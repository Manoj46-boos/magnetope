import { TUNING } from '@/config/tuning';
import { isMagnetic, type MaterialId } from '@/config/materials';
import { Emitter } from '@/core/emitter';
import { DEG, angleDelta, clamp, dot2, invLerp, len2, lerp, norm2, perp2, type Vec2 } from '@/core/mathx';
import type { InputFrame } from './types';
import type { PhysicsWorld, SnapCandidate, SurfaceContact } from './world';

export type MagnoState = 'airborne' | 'attached' | 'charging' | 'repelled' | 'recovering';
export type Polarity = 'attract' | 'repel';

export interface MagnoEvents {
  attach: { material: MaterialId; point: Vec2; normal: Vec2; speed: number; weak: boolean; viaSnap: boolean };
  detach: { reason: 'lost' | 'weak-failed' | 'repel' };
  chargeLevel: { level: number };
  repel: { power: number; speed: number; normal: Vec2; point: Vec2; direction: Vec2 };
  snapArm: { target: Vec2 | null };
  snapEngage: { target: Vec2 };
  snapWhiff: Record<string, never>;
  impact: { material: MaterialId; point: Vec2; normal: Vec2; speed: number; hard: boolean };
  limp: Record<string, never>;
  recoverBegin: Record<string, never>;
  recoverEnd: Record<string, never>;
  weakCrumble: { point: Vec2 };
  boing: { propIndex: number; point: Vec2; normal: Vec2; speed: number; outSpeed: number };
}

interface Attachment {
  collider: number;
  body: number;
  material: MaterialId;
  weak: boolean;
  normal: Vec2;
  point: Vec2;
  ageMs: number;
  /** Set while a late (coyote) flip stands in for a surface MAGNO just left. */
  virtual: boolean;
}

interface SnapState {
  armed: boolean;
  target: { collider: number; point: Vec2 } | null;
  engaged: boolean;
  engagedMs: number;
  cooldownUntilMs: number;
}

interface LastContact {
  collider: number;
  body: number;
  material: MaterialId;
  weak: boolean;
  normal: Vec2;
  point: Vec2;
  atMs: number;
}

/** Plain-data state so a controller can be snapshotted and restored by the bots. */
export interface MagnoData {
  state: MagnoState;
  stateMs: number;
  timeMs: number;
  chargeMs: number;
  lastChargeLevel: number;
  attach: Attachment | null;
  lastContact: LastContact | null;
  repelLockUntilMs: number;
  lastRepelCollider: number;
  lastRepelAtMs: number;
  snap: SnapState;
  limp: boolean;
  limpRestMs: number;
  scrambleUntilMs: number;
  bufferedFlipAtMs: number;
  lockouts: Record<number, number>;
  touching: number[];
  prevVel: Vec2;
  peakY: number;
  grounded: boolean;
  groundNormal: Vec2;
  popped: boolean;
  chainTimes: number[];
  assist: boolean;
}

const FRICTION_FREE = 0.5;
const NEVER = -1e9;
/** Surfaces at least this bouncy throw MAGNO back up instead of knocking him limp. */
const SPRINGY_RESTITUTION = 0.85;
/** The fall assist at strength one: how much the aim cone still counts, and how hard a surface well below is shunned. */
const ASSIST_CONE_WEIGHT = 0.25;
const ASSIST_BELOW_BIAS = 0.4;

const freshData = (): MagnoData => ({
  state: 'airborne',
  stateMs: 0,
  timeMs: 0,
  chargeMs: 0,
  lastChargeLevel: 0,
  attach: null,
  lastContact: null,
  repelLockUntilMs: 0,
  lastRepelCollider: -1,
  lastRepelAtMs: NEVER,
  snap: { armed: false, target: null, engaged: false, engagedMs: 0, cooldownUntilMs: 0 },
  limp: false,
  limpRestMs: 0,
  scrambleUntilMs: NEVER,
  bufferedFlipAtMs: NEVER,
  lockouts: {},
  touching: [],
  prevVel: { x: 0, y: 0 },
  peakY: 0,
  grounded: false,
  groundNormal: { x: 0, y: 1 },
  popped: false,
  chainTimes: [],
  assist: true,
});

export interface MagnoView {
  position: Vec2;
  velocity: Vec2;
  /** Physical capsule angle. */
  angle: number;
  /** Angle the model should show: standing on whatever it is attached to. */
  visualAngle: number;
  state: MagnoState;
  polarity: Polarity;
  charge01: number;
  chargeLevel: number;
  snapArmed: boolean;
  snapEngaged: boolean;
  snapTarget: Vec2 | null;
  attachNormal: Vec2 | null;
  limp: boolean;
  scramble: boolean;
  /** 0..1 progress through the get-up while recovering. */
  recoverPhase: number;
  grounded: boolean;
  /** True when three surfaces were caught inside the chain window (drives the second music layer). */
  chaining: boolean;
  dropMeters: number;
}

