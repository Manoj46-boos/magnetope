import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  RingGeometry,
  AdditiveBlending,
  type Object3D,
} from 'three';
import type { Accessory, SkinLook } from '@/config/cosmetics';
import { SecondOrder, SecondOrder2, frequencyForLag, noise1 } from '@/core/dynamics';
import { angleDelta, clamp, damp, DEG, hypot2, lerp, type Vec2 } from '@/core/mathx';
import type { MagnoView } from '@/sim/magno';
import { fxTheme } from './palette';

export interface RigSkin {
  body: Color;
  ring: Color;
  socket: Color;
  tip: Color;
  accessory?: Accessory;
}

/** Cosmetic colours are authored as sRGB hex, so they are converted into the renderer's working space here. */
export const skinFromLook = (look: SkinLook): RigSkin => ({
  body: new Color(look.body),
  ring: new Color(look.ring),
  socket: new Color(look.socket),
  tip: new Color(look.tip),
  accessory: look.accessory,
});

export const CLASSIC_SKIN: RigSkin = {
  body: new Color().setHSL(0.58, 0.14, 0.58),
  ring: new Color().setHSL(0.0, 0.0, 0.88),
  socket: new Color().setHSL(0.62, 0.3, 0.1),
  tip: new Color().setHSL(0.99, 0.78, 0.5),
};

interface Pulse {
  axis: number;
  peak: number;
  hold: number;
  recover: number;
  age: number;
}

/** PRD 7.2: scale to 85% along the contact normal, held 90 ms, with a 140 ms elastic recovery. */
const ATTACH_SQUASH = 0.85;

const ARM_UPPER = 0.15;
const ARM_LOWER = 0.15;
const SHOULDER_X = 0.2;
const SHOULDER_Y = 0.07;
const BODY_Z = 0.0;
/** PRD 7.4: hand targets trail the body by 80 ms, the head by 30 ms. */
const HAND_LAG_S = 0.08;
const HEAD_LAG_S = 0.03;
const HAND_DAMPING = 0.55;
const HEAD_DAMPING = 0.6;

/** Pose envelope: full effect through `hold`, then an elastic recovery with slight overshoot. */
function envelope(p: Pulse): number {
  if (p.age < p.hold) return Math.min(1, p.age / Math.max(0.012, p.hold * 0.25));
  const u = (p.age - p.hold) / p.recover;
  if (u >= 1) return 0;
  return (1 - u) * Math.cos(u * Math.PI * 0.9) * (1 - u * 0.15);
}

class Arm {
  readonly upper: Mesh;
  readonly lower: Mesh;
  readonly hand: Mesh;
  readonly target = new SecondOrder2(frequencyForLag(HAND_LAG_S, HAND_DAMPING), HAND_DAMPING, 0);

  constructor(
    readonly side: -1 | 1,
    parent: Object3D,
    material: MeshStandardMaterial,
    handMaterial: MeshStandardMaterial,
  ) {
    const segment = new CylinderGeometry(0.036, 0.03, 1, 5);
    segment.translate(0, 0.5, 0);
    this.upper = new Mesh(segment, material);
    this.lower = new Mesh(segment, material);
    this.hand = new Mesh(new SphereGeometry(0.058, 6, 5), handMaterial);
    parent.add(this.upper, this.lower, this.hand);
    this.target.snap(side * 0.3, -0.12);
  }

  /** Closed-form two-bone IK in the body plane. Positions are body-local. */
  solve(tx: number, ty: number): void {
    const sx = this.side * SHOULDER_X;
    const sy = SHOULDER_Y;
    let dx = tx - sx;
    let dy = ty - sy;
    let dist = hypot2(dx, dy);
    const reach = ARM_UPPER + ARM_LOWER - 0.002;
    if (dist > reach) {
      dx *= reach / dist;
      dy *= reach / dist;
      dist = reach;
    }
    dist = Math.max(dist, 0.05);
    const base = Math.atan2(dy, dx);
    const cosElbow = clamp((ARM_UPPER * ARM_UPPER + dist * dist - ARM_LOWER * ARM_LOWER) / (2 * ARM_UPPER * dist), -1, 1);
    const shoulderAngle = base + Math.acos(cosElbow) * -this.side;
    const ex = sx + Math.cos(shoulderAngle) * ARM_UPPER;
    const ey = sy + Math.sin(shoulderAngle) * ARM_UPPER;
    const hx = sx + dx;
    const hy = sy + dy;

    this.upper.position.set(sx, sy, BODY_Z + 0.02);
    this.upper.rotation.set(0, 0, Math.atan2(ey - sy, ex - sx) - Math.PI / 2);
    this.upper.scale.set(1, ARM_UPPER, 1);
    this.lower.position.set(ex, ey, BODY_Z + 0.02);
    this.lower.rotation.set(0, 0, Math.atan2(hy - ey, hx - ex) - Math.PI / 2);
    this.lower.scale.set(1, ARM_LOWER, 1);
    this.hand.position.set(hx, hy, BODY_Z + 0.02);
  }
}

