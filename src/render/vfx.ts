import type { Scene } from 'three';
import { Rng } from '@/core/rng';
import { clamp, norm2, type Vec2 } from '@/core/mathx';
import type { MaterialId } from '@/config/materials';
import { MATERIALS } from '@/config/materials';
import type { MagnoView } from '@/sim/magno';
import type { Simulation } from '@/sim/simulation';
import type { BuiltProp } from '@/sim/world';
import { FieldLines } from './field-lines';
import { ParticleSystem, RingPool } from './particles';
import { fxTheme, type BiomePalette, toColor } from './palette';
import type { QualityProfile } from './quality';
import type { ShakeKind } from './camera-rig';

type Rgb = readonly [number, number, number];

const SPARK: Record<string, Rgb> = {
  beam: [1, 0.92, 0.62],
  body: [1, 0.76, 0.46],
  crumple: [0.95, 0.66, 0.46],
  wood: [0.9, 0.7, 0.45],
  rubber: [0.7, 0.7, 0.75],
  glass: [0.8, 0.95, 1],
  soft: [1, 0.8, 0.85],
  stone: [0.85, 0.82, 0.76],
  spring: [1, 0.7, 0.62],
};

const rgbOf = (c: { r: number; g: number; b: number }): Rgb => [c.r, c.g, c.b];
const CONFETTI: Rgb[] = [
  [1, 0.8, 0.3],
  [0.35, 0.85, 1],
  [1, 0.5, 0.45],
  [0.7, 1, 0.55],
  [1, 0.95, 0.85],
];

export interface VfxHooks {
  shake(kind: ShakeKind): void;
  flash(amount: number): void;
}

/**
 * Turns simulation events into the effect inventory of PRD 8.2, within the
 * particle ceiling of the active device tier.
 */
export class Vfx {
  readonly additive: ParticleSystem;
  readonly dust: ParticleSystem;
  readonly rings: RingPool;
  readonly fieldLines: FieldLines;
  private readonly rng = new Rng(2026);
  private dustRgb: Rgb = [0.8, 0.7, 0.55];
  private attractRgb: Rgb = [0.4, 0.8, 1];
  private repelRgb: Rgb = [1, 0.6, 0.2];
  private repelCoreRgb: Rgb = [1, 0.85, 0.5];
  private profile: QualityProfile;
  private unsubscribe: Array<() => void> = [];
  private sim: Simulation | null = null;
  private crumblers: BuiltProp[] = [];
  /** Accumulator for the ambient dust emitter, so the per-second rate is frame-rate independent. */
  private ambientAccum = 0;

  constructor(scene: Scene, profile: QualityProfile, z: number, private readonly hooks: VfxHooks) {
    this.profile = profile;
    this.additive = new ParticleSystem(900, true, z);
    this.dust = new ParticleSystem(500, false, z - 0.05);
    this.rings = new RingPool(scene, 10, z);
    this.fieldLines = new FieldLines(profile.fieldLineSegments, z + 0.05);
    scene.add(this.additive.points, this.dust.points, ...this.fieldLines.objects);
    this.applyProfile(profile);
  }

  setBiome(palette: BiomePalette): void {
    fxTheme.bright = palette.skyHorizon.l > 55;
    this.syncTheme();
    const c = toColor(palette.fog);
    this.dustRgb = [Math.min(1, c.r * 1.1), Math.min(1, c.g * 1.05), Math.min(1, c.b)];
  }

  /** Re-reads the effect colours, e.g. after a different field-line colour is equipped. */
  syncTheme(): void {
    this.attractRgb = rgbOf(fxTheme.attract);
    this.repelRgb = rgbOf(fxTheme.repel);
    this.repelCoreRgb = rgbOf(fxTheme.repelCore);
    this.additive.setAdditive(!fxTheme.bright);
    this.rings.setBlending(fxTheme.blending);
  }

  applyProfile(profile: QualityProfile): void {
    this.profile = profile;
    this.additive.setCeiling(profile.particleCeiling);
    this.dust.setCeiling(Math.floor(profile.particleCeiling * 0.5 * profile.dustScale));
  }

  setViewport(height: number, fov: number, pixelRatio: number): void {
    this.additive.setScale(height, fov, pixelRatio);
    this.dust.setScale(height, fov, pixelRatio);
  }

