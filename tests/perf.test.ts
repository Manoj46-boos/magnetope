import { describe, expect, it } from 'vitest';
import { timeLevel } from '../tools/perf';

/**
 * PRD 10.4 / 14.3: the physics step is bounded at 3.5 ms (p99) on the high tier, so
 * 60 fps keeps the rest of the frame for rendering. The levels timed are the ones
 * with the most bodies and the busiest machinery.
 */

const BUDGET_P99_MS = 3.5;
const BUSIEST = ['playground-14', 'playground-08', 'playground-13', 'scrapyard-13', 'stratosphere-14', 'stratosphere-07', 'metropolis-14'];

describe('the physics step', () => {
  for (const id of BUSIEST) {
    it(`${id} stays inside the frame budget while it plays out and while it settles`, async () => {
      const t = await timeLevel(id, 8);
      expect(t.p99, `p99 of ${t.steps} steps with ${t.bodies} bodies`).toBeLessThan(BUDGET_P99_MS);
      expect(t.p50).toBeLessThan(1);
    }, 120_000);
  }

  it('is heavy enough in the busiest level to make the timing meaningful', async () => {
    const t = await timeLevel('playground-14', 1);
    expect(t.bodies).toBeGreaterThan(50);
    expect(t.steps).toBeGreaterThan(600);
  }, 60_000);
});
