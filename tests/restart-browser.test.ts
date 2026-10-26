import { describe, expect, it } from 'vitest';
import { HEAVY_LEVELS, timeRestarts, type RestartTiming } from '../tools/restart-time';
import { RESTART_BUDGET_MS } from '../tools/perf-laws';
import { launchBrowser } from './browser/harness';

/**
 * PRD pillar 2, 4.5 and 23.3 (R-PE-13): a retry rebuilds the level inside the
 * 50 ms budget with no loading screen — the promise to players stays the same
 * 400 ms, but the gate the budget owns is the tighter line, because the rebuild
 * is the part that costs CPU on any device and it sits well inside even that.
 */

const PROMISE_MS = 400;
const GATE_MS = RESTART_BUDGET_MS;

describe('restarting a level', () => {
  let rows: RestartTiming[] | null = null;

  const measured = async (): Promise<RestartTiming[] | null> => {
    if (rows) return rows;
    const browser = await launchBrowser();
    if (!browser) return null;
    await browser.close();
    rows = await timeRestarts(HEAVY_LEVELS, 5);
    return rows;
  };

  it('rebuilds even the heaviest levels well inside 400 ms', async (ctx) => {
    const timings = await measured();
    if (!timings) ctx.skip();
    for (const row of timings!) {
      expect(row.rebuildMs, `${row.id} rebuild`).toBeLessThan(GATE_MS);
      expect(row.rebuildMs, `${row.id} against the PRD promise`).toBeLessThan(PROMISE_MS);
    }
  }, 120_000);

  it('never covers the game with a loading screen or a menu on the way', async (ctx) => {
    const timings = await measured();
    if (!timings) ctx.skip();
    expect(timings!.filter((row) => row.coverShown).map((row) => row.id)).toEqual([]);
  }, 120_000);
});
