import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_LEVELS } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';
import { holdShare } from '../tools/respawn-probe';

/**
 * PRD 13.1: Second Wind puts MAGNO back at the last checkpoint, and falling out of the world does
 * the same. That is only worth an ad view if the checkpoint is somewhere he can be put back. A
 * respawn must leave him standing or gripping, near the point, a second later, whatever the
 * scripted hazards (which run on the run clock) are doing at that moment.
 *
 * Four checkpoints sit in Metropolis alleys whose only footing blinks or gives way; they hold at
 * the share of clock readings listed below. The list may only shrink or improve.
 */
const BLINKING_FOOTING: Readonly<Record<string, number>> = {
  'metropolis-03:0': 3 / 8,
  'metropolis-07:0': 5 / 8,
  'metropolis-09:1': 4 / 8,
  'metropolis-13:0': 4 / 8,
};

const checkpoints = ALL_LEVELS.flatMap((level) => level.checkpoints.map((point, index) => ({ level, point, index })));

describe('checkpoints', () => {
  it('give every level but the ten-metre tutorial somewhere to come back to', () => {
    for (const level of ALL_LEVELS.filter((l) => l.id !== 'scrapyard-00')) expect(level.checkpoints.length, level.id).toBeGreaterThan(0);
  });

  it('run up the level in order, clear of each other and short of the summit', () => {
    for (const level of ALL_LEVELS) {
      const heights = level.checkpoints.map((c) => c.y);
      heights.forEach((y, i) => {
        expect(y, `${level.id} cp${i} above the start`).toBeGreaterThan(level.spawn.y + 3);
        expect(y, `${level.id} cp${i} below the summit`).toBeLessThan(level.summit.y - 3);
        if (i > 0) expect(y - heights[i - 1]!, `${level.id} cp${i} spacing`).toBeGreaterThanOrEqual(2);
      });
    }
  });

  it('are all reached by a player who simply climbs the level', async () => {
    const rapier = await loadRapier();
    const missed: string[] = [];
    for (const level of ALL_LEVELS) {
      const sim = new Simulation(rapier, level);
      const route = decodeRecording(readFileSync(resolve(__dirname, `../src/levels/routes/${level.id}.json`), 'utf8'));
      const player = new ReplayPlayer(route);
      while (!player.done) sim.step(player.next());
      if (sim.run.checkpoint !== level.checkpoints.length - 1) missed.push(`${level.id}: planted ${sim.run.checkpoint + 1} of ${level.checkpoints.length}`);
      sim.dispose();
    }
    expect(missed).toEqual([]);
  }, 120_000);

  it('put MAGNO on something he can use, whatever the hazard clock reads', async () => {
    const wrong: string[] = [];
    for (const { level, point, index } of checkpoints) {
      const share = await holdShare(level, point);
      const floor = BLINKING_FOOTING[`${level.id}:${index}`] ?? 1;
      if (share < floor) wrong.push(`${level.id} cp${index}: holds at ${Math.round(share * 100)}% of clock readings, needs ${Math.round(floor * 100)}%`);
    }
    expect(wrong).toEqual([]);
  }, 600_000);
});