  bind(sim: Simulation): void {
    this.unbind();
    this.sim = sim;
    this.crumblers = sim.physics.props.filter((p) => p.kind.reaction?.type === 'crumble');
    const on = sim.events.on.bind(sim.events);
    this.unsubscribe.push(
      on('attach', (e) => {
        this.attachBurst(e.point, e.normal, MATERIALS[e.material].voice, e.speed, e.weak, e.viaSnap);
        this.hooks.shake(e.weak ? 'micro' : e.viaSnap ? (e.speed > 9 ? 'big' : 'small') : e.speed > 11 ? 'big' : 'micro');
      }),
      on('repel', (e) => {
        this.repelBurst(e.point, e.normal, e.direction, e.power);
        this.fieldLines.flipPulse();
        if (e.power > 0.6) this.hooks.shake('small');
      }),
      on('impact', (e) => {
        this.impactDust(e.point, e.normal, e.speed, MATERIALS[e.material].id);
        if (e.speed > 11) this.hooks.shake('big');
        else if (e.speed > 6) this.hooks.shake('micro');
      }),
      on('weakCrumble', (e) => this.crumble(e.point)),
      on('glassBreak', (e) => this.shards(e.point)),
      on('boing', (e) => {
        this.boingBurst(e.point, e.normal, e.outSpeed);
        this.hooks.shake(e.outSpeed > 12 ? 'small' : 'micro');
      }),
      on('crumble', (e) => {
        this.crumbleSurface(e.propIndex);
        this.hooks.shake('micro');
      }),
      on('summit', () => this.hooks.flash(0.0)),
    );
  }

  unbind(): void {
    this.unsubscribe.forEach((off) => off());
    this.unsubscribe = [];
  }

  reset(): void {
    this.additive.clear();
    this.dust.clear();
    this.rings.clear();
  }

  update(dt: number, view: MagnoView, head: Vec2, axisAngle: number): void {
    this.fieldLines.update(view, head, axisAngle, dt);
    if (view.snapEngaged) this.snapTrail(view);
    this.shedGrit(dt);
    this.shedAmbient(head, dt);
    this.additive.update(dt);
    this.dust.update(dt);
    this.rings.update(dt);
  }

  /**
   * Ambient dust motes drifting around MAGNO's head, the atmospheric cue the
   * PRD commits to (Chapter 13, per-biome ambient FX). The motes are emitted
   * on the additive pass so they read as dust catching the light, rather than
   * as opaque specks against a bright sky. A small number are released every
   * frame in a ring around the head (not on it), so the air feels alive without
   * competing with the magnet silhouette for the player's attention.
   */
  private shedAmbient(head: Vec2, dt: number): void {
    if (this.profile.dustScale <= 0) return;
    // Emit roughly 8 motes per second, scaled by the device's dust budget.
    const rate = 8 * this.profile.dustScale;
    this.ambientAccum += rate * dt;
    const n = Math.floor(this.ambientAccum);
    this.ambientAccum -= n;
    if (n === 0) return;
    const budget = this.budgetFor(n);
    for (let i = 0; i < budget; i++) {
      // Emit in a ring 4 to 8 units from the head, so motes drift past MAGNO
      // without sitting on the magnet poles and washing out the signature colour.
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(4, 8);
      const x = head.x + Math.cos(angle) * radius;
      const y = head.y + Math.sin(angle) * radius + 2;
      this.additive.emit({
        x,
        y,
        vx: this.rng.range(-0.3, 0.3),
        vy: this.rng.range(0.1, 0.6),
        life: this.rng.range(2.5, 4.5),
        size: this.rng.range(0.14, 0.2),
        sizeEnd: 0.03,
        color: this.dustRgb,
        alpha: 0.7,
        gravity: -0.05,
        drag: 0.4,
      });
    }
  }

  // ---------------------------------------------------------------- emitters

  private budgetFor(count: number): number {
    const total = this.additive.alive + this.dust.alive;
    return Math.max(0, Math.min(count, this.profile.particleCeiling - total));
  }

  private attachBurst(point: Vec2, normal: Vec2, voice: string, speed: number, weak: boolean, viaSnap: boolean): void {
    const color = SPARK[voice] ?? SPARK.beam!;
    const count = this.budgetFor(Math.round(clamp(16 + speed * 1.8, 16, 40)));
    const base = Math.atan2(normal.y, normal.x);
    for (let i = 0; i < count; i++) {
      const a = base + this.rng.range(-1.25, 1.25);
      const v = this.rng.range(2, 7.5) * (weak ? 0.7 : 1);
      this.additive.emit({
        x: point.x,
        y: point.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: this.rng.range(0.22, 0.5),
        size: this.rng.range(0.07, 0.16),
        sizeEnd: 0.02,
        color,
        gravity: -9,
        drag: 2.2,
      });
    }
    const ringColor = weak ? ([0.9, 0.7, 0.5] as Rgb) : this.attractRgb;
    this.rings.spawn(point.x, point.y, 0.08, 0.95, 0.3, ringColor, base + Math.PI / 2, 0.42);
    // A snap-powered attach gets a second, larger cyan burst so the player
    // feels the magnetic click. The burst is on the additive pass so it glows
    // against any biome, and the ring expands faster and further than the
    // contact ring so the two reads as cause and effect. Emission count and
    // particle size are pushed well past subtle so the snap reads as an event
    // even on tier-low software WebGL where additive blending is dimmer.
    if (viaSnap) {
      const snapCount = this.budgetFor(40);
      for (let i = 0; i < snapCount; i++) {
        const a = this.rng.range(0, Math.PI * 2);
        const v = this.rng.range(4, 12);
        this.additive.emit({
          x: point.x,
          y: point.y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: this.rng.range(0.4, 0.75),
          size: this.rng.range(0.16, 0.28),
          sizeEnd: 0.03,
          color: i % 3 === 0 ? [1, 1, 1] : this.attractRgb,
          alpha: 0.95,
          drag: 2.0,
        });
      }
      this.rings.spawn(point.x, point.y, 0.16, 2.2, 0.55, this.attractRgb, base + Math.PI / 2, 0.75);
      this.rings.spawn(point.x, point.y, 0.2, 1.4, 0.4, [1, 1, 1], base + Math.PI / 2, 0.5);
    }
  }

