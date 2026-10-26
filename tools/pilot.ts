import type { Rng } from '@/core/rng';
import type { Simulation } from '@/sim/simulation';
import type { InputFrame } from '@/sim/types';

/**
 * Hands for the development bots: the macro vocabulary a player's inputs fall into
 * (charge and launch, snap, crawl, wait), a pilot that feeds the simulation frame by
 * frame, and the routine that carries one macro out from a standing hold.
 */

export type Vec = [number, number];

export type Macro =
  | { kind: 'launch'; holdMs: number; tilt: Vec; snap?: { delayMs: number; aim: Vec } }
  | { kind: 'crawl'; dir: Vec; ms: number }
  /** Hang still and let a moving platform come round. */
  | { kind: 'wait'; ms: number };

export interface MacroSpace {
  holds?: number[];
  tilts?: Vec[];
  snapDelays?: number[];
  crawlMs?: number[];
  waitMs?: number[];
}

const DEFAULT_SPACE = {
  holds: [0, 380, 900],
  tilts: [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0.7, 0.7],
    [-0.7, 0.7],
    [0, 1],
  ] as Vec[],
  snapDelays: [220, 420, 640],
  crawlMs: [700, 1500],
  waitMs: [900, 2000, 3600],
};

/** Time allowed for a hop to land at normal gravity; lighter levels fly proportionally longer. */
const LANDING_WINDOW_MS = 4200;
/** Consecutive attached ticks that count as having landed. */
const STABLE_TICKS = 8;
const SETTLE_MS = 300;

export const TICK = 1000 / 60;
export const ticksOf = (ms: number): number => Math.max(1, Math.round(ms / TICK));

export const idle = (held: boolean, tilt: Vec): InputFrame => ({
  tiltX: tilt[0],
  tiltY: tilt[1],
  flipHeld: held,
  flipDown: false,
  flipUp: false,
});

/** Drives a simulation while recording the exact frames it fed in. */
export class Pilot {
  private held = false;
  private lastHeld = false;
  tilt: Vec = [0, 0];
  readonly frames: InputFrame[];

  constructor(
    readonly sim: Simulation,
    seed: InputFrame[],
  ) {
    this.frames = seed;
  }

  step(n = 1): void {
    for (let i = 0; i < n; i++) {
      const held = this.held;
      const frame: InputFrame = { ...idle(held, this.tilt), flipDown: held && !this.lastHeld, flipUp: !held && this.lastHeld };
      this.lastHeld = held;
      this.frames.push(frame);
      this.sim.step(frame);
    }
  }

  press(): void {
    this.held = true;
  }

  release(): void {
    this.held = false;
  }

  /** Re-sync the edge detector when continuing from a stored node. */
  resume(held: boolean): void {
    this.held = held;
    this.lastHeld = held;
  }

  get attachedStable(): boolean {
    return this.sim.magno.view.state === 'attached';
  }
}

export function buildMacros(space: MacroSpace = {}): Macro[] {
  const holds = space.holds ?? DEFAULT_SPACE.holds;
  const tilts = space.tilts ?? DEFAULT_SPACE.tilts;
  const delays = space.snapDelays ?? DEFAULT_SPACE.snapDelays;
  const crawls = space.crawlMs ?? DEFAULT_SPACE.crawlMs;
  const macros: Macro[] = [];
  for (const holdMs of holds) {
    for (const tilt of tilts) {
      macros.push({ kind: 'launch', holdMs, tilt });
      for (const delayMs of delays) {
        macros.push({ kind: 'launch', holdMs, tilt, snap: { delayMs, aim: [tilt[0], Math.max(tilt[1], 0.7)] } });
        macros.push({ kind: 'launch', holdMs, tilt, snap: { delayMs, aim: [0, 1] } });
      }
    }
  }
  for (const ms of crawls) {
    for (const dir of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Vec[]) macros.push({ kind: 'crawl', dir, ms });
  }
  for (const ms of space.waitMs ?? DEFAULT_SPACE.waitMs) macros.push({ kind: 'wait', ms });
  return macros;
}

export interface Noise {
  rng: Rng;
  timingTicks: number;
  tilt: number;
}

const wobble = (noise: Noise | undefined, v: Vec): Vec =>
  noise
    ? [Math.max(-1, Math.min(1, v[0] + noise.rng.range(-noise.tilt, noise.tilt))), Math.max(-1, Math.min(1, v[1] + noise.rng.range(-noise.tilt, noise.tilt)))]
    : v;

const slip = (noise: Noise | undefined): number =>
  noise ? Math.round(noise.rng.range(-noise.timingTicks, noise.timingTicks)) : 0;

/** Runs one macro from the current state. Returns true when MAGNO ends up attached and safe.
 *
 * `oneThumb` plays the macro the button layout's single thumb must: the stick
 * is empty on every tick the flip button is held or edged — the aim lands one
 * tick after the release, and the snap press carries no steering, the assist
 * making the catch on its own (R-AC-03). */
export function execute(pilot: Pilot, macro: Macro, noise?: Noise, oneThumb = false): boolean {
  const { sim } = pilot;
  const startFalls = sim.run.fallCount;
  const failed = (): boolean => sim.run.fallCount > startFalls || sim.magno.view.limp;

  if (macro.kind === 'wait') {
    pilot.tilt = [0, 0];
    pilot.step(Math.max(1, ticksOf(macro.ms) + slip(noise)));
  } else if (macro.kind === 'crawl') {
    pilot.tilt = wobble(noise, macro.dir);
    pilot.step(Math.max(1, ticksOf(macro.ms) + slip(noise)));
    pilot.tilt = [0, 0];
  } else {
    pilot.tilt = [0, 0];
    pilot.press();
    pilot.step(Math.max(3, ticksOf(macro.holdMs) + slip(noise)));
    if (oneThumb) {
      pilot.release();
      pilot.step(1);
      pilot.tilt = wobble(noise, macro.tilt);
    } else {
      pilot.tilt = wobble(noise, macro.tilt);
      pilot.release();
      pilot.step(1);
    }
    if (macro.snap) {
      pilot.step(Math.max(1, ticksOf(macro.snap.delayMs) + slip(noise)));
      if (oneThumb) {
        pilot.tilt = [0, 0];
        pilot.press();
        pilot.step(4);
        pilot.release();
      } else {
        pilot.tilt = wobble(noise, macro.snap.aim);
        pilot.press();
        pilot.step(4);
        pilot.release();
      }
    }
  }

  const limit = ticksOf(LANDING_WINDOW_MS / Math.min(1, sim.level.gravityScale ?? 1));
  let stable = 0;
  for (let i = 0; i < limit; i++) {
    pilot.step();
    if (sim.run.cleared) return true;
    if (failed()) return false;
    const attached = pilot.attachedStable;
    stable = attached ? stable + 1 : 0;
    if (stable >= STABLE_TICKS) break;
  }
  if (stable < STABLE_TICKS) return false;
  pilot.tilt = [0, 0];
  pilot.step(ticksOf(SETTLE_MS));
  return pilot.attachedStable && !failed();
}
