import { loadRapier } from '@/sim/rapier';
import { Simulation } from '@/sim/simulation';
import type { InputFrame, LevelDef, PropPlacement } from '@/sim/types';

export const TICK_MS = 1000 / 60;
export const ticks = (ms: number): number => Math.round(ms / TICK_MS);

export function makeLevel(props: PropPlacement[], overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test',
    biome: 'scrapyard',
    index: 1,
    name: 'Test',
    parSeconds: 60,
    spawn: { x: 0, y: 0 },
    summit: { x: 0, y: 100, radius: 1 },
    checkpoints: [],
    killY: -60,
    bounds: { minX: -30, maxX: 30 },
    fallRateTarget: 0.2,
    props,
    ...overrides,
  };
}

export const floor = (overrides: Partial<PropPlacement> = {}): PropPlacement => ({
  kind: 'plate',
  x: 0,
  y: -0.4,
  w: 16,
  h: 0.8,
  ...overrides,
});

export async function createSim(level: LevelDef): Promise<Simulation> {
  const rapier = await loadRapier();
  return new Simulation(rapier, level);
}

interface Pointer {
  flipHeld: boolean;
  tiltX: number;
  tiltY: number;
}

/** Scripted player. Edges are derived from held-state changes, mirroring the real input layer. */
export class Driver {
  private pointer: Pointer = { flipHeld: false, tiltX: 0, tiltY: 0 };
  readonly log: string[] = [];

  constructor(readonly sim: Simulation) {}

  /** A harmless nudge that starts the run clock, which is what scripted hazards and wind follow. */
  start(): this {
    return this.tilt(0.3, 0).tick(2).tilt(0, 0);
  }

  tilt(x: number, y: number): this {
    this.pointer.tiltX = x;
    this.pointer.tiltY = y;
    return this;
  }

  press(): this {
    this.pointer.flipHeld = true;
    return this;
  }

  release(): this {
    this.pointer.flipHeld = false;
    return this;
  }

  private prevHeld = false;

  tick(n = 1): this {
    for (let i = 0; i < n; i++) {
      const held = this.pointer.flipHeld;
      const frame: InputFrame = {
        tiltX: this.pointer.tiltX,
        tiltY: this.pointer.tiltY,
        flipHeld: held,
        flipDown: held && !this.prevHeld,
        flipUp: !held && this.prevHeld,
      };
      this.prevHeld = held;
      this.sim.step(frame);
    }
    return this;
  }

  ms(duration: number): this {
    return this.tick(ticks(duration));
  }

  /** Tap: press for `holdMs`, then release on the following tick. */
  tap(holdMs = 50): this {
    return this.press().ms(holdMs).release().tick();
  }

  until(predicate: () => boolean, maxMs = 5000): boolean {
    const limit = ticks(maxMs);
    for (let i = 0; i < limit; i++) {
      if (predicate()) return true;
      this.tick();
    }
    return predicate();
  }

  get view() {
    return this.sim.magno.view;
  }
}
