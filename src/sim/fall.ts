import { TUNING } from '@/config/tuning';
import { Emitter } from '@/core/emitter';
import type { MagnoController, MagnoEvents } from './magno';
import type { PhysicsWorld } from './world';

export type FallGrade = 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';

export interface FallReport {
  heightMeters: number;
  bounces: number;
  junkDisplaced: number;
  grade: FallGrade;
  score: number;
  /** True once the drop crossed the safety line that costs the no-fall star. */
  beyondSafetyLine: boolean;
  atMs: number;
}

export interface FallEvents {
  fall: FallReport;
  /** The fall crossed the cinematic threshold; the director may slow time. */
  slowMo: { reason: 'height' | 'impact'; heightMeters: number };
  /** The body caught a surface before landing; no fall is scored. */
  saved: { heightMeters: number };
}

const GRADE_STEPS: ReadonlyArray<[number, FallGrade]> = [
  [8, 'C'],
  [16, 'B'],
  [26, 'A'],
  [40, 'S'],
  [60, 'SS'],
];

export const gradeFall = (score: number): FallGrade => {
  for (const [limit, grade] of GRADE_STEPS) if (score < limit) return grade;
  return 'SSS';
};

export const fallScore = (height: number, bounces: number, junk: number): number =>
  height + bounces * 1.5 + junk * 2.5;

interface FallData {
  active: boolean;
  /** A fall was scored and the body has not yet started a new descent; the same drop must not count twice. */
  spent: boolean;
  slowMoFired: boolean;
  bounces: number;
  restMs: number;
  propStart: Array<{ x: number; y: number }>;
}

const JUNK_MOVE_THRESHOLD = 0.75;

/**
 * Watches MAGNO's descent. A fall begins once the drop from the highest point
 * since the last hold passes the stumble threshold, and is scored when the body
 * comes to rest. Catching a surface first cancels it.
 */
export class FallTracker {
  readonly events = new Emitter<FallEvents>();
  data: FallData = { active: false, spent: false, slowMoFired: false, bounces: 0, restMs: 0, propStart: [] };
  private readonly unsubscribe: Array<() => void> = [];

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly magno: MagnoController,
  ) {
    this.unsubscribe.push(
      magno.events.on('attach', () => this.onAttach()),
      magno.events.on('impact', (e) => this.onImpact(e)),
    );
  }

  reset(): void {
    this.data = { active: false, spent: false, slowMoFired: false, bounces: 0, restMs: 0, propStart: [] };
  }

  dispose(): void {
    this.unsubscribe.forEach((off) => off());
  }

  update(timeMs: number): void {
    const view = this.magno.view;
    const d = this.data;
    const airborneish = view.state === 'airborne' || view.state === 'repelled' || view.state === 'recovering';
    if (!airborneish) return;

    if (d.spent && view.dropMeters < TUNING.fall.minFallHeight) d.spent = false;
    if (!d.active && !d.spent && view.dropMeters >= TUNING.fall.minFallHeight && view.velocity.y < 0) {
      d.active = true;
      d.slowMoFired = false;
      d.bounces = 0;
      d.restMs = 0;
      d.propStart = this.physics.dynamicProps.map((p) => {
        const t = this.physics.world.getRigidBody(p.bodyHandle).translation();
        return { x: t.x, y: t.y };
      });
    }
    if (!d.active) return;

    if (!d.slowMoFired && view.dropMeters >= TUNING.fall.slowMoHeight && view.velocity.y < -3) {
      d.slowMoFired = true;
      this.events.emit('slowMo', { reason: 'height', heightMeters: view.dropMeters });
    }

    const speed = Math.hypot(view.velocity.x, view.velocity.y);
    const resting = view.grounded && speed < TUNING.fall.settleSpeed && !view.limp && view.state !== 'recovering';
    const limpDone = view.state === 'recovering';
    if (resting || limpDone) d.restMs += 1000 / TUNING.sim.hz;
    else if (!view.limp) d.restMs = 0;

    if (limpDone || d.restMs >= TUNING.fall.settleMs) this.resolve(timeMs, view.dropMeters);
  }

  private onAttach(): void {
    const d = this.data;
    if (!d.active) return;
    this.events.emit('saved', { heightMeters: this.magno.view.dropMeters });
    d.active = false;
  }

  private onImpact(e: MagnoEvents['impact']): void {
    const d = this.data;
    if (!d.active) return;
    if (e.speed >= 2) d.bounces++;
    if (!d.slowMoFired && e.speed >= TUNING.fall.slowMoImpactSpeed) {
      d.slowMoFired = true;
      this.events.emit('slowMo', { reason: 'impact', heightMeters: this.magno.view.dropMeters });
    }
  }

  private resolve(timeMs: number, dropMeters: number): void {
    const d = this.data;
    d.active = false;
    d.spent = true;
    if (dropMeters < TUNING.fall.minFallHeight) return;

    const junk = this.physics.dynamicProps.reduce((count, p, i) => {
      const start = d.propStart[i];
      if (!start) return count;
      const t = this.physics.world.getRigidBody(p.bodyHandle).translation();
      return Math.hypot(t.x - start.x, t.y - start.y) > JUNK_MOVE_THRESHOLD ? count + 1 : count;
    }, 0);

    const score = fallScore(dropMeters, d.bounces, junk);
    this.events.emit('fall', {
      heightMeters: dropMeters,
      bounces: d.bounces,
      junkDisplaced: junk,
      grade: gradeFall(score),
      score,
      beyondSafetyLine: dropMeters >= TUNING.safetyLine.dropMeters,
      atMs: timeMs,
    });
  }
}
