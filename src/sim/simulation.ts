import type RAPIER from '@dimforge/rapier3d-compat';
import { TUNING } from '@/config/tuning';
import { Emitter } from '@/core/emitter';
import { len2, norm2, type Vec2 } from '@/core/mathx';
import { FallTracker, type FallEvents, type FallReport } from './fall';
import { MagnoController, type MagnoData, type MagnoEvents } from './magno';
import { ReactiveSystem, type ReactiveData, type ReactiveEvents } from './reactive';
import type { InputFrame, LevelDef } from './types';
import { windAcceleration } from './wind';
import { PhysicsWorld } from './world';

export interface RunSummary {
  clearTimeMs: number;
  falls: number;
  noFall: boolean;
  underPar: boolean;
  stars: number;
}

export interface SimEvents extends MagnoEvents, FallEvents, ReactiveEvents {
  runStart: Record<string, never>;
  summit: RunSummary;
  checkpoint: { index: number };
  respawn: { reason: 'void' | 'second-wind' };
  glassBreak: { propIndex: number; point: Vec2 };
}

interface RunData {
  started: boolean;
  timeMs: number;
  cleared: boolean;
  fallCount: number;
  beyondSafetyLine: number;
  checkpoint: number;
  maxAltitude: number;
}

export interface SimSnapshot {
  physics: Uint8Array;
  magno: MagnoData;
  reactive: ReactiveData;
  run: RunData;
  tick: number;
}

const FIELD_RANGE = 3.5;
const FIELD_FORCE = 260;
const GLASS_BREAK_SPEED = 5;
const RUN_START_TILT = 0.2;

export const starsFor = (cleared: boolean, noFall: boolean, underPar: boolean): number =>
  (cleared ? 1 : 0) + (cleared && noFall ? 1 : 0) + (cleared && underPar ? 1 : 0);

/**
 * Headless, deterministic game simulation. It has no knowledge of rendering,
 * audio or the DOM, which is what lets the playtest bots, ghosts and tests
 * drive the very same code the player runs.
 */
export class Simulation {
  readonly events = new Emitter<SimEvents>();
  readonly physics: PhysicsWorld;
  readonly magno: MagnoController;
  readonly falls: FallTracker;
  readonly reactive: ReactiveSystem;
  run: RunData = Simulation.freshRun();
  tick = 0;
  private lastFall: FallReport | null = null;

  constructor(
    rapier: typeof RAPIER,
    readonly level: LevelDef,
  ) {
    this.physics = new PhysicsWorld(rapier, level);
    this.magno = new MagnoController(this.physics);
    this.falls = new FallTracker(this.physics, this.magno);
    this.reactive = new ReactiveSystem(this.physics);
    this.forward();
  }

  private static freshRun(): RunData {
    return { started: false, timeMs: 0, cleared: false, fallCount: 0, beyondSafetyLine: 0, checkpoint: -1, maxAltitude: 0 };
  }

  private forward(): void {
    const relay = <K extends keyof MagnoEvents>(name: K) =>
      this.magno.events.on(name, (payload) => this.events.emit(name, payload as SimEvents[K]));
    (['attach', 'detach', 'chargeLevel', 'repel', 'snapArm', 'snapEngage', 'snapWhiff', 'impact', 'limp', 'recoverBegin', 'recoverEnd', 'weakCrumble', 'boing'] as const).forEach(
      (name) => relay(name),
    );
    (['crumbleWarn', 'crumble', 'restore', 'followerMove'] as const).forEach((name) =>
      this.reactive.events.on(name, (payload) => this.events.emit(name, payload as SimEvents[typeof name])),
    );
    this.falls.events.on('fall', (report) => {
      this.lastFall = report;
      this.run.fallCount++;
      if (report.beyondSafetyLine) this.run.beyondSafetyLine++;
      this.events.emit('fall', report);
    });
    this.falls.events.on('slowMo', (e) => this.events.emit('slowMo', e));
    this.falls.events.on('saved', (e) => this.events.emit('saved', e));
    this.magno.events.on('impact', (e) => this.onImpact(e));
  }

  get lastFallReport(): FallReport | null {
    return this.lastFall;
  }

  /** Time the scripted hazards and wind have been running, in milliseconds. Zero until the run starts. */
  get hazardClockMs(): number {
    return this.run.timeMs;
  }

  get timeSeconds(): number {
    return this.run.timeMs / 1000;
  }

  /** Advance exactly one fixed 60 Hz tick. */
  step(input: InputFrame): void {
    const run = this.run;
    if (!run.started && (input.flipDown || Math.hypot(input.tiltX, input.tiltY) > RUN_START_TILT)) {
      run.started = true;
      this.events.emit('runStart', {});
    }
    // Scripted hazards run on the run clock, so every attempt meets them in the same state and ghosts stay in sync.
    const clockMs = run.timeMs;
    if (run.started && !run.cleared) run.timeMs += 1000 / TUNING.sim.hz;

    const wind = windAcceleration(this.level, clockMs, this.magno.view.position.y);
    this.physics.clearForces();
    this.physics.drive(clockMs);
    this.reactive.step(this.magno.contactHandles(), this.magno.view.position);
    this.applyFieldForces();
    this.applyWindToProps(clockMs);
    this.magno.update(input, wind);
    this.physics.step();
    this.tick++;

    this.falls.update(run.timeMs);
    this.checkRules();
  }

