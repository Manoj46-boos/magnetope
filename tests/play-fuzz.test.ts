import { describe, expect, it } from 'vitest';
import { TUNING } from '@/config/tuning';
import { ALL_LEVELS } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { Simulation } from '@/sim/simulation';
import type { FallReport } from '@/sim/fall';
import type { InputFrame } from '@/sim/types';

/**
 * Thirty seconds of erratic play on every level, the way a player who has no idea what they are
 * doing would produce it: taps, holds, jittery steering, long stretches of nothing. Nothing a
 * player does may corrupt the run: no NaN, no runaway body, no fall scored twice for one descent,
 * no checkpoint going backwards, no body appearing from nowhere.
 */

const SECONDS = 30;
const TICKS = SECONDS * TUNING.sim.hz;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An erratic player: each habit lasts a random stretch, then another one takes over. */
function* erratic(seed: number): Generator<InputFrame> {
  const random = seeded(seed);
  let held = false;
  let tiltX = 0;
  let tiltY = 0;
  for (;;) {
    const habit = random();
    const length = 4 + Math.floor(random() * 50);
    for (let i = 0; i < length; i++) {
      const wasHeld = held;
      if (habit < 0.25) held = i < length / 2;
      else if (habit < 0.45) held = random() < 0.5;
      else if (habit < 0.6) held = false;
      else held = i < length * 0.8 && random() < 0.97;
      if (habit >= 0.2) {
        tiltX = habit < 0.7 ? Math.sin((i + habit * 100) / 7) : random() * 2 - 1;
        tiltY = habit < 0.85 ? random() * 2 - 1 : 1;
      } else {
        tiltX = 0;
        tiltY = 0;
      }
      yield { tiltX, tiltY, flipHeld: held, flipDown: held && !wasHeld, flipUp: !held && wasHeld };
    }
  }
}

describe('erratic play on every level', () => {
  it.each(ALL_LEVELS.map((level, index) => [level.id, index] as const))('%s stays coherent for thirty seconds', async (_id, index) => {
    const level = ALL_LEVELS[index]!;
    const sim = new Simulation(await loadRapier(), level);
    const bodies = sim.physics.world.bodies.len();
    const falls: Array<{ tick: number; report: FallReport }> = [];
    let voids = 0;
    sim.events.on('fall', (report) => falls.push({ tick: sim.tick, report }));
    sim.events.on('respawn', (e) => {
      if (e.reason === 'void') voids++;
    });

    const player = erratic(index * 7919 + 13);
    let lastCheckpoint = sim.run.checkpoint;
    let sawCleared = false;
    let lowSinceFall = true;
    let lastFallTick = -Infinity;

    for (let tick = 0; tick < TICKS; tick++) {
      sim.step(player.next().value);
      const view = sim.magno.view;

      const finite = Number.isFinite(view.position.x) && Number.isFinite(view.position.y) && Number.isFinite(view.velocity.x) && Number.isFinite(view.velocity.y);
      if (!finite) throw new Error(`${level.id}: non-finite state at tick ${tick}`);
      if (Math.abs(view.position.x) > 400 || view.position.y > level.summit.y + 400) throw new Error(`${level.id}: MAGNO left the world (${view.position.x.toFixed(0)}, ${view.position.y.toFixed(0)}) at tick ${tick}`);

      if (sim.run.checkpoint < lastCheckpoint) throw new Error(`${level.id}: checkpoint went backwards at tick ${tick}`);
      lastCheckpoint = sim.run.checkpoint;
      if (sim.run.checkpoint >= level.checkpoints.length) throw new Error(`${level.id}: checkpoint index ${sim.run.checkpoint} out of range`);
      if (sawCleared && !sim.run.cleared) throw new Error(`${level.id}: a cleared run un-cleared itself`);
      sawCleared = sim.run.cleared;

      if (view.dropMeters < TUNING.fall.minFallHeight) lowSinceFall = true;
      const fresh = falls.at(-1);
      if (fresh && fresh.tick > lastFallTick) {
        if (!lowSinceFall) throw new Error(`${level.id}: two falls scored for one descent (ticks ${lastFallTick} and ${fresh.tick})`);
        lowSinceFall = false;
        lastFallTick = fresh.tick;
      }
    }

    expect(sim.physics.world.bodies.len(), 'bodies appear or vanish').toBe(bodies);
    expect(sim.run.fallCount, 'fall count follows the events').toBe(falls.length + voids);
    expect(sim.run.beyondSafetyLine).toBeLessThanOrEqual(sim.run.fallCount);
    sim.dispose();
  }, 60_000);
});