/**
 * MAGNO's visual rig. The physics body supplies motion; everything here is
 * reaction and personality: squash and stretch, lagging IK arms, a leading
 * head, and an eye that carries the entire expression system.
 */
export class MagnoRig {
  readonly root = new Group();
  private readonly deform = new Group();
  private readonly inner = new Group();
  private readonly headPivot = new Group();
  private readonly eyeGroup = new Group();
  private readonly pupil: Mesh;
  private readonly lid: Mesh;
  private readonly glow: Mesh;
  private readonly arcs: Mesh[] = [];
  private readonly arcMaterials: MeshBasicMaterial[] = [];
  private readonly arms: [Arm, Arm];
  private readonly bodyMaterial: MeshStandardMaterial;
  private readonly ringMaterial: MeshStandardMaterial;
  private readonly tipMaterial: MeshStandardMaterial;
  private readonly socketMaterial: MeshStandardMaterial;
  private readonly glowMaterial: MeshBasicMaterial;
  private readonly coreLight: Mesh;
  private readonly accessories: Record<Accessory, Group>;
  private chargeMeter = true;

  private pulse: Pulse | null = null;
  private visualAngle = 0;
  private angleReady = false;
  private headLag = new SecondOrder(frequencyForLag(HEAD_LAG_S, HEAD_DAMPING), HEAD_DAMPING, 0);
  private gaze = new SecondOrder2(5, 0.7, 0, 0, 0);
  private lidOpen = new SecondOrder(7, 0.8, 0, 1);
  private eyeScale = new SecondOrder(7, 0.7, 0, 1);
  private time = 0;
  private clearAt = -10;
  private fallStretch = 1;
  private brace = 0;
  private grab: Vec2 | null = null;
  private readonly grabAt: Vec2 = { x: 0, y: 0 };
  private readonly offset: Vec2 = { x: 0, y: 0 };
  /** Scratch for the per-frame rotations, so the update loop allocates nothing. */
  private readonly local: Vec2 = { x: 0, y: 0 };
  private joy = 0;