  /** Hung props catch the wind at their own height, so a gust sets a swing plate rocking before MAGNO arrives. */
  private applyWindToProps(timeMs: number): void {
    if (!this.level.wind) return;
    for (const prop of this.physics.dynamicProps) {
      const windage = prop.kind.windage;
      if (!windage) continue;
      const body = this.physics.world.getRigidBody(prop.bodyHandle);
      const accel = windAcceleration(this.level, timeMs, body.translation().y);
      if (accel !== 0) body.addForce({ x: body.mass() * accel * windage, y: 0, z: 0 }, true);
    }
  }

  private applyFieldForces(): void {
    const view = this.magno.view;
    if (view.state !== 'airborne' && view.state !== 'attached' && view.state !== 'charging') return;
    const body = this.physics.magnoBody;
    for (const prop of this.physics.props) {
      if (!prop.dynamic || !prop.kind.live) continue;
      const pb = this.physics.world.getRigidBody(prop.bodyHandle);
      const t = pb.translation();
      const delta = { x: view.position.x - t.x, y: view.position.y - t.y };
      const dist = len2(delta);
      if (dist > FIELD_RANGE || dist < 0.4) continue;
      const falloff = 1 - dist / FIELD_RANGE;
      const dir = norm2(delta);
      const f = FIELD_FORCE * falloff;
      pb.addForce({ x: dir.x * f, y: dir.y * f, z: 0 }, true);
      body.addForce({ x: -dir.x * f * 0.2, y: -dir.y * f * 0.2, z: 0 }, true);
    }
  }

  private onImpact(e: MagnoEvents['impact']): void {
    if (e.speed < GLASS_BREAK_SPEED) return;
    for (const prop of this.physics.props) {
      const surface = this.physics.surfaces.get(prop.colliderHandle);
      if (!surface?.material.breakable) continue;
      const t = this.physics.world.getRigidBody(prop.bodyHandle).translation();
      if (Math.hypot(t.x - e.point.x, t.y - e.point.y) > Math.max(prop.width, prop.height) / 2 + 0.4) continue;
      this.physics.removeSurface(prop.colliderHandle);
      this.events.emit('glassBreak', { propIndex: prop.index, point: e.point });
    }
  }

  private checkRules(): void {
    const run = this.run;
    const view = this.magno.view;
    run.maxAltitude = Math.max(run.maxAltitude, view.position.y);

    const { checkpoints, summit, killY } = this.level;
    checkpoints.forEach((cp, index) => {
      if (index > run.checkpoint && view.position.y >= cp.y) {
        run.checkpoint = index;
        this.events.emit('checkpoint', { index });
      }
    });

    if (view.position.y < killY) {
      this.respawn('void');
      return;
    }

    if (!run.cleared && run.started) {
      const reach = len2({ x: view.position.x - summit.x, y: view.position.y - summit.y });
      if (reach <= summit.radius) {
        run.cleared = true;
        const noFall = run.beyondSafetyLine === 0;
        const underPar = run.timeMs / 1000 <= this.level.parSeconds;
        this.events.emit('summit', {
          clearTimeMs: run.timeMs,
          falls: run.fallCount,
          noFall,
          underPar,
          stars: starsFor(true, noFall, underPar),
        });
      }
    }
  }

  /** Put MAGNO back at the last checkpoint (or the base) with all momentum cleared. */
  respawn(reason: 'void' | 'second-wind'): void {
    const target = this.run.checkpoint >= 0 ? this.level.checkpoints[this.run.checkpoint] : undefined;
    const at = target ?? this.level.spawn;
    const body = this.physics.magnoBody;
    body.setTranslation({ x: at.x, y: at.y + TUNING.body.radius + TUNING.body.halfHeight + 0.1, z: 0 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.magno.reset();
    this.falls.reset();
    if (reason === 'void') {
      this.run.fallCount++;
      this.run.beyondSafetyLine++;
    }
    this.events.emit('respawn', { reason });
  }

  snapshot(): SimSnapshot {
    return {
      physics: this.physics.snapshot(),
      magno: this.magno.snapshot(),
      reactive: this.reactive.snapshot(),
      run: { ...this.run },
      tick: this.tick,
    };
  }

  restore(snap: SimSnapshot): void {
    this.physics.restore(snap.physics);
    this.magno.restore(snap.magno);
    this.reactive.restore(snap.reactive);
    this.run = { ...snap.run };
    this.tick = snap.tick;
    this.falls.reset();
  }

  dispose(): void {
    this.falls.dispose();
    this.physics.dispose();
  }
}
