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
import { TUNING } from '@/config/tuning';
import { SecondOrder, SecondOrder2, frequencyForLag, noise1 } from '@/core/dynamics';
import { angleDelta, clamp, damp, DEG, hypot2, lerp, type Vec2 } from '@/core/mathx';
import type { MagnoView } from '@/sim/magno';
import { POLE_NORTH, POLE_SOUTH, fxTheme } from './palette';

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

/** R-GF-02: the coil before a launch — squash along the body axis, grown with the charge so it is already reading about 120 ms before a full release lets go. */
const COIL_SQUASH = 0.12;
/** R-GF-02: the post-catch wobble — a damped sway along the contact axis, spent inside three cycles. */
const WOBBLE_HZ = 8.5;
const WOBBLE_DECAY = 8;
const WOBBLE_AMPLITUDE = 0.035;
/** R-GF-05: at full charge the whole rig trembles on the edge of letting go. */
const SHIVER_METERS = 0.009;
/** R-GF-05: a meter segment punches in for this long when its threshold is crossed. */
const SEGMENT_PULSE_S = 0.15;
const SEGMENT_PULSE_SCALE = 0.22;

/** The idle ladder's attention hop: a small parabolic lift, never a simulation move. */
const HOP_MS = 520;
const HOP_HEIGHT = 0.42;

/** The settled breath: a little over two seconds a cycle, on the body's own scale. */
const BREATH_HZ = 0.45;
const BREATH_SCALE = 0.012;
/** R-CH-02: the character beat's look-around — the head sweeps this far either side of rest. */
const LOOK_SWEEP_DEG = 12;
const LOOK_SWEEP_MS = 1400;
/** R-CH-03: the fall deep enough to read as panic — the same bar the arms' windmill answers. */
const PANIC_DROP_M = 7;
/** The staged card's panic grade (rebuild PRD 1.4.2): the eye grows until it clears the 12-pixel law at 128 px on the primary card's framing. */
const CARD_EYE_SCALE = 2.3;
/** The card's pupil share: small on the wide white — the concept card's own law, a pupil half the eye reads as a camera lens, a quarter reads as panic. */
const CARD_PUPIL_SCALE = 0.5;
/** The card's gaze rides further than gameplay dares, so the look toward the destination survives the downscale. */
const CARD_GAZE = 0.065;
/** The card's windmill frozen mid-cycle, so a still reads as motion. */
const CARD_WINDMILL_PHASE = 1.15;
/** The relief face: a catch inside this window of the panic earns it, held this long. */
const RELIEF_CATCH_S = 1.2;
const RELIEF_HOLD_S = 0.9;
/** The failing surface under him earns a squint this tight, held this long. */
const WARY_SQUINT = 0.85;
const WARY_HOLD_S = 2.5;

const ARM_UPPER = 0.15;
const ARM_LOWER = 0.15;
const SHOULDER_X = 0.2;
const SHOULDER_Y = 0.07;
const BODY_Z = 0.0;
/** PRD 7.4 / R-CH-05: hand targets trail the body by the tuned lag, the head by its own. */
const HAND_LAG_S = TUNING.character.handLagMs / 1000;
const HEAD_LAG_S = TUNING.character.headLagMs / 1000;
const HAND_DAMPING = 0.55;
const HEAD_DAMPING = 0.6;
/** The blink pulse: the lid dips and returns inside its tuned window. */
const BLINK_MS = TUNING.character.blinkMs;

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
 * R-CH-03/04: the eye's whole vocabulary — one name per emotion the rig can
 * perform. The emotion table and its doc are generated from this union, and a
 * face the rig cannot show fails the compile there before any test runs.
 */
export type EyeState =
  | 'idle'
  | 'curious'
  | 'focused'
  | 'whee'
  | 'panic'
  | 'wince'
  | 'dazed'
  | 'relief'
  | 'pride'
  | 'weary'
  | 'wary'
  | 'home';

/** The idle performance's one voice moment, collected by the renderer once per beat. */
export type CharacterBeat = 'curious';

/**
 * Held so the doc suite can prove the emotion table covers every face the rig
 * can perform. The Record satisfies the union both ways, so a face the rig
 * gains or drops fails the compile here.
 */