  private repelBurst(point: Vec2, normal: Vec2, direction: Vec2, power: number): void {
    const base = Math.atan2(normal.y, normal.x);
    this.rings.spawn(point.x, point.y, 1.15, 0.12, 0.24, this.repelRgb, base + Math.PI / 2, 0.5);
    const dir = norm2(direction);
    const heading = Math.atan2(dir.y, dir.x);
    const wisps = this.budgetFor(6 + Math.round(power * 10));
    for (let i = 0; i < wisps; i++) {
      const a = heading + this.rng.range(-0.45, 0.45);
      const v = this.rng.range(3, 9) * (0.6 + power * 0.6);
      this.additive.emit({
        x: point.x + normal.x * 0.2,
        y: point.y + normal.y * 0.2,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: this.rng.range(0.22, 0.42),
        size: this.rng.range(0.12, 0.22),
        sizeEnd: 0.03,
        color: i % 2 ? this.repelRgb : this.repelCoreRgb,
        drag: 3,
      });
    }
  }

  private snapTrail(view: MagnoView): void {
    for (let i = 0; i < 2; i++) {
      if (this.budgetFor(1) === 0) return;
      this.additive.emit({
        x: view.position.x + this.rng.range(-0.1, 0.1),
        y: view.position.y + this.rng.range(-0.1, 0.1),
        vx: -view.velocity.x * 0.08 + this.rng.range(-0.6, 0.6),
        vy: -view.velocity.y * 0.08 + this.rng.range(-0.6, 0.6),
        life: this.rng.range(0.25, 0.4),
        size: this.rng.range(0.1, 0.18),
        sizeEnd: 0.02,
        color: this.attractRgb,
        drag: 2,
        alpha: 0.8,
      });
    }
  }

