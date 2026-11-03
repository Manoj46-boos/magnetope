import type { Browser, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The on-ramp's adaptive mercy in the live game (rebuild PRD Volume VI,
 * P-LD-05). The law itself — two falls in a row widen the next attempt, the
 * widening caps, a level past ten never widens — is held end-to-end by the
 * sim suite (tests/mercy.test.ts) through real onFall events, because a fall
 * in this game only happens to a player who has already climbed: the spawn
 * shelves of every level are walled in steel (that is the ramp's own
 * generosity working), and no charge a test can synthesize at the bottom
 * reaches past it — probes on scrapyard-02 and stratosphere-02, charged flat
 * and full, all land attached. So the live-game test holds what the real page
 * can carry: the numbers the game actually builds its attempts with — the
 * full hand-held 1.6 on the third level, none at all past ten — and a page
 * that stays error-free while it rides.
 */

interface GameWindow {
  __game: {
    startLevel(id: string): void;
    debug: {
      phase: string;
      sim: {
        physics: { snapRadius: number };
        run: { cleared: boolean };
        magno: { view: { state: string } };
        level: { id: string; onRamp?: { catchWindow: number; assist: number } };
      };
      telemetry: { queue: Array<{ category: string; what: string; action: string }> };
    };
    holdClock(held: boolean): void;
  };
}

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let page: Page | null = null;
const problems: string[] = [];

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
  });
  await page.goto(started.url);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
  await page.waitForTimeout(800);
}, 90000);

afterAll(async () => {
  await page?.close();
  await browser?.close();
  await server?.close();
}, 120000);

const runnable = (name: string, body: () => Promise<void>, timeout = 120000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

describe('the adaptive mercy in the live game (P-LD-05)', () => {
  runnable('builds its attempts on the ramp\'s own numbers', async () => {
    const g = page!;

    // The third level of the campaign: still inside the held-hand band.
    await g.evaluate(() => {
      const game = (window as unknown as GameWindow).__game;
      game.startLevel('scrapyard-02');
    });
    await g.waitForTimeout(1200);
    const held = await g.evaluate(() => {
      const sim = (window as unknown as GameWindow).__game.debug.sim;
      return { id: sim.level.id, window: sim.level.onRamp?.catchWindow ?? 1, assist: sim.level.onRamp?.assist ?? 1 };
    });
    expect(held.id, 'the level the game actually built').toBe('scrapyard-02');
    expect(held.window, 'the third level rides the full hand-held 1.6').toBeCloseTo(1.6, 5);
    expect(held.assist, 'the third level rides the full assist').toBeGreaterThan(1);

    // Past ten: the climb is the player's own, nothing widens for him there.
    await g.evaluate(() => {
      const game = (window as unknown as GameWindow).__game;
      game.startLevel('scrapyard-11');
    });
    await g.waitForTimeout(1200);
    const own = await g.evaluate(() => {
      const sim = (window as unknown as GameWindow).__game.debug.sim;
      return { id: sim.level.id, window: sim.level.onRamp?.catchWindow ?? 1, radius: sim.physics.snapRadius };
    });
    expect(own.id, 'the level the game actually built').toBe('scrapyard-11');
    expect(own.window, 'past ten there is no on-ramp to widen').toBe(1);
    expect(own.radius).toBeGreaterThan(0);
  });

  runnable('raises no page error while it rides the ramp', async () => {
    expect(problems).toEqual([]);
  });
});