const EYES = {
  idle: 1,
  curious: 1,
  focused: 1,
  whee: 1,
  panic: 1,
  wince: 1,
  dazed: 1,
  relief: 1,
  pride: 1,
  weary: 1,
  wary: 1,
  home: 1,
} as const satisfies Record<EyeState, number>;

/** Every face the rig can perform, for the doc suite's coverage law. */
export const EYE_STATES: readonly EyeState[] = Object.keys(EYES) as readonly EyeState[];

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
  private readonly daze: Group;
  private readonly gleam: Group;
  private readonly mouth: Mesh;
  private readonly mouthRing: Mesh;
  private readonly spark: Mesh;
  private readonly socketMesh: Mesh;
  private readonly glow: Mesh;
  private readonly arcs: Mesh[] = [];
  private readonly arcMaterials: MeshBasicMaterial[] = [];
  private readonly arms: [Arm, Arm];
  private readonly bodyMaterial: MeshStandardMaterial;
  private readonly ringMaterial: MeshStandardMaterial;
  private readonly tipMaterial: MeshStandardMaterial;
  private readonly northMaterial: MeshStandardMaterial;
  private readonly southMaterial: MeshStandardMaterial;
  private readonly socketMaterial: MeshStandardMaterial;
  private readonly glowMaterial: MeshBasicMaterial;
  private readonly coreLight: Mesh;
  private readonly accessories: Record<Accessory, Group>;
  private chargeMeter = true;

  private pulse: Pulse | null = null;
  private visualAngle = 0;
  private angleReady = false;
  private wobbleAge = -1;
  private wobbleAxis = 0;
  private prevChargeLevel = 0;
  private readonly segmentPulse = new Float64Array(3);
  private headLag = new SecondOrder(frequencyForLag(HEAD_LAG_S, HEAD_DAMPING), HEAD_DAMPING, 0);
  private gaze = new SecondOrder2(5, 0.7, 0, 0, 0);
  /** The in-flight gaze: quick enough to beat the head's 30 ms lag, so the eye leads the line of action (R-GF-02). */
  private readonly gazeQuick = new SecondOrder2(14, 0.8, 0, 0, 0);
  private gazeIntent = false;
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
  private hopMs = -1;
  private blinkMs = -1;

  /** R-CH-02: the idle performance's clock — settled time, the next blink and the next beat. */
  private idleMs = 0;
  private nextBlinkAt = 0;
  private nextBeatAt = 0;
  private beatAge = -1;
  private spinLeft = 0;
  private spinAngle = 0;
  /** R-EC-05: with a complete set equipped, the character beat's turn doubles into the set's own flourish. */
  private fullSet = false;
  private spinDuration = HOP_MS / 1000;
  private spinTurns = 1;
  private pendingBeat: CharacterBeat | null = null;
  private curiosity: Vec2 | null = null;
  private readonly curiosityAt: Vec2 = { x: 0, y: 0 };
  private glanceUntil = -1;
  private waryUntil = -1;
  private readonly waryAt: Vec2 = { x: 0, y: 0 };
  private winceLeft = 0;
  private reliefUntil = -1;
  private lastPanicAt = -10;
  private prevLimp = false;
  private dazed = false;
  private settled = false;
  private cardFace: 'panic' | null = null;
  private breathWeight = 0;
  private breathPhase = 0;
  private idleRolls = 0;
  private eye: EyeState = 'idle';

  constructor(skin: RigSkin = CLASSIC_SKIN) {
    this.bodyMaterial = new MeshStandardMaterial({ color: skin.body, flatShading: true, roughness: 0.55, metalness: 0.45 });
    // Rim light on the body so MAGNO separates from the background even when
    // the directional sun has him in shadow. The rim is a warm white that
    // appears at grazing angles (where the view direction is perpendicular to
    // the surface normal), giving him a lit edge against any biome.
    applyMagnoRim(this.bodyMaterial);
    this.ringMaterial = new MeshStandardMaterial({ color: skin.ring, flatShading: true, roughness: 0.25, metalness: 0.85 });
    applyMagnoRim(this.ringMaterial);
    this.tipMaterial = new MeshStandardMaterial({ color: skin.tip, flatShading: true, roughness: 0.4, metalness: 0.6 });
    // The pole materials carry a moderate emissive lift so the magnet signature
    // colours survive bloom and tone mapping without going flat. Intensity is
    // kept under 0.6 so the red and blue stay saturated rather than blowing out
    // to white, which would break the silhouette read.
    this.northMaterial = new MeshStandardMaterial({ color: POLE_NORTH, flatShading: true, roughness: 0.3, metalness: 0.4, emissive: POLE_NORTH, emissiveIntensity: 0.55 });
    this.southMaterial = new MeshStandardMaterial({ color: POLE_SOUTH, flatShading: true, roughness: 0.3, metalness: 0.4, emissive: POLE_SOUTH, emissiveIntensity: 0.55 });
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

    // Eye: a single large eye in a dark socket, sized to read MAGNO's
    // personality at gameplay distance (Carter Goodrich: the eye carries it).
    this.socketMesh = new Mesh(new SphereGeometry(0.135, 9, 6), this.socketMaterial);
    this.socketMesh.scale.set(1, 1, 0.55);
    this.socketMesh.position.set(0, 0.1, 0.17);
    this.inner.add(this.socketMesh);
    this.eyeGroup.position.set(0, 0.1, 0.22);
    const eye = new Mesh(new SphereGeometry(0.105, 8, 6), white);
    eye.scale.set(1, 1, 0.5);
    this.eyeGroup.add(eye);
    this.pupil = new Mesh(new SphereGeometry(0.052, 6, 5), black);
    this.pupil.position.z = 0.038;
    this.eyeGroup.add(this.pupil);
    this.lid = new Mesh(new SphereGeometry(0.112, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), this.bodyMaterial);
    this.lid.scale.set(1, 1, 0.56);
    this.lid.rotation.x = -Math.PI / 2 + 0.2;
    this.eyeGroup.add(this.lid);

    // R-CH-03: the comic daze — a crossed X where the pupil sits, never gory,
    // swapped in only after a fall deep enough that the bonk earned it.
    this.daze = new Group();
    for (const tilt of [-Math.PI / 4, Math.PI / 4]) {
      const bar = new Mesh(new BoxGeometry(0.098, 0.017, 0.016), black);
      bar.rotation.z = tilt;
      this.daze.add(bar);
    }
    this.daze.position.z = 0.042;
    this.daze.visible = false;
    this.eyeGroup.add(this.daze);

    // R-CH-03: the clear gleam — a four-point sparkle riding the eye's upper
    // corner for the pride window, the one flourish the clear card gets.
    this.gleam = new Group();
    const gleamMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, fog: false });
    for (const tilt of [0, Math.PI / 2]) {
      const ray = new Mesh(new BoxGeometry(0.075, 0.011, 0.006), gleamMaterial);
      ray.rotation.z = tilt;
      this.gleam.add(ray);
    }
    this.gleam.position.set(0.048, 0.052, 0.05);
    this.gleam.visible = false;
    this.eyeGroup.add(this.gleam);
    // The staged card's panic mouth (rebuild PRD 1.4.2): a dark agape O on a
    // bright disc, riding the eye group so it grows with it — the same
    // two-shape read the eye itself uses, because a dark O on the body's own
    // shadow side reads as nothing at card scale. Gameplay MAGNO has no mouth;
    // this shows only while a card face is set, and nothing in the simulation
    // or the gameplay loop can set one.
    this.mouthRing = new Mesh(new CircleGeometry(0.112, 12), white);
    this.mouthRing.position.set(0, -0.128, 0.055);
    this.mouthRing.visible = false;
    this.eyeGroup.add(this.mouthRing);
    this.mouth = new Mesh(new CircleGeometry(0.082, 10), black);
    this.mouth.position.set(0, -0.128, 0.058);
    this.mouth.visible = false;
    this.eyeGroup.add(this.mouth);
    // The wet gleam's smallest unit: one bright dot at ten o'clock, the
    // specular that keeps an oversized eye alive at card scale.
    this.spark = new Mesh(new SphereGeometry(0.016, 6, 4), gleamMaterial);
    this.spark.position.set(-0.062, 0.058, 0.075);
    this.spark.visible = false;
    this.eyeGroup.add(this.spark);
    this.inner.add(this.eyeGroup);

    // Horseshoe magnet head. The arch and legs stay as the steel-coloured body
    // of the magnet; each pole tip is its own mesh, with a saturated red (north)
    // or blue (south) material and a 15° outward flare. The flare is what makes
    // the silhouette read as a magnet rather than a padlock shackle: real
    // horseshoe magnets have flared pole pieces, real padlock shackles do not.
    this.headPivot.position.set(0, 0.34, 0);
    this.headPivot.rotation.z = -8 * DEG;
    const arch = new Mesh(new TorusGeometry(0.15, 0.058, 5, 10, Math.PI), this.ringMaterial);
    arch.position.y = 0.02;
    this.headPivot.add(arch);
    const POLE_FLARE = 18 * DEG;
    for (const side of [-1, 1] as const) {
      const leg = new Mesh(new BoxGeometry(0.12, 0.14, 0.12), this.ringMaterial);
      leg.position.set(side * 0.15, -0.055, 0);
      this.headPivot.add(leg);
      const polePivot = new Group();
      polePivot.position.set(side * 0.15, -0.1, 0);
      polePivot.rotation.z = side * POLE_FLARE;
      // Tip and cap are merged into a single tapered box so the pole piece reads
      // as one solid flared block at distance, without doubling the triangle count.
      const tip = new Mesh(new BoxGeometry(0.17, 0.13, 0.17), side < 0 ? this.northMaterial : this.southMaterial);
      tip.position.y = -0.07;
      polePivot.add(tip);
      this.headPivot.add(polePivot);
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
    this.wobbleAge = 0;
    this.wobbleAxis = axis;
    // R-CH-03: a catch inside the panic's echo reads as relief — the wide-open,
    // soft face the save earns before the settled face takes back over.
    if (this.time - this.lastPanicAt < RELIEF_CATCH_S) this.reliefUntil = this.time + RELIEF_HOLD_S;
  }

  onRepel(direction: Vec2, power01: number): void {
    const axis = Math.atan2(-direction.x, direction.y);
    this.pulse = { axis, peak: lerp(1.18, 1.24, power01), hold: 0.04, recover: 0.2, age: 0 };
  }

  /** A small bounce in place for the idle ladder: a stretch on the way up, a landing squash, no simulation involvement. */
  attentionHop(): void {
    if (this.hopMs >= 0) return;
    this.hopMs = 0;
    this.pulse = { axis: 0, peak: 1.16, hold: 0.05, recover: 0.24, age: 0 };
  }

  /** R-EC-05: the equipped look's set is complete, so the character beat carries the set's own double flourish. */
  setFullSet(on: boolean): void {
    this.fullSet = on;
  }

  /** The flourish the next character beat will carry — the set's completion, made visible. */
  get fullSetFlourish(): boolean {
    return this.fullSet;
  }

  /** A 140 ms lid close, a one-shot like the hop; the ident's settle beat ends on it. */
  blink(): void {
    this.blinkMs = 0;
  }

  /** R-CH-02: the nearest steel face to glance at while settled; null clears it. */
  setCuriosity(point: Vec2 | null): void {
    if (point) {
      this.curiosityAt.x = point.x;
      this.curiosityAt.y = point.y;
    }
    this.curiosity = point ? this.curiosityAt : null;
  }

  /** R-CH-03: the failing surface under him — the pupil darts to it and the lid squints. */
  setWary(point: Vec2): void {
    this.waryAt.x = point.x;
    this.waryAt.y = point.y;
    this.waryUntil = this.time + WARY_HOLD_S;
  }

  /** The idle performance's one voice moment; the renderer collects it once per character beat. */
  takeCharacterBeat(): CharacterBeat | null {
    const beat = this.pendingBeat;
    this.pendingBeat = null;
    return beat;
  }

  /** The face this frame names — the emotion table and its doc are held to this vocabulary, and the tests read it straight off the rig. */
  get eyeState(): EyeState {
    return this.eye;
  }

  /** The staged card's face override (rebuild PRD 1.7): the card-grade panic — the oversized eye, the agape mouth, the frozen windmill. Gameplay never sets it. */
  setCardFace(face: 'panic' | null): void {
    this.cardFace = face;
  }

  onImpact(normal: Vec2, speed: number): void {
    if (speed < 4) return;
    const axis = Math.atan2(-normal.x, normal.y);
    const peak = lerp(0.9, 0.72, clamp((speed - 4) / 12, 0, 1));
    this.pulse = { axis, peak, hold: 0.07, recover: 0.2, age: 0 };
    // R-CH-03: the squeeze-shut of a landing that hurt, spent inside its window.
    this.winceLeft = TUNING.character.winceMs / 1000;
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
    if (view.state === 'charging' && view.chargeLevel >= 3 && !reducedMotion) {
      this.root.position.x += noise1(this.time * 90, 3) * SHIVER_METERS;
      this.root.position.y += noise1(this.time * 90, 7) * SHIVER_METERS * 0.6;
    }
    if (this.hopMs >= 0) {
      this.hopMs += dt * 1000;
      const u = this.hopMs / HOP_MS;
      if (u >= 1) {
        this.hopMs = -1;
        this.pulse = { axis: 0, peak: ATTACH_SQUASH, hold: 0.06, recover: 0.16, age: 0 };
      } else {
        this.root.position.y += Math.sin(u * Math.PI) * HOP_HEIGHT;
      }
    }
    if (this.spinLeft > 0) {
      // The character beat's flourish: a whole turn in place, eased out so it
      // reads as a flip and lands without a wobble. Presentation only — it
      // rides the inner rotation, so the squash axis and the upright charge
      // arcs never take part. A complete set doubles the turn into its own
      // signature (R-EC-05).
      this.spinLeft = Math.max(0, this.spinLeft - dt);
      const u = 1 - this.spinLeft / this.spinDuration;
      this.spinAngle = (1 - (1 - u) ** 2) * Math.PI * 2 * this.spinTurns;
      if (this.spinLeft === 0) this.spinAngle = 0;
    }
    this.performIdle(view, dt, reducedMotion);
    this.inner.rotation.z = this.visualAngle - this.deform.rotation.z + this.spinAngle;

    this.applyDeformation(view, dt, reducedMotion);
    this.animateHead(view, dt);
    this.animateEye(view, dt, t);
    this.animateArms(view, dt, t);
    this.animateAura(view, dt, t);
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

  /**
   * R-CH-02: the idle performance. Settled means attached, awake and slower
   * than the tuned bar — then the rig breathes, blinks on its own cadence
   * (looking at the nearest steel with some blinks), and throws one character
   * beat around every twenty seconds: a look-around, and for full motion a
   * little flip in place. Every move is presentation; the capsule never moves.
   */
  private performIdle(view: MagnoView, dt: number, reducedMotion: boolean): void {
    const speed = hypot2(view.velocity.x, view.velocity.y);
    const settled = view.state === 'attached' && !view.limp && speed < TUNING.character.idleSpeed;
    if (settled !== this.settled) {
      this.settled = settled;
      if (settled) {
        // A fresh settle rolls a fresh session: the first blink lands inside
        // the tuned window, the first beat around its cadence.
        this.idleMs = 0;
        this.idleRolls = 0;
        this.nextBlinkAt = this.roll01() * (TUNING.character.idleBlinkMaxMs - TUNING.character.idleBlinkMinMs) + TUNING.character.idleBlinkMinMs;
        this.nextBeatAt = TUNING.character.beatMs + (this.roll01() * 2 - 1) * TUNING.character.beatJitterMs;
      }
    }
    this.breathWeight = damp(this.breathWeight, settled ? 1 : 0, 3, dt);
    this.breathPhase += dt * BREATH_HZ * Math.PI * 2;
    const breath = this.breathWeight * Math.sin(this.breathPhase);
    this.inner.scale.set(1 - BREATH_SCALE * 0.5 * breath, 1 + BREATH_SCALE * breath, 1);
    if (!settled) {
      this.idleMs = 0;
      this.beatAge = -1;
      return;
    }

    this.idleMs += dt * 1000;
    if (this.idleMs >= this.nextBlinkAt) {
      // The blink-look cycle: a blink, and with it a glance at whatever steel
      // is nearest, held about a second and a half before the gaze comes home.
      this.blink();
      if (this.curiosity) this.glanceUntil = this.time + 1.5;
      this.nextBlinkAt = this.idleMs + this.roll01() * (TUNING.character.idleBlinkMaxMs - TUNING.character.idleBlinkMinMs) + TUNING.character.idleBlinkMinMs;
    }
    if (this.beatAge >= 0) {
      this.beatAge += dt * 1000;
      if (this.beatAge >= LOOK_SWEEP_MS) this.beatAge = -1;
    } else if (this.idleMs >= this.nextBeatAt) {
      // The character beat: the head's look-around always plays; the flip in
      // place is full motion's half, so reduced motion keeps the performance
      // and drops the travel.
      this.beatAge = 0;
      this.pendingBeat = 'curious';
      this.nextBeatAt = this.idleMs + TUNING.character.beatMs + (this.roll01() * 2 - 1) * TUNING.character.beatJitterMs;
      if (!reducedMotion && this.hopMs < 0) {
        this.attentionHop();
        this.spinDuration = (HOP_MS / 1000) * (this.fullSet ? 2 : 1);
        this.spinTurns = this.fullSet ? 2 : 1;
        this.spinLeft = this.spinDuration;
      }
    }
  }

  /** A deterministic roll in [0, 1] — the idle cadence is presentational, but it stays testable. */
  private roll01(): number {
    return (noise1(this.idleRolls++, 23) + 1) * 0.5;
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
    } else if (view.state === 'charging') {
      // The coil: squash along the body axis while the charge builds, so the
      // release stretch unwinds something the player already saw winding.
      const coil = COIL_SQUASH * view.charge01 ** 1.5 * (reducedMotion ? 0.5 : 1);
      if (coil > 0.002) {
        scaleAlong = 1 - coil;
        axis = view.visualAngle;
      }
    }

    if (this.wobbleAge >= 0 && !this.pulse) {
      // The sway waits out the squash it follows: catch, squash, then the wobble
      // the recovery leaves behind — anticipation, impact, follow-through.
      this.wobbleAge += dt;
      const decay = Math.exp(-this.wobbleAge * WOBBLE_DECAY);
      if (decay < 0.02) {
        this.wobbleAge = -1;
      } else {
        scaleAlong += Math.sin(this.wobbleAge * WOBBLE_HZ * Math.PI * 2) * WOBBLE_AMPLITUDE * decay * (reducedMotion ? 0.5 : 1);
        axis = this.wobbleAxis;
      }
    }

    const speedDown = -view.velocity.y;
    const wantStretch = !view.attachNormal && !view.limp && speedDown > 9 ? 1.08 : 1;
    this.fallStretch = damp(this.fallStretch, wantStretch, 8, dt);
    if (this.fallStretch > 1.002 && !this.pulse && view.state !== 'charging') {
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
    // R-CH-02: settled, the head breathes with the body and carries the beat's
    // look-around on top of its lean — the magnet nods as it idles.
    let idleTilt = this.breathWeight * Math.sin(this.breathPhase) * 1.5 * DEG;
    if (this.beatAge >= 0) idleTilt += Math.sin((this.beatAge / LOOK_SWEEP_MS) * Math.PI * 2) * LOOK_SWEEP_DEG * DEG;
    this.headPivot.rotation.z = -8 * DEG + this.headLag.value + idleTilt;
  }

  private animateEye(view: MagnoView, dt: number, t: number): void {
    // R-CH-03: the fall deep enough to read as panic is the same bar the arms'
    // windmill answers, so the face and the flailing never disagree.
    const panic = !view.attachNormal && !view.limp && view.dropMeters > PANIC_DROP_M && view.velocity.y < -8;
    if (panic) this.lastPanicAt = t;
    if (view.limp && !this.prevLimp) this.dazed = view.dropMeters >= TUNING.character.dazeMeters;
    this.prevLimp = view.limp;
    const pride = t - this.clearAt < TUNING.character.gleamMs / 1000;
    const wary = t < this.waryUntil;
    const relief = t < this.reliefUntil;

    let lid = 1;
    let size = 1;
    const card = this.cardFace === 'panic';
    if (card) {
      // The card grade (rebuild PRD 1.4.2): the eye oversized past the point
      // physics would ever ask of it, the lid raised past open — surprise as
      // geometry, because a two-shape face is what survives the downscale.
      size = CARD_EYE_SCALE;
      lid = 1.06;
    } else if (view.state === 'charging') {
      lid = 0.62;
      size = 0.92;
    } else if (view.limp) {
      lid = 0.15;
    } else if (panic) {
      size = 1.22;
      lid = 1;
    } else if (pride) {
      lid = 0.55;
    }
    if (view.state === 'recovering') lid = 0.8 + 0.2 * view.recoverPhase;
    if (relief) lid = 1.05;
    if (wary) lid = Math.min(lid, WARY_SQUINT);
    if (this.joy > 0.5) lid = 0.7;

    if (this.blinkMs >= 0) {
      this.blinkMs += dt * 1000;
      const u = this.blinkMs / BLINK_MS;
      lid = Math.min(lid, 1 - 0.95 * Math.sin(Math.PI * Math.min(1, u)));
      if (u >= 1) this.blinkMs = -1;
    }
    // R-CH-03: the squeeze-shut of a landing that hurt, held for its tuned window.
    if (this.winceLeft > 0) lid = Math.min(lid, 0.12);

    this.lidOpen.update(lid, dt);
    this.eyeScale.update(size, dt);
    this.eyeGroup.scale.set(this.eyeScale.value, this.eyeScale.value * (0.45 + 0.55 * this.lidOpen.value), 1);
    this.lid.visible = this.lidOpen.value < 0.97;
    this.lid.position.y = 0.09 * (this.lidOpen.value - 1) * -1;
    // The card's mouth, spark and socket grade ride the same gate: on with the
    // face, off with it, and the socket's bezel widens under the oversized eye.
    this.mouthRing.visible = card;
    this.mouth.visible = card;
    this.spark.visible = card;
    const socketScale = card ? CARD_EYE_SCALE * 0.72 : 1;
    this.socketMesh.scale.set(socketScale, socketScale, 0.55);

    let towardX = view.velocity.x;
    let towardY = view.velocity.y;
    let amount = 0.026 * clamp(hypot2(towardX, towardY) / 6, 0, 1);
    if (view.snapTarget) {
      towardX = view.snapTarget.x - view.position.x;
      towardY = view.snapTarget.y - view.position.y;
      amount = card ? CARD_GAZE : 0.034;
    } else if (wary) {
      // The failing surface under him: the pupil goes to it and stays.
      towardX = this.waryAt.x - view.position.x;
      towardY = this.waryAt.y - view.position.y;
      amount = 0.034;
    } else if (t < this.glanceUntil && this.curiosity) {
      // R-CH-02: the settled glance at the nearest steel, riding a blink.
      towardX = this.curiosity.x - view.position.x;
      towardY = this.curiosity.y - view.position.y;
      amount = 0.03;
    } else if (this.beatAge >= 0) {
      towardX = Math.sin((this.beatAge / LOOK_SWEEP_MS) * Math.PI * 2);
      towardY = 0;
      amount = 0.03;
    } else if (this.joy > 0.5) {
      // The ending's gaze: up, toward the light the core came from.
      towardX = 0;
      towardY = 2;
      amount = 0.018;
    }
    const len = hypot2(towardX, towardY) || 1;
    const local = rotateInto(this.local, towardX / len, towardY / len, -this.visualAngle);
    const intent = !view.attachNormal && !view.limp && hypot2(view.velocity.x, view.velocity.y) > 4;
    if (intent !== this.gazeIntent) {
      // Hand the current gaze across so the spring swap never twitches the pupil.
      const from = intent ? this.gaze : this.gazeQuick;
      const to = intent ? this.gazeQuick : this.gaze;
      to.snap(from.x.value, from.y.value);
      this.gazeIntent = intent;
    }
    const spring = this.gazeIntent ? this.gazeQuick : this.gaze;
    spring.update(local.x * amount, local.y * amount, dt);
    this.pupil.position.set(spring.x.value, spring.y.value, 0.032);

    // R-CH-03: the comic X swaps in only for the daze a deep fall earned; a
    // small bonk keeps the seeing-stars pulse instead. The gleam is the pride
    // window's one flourish, twinkling while it rides.
    const dazedNow = view.limp && this.dazed;
    this.pupil.visible = !dazedNow;
    this.daze.visible = dazedNow;
    if (dazedNow) this.daze.rotation.z = 0.35 * Math.sin(t * 3.1);
    this.gleam.visible = pride && !view.limp;
    if (this.gleam.visible) this.gleam.scale.setScalar(0.8 + 0.25 * Math.sin(t * 9));
    const dilate = card ? CARD_PUPIL_SCALE : view.state === 'charging' ? 1 + TUNING.character.pupilDilate * view.charge01 : relief ? 1.15 : panic ? 0.85 : 1;
    this.pupil.scale.setScalar(dazedNow ? 1 : view.limp ? 0.6 + 0.4 * Math.sin(t * 18) : dilate);

    // R-CH-04: the face this frame names — the emotion table and its doc are
    // held to this vocabulary, and the tests read it straight off the rig.
    this.eye = this.joy > 0.5
      ? 'home'
      : card
        ? 'panic'
        : view.limp
          ? 'dazed'
          : this.winceLeft > 0
            ? 'wince'
            : wary
              ? 'wary'
              : view.state === 'charging'
                ? 'focused'
                : view.state === 'recovering'
                  ? 'weary'
                  : pride
                    ? 'pride'
                    : relief
                      ? 'relief'
                      : panic
                        ? 'panic'
                        : this.gazeIntent
                          ? 'whee'
                          : this.beatAge >= 0
                            ? 'curious'
                            : 'idle';
    if (this.winceLeft > 0) this.winceLeft = Math.max(0, this.winceLeft - dt);
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
      } else if (this.cardFace === 'panic') {
        // The card's windmill, frozen mid-cycle: arms thrown to opposite
        // quarters, so the still carries the motion a tumbling fall would.
        const phase = CARD_WINDMILL_PHASE + (side > 0 ? Math.PI : 0);
        tx = side * 0.1 + Math.cos(phase) * 0.28;
        ty = SHOULDER_Y + Math.sin(phase) * 0.28;
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

  private animateAura(view: MagnoView, dt: number, t: number): void {
    const polar = view.polarity === 'repel' ? fxTheme.repel : fxTheme.attract;
    this.glowMaterial.blending = fxTheme.blending;
    const intensity = view.state === 'charging' ? 0.3 + view.charge01 * 0.6 : view.snapEngaged ? 0.7 : 0.18;
    this.glowMaterial.color.copy(polar);
    this.glowMaterial.opacity = intensity * (0.85 + 0.15 * Math.sin(t * 9));
    this.glow.scale.setScalar(1 + (view.state === 'charging' ? view.charge01 * 0.55 : 0));

    const level = view.state === 'charging' ? view.chargeLevel : 0;
    // A newly crossed threshold punches its segment in; the pulse decays on its own.
    for (let i = this.prevChargeLevel; i < level && i < 3; i++) this.segmentPulse[i] = 1;
    this.prevChargeLevel = level;
    for (let i = 0; i < 3; i++) {
      const lit = level > i;
      const material = this.arcMaterials[i]!;
      const full = level === 3 && lit;
      const pulse = this.segmentPulse[i]!;
      const base = lit ? (full ? 0.85 + 0.15 * Math.sin(t * 28) : 0.8) : view.state === 'charging' ? 0.14 : 0;
      material.opacity = Math.min(1, base + pulse * 0.35);
      material.blending = fxTheme.blending;
      material.color.copy(lit ? (level === 3 ? fxTheme.repelCore : fxTheme.repel) : fxTheme.repel);
      this.arcs[i]!.scale.setScalar(1 + SEGMENT_PULSE_SCALE * pulse);
      this.arcs[i]!.visible = view.state === 'charging' && this.chargeMeter;
      this.segmentPulse[i] = Math.max(0, pulse - dt / SEGMENT_PULSE_S);
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

/**
 * Adds a warm-white rim light to a MeshStandardMaterial so MAGNO carries a lit
 * edge against any background, even when the directional sun has him in shadow.
 *
 * The rim is computed from 1 - dot(viewDir, normal) and added to the material's
 * emissive output. Emissive is added to the final colour AFTER the diffuse
 * lighting sum but BEFORE tone mapping, so it survives ACES compression better
 * than a diffuseColor addition (which gets multiplied by NdotL and shadow).
 *
 * Fresnel power 3.0 gives a medium-tight edge; intensity 2.5 is high enough to
 * read as a committed rim against any biome background, including busy particle
 * scenes where a softer rim would be lost.
 */
function applyMagnoRim(material: MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         {
           float rimNdotV = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
           float rim = pow(rimNdotV, 3.0);
           totalEmissiveRadiance += vec3(1.0, 0.92, 0.78) * rim * 2.5;
         }`,
      );
  };
  material.needsUpdate = true;
}