const CHAIN_WINDOW_MS = 6000;
const CHAIN_COUNT = 3;

export class MagnoController {
  readonly events = new Emitter<MagnoEvents>();
  data: MagnoData = freshData();
  private contacts: SurfaceContact[] = [];

  constructor(private readonly physics: PhysicsWorld) {
    const p = this.physics.magnoBody.translation();
    this.data.peakY = p.y;
  }

  setAssist(enabled: boolean): void {
    this.data.assist = enabled;
  }

  snapshot(): MagnoData {
    return structuredClone(this.data);
  }

  restore(data: MagnoData): void {
    this.data = structuredClone(data);
  }

  reset(): void {
    this.unlockRotation();
    this.data = { ...freshData(), assist: this.data.assist };
    this.data.peakY = this.physics.magnoBody.translation().y;
  }

  /** Three snap catches inside the last six seconds; the streak ends by itself once they age out. */
  private chainStreak(): boolean {
    const d = this.data;
    let recent = 0;
    for (const t of d.chainTimes) if (d.timeMs - t <= CHAIN_WINDOW_MS) recent++;
    return recent >= CHAIN_COUNT;
  }

  get view(): MagnoView {
    const d = this.data;
    const body = this.physics.magnoBody;
    const t = body.translation();
    const v = body.linvel();
    const frac = d.state === 'charging' ? this.charge01() : 0;
    return {
      position: { x: t.x, y: t.y },
      velocity: { x: v.x, y: v.y },
      angle: this.angle(),
      visualAngle: d.attach && !d.attach.virtual ? Math.atan2(-d.attach.normal.x, d.attach.normal.y) : this.angle(),
      state: d.state,
      polarity: d.state === 'charging' || d.state === 'repelled' ? 'repel' : 'attract',
      charge01: frac,
      chargeLevel: d.state === 'charging' ? this.chargeLevel() : 0,
      snapArmed: d.snap.armed,
      snapEngaged: d.snap.engaged,
      snapTarget: d.snap.target ? d.snap.target.point : null,
      attachNormal: d.attach ? d.attach.normal : null,
      limp: d.limp,
      scramble: d.timeMs < d.scrambleUntilMs,
      recoverPhase: d.state === 'recovering' ? clamp(d.stateMs / TUNING.recover.getUpMs, 0, 1) : 0,
      grounded: d.grounded,
      chaining: this.chainStreak(),
      dropMeters: Math.max(0, d.peakY - t.y),
    };
  }

  /** Advance one fixed tick. Call before stepping the physics world. */
  update(input: InputFrame, windAccel: number): void {
    const d = this.data;
    const dtMs = 1000 / TUNING.sim.hz;
    d.timeMs += dtMs;
    d.stateMs += dtMs;

    const body = this.physics.magnoBody;
    const pos = body.translation();
    const pose = { x: pos.x, y: pos.y };

    this.contacts = this.gatherContacts(pose);
    this.updateGrounding();
    this.detectImpacts(pose);

    if (input.flipDown && (d.state === 'recovering' || d.limp)) d.bufferedFlipAtMs = d.timeMs;

    switch (d.state) {
      case 'airborne':
      case 'repelled':
        this.updateFree(input, pose, windAccel);
        break;
      case 'attached':
      case 'charging':
        this.updateAttached(input, pose);
        break;
      case 'recovering':
        this.updateRecovering(pose);
        break;
    }

    if (d.state === 'airborne' || d.state === 'repelled') d.peakY = Math.max(d.peakY, pos.y);

    this.limitSpeed();
    const after = this.physics.magnoBody.linvel();
    d.prevVel = { x: after.x, y: after.y };
  }

  private angle(): number {
    const q = this.physics.magnoBody.rotation();
    return 2 * Math.atan2(q.z, q.w);
  }

  private charge01(): number {
    return clamp(invLerp(80, TUNING.repel.chargeMs, this.data.chargeMs), 0, 1);
  }

  private chargeLevel(): number {
    return this.data.chargeMs < 80 ? 0 : Math.max(1, Math.ceil(this.charge01() * TUNING.repel.chargeLevels));
  }

  private limitSpeed(): void {
    const body = this.physics.magnoBody;
    const v = body.linvel();
    const speed = Math.hypot(v.x, v.y);
    const max = 30;
    if (speed > max) body.setLinvel({ x: (v.x / speed) * max, y: (v.y / speed) * max, z: 0 }, true);
  }

  private setState(next: MagnoState): void {
    this.data.state = next;
    this.data.stateMs = 0;
  }