  private impactDust(point: Vec2, normal: Vec2, speed: number, material: MaterialId): void {
    if (speed < 3.5) return;
    const strength = clamp((speed - 3.5) / 14, 0.15, 1);
    const count = Math.round(14 * strength * this.profile.dustScale);
    const tangent = { x: -normal.y, y: normal.x };
    const tone: Rgb = material === 'glass' ? [0.85, 0.95, 1] : this.dustRgb;
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const v = this.rng.range(0.8, 3.6) * (0.5 + strength);
      this.dust.emit({
        x: point.x + normal.x * 0.1,
        y: point.y + normal.y * 0.1,
        vx: tangent.x * v * side + normal.x * this.rng.range(0.4, 1.4),
        vy: tangent.y * v * side + normal.y * this.rng.range(0.4, 1.4),
        life: this.rng.range(0.5, 0.95),
        size: this.rng.range(0.32, 0.6) * (0.6 + strength),
        sizeEnd: this.rng.range(0.9, 1.5) * (0.6 + strength),
        color: tone,
        alpha: 0.42,
        drag: 1.8,
        gravity: 0.6,
      });
    }
    if (speed > 7) {
      const angle = Math.atan2(normal.y, normal.x) + Math.PI / 2;
      this.rings.spawn(point.x, point.y, 0.2, 1.1 + strength * 1.4, 0.4, [tone[0] * 0.7, tone[1] * 0.7, tone[2] * 0.7], angle, 0.28);
    }
  }

  /** Grit and frost drop from the underside of a surface that is about to give way. */
  private shedGrit(dt: number): void {
    const sim = this.sim;
    if (!sim) return;
    for (const prop of this.crumblers) {
      const { stress, gone } = sim.reactive.crumbleView(prop.index);
      if (gone || stress < 0.4 || this.rng.next() > dt * (8 + stress * 20)) continue;
      const icy = prop.kind.detail === 'ice';
      this.dust.emit({
        x: prop.placement.x + this.rng.range(-prop.width / 2, prop.width / 2),
        y: prop.placement.y - prop.height / 2,
        vx: this.rng.range(-0.3, 0.3),
        vy: -this.rng.range(0.4, 1.4),
        life: this.rng.range(0.5, 0.9),
        size: this.rng.range(0.06, 0.12),
        sizeEnd: 0.03,
        color: icy ? [0.86, 0.96, 1] : [0.6, 0.38, 0.24],
        alpha: 0.8,
        gravity: -5,
        drag: 0.5,
      });
    }
  }

  private boingBurst(point: Vec2, normal: Vec2, outSpeed: number): void {
    const strength = clamp(outSpeed / 16, 0.3, 1);
    const angle = Math.atan2(normal.y, normal.x) + Math.PI / 2;
    this.rings.spawn(point.x, point.y, 0.3, 1.8 + strength * 2.2, 0.38, [1, 0.8, 0.5], angle, 0.5);
    this.rings.spawn(point.x, point.y, 0.2, 1.1 + strength * 1.4, 0.3, [1, 0.96, 0.82], angle, 0.35);
    const tangent = { x: -normal.y, y: normal.x };
    const count = this.budgetFor(Math.round(12 * strength * this.profile.dustScale));
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const v = this.rng.range(1.5, 4.5) * (0.6 + strength);
      this.dust.emit({
        x: point.x + normal.x * 0.1,
        y: point.y + normal.y * 0.1,
        vx: tangent.x * v * side + normal.x * this.rng.range(0.5, 2),
        vy: tangent.y * v * side + normal.y * this.rng.range(0.5, 2),
        life: this.rng.range(0.4, 0.8),
        size: this.rng.range(0.3, 0.55),
        sizeEnd: this.rng.range(0.8, 1.3),
        color: this.dustRgb,
        alpha: 0.4,
        drag: 2,
      });
    }
  }

  /** A whole surface letting go: chips along its full length rather than a single burst. */
  private crumbleSurface(propIndex: number): void {
    const prop = this.sim?.physics.props[propIndex];
    if (!prop) return;
    const icy = prop.kind.detail === 'ice';
    const n = this.budgetFor(icy ? 34 : 24);
    for (let i = 0; i < n; i++) {
      this.additive.emit({
        x: prop.placement.x + this.rng.range(-prop.width / 2, prop.width / 2),
        y: prop.placement.y + this.rng.range(-prop.height / 2, prop.height / 2),
        vx: this.rng.range(-1.8, 1.8),
        vy: this.rng.range(-0.5, 2),
        life: this.rng.range(0.6, 1.1),
        size: this.rng.range(0.08, 0.2),
        sizeEnd: 0.04,
        color: icy ? [0.8, 0.96, 1] : [0.9, 0.55, 0.32],
        shape: 1,
        gravity: -12,
        drag: 0.5,
      });
    }
  }

  private crumble(point: Vec2): void {
    const n = this.budgetFor(16);
    for (let i = 0; i < n; i++) {
      this.additive.emit({
        x: point.x + this.rng.range(-0.5, 0.5),
        y: point.y + this.rng.range(-0.1, 0.1),
        vx: this.rng.range(-1.6, 1.6),
        vy: this.rng.range(0, 2),
        life: this.rng.range(0.5, 0.9),
        size: this.rng.range(0.07, 0.15),
        sizeEnd: 0.05,
        color: [0.9, 0.55, 0.32],
        shape: 1,
        gravity: -11,
        drag: 0.6,
      });
    }
  }

  private shards(point: Vec2): void {
    const n = this.budgetFor(28);
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const v = this.rng.range(2, 9);
      this.additive.emit({
        x: point.x,
        y: point.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v + 2,
        life: this.rng.range(0.5, 0.9),
        size: this.rng.range(0.08, 0.2),
        sizeEnd: 0.04,
        color: [0.75, 0.95, 1],
        shape: 1,
        gravity: -14,
        drag: 0.4,
      });
    }
  }

  /** Level-clear constellation: confetti sparks and a beacon flare. */
  celebrate(point: Vec2): void {
    const n = this.budgetFor(80);
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + this.rng.range(-1.2, 1.2);
      const v = this.rng.range(4, 12);
      this.additive.emit({
        x: point.x,
        y: point.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: this.rng.range(1.3, 2.3),
        size: this.rng.range(0.1, 0.2),
        sizeEnd: 0.07,
        color: CONFETTI[i % CONFETTI.length]!,
        shape: 1,
        gravity: -5.5,
        drag: 0.9,
      });
    }
    this.rings.spawn(point.x, point.y, 0.4, 4.2, 0.7, [1, 0.86, 0.45], 0, 1);
    this.rings.spawn(point.x, point.y, 0.2, 2.6, 0.55, [1, 0.97, 0.8], 0, 1);
  }

  dispose(): void {
    this.unbind();
    this.additive.dispose();
    this.dust.dispose();
    this.rings.dispose();
    this.fieldLines.dispose();
  }
}
