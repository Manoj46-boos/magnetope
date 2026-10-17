import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TUNING } from '@/config/tuning';
import { ALL_LEVELS } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';
import { IDLE_INPUT } from '@/sim/types';

/**
 * PRD 10.4: no more than 260 physics bodies alive at once. The levels sit far
 * inside that, so the gate is what keeps a future level from quietly spending
 * the headroom the device tiers depend on.
 */

const CEILING = TUNING.budget.maxBodies;
const ROUTE_TICKS_AFTER = 600;

const routeOf = (id: string) =>
  decodeRecording(readFileSync(fileURLToPath(new URL(`../src/levels/routes/${id}.json`, import.meta.url)), 'utf8'));

describe('physics body budget', () => {
  it('holds the PRD ceiling at 260', () => {
    expect(CEILING).toBe(260);
  });

  it('is respected by every level as it is built', async () => {
    const rapier = await loadRapier();
    const counts = ALL_LEVELS.map((level) => {
      const sim = new Simulation(rapier, level);
      const bodies = sim.physics.world.bodies.len();
      sim.dispose();
      return { id: level.id, bodies };
    });
    const over = counts.filter((c) => c.bodies > CEILING);
    expect(over).toEqual([]);
    expect(Math.max(...counts.map((c) => c.bodies))).toBeGreaterThan(40);
  });

  it('leaves at least half the ceiling free in every level, so a new prop never lands a level on the limit', async () => {
    const rapier = await loadRapier();
    for (const level of ALL_LEVELS) {
      const sim = new Simulation(rapier, level);
      const bodies = sim.physics.world.bodies.len();
      sim.dispose();
      expect(bodies, level.id).toBeLessThanOrEqual(CEILING / 2);
    }
  });

  it.each(['playground-14', 'playground-08', 'scrapyard-13', 'stratosphere-14', 'playground-13'])(
    'never grows past the ceiling while %s is played through and left to settle',
    async (id) => {
      const level = ALL_LEVELS.find((l) => l.id === id)!;
      const sim = new Simulation(await loadRapier(), level);
      const player = new ReplayPlayer(routeOf(id));
      const start = sim.physics.world.bodies.len();
      let peak = start;
      let tick = 0;
      let after = 0;
      while (after < ROUTE_TICKS_AFTER && tick++ < 12_000) {
        sim.step(player.done ? IDLE_INPUT : player.next());
        if (player.done) after++;
        if (tick % 20 === 0) peak = Math.max(peak, sim.physics.world.bodies.len());
      }
      peak = Math.max(peak, sim.physics.world.bodies.len());
      sim.dispose();
      expect(peak).toBeLessThanOrEqual(CEILING);
      expect(peak - start, 'bodies a level makes while it runs').toBeLessThanOrEqual(20);
    },
    120_000,
  );
});