  /**
   * While stuck, the capsule lies flat against the surface with rotation locked.
   * A free round body would simply roll down the wall no matter the friction.
   */
  private lockToSurface(normal: Vec2): void {
    const body = this.physics.magnoBody;
    const flat = Math.atan2(-normal.x, normal.y) + Math.PI / 2;
    const current = this.angle();
    const target = Math.abs(angleDelta(current, flat)) <= Math.PI / 2 ? flat : flat + Math.PI;
    body.setRotation({ x: 0, y: 0, z: Math.sin(target / 2), w: Math.cos(target / 2) }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setEnabledRotations(false, false, false, true);
  }

  private unlockRotation(): void {
    this.physics.magnoBody.setEnabledRotations(false, false, true, true);
  }

  private setFriction(value: number): void {
    this.physics.world.getCollider(this.physics.magnoColliderHandle).setFriction(value);
  }

  /** Contacts for the three spheres that make up the capsule, nearest per surface. */
  private gatherContacts(pose: Vec2): SurfaceContact[] {
    const a = this.angle();
    const ax = -Math.sin(a);
    const ay = Math.cos(a);
    const h = TUNING.body.halfHeight;
    const centers: Vec2[] = [
      pose,
      { x: pose.x + ax * h, y: pose.y + ay * h },
      { x: pose.x - ax * h, y: pose.y - ay * h },
    ];
    const merged = new Map<number, SurfaceContact>();
    for (const c of centers) {
      for (const contact of this.physics.probe(c)) {
        const key = contact.surface.colliderHandle;
        const prev = merged.get(key);
        if (!prev || contact.gap < prev.gap) merged.set(key, contact);
      }
    }
    return [...merged.values()].sort((x, y) => x.gap - y.gap);
  }

  private updateGrounding(): void {
    const d = this.data;
    d.grounded = false;
    for (const c of this.contacts) {
      if (c.gap < 0.06 && c.normal.y > 0.5) {
        d.grounded = true;
        d.groundNormal = c.normal;
        return;
      }
    }
  }

  private detectImpacts(pose: Vec2): void {
    const d = this.data;
    const touchingNow: number[] = [];
    for (const c of this.contacts) {
      if (c.gap > 0.03) continue;
      const handle = c.surface.colliderHandle;
      touchingNow.push(handle);
      if (d.touching.includes(handle)) continue;
      const surfVel = this.physics.velocityAt(c.surface.bodyHandle, c.point);
      const rel = { x: d.prevVel.x - surfVel.x, y: d.prevVel.y - surfVel.y };
      const speed = -dot2(rel, c.normal);
      if (speed < 2) continue;
      const hard = speed >= TUNING.recover.hardImpactSpeed;
      this.events.emit('impact', {
        material: c.surface.material.id,
        point: c.point,
        normal: c.normal,
        speed,
        hard,
      });
      if (this.data.state === 'attached' || this.data.state === 'charging') continue;
      if (this.tryBoing(c, speed, pose)) continue;
      this.onFreeImpact(c, speed, pose);
    }
    d.touching = touchingNow;
  }

  /**
   * A boing surface throws MAGNO back off a hard landing and refuses to catch him for a moment,
   * so a fast arrival never sticks. A gentle arrival, or one he aimed with a snap, is treated like any other surface.
   */
  private tryBoing(c: SurfaceContact, speed: number, pose: Vec2): boolean {
    const d = this.data;
    const reaction = c.surface.kind.reaction;
    if (reaction?.type !== 'boing' || speed < reaction.above || d.state === 'recovering' || d.snap.engaged) return false;

    const surfVel = this.physics.velocityAt(c.surface.bodyHandle, c.point);
    const rel = { x: d.prevVel.x - surfVel.x, y: d.prevVel.y - surfVel.y };
    const into = dot2(rel, c.normal);
    const outSpeed = clamp(speed * reaction.gain, reaction.min, reaction.max);
    const carry = 0.85;
    this.physics.magnoBody.setLinvel(
      {
        x: surfVel.x + (rel.x - c.normal.x * into) * carry + c.normal.x * outSpeed,
        y: surfVel.y + (rel.y - c.normal.y * into) * carry + c.normal.y * outSpeed,
        z: 0,
      },
      true,
    );
    d.lockouts[c.surface.colliderHandle] = d.timeMs + reaction.lockMs;
    d.peakY = pose.y;
    d.snap = { ...d.snap, armed: false, engaged: false, target: null };
    this.events.emit('boing', { propIndex: c.surface.propIndex, point: c.point, normal: c.normal, speed, outSpeed });
    return true;
  }

  /** A fast arrival is inside the capture gap before it ever touches, so the bounce has to be decided here too. */
  private boingOnApproach(hit: SurfaceContact, pose: Vec2): boolean {
    const surfVel = this.physics.velocityAt(hit.surface.bodyHandle, hit.point);
    const rel = { x: this.data.prevVel.x - surfVel.x, y: this.data.prevVel.y - surfVel.y };
    return this.tryBoing(hit, Math.max(0, -dot2(rel, hit.normal)), pose);
  }

  /** Surfaces MAGNO is holding, standing on or leaning against right now. */
  contactHandles(): readonly number[] {
    const a = this.data.attach;
    return a && !a.virtual ? [a.collider, ...this.data.touching] : this.data.touching;
  }

  /** A non-attach landing: decide between a clean catch, a scramble and a full limp. */
  private onFreeImpact(c: SurfaceContact, speed: number, pose: Vec2): void {
    const d = this.data;
    if (d.limp || d.state === 'recovering') return;
    if (c.surface.material.restitution >= SPRINGY_RESTITUTION || c.surface.material.cushion) {
      // A trampoline or a ball pit catches the fall: where MAGNO lands is the new height to fall from.
      d.peakY = pose.y;
      return;
    }
    const dropped = d.peakY - pose.y;
    const floorLike = c.normal.y > 0.5;
    const magnetic = isMagnetic(c.surface.material);
    const attractLive = d.state === 'airborne' && d.timeMs >= d.repelLockUntilMs;
    const caught = magnetic && attractLive && !this.isLockedOut(c.surface.colliderHandle);
    const overwhelmed = floorLike && !d.snap.engaged && speed >= 12;

    if (caught && !overwhelmed) return;
    if (floorLike && speed >= TUNING.recover.hardImpactSpeed && dropped >= TUNING.fall.minFallHeight) {
      this.goLimp();
    } else if (speed >= TUNING.recover.hardImpactSpeed) {
      d.scrambleUntilMs = d.timeMs + TUNING.recover.scrambleMs;
    }
  }

  private goLimp(): void {
    const d = this.data;
    d.limp = true;
    d.limpRestMs = 0;
    d.snap.armed = false;
    d.snap.engaged = false;
    d.snap.target = null;
    this.setFriction(0.8);
    this.events.emit('limp', {});
  }

  private isLockedOut(handle: number): boolean {
    const until = this.data.lockouts[handle];
    return until !== undefined && this.data.timeMs < until;
  }

  private authority(): number {
    return this.data.timeMs < this.data.scrambleUntilMs ? TUNING.recover.scrambleAuthority : 1;
  }

  // ---------------------------------------------------------------- free flight

  private updateFree(input: InputFrame, pose: Vec2, windAccel: number): void {
    const d = this.data;
    const body = this.physics.magnoBody;
    const mass = TUNING.body.mass;

    if (d.state === 'repelled' && d.timeMs >= d.repelLockUntilMs) this.setState('airborne');

    if (d.limp) {
      this.updateLimp();
      return;
    }

    this.setFriction(d.grounded ? 0.9 : FRICTION_FREE);

    // Snap bookkeeping first so a late press can still arm this tick.
    this.handleSnapInput(input, pose);
    if (d.snap.engaged) this.applySnapPull(pose);

    // Capture: attract mode is live whenever the repel lock has expired.
    if (d.state === 'airborne' && d.timeMs >= d.repelLockUntilMs) {
      const hit = this.contacts.find(
        (c) => isMagnetic(c.surface.material) && c.gap <= TUNING.attach.captureGap && !this.isLockedOut(c.surface.colliderHandle),
      );
      if (hit) {
        if (this.boingOnApproach(hit, pose)) return;
        this.beginAttach(hit, input, pose);
        return;
      }
    }

    if (d.state === 'airborne' && d.lastContact && input.flipDown && !d.snap.engaged) {
      if (d.timeMs - d.lastContact.atMs <= TUNING.windows.coyoteMs) {
        this.beginCoyoteCharge();
        return;
      }
    }

    // Air steering: tilt authority is small enough that it can never cancel gravity. Sideways it stays
    // constant so a gust can always be fought; upward it is a fixed share of gravity, so lighter air
    // never turns steering into flying.
    const auth = this.authority();
    const lift = Math.min(1, this.physics.gravityScale);
    if (!d.snap.engaged) {
      if (d.grounded) {
        const target = input.tiltX * TUNING.attach.crawlSpeed * 2;
        const v = body.linvel();
        const accel = clamp((target - v.x) * 6, -16, 16) * auth;
        body.addForce({ x: mass * accel, y: 0, z: 0 }, true);
      } else {
        body.addForce(
          { x: mass * input.tiltX * TUNING.air.tiltAccel * auth, y: mass * input.tiltY * TUNING.air.tiltAccel * auth * lift, z: 0 },
          true,
        );
      }
    }
    if (windAccel !== 0 && !d.grounded) body.addForce({ x: mass * windAccel, y: 0, z: 0 }, true);

    const v = body.linvel();
    const lean = clamp(-v.x * 0.045, -0.4, 0.4);
    this.steerAngle(lean, 0.4 * auth);
    this.trackLastContact();
  }

  /** Remember the most recent magnetic surface so a late flip can still launch off it. */
  private trackLastContact(): void {
    const d = this.data;
    const hit = this.contacts.find((c) => isMagnetic(c.surface.material) && c.gap <= TUNING.attach.captureGap * 2);
    if (!hit) return;
    if (d.timeMs - d.lastRepelAtMs < TUNING.windows.coyoteMs * 2 && hit.surface.colliderHandle === d.lastRepelCollider) return;
    d.lastContact = {
      collider: hit.surface.colliderHandle,
      body: hit.surface.bodyHandle,
      material: hit.surface.material.id,
      weak: hit.surface.material.magnetic === 'weak',
      normal: hit.normal,
      point: hit.point,
      atMs: d.timeMs,
    };
  }

  private updateLimp(): void {
    const d = this.data;
    const body = this.physics.magnoBody;
    const v = body.linvel();
    const speed = Math.hypot(v.x, v.y) + Math.abs(body.angvel().z) * 0.2;
    if (d.grounded && speed < TUNING.fall.settleSpeed) d.limpRestMs += 1000 / TUNING.sim.hz;
    else d.limpRestMs = 0;
    if (d.limpRestMs >= TUNING.fall.settleMs) {
      d.limp = false;
      d.popped = false;
      this.setState('recovering');
      this.events.emit('recoverBegin', {});
    }
  }

  private updateRecovering(pose: Vec2): void {
    const d = this.data;
    const body = this.physics.magnoBody;
    const total = TUNING.recover.getUpMs + TUNING.recover.settleBounceMs;
    const t = d.stateMs / TUNING.recover.getUpMs;

    this.setFriction(0.9);
    this.steerAngle(0, clamp(0.25 + t * 0.9, 0, 1));
    if (!d.popped && t >= 0.6 && d.grounded) {
      const v = body.linvel();
      body.setLinvel({ x: v.x, y: Math.max(v.y, 2.6), z: 0 }, true);
      d.popped = true;
    }
    this.trackLastContact();

    if (d.stateMs >= total) {
      d.snap = { ...d.snap, armed: false, engaged: false, target: null };
      this.setState('airborne');
      d.peakY = pose.y;
      this.events.emit('recoverEnd', {});
      if (d.timeMs - d.bufferedFlipAtMs <= TUNING.windows.bufferMs) {
        d.bufferedFlipAtMs = NEVER;
        d.snap.armed = true;
      }
    }
  }

  // ------------------------------------------------------------------- snapping

  private aimDirection(input: InputFrame): Vec2 {
    const tilt = { x: input.tiltX, y: input.tiltY };
    if (len2(tilt) > 0.3) return norm2(tilt);
    const v = this.physics.magnoBody.linvel();
    if (Math.hypot(v.x, v.y) > 1.5) return norm2({ x: v.x, y: v.y });
    return { x: 0, y: 1 };
  }

  private excludedTargets(): Set<number> {
    const d = this.data;
    const out = new Set<number>();
    if (d.timeMs - d.lastRepelAtMs < TUNING.repel.lockMs * 2) out.add(d.lastRepelCollider);
    for (const [handle, until] of Object.entries(d.lockouts)) {
      if (d.timeMs < until) out.add(Number(handle));
    }
    return out;
  }

  private pickSnapTarget(input: InputFrame, pose: Vec2): SnapCandidate | null {
    const d = this.data;
    const aim = this.aimDirection(input);
    const coneCos = Math.cos(TUNING.snap.coneDeg * DEG);
    const falling = this.physics.magnoBody.linvel().y < -4;
    const impactSoon =
      falling && this.physics.castDistance(pose, { x: 0, y: -1 }, Math.abs(this.physics.magnoBody.linvel().y) * 0.3 + 0.4) < Infinity;
    const assisting = d.assist && impactSoon;
    const strength = assisting ? (this.physics.level.onRamp?.assist ?? 1) : 1;
    const coneWeight = assisting ? Math.max(0, 1 - (1 - ASSIST_CONE_WEIGHT) * strength) : 1;
    // The on-ramp's extra reach is a training wheel for saves: while flight is
    // deliberate the window is the base radius, so a level's catches keep their
    // authored order, and only a falling player sees the widened band.
    const reach = assisting ? this.physics.snapRadius : TUNING.snap.radius;
    const candidates = this.physics.snapCandidates(pose, this.excludedTargets()).filter((c) => c.distance <= reach);
    if (candidates.length === 0) return null;

    let best: SnapCandidate | null = null;
    let bestScore = Infinity;
    for (const c of candidates) {
      const dir = norm2({ x: c.point.x - pose.x, y: c.point.y - pose.y });
      const cos = dot2(dir, aim);
      let score = c.distance / TUNING.snap.radius + (1 - cos) * 0.55 * coneWeight;
      if (cos >= coneCos) score -= 0.35 * coneWeight;
      if (assisting && c.point.y < pose.y - 0.2) score += ASSIST_BELOW_BIAS * strength;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  private handleSnapInput(input: InputFrame, pose: Vec2): void {
    const d = this.data;
    const s = d.snap;

    if (input.flipDown && !s.engaged && d.timeMs >= s.cooldownUntilMs) s.armed = true;

    if (s.armed) {
      const best = this.pickSnapTarget(input, pose);
      const previous = s.target;
      s.target = best ? { collider: best.surface.colliderHandle, point: best.point } : null;
      if ((previous?.collider ?? -1) !== (s.target?.collider ?? -1)) {
        this.events.emit('snapArm', { target: s.target ? s.target.point : null });
      }
    }

    if (input.flipUp && s.armed) {
      s.armed = false;
      if (s.target) {
        s.engaged = true;
        s.engagedMs = 0;
        this.events.emit('snapEngage', { target: s.target.point });
      } else {
        s.cooldownUntilMs = d.timeMs + TUNING.snap.cooldownMs;
        this.events.emit('snapWhiff', {});
      }
    }
  }

  private applySnapPull(pose: Vec2): void {
    const d = this.data;
    const s = d.snap;
    const target = s.target;
    if (!target) {
      s.engaged = false;
      return;
    }
    s.engagedMs += 1000 / TUNING.sim.hz;
    const surface = this.physics.surfaces.get(target.collider);
    if (!surface || s.engagedMs > TUNING.snap.maxDurationMs) {
      this.endSnap();
      return;
    }
    const proj = this.physics.world.getCollider(target.collider).projectPoint({ x: pose.x, y: pose.y, z: 0 }, false);
    if (!proj) {
      this.endSnap();
      return;
    }
    target.point = { x: proj.point.x, y: proj.point.y };
    const delta = { x: target.point.x - pose.x, y: target.point.y - pose.y };
    const dist = len2(delta);
    if (dist > this.physics.snapRadius * 1.6) {
      this.endSnap();
      return;
    }
    const dir = norm2(delta);
    const body = this.physics.magnoBody;
    const v = body.linvel();
    const damping = 2 * TUNING.snap.zeta * Math.sqrt(TUNING.snap.k);
    const closeness = clamp(1 - dist / 1.6, 0, 1);
    const approach = dot2({ x: v.x, y: v.y }, dir);
    const pull = Math.min(TUNING.snap.k * dist, TUNING.snap.maxAccel);
    const accel = pull - (approach > 0 ? damping * approach * closeness : 0);
    const mass = TUNING.body.mass;
    const force = { x: dir.x * accel * mass, y: dir.y * accel * mass };
    body.addForce({ x: force.x, y: force.y, z: 0 }, true);
    this.physics.addForceAt(surface.bodyHandle, { x: -force.x * 0.15, y: -force.y * 0.15 }, target.point);
    // Counter gravity along the pull so the spring reads as magnetism rather than a lob.
    body.addForce({ x: 0, y: mass * this.physics.gravity * 0.6 * closeness, z: 0 }, true);
  }

  private endSnap(): void {
    const s = this.data.snap;
    s.engaged = false;
    s.target = null;
    s.cooldownUntilMs = this.data.timeMs + TUNING.snap.cooldownMs;
  }

  // -------------------------------------------------------------------- attach

  private beginAttach(hit: SurfaceContact, input: InputFrame, pose: Vec2): void {
    const d = this.data;
    const viaSnap = d.snap.engaged;
    const weak = hit.surface.material.magnetic === 'weak';
    const surfVel = this.physics.velocityAt(hit.surface.bodyHandle, hit.point);
    const rel = { x: d.prevVel.x - surfVel.x, y: d.prevVel.y - surfVel.y };
    const speed = Math.max(0, -dot2(rel, hit.normal));

    d.attach = {
      collider: hit.surface.colliderHandle,
      body: hit.surface.bodyHandle,
      material: hit.surface.material.id,
      weak,
      normal: hit.normal,
      point: hit.point,
      ageMs: 0,
      virtual: false,
    };
    d.snap = { armed: false, target: null, engaged: false, engagedMs: 0, cooldownUntilMs: 0 };
    d.chargeMs = 0;
    d.lastChargeLevel = 0;
    d.peakY = pose.y;
    d.chainTimes = d.chainTimes.filter((t) => d.timeMs - t <= CHAIN_WINDOW_MS);
    if (viaSnap) d.chainTimes.push(d.timeMs);
    this.setState(input.flipHeld ? 'charging' : 'attached');
    this.setFriction(0);
    this.lockToSurface(hit.normal);

    this.events.emit('attach', {
      material: hit.surface.material.id,
      point: hit.point,
      normal: hit.normal,
      speed,
      weak,
      viaSnap,
    });
  }

  private beginCoyoteCharge(): void {
    const d = this.data;
    const last = d.lastContact;
    if (!last) return;
    d.attach = {
      collider: last.collider,
      body: last.body,
      material: last.material,
      weak: last.weak,
      normal: last.normal,
      point: last.point,
      ageMs: 0,
      virtual: true,
    };
    d.chargeMs = 0;
    d.lastChargeLevel = 0;
    d.snap = { ...d.snap, armed: false, target: null, engaged: false };
    this.setState('charging');
  }

  private updateAttached(input: InputFrame, pose: Vec2): void {
    const d = this.data;
    const a = d.attach;
    if (!a) {
      this.setState('airborne');
      return;
    }
    const dtMs = 1000 / TUNING.sim.hz;
    const body = this.physics.magnoBody;
    a.ageMs += dtMs;

    if (a.virtual) {
      this.updateVirtualCharge(input, pose);
      return;
    }

    const contact = this.contacts.find((c) => c.surface.colliderHandle === a.collider);
    if (!contact || contact.gap > TUNING.attach.captureGap * 2) {
      this.releaseHold('lost');
      return;
    }
    a.normal = contact.normal;
    a.point = contact.point;

    if (a.weak && a.ageMs >= TUNING.weakMetal.holdMs) {
      d.lockouts[a.collider] = d.timeMs + TUNING.weakMetal.lockoutMs;
      this.events.emit('weakCrumble', { point: a.point });
      this.releaseHold('weak-failed');
      return;
    }

    if (d.state === 'attached' && input.flipDown) {
      d.chargeMs = 0;
      d.lastChargeLevel = 0;
      this.setState('charging');
    }
    if (d.state === 'charging' && this.advanceCharge(input, a.normal, a.point, a.body, pose)) return;

    const ramp = clamp(a.ageMs / TUNING.attach.holdRampMs, 0, 1);
    const fadeStart = TUNING.weakMetal.holdMs - TUNING.weakMetal.fadeMs;
    const fade = a.weak ? 1 - clamp(invLerp(fadeStart, TUNING.weakMetal.holdMs, a.ageMs), 0, 1) * 0.85 : 1;
    const hold = TUNING.attach.holdForceN * ramp * fade;
    const n = a.normal;
    body.addForce({ x: -n.x * hold, y: -n.y * hold, z: 0 }, true);
    this.physics.addForceAt(a.body, { x: n.x * hold, y: n.y * hold }, a.point);

    // Rapier's solver friction is too weak under a pressed force, so the grip is modelled directly.
    this.setFriction(0);
    this.applyGrip(input, n, a, hold);
  }

  /**
   * Tangential friction with a force cap of mu * holdForce, where mu ramps 0 -> 0.9 over 250 ms.
   * Arrival speed therefore bleeds off over the ramp instead of dying on contact, and tilt
   * drives a crawl along the surface within the same force budget.
   */
  private applyGrip(input: InputFrame, normal: Vec2, a: Attachment, normalForce: number): void {
    const body = this.physics.magnoBody;
    const dt = 1 / TUNING.sim.hz;
    const mass = TUNING.body.mass;
    const tangent = perp2(normal);
    const surfVel = this.physics.velocityAt(a.body, a.point);
    const v = body.linvel();
    const vt = (v.x - surfVel.x) * tangent.x + (v.y - surfVel.y) * tangent.y;

    const along = input.tiltX * tangent.x + input.tiltY * tangent.y;
    const crawling = Math.abs(along) >= 0.15;
    const target = crawling ? along * TUNING.attach.crawlSpeed : 0;
    let wanted = (target - vt) / dt;
    if (crawling) wanted = clamp(wanted, -TUNING.attach.crawlAccel, TUNING.attach.crawlAccel);

    const gravityAlong = -this.physics.gravity * tangent.y;
    const mu = TUNING.attach.frictionMu * clamp(a.ageMs / TUNING.attach.frictionRampMs, 0, 1) * this.authority();
    const cap = mu * normalForce;
    const force = clamp(mass * (wanted - gravityAlong), -cap, cap);
    body.addForce({ x: tangent.x * force, y: tangent.y * force, z: 0 }, true);
    this.physics.addForceAt(a.body, { x: -tangent.x * force, y: -tangent.y * force }, a.point);
  }

  private updateVirtualCharge(input: InputFrame, pose: Vec2): void {
    const d = this.data;
    const a = d.attach;
    if (!a) return;
    const capture = this.contacts.find(
      (c) => isMagnetic(c.surface.material) && c.gap <= TUNING.attach.captureGap && !this.isLockedOut(c.surface.colliderHandle),
    );
    if (capture) {
      this.beginAttach(capture, { ...input, flipHeld: true }, pose);
      return;
    }
    d.chargeMs += 1000 / TUNING.sim.hz;
    if (input.flipUp) {
      this.releaseRepel(input, a.normal, a.point, a.body, pose);
      return;
    }
    if (a.ageMs > TUNING.windows.coyoteMs) {
      d.attach = null;
      d.lastContact = null;
      d.snap.armed = true;
      this.setState('airborne');
    }
  }

  /** Returns true when the flip was released and the launch has been applied. */
  private advanceCharge(input: InputFrame, normal: Vec2, point: Vec2, bodyHandle: number, pose: Vec2): boolean {
    const d = this.data;
    d.chargeMs = Math.min(d.chargeMs + 1000 / TUNING.sim.hz, TUNING.repel.chargeMs);
    const level = this.chargeLevel();
    if (level !== d.lastChargeLevel) {
      d.lastChargeLevel = level;
      this.events.emit('chargeLevel', { level });
    }
    if (!input.flipUp) return false;
    this.releaseRepel(input, normal, point, bodyHandle, pose);
    return true;
  }

  private releaseRepel(input: InputFrame, normal: Vec2, point: Vec2, bodyHandle: number, pose: Vec2): void {
    const d = this.data;
    const { fullSpeed, tapSpeed, tiltShare } = TUNING.repel;
    const frac = this.charge01();
    const power = lerp(tapSpeed, fullSpeed, frac);
    const body = this.physics.magnoBody;
    this.unlockRotation();
    const surfVel = this.physics.velocityAt(bodyHandle, point);
    const v = body.linvel();

    const rel = { x: v.x - surfVel.x, y: v.y - surfVel.y };
    const along = dot2(rel, normal);
    const tangential = { x: rel.x - normal.x * along, y: rel.y - normal.y * along };
    const tilt = { x: input.tiltX, y: input.tiltY };
    const exit = {
      x: surfVel.x + tangential.x + normal.x * power + tilt.x * tiltShare * power,
      y: surfVel.y + tangential.y + normal.y * power + tilt.y * tiltShare * power,
    };
    body.setLinvel({ x: exit.x, y: exit.y, z: 0 }, true);

    const mass = TUNING.body.mass;
    this.physics.applyImpulseAt(bodyHandle, { x: -(exit.x - v.x) * mass * 0.25, y: -(exit.y - v.y) * mass * 0.25 }, point);

    d.lastRepelCollider = d.attach ? d.attach.collider : -1;
    d.lastRepelAtMs = d.timeMs;
    d.repelLockUntilMs = d.timeMs + TUNING.repel.lockMs;
    d.attach = null;
    d.lastContact = null;
    d.chargeMs = 0;
    d.lastChargeLevel = 0;
    d.peakY = pose.y;
    this.setFriction(FRICTION_FREE);
    this.setState('repelled');
    this.events.emit('detach', { reason: 'repel' });
    this.events.emit('repel', { power: frac, speed: power, normal, point, direction: norm2(exit) });
  }

  private releaseHold(reason: 'lost' | 'weak-failed'): void {
    const d = this.data;
    const a = d.attach;
    if (a && !a.virtual) {
      d.lastContact = {
        collider: a.collider,
        body: a.body,
        material: a.material,
        weak: a.weak,
        normal: a.normal,
        point: a.point,
        atMs: d.timeMs,
      };
    }
    d.attach = null;
    d.chargeMs = 0;
    d.lastChargeLevel = 0;
    this.unlockRotation();
    this.setFriction(FRICTION_FREE);
    this.setState('airborne');
    this.events.emit('detach', { reason });
  }

  // ----------------------------------------------------------------- orientation

  /**
   * Rotate toward `target` by blending the body's angular velocity. `weight` of 0
   * leaves the physics untouched (limp), 1 is full motor authority.
   */
  private steerAngle(target: number, weight: number): void {
    const body = this.physics.magnoBody;
    const w = body.angvel().z;
    const err = angleDelta(this.angle(), target);
    const desired = clamp(err * 14, -14, 14);
    const next = lerp(w, desired, clamp(weight, 0, 1) * 0.35);
    body.setAngvel({ x: 0, y: 0, z: next }, true);
  }
}
