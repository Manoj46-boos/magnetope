import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_LEVELS } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';
import { IDLE_INPUT } from '@/sim/types';

/**
 * PRD 9.4: the harmonic pad "engages during snap-chain streaks (three surfaces in under six
 * seconds)". The streak is replayed from real routes and checked tick by tick against a count
 * kept outside the simulation: it must switch on at the third snap catch inside the window and
 * switch off again once the streak is older than that, even if MAGNO just hangs there.
 */

const WINDOW_TICKS = 360;
const STREAK = 3;
const TAIL_TICKS = 1200;
const ROUTES = ['scrapyard-03', 'scrapyard-09', 'suburbia-04', 'suburbia-12', 'metropolis-05', 'metropolis-12', 'playground-04', 'stratosphere-03', 'stratosphere-10'];

interface Trace {
  id: string;
  /** Per tick: what the simulation reports, and what an independent count says for windows a tick shorter, exact and a tick longer. */
  rows: Array<{ reported: boolean; short: boolean; exact: boolean; long: boolean }>;
}

async function trace(id: string): Promise<Trace> {
  const level = ALL_LEVELS.find((l) => l.id === id)!;
  const sim = new Simulation(await loadRapier(), level);
  const recording = decodeRecording(readFileSync(fileURLToPath(new URL(`../src/levels/routes/${id}.json`, import.meta.url)), 'utf8'));
  const player = new ReplayPlayer(recording);
  const snapCatches: number[] = [];
  let tick = 0;
  sim.events.on('attach', (e) => {
    if (e.viaSnap) snapCatches.push(tick);
  });

  const within = (window: number): boolean => snapCatches.filter((t) => tick - t <= window).length >= STREAK;
  const rows: Trace['rows'] = [];
  while (tick < recording.totalTicks + TAIL_TICKS) {
    sim.step(player.done ? IDLE_INPUT : player.next());
    tick++;
    rows.push({ reported: sim.magno.view.chaining, short: within(WINDOW_TICKS - 1), exact: within(WINDOW_TICKS), long: within(WINDOW_TICKS + 1) });
  }
  sim.dispose();
  return { id, rows };
}

describe('the snap-chain streak behind the music pad', () => {
  it('follows the count of snap catches in the last six seconds on real routes', async () => {
    let streaks = 0;
    let ended = 0;
    for (const id of ROUTES) {
      const { rows } = await trace(id);
      rows.forEach((row, i) => {
        const ambiguous = row.short !== row.long;
        if (!ambiguous) expect(row.reported, `${id} tick ${i}`).toBe(row.exact);
        if (row.reported && !(rows[i - 1]?.reported ?? false)) streaks++;
        if (!row.reported && (rows[i - 1]?.reported ?? false)) ended++;
      });
    }
    expect(streaks, 'routes that chain at least once').toBeGreaterThan(2);
    expect(ended, 'streaks that ran out').toBeGreaterThan(2);
  }, 240_000);
});