  constructor(skin: RigSkin = CLASSIC_SKIN) {
    this.bodyMaterial = new MeshStandardMaterial({ color: skin.body, flatShading: true, roughness: 0.55, metalness: 0.45 });
    this.ringMaterial = new MeshStandardMaterial({ color: skin.ring, flatShading: true, roughness: 0.25, metalness: 0.85 });
    this.tipMaterial = new MeshStandardMaterial({ color: skin.tip, flatShading: true, roughness: 0.4, metalness: 0.6 });
    this.socketMaterial = new MeshStandardMaterial({ color: skin.socket, flatShading: true, roughness: 0.9 });
    const white = new MeshStandardMaterial({ color: 0xf6f4ee, flatShading: true, roughness: 0.35 });
    const black = new MeshStandardMaterial({ color: 0x0c1118, flatShading: true, roughness: 0.4 });
    const handMaterial = new MeshStandardMaterial({ color: skin.ring, flatShading: true, roughness: 0.3, metalness: 0.7 });

    this.root.add(this.deform);
    this.deform.add(this.inner);

    const body = new Mesh(new SphereGeometry(0.225, 9, 7), this.bodyMaterial);
    body.scale.set(1, 1.28, 0.95);
    this.inner.add(body);
    const belt = new Mesh(new TorusGeometry(0.2, 0.026, 4, 10), this.ringMaterial);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = -0.06;
    belt.scale.set(1.05, 1.05, 1.05);
    this.inner.add(belt);
    const coreSocket = new Mesh(new CylinderGeometry(0.06, 0.06, 0.03, 8), this.socketMaterial);
    coreSocket.rotation.x = Math.PI / 2;
    coreSocket.position.set(0, -0.12, 0.2);
    this.inner.add(coreSocket);
    this.coreLight = new Mesh(
      new SphereGeometry(0.058, 8, 6),
      new MeshBasicMaterial({ color: new Color().setHSL(0.5, 0.95, 0.72), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false }),
    );
    this.coreLight.position.set(0, -0.12, 0.215);
    this.coreLight.visible = false;
    this.inner.add(this.coreLight);

    // Eye: single large eye in a dark socket.
    const socket = new Mesh(new SphereGeometry(0.115, 8, 6), this.socketMaterial);
    socket.scale.set(1, 1, 0.55);
    socket.position.set(0, 0.1, 0.17);
    this.inner.add(socket);
    this.eyeGroup.position.set(0, 0.1, 0.215);
    const eye = new Mesh(new SphereGeometry(0.085, 8, 6), white);
    eye.scale.set(1, 1, 0.5);
    this.eyeGroup.add(eye);
    this.pupil = new Mesh(new SphereGeometry(0.042, 6, 5), black);
    this.pupil.position.z = 0.032;
    this.eyeGroup.add(this.pupil);
    this.lid = new Mesh(new SphereGeometry(0.092, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), this.bodyMaterial);
    this.lid.scale.set(1, 1, 0.56);
    this.lid.rotation.x = -Math.PI / 2 + 0.2;
    this.eyeGroup.add(this.lid);
    this.inner.add(this.eyeGroup);

    // Horseshoe magnet head, tilted a permanent 8 degrees.
    this.headPivot.position.set(0, 0.34, 0);
    this.headPivot.rotation.z = -8 * DEG;
    const arch = new Mesh(new TorusGeometry(0.15, 0.058, 5, 12, Math.PI), this.ringMaterial);
    arch.position.y = 0.02;
    this.headPivot.add(arch);
    for (const side of [-1, 1]) {
      const leg = new Mesh(new BoxGeometry(0.116, 0.16, 0.116), this.ringMaterial);
      leg.position.set(side * 0.15, -0.055, 0);
      this.headPivot.add(leg);
      const tip = new Mesh(new BoxGeometry(0.122, 0.07, 0.122), this.tipMaterial);
      tip.position.set(side * 0.15, -0.13, 0);
      this.headPivot.add(tip);
    }
    this.inner.add(this.headPivot);
    this.accessories = this.buildAccessories();
    this.applySkin(skin);

    this.arms = [new Arm(-1, this.inner, this.bodyMaterial, handMaterial), new Arm(1, this.inner, this.bodyMaterial, handMaterial)];

    this.glowMaterial = new MeshBasicMaterial({
      color: fxTheme.attract,
      transparent: true,
      opacity: 0.0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    this.glow = new Mesh(new RingGeometry(0.2, 0.34, 20), this.glowMaterial);
    this.glow.position.set(0, 0.36, 0.06);
    this.inner.add(this.glow);

    for (let i = 0; i < 3; i++) {
      const material = new MeshBasicMaterial({
        color: fxTheme.repel,
        transparent: true,
        opacity: 0.12,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      });
      const start = 90 * DEG + 14 * DEG - i * 56 * DEG;
      const arc = new Mesh(new RingGeometry(0.56, 0.63, 10, 1, start - 46 * DEG, 46 * DEG), material);
      arc.position.z = 0.1;
      this.root.add(arc);
      this.arcs.push(arc);
      this.arcMaterials.push(material);
    }
  }

  /** Small clip-on props; none of them changes the silhouette enough to hurt readability. */
  private buildAccessories(): Record<Accessory, Group> {
    const antenna = new Group();
    const stalk = new Mesh(new CylinderGeometry(0.011, 0.011, 0.17, 4), this.ringMaterial);
    stalk.position.y = 0.085;
    const bulb = new Mesh(new SphereGeometry(0.03, 5, 3), this.tipMaterial);
    bulb.position.y = 0.19;
    antenna.add(stalk, bulb);
    antenna.position.set(0, 0.23, 0);
    this.headPivot.add(antenna);

    const flag = new Group();
    const pole = new Mesh(new CylinderGeometry(0.009, 0.009, 0.34, 4), this.ringMaterial);
    pole.position.y = 0.17;
    const cloth = new Mesh(new ConeGeometry(0.06, 0.13, 3), this.tipMaterial);
    cloth.rotation.z = -Math.PI / 2;
    cloth.position.set(0.065, 0.3, 0);
    flag.add(pole, cloth);
    flag.position.set(-0.13, 0.02, -0.15);
    this.inner.add(flag);

    const sticker = new Group();
    const star = new Mesh(new CircleGeometry(0.058, 5), this.tipMaterial);
    star.rotation.z = 0.35;
    sticker.add(star);
    sticker.position.set(-0.1, -0.13, 0.178);
    this.inner.add(sticker);

    return { antenna, flag, sticker };
  }

  applySkin(skin: RigSkin): void {
    this.bodyMaterial.color.copy(skin.body);
    this.ringMaterial.color.copy(skin.ring);
    this.tipMaterial.color.copy(skin.tip);
    this.socketMaterial.color.copy(skin.socket);
    for (const [name, group] of Object.entries(this.accessories)) group.visible = name === skin.accessory;
  }

  /** The charge arcs stay hidden until the player has had a reason to learn them (PRD 12.1). */
  setChargeMeterVisible(visible: boolean): void {
    this.chargeMeter = visible;
  }

  // ------------------------------------------------------------------- events

  onAttach(normal: Vec2): void {
    const axis = Math.atan2(-normal.x, normal.y);
    this.pulse = { axis, peak: ATTACH_SQUASH, hold: 0.09, recover: 0.14, age: 0 };
  }

  onRepel(direction: Vec2, power01: number): void {
    const axis = Math.atan2(-direction.x, direction.y);
    this.pulse = { axis, peak: lerp(1.18, 1.24, power01), hold: 0.04, recover: 0.2, age: 0 };
  }

  onImpact(normal: Vec2, speed: number): void {
    if (speed < 4) return;
    const axis = Math.atan2(-normal.x, normal.y);
    const peak = lerp(0.9, 0.72, clamp((speed - 4) / 12, 0, 1));
    this.pulse = { axis, peak, hold: 0.07, recover: 0.2, age: 0 };
  }

  onClear(): void {
    this.clearAt = this.time;
  }

  /** Light from the power core once it sits in the chest socket, 0 to 1. */
  setCoreLight(amount: number): void {
    const material = this.coreLight.material as MeshBasicMaterial;
    material.opacity = clamp(amount, 0, 1);
    this.coreLight.visible = amount > 0.001;
    this.coreLight.scale.setScalar(0.8 + 0.7 * clamp(amount, 0, 1));
  }

  get coreLightVisible(): boolean {
    return this.coreLight.visible;
  }

  /** Arms overhead and a held smile, for the ending. */
  setJoy(amount: number): void {
    this.joy = amount;
    if (amount > 0) this.clearAt = this.time;
  }

  setBrace(amount: number): void {
    this.brace = amount;
  }

  /** World point of a steel face the hands should reach for, or null. */
  setGrab(point: Vec2 | null): void {
    if (point) {
      this.grabAt.x = point.x;
      this.grabAt.y = point.y;
    }
    this.grab = point ? this.grabAt : null;
  }

  /** Body-local position of a hand. */
  handLocal(side: -1 | 1, out: Vec2): Vec2 {
    const p = this.arms[side < 0 ? 0 : 1].hand.position;
    out.x = p.x;
    out.y = p.y;
    return out;
  }

  // ------------------------------------------------------------------- update

  update(view: MagnoView, position: Vec2, dt: number, reducedMotion: boolean): void {
    this.time += dt;
    const t = this.time;

    this.followAngle(view, dt);
    this.root.position.set(position.x + this.offset.x, position.y + this.offset.y, 0);
    this.inner.rotation.z = this.visualAngle - this.deform.rotation.z;

    this.applyDeformation(view, dt, reducedMotion);
    this.animateHead(view, dt);
    this.animateEye(view, dt, t);
    this.animateArms(view, dt, t);
    this.animateAura(view, t);
  }

  private followAngle(view: MagnoView, dt: number): void {
    const target = view.visualAngle;
    if (!this.angleReady) {
      this.visualAngle = target;
      this.angleReady = true;
    } else if (view.limp || view.state === 'recovering') {
      this.visualAngle = target;
    } else {
      this.visualAngle += angleDelta(this.visualAngle, target) * (1 - Math.exp(-(view.attachNormal ? 22 : 12) * dt));
    }
    // While stuck, the physical capsule sits flush; stand the model on the surface instead.
    if (view.attachNormal) {
      const lift = 0.075;
      this.offset.x = view.attachNormal.x * lift;
      this.offset.y = view.attachNormal.y * lift;
    } else {
      this.offset.x = 0;
      this.offset.y = 0;
    }
  }

  private applyDeformation(view: MagnoView, dt: number, reducedMotion: boolean): void {
    let scaleAlong = 1;
    let axis = 0;
    if (this.pulse) {
      this.pulse.age += dt;
      const e = envelope(this.pulse);
      scaleAlong = 1 + (this.pulse.peak - 1) * e * (reducedMotion ? 0.5 : 1);
      axis = this.pulse.axis;
      if (this.pulse.age > this.pulse.hold + this.pulse.recover) this.pulse = null;
    }

    const speedDown = -view.velocity.y;
    const wantStretch = !view.attachNormal && !view.limp && speedDown > 9 ? 1.08 : 1;
    this.fallStretch = damp(this.fallStretch, wantStretch, 8, dt);
    if (this.fallStretch > 1.002 && !this.pulse) {
      scaleAlong = this.fallStretch;
      axis = view.visualAngle;
    }

    const perpendicular = 1 / Math.sqrt(scaleAlong);
    this.deform.rotation.z = axis;
    this.deform.scale.set(perpendicular, scaleAlong, perpendicular);

    // The magnet head works against the body so total volume reads as preserved.
    const counter = 1 + (1 - scaleAlong) * 0.55;
    this.headPivot.scale.set(1 / Math.sqrt(counter), counter, 1);
  }

  private animateHead(view: MagnoView, dt: number): void {
    const lean = clamp(view.velocity.x * -0.012, -0.22, 0.22);
    const bias = view.snapEngaged || view.snapArmed ? 0.08 : 0;
    this.headLag.update(lean + bias, dt);
    this.headPivot.rotation.z = -8 * DEG + this.headLag.value;
  }

  private animateEye(view: MagnoView, dt: number, t: number): void {
    let lid = 1;
    let size = 1;
    if (view.state === 'charging') {
      lid = 0.62;
      size = 0.92;
    } else if (view.limp) {
      lid = 0.15;
    } else if (!view.attachNormal && view.velocity.y < -8) {
      size = 1.22;
      lid = 1;
    } else if (t - this.clearAt < 2.4) {
      lid = 0.55;
    }
    if (view.state === 'recovering') lid = 0.8 + 0.2 * view.recoverPhase;

    this.lidOpen.update(lid, dt);
    this.eyeScale.update(size, dt);
    this.eyeGroup.scale.set(this.eyeScale.value, this.eyeScale.value * (0.45 + 0.55 * this.lidOpen.value), 1);
    this.lid.visible = this.lidOpen.value < 0.97;
    this.lid.position.y = 0.09 * (this.lidOpen.value - 1) * -1;

    const towardX = view.snapTarget ? view.snapTarget.x - view.position.x : view.velocity.x;
    const towardY = view.snapTarget ? view.snapTarget.y - view.position.y : view.velocity.y;
    const len = hypot2(towardX, towardY) || 1;
    const local = rotateInto(this.local, towardX / len, towardY / len, -this.visualAngle);
    const amount = view.snapTarget ? 0.034 : 0.026 * clamp(len / 6, 0, 1);
    this.gaze.update(local.x * amount, local.y * amount, dt);
    this.pupil.position.set(this.gaze.x.value, this.gaze.y.value, 0.032);
    this.pupil.scale.setScalar(view.limp ? 0.6 + 0.4 * Math.sin(t * 18) : 1);
  }

  private animateArms(view: MagnoView, dt: number, t: number): void {
    const speed = hypot2(view.velocity.x, view.velocity.y);

    for (const arm of this.arms) {
      const side = arm.side;
      let tx: number;
      let ty: number;

      if (view.limp) {
        // Pure ragdoll: arms hang with gravity and flop with the tumble.
        const hang = rotateInto(this.local, 0, -1, -this.visualAngle);
        tx = side * 0.2 + hang.x * 0.26 + Math.sin(t * 9 + side) * 0.05;
        ty = SHOULDER_Y + hang.y * 0.26;
      } else if (this.joy > 0.5) {
        tx = side * (0.2 + 0.04 * Math.sin(t * 5 + side));
        ty = SHOULDER_Y + 0.27 + 0.03 * Math.sin(t * 6 + side * 2);
      } else if (view.state === 'recovering') {
        const push = Math.sin(clamp(view.recoverPhase, 0, 1) * Math.PI * 2);
        tx = side * (0.3 + 0.05 * push);
        ty = -0.2 - 0.12 * Math.max(0, push);
      } else if (view.attachNormal) {
        const n = rotateInto(this.local, view.attachNormal.x, view.attachNormal.y, -this.visualAngle);
        // Hands reach into the surface that holds MAGNO.
        tx = side * 0.16 - n.x * 0.12;
        ty = SHOULDER_Y - n.y * 0.2 + (view.state === 'charging' ? 0.04 * Math.sin(t * 40) * view.charge01 : 0);
      } else if (view.snapEngaged && view.snapTarget) {
        const dir = rotateInto(this.local, view.snapTarget.x - view.position.x, view.snapTarget.y - view.position.y, -this.visualAngle);
        const l = hypot2(dir.x, dir.y) || 1;
        tx = side * 0.1 + (dir.x / l) * 0.3;
        ty = SHOULDER_Y + (dir.y / l) * 0.3;
      } else if (this.grab) {
        const dir = rotateInto(this.local, this.grab.x - view.position.x, this.grab.y - view.position.y, -this.visualAngle);
        const l = hypot2(dir.x, dir.y) || 1;
        tx = side * 0.1 + (dir.x / l) * 0.3;
        ty = SHOULDER_Y + (dir.y / l) * 0.3;
      } else if (this.brace > 0.02) {
        tx = side * 0.14;
        ty = SHOULDER_Y + 0.24 * this.brace;
      } else if (view.dropMeters > 7 && view.velocity.y < -8) {
        // Windmilling in a long fall.
        const phase = t * 11 + (side > 0 ? 0 : Math.PI);
        tx = side * 0.1 + Math.cos(phase) * 0.28;
        ty = SHOULDER_Y + Math.sin(phase) * 0.28;
      } else {
        const amp = 0.04 + 0.1 * clamp(speed / 12, 0, 1);
        tx = side * 0.3 + noise1(t, side * 3) * amp;
        ty = -0.06 + noise1(t, side * 7 + 1) * amp - 0.05 * clamp(-view.velocity.y / 10, 0, 1);
        // Arms trail the direction of travel.
        const trail = rotateInto(this.local, -view.velocity.x, -view.velocity.y, -this.visualAngle);
        tx += clamp(trail.x * 0.012, -0.1, 0.1);
        ty += clamp(trail.y * 0.012, -0.1, 0.1);
      }

      arm.target.update(tx, ty, dt);
      arm.solve(arm.target.x.value, arm.target.y.value);
    }
  }

  private animateAura(view: MagnoView, t: number): void {
    const polar = view.polarity === 'repel' ? fxTheme.repel : fxTheme.attract;
    this.glowMaterial.blending = fxTheme.blending;
    const intensity = view.state === 'charging' ? 0.3 + view.charge01 * 0.6 : view.snapEngaged ? 0.7 : 0.18;
    this.glowMaterial.color.copy(polar);
    this.glowMaterial.opacity = intensity * (0.85 + 0.15 * Math.sin(t * 9));
    this.glow.scale.setScalar(1 + (view.state === 'charging' ? view.charge01 * 0.55 : 0));

    const level = view.state === 'charging' ? view.chargeLevel : 0;
    for (let i = 0; i < 3; i++) {
      const lit = level > i;
      const material = this.arcMaterials[i]!;
      const full = level === 3 && lit;
      material.opacity = lit ? (full ? 0.85 + 0.15 * Math.sin(t * 28) : 0.8) : view.state === 'charging' ? 0.14 : 0;
      material.blending = fxTheme.blending;
      material.color.copy(lit ? (level === 3 ? fxTheme.repelCore : fxTheme.repel) : fxTheme.repel);
      this.arcs[i]!.visible = view.state === 'charging' && this.chargeMeter;
    }
    // Arcs stay upright in screen space regardless of how the body is oriented.
    for (const arc of this.arcs) arc.rotation.z = 0;
  }

  /** Head world position, used by the field-line system. Pass `out` to reuse an object every frame. */
  headWorld(out: Vec2 = { x: 0, y: 0 }): Vec2 {
    const local = rotateInto(this.local, 0, 0.36, this.visualAngle);
    out.x = this.root.position.x + local.x;
    out.y = this.root.position.y + local.y;
    return out;
  }

  /** Where the power core seats, in world space. */
  chestWorld(out: Vec2 = { x: 0, y: 0 }): Vec2 {
    const local = rotateInto(this.local, 0, -0.12, this.visualAngle);
    out.x = this.root.position.x + local.x;
    out.y = this.root.position.y + local.y;
    return out;
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
      }
    });
  }
}

function rotateInto(out: Vec2, x: number, y: number, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out.x = x * c - y * s;
  out.y = x * s + y * c;
  return out;
}
