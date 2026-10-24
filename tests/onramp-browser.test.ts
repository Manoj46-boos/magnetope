import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The on-ramp a first-time player actually rides (PRD 14.3, R-LD-14/R-ON-10):
 * a fresh profile boots into level one with the boosts already live, clears
 * the first two levels without one fall through the real game loop, and the
 * boosts taper — full to five, half to ten, gone at eleven — exactly as the
 * ramp table promises. The clock is held and driven frame by frame, so every
 * probe lands on an exact tick of the route.
 */

interface GameWindow {
  __game: {
    startLevel(id: string): void;
    debug: {
      autoplay(recording: unknown): void;
      holdClock(held: boolean): void;
      advance(seconds: number): void;
      sim: {
        level: { id: string; onRamp?: { catchWindow: number; assist: number } | null };
        physics: { snapRadius: number };
        run: { cleared: boolean; fallCount: number };
      };
    };
  };
}

const routeOf = (id: string): unknown => JSON.parse(readFileSync(resolve(__dirname, `../src/levels/routes/${id}.json`), 'utf8'));

/** Advances the held clock until an in-page condition turns true; returns the seconds spent, or -1 at the cap. */
const advanceUntil = (page: Page, condition: string, maxSeconds = 60) =>
  page.evaluate(
    ({ condition, maxSeconds }) => {
      const handle = (window as unknown as GameWindow).__game;
      const frames = Math.round(maxSeconds * 60);
      for (let i = 0; i < frames; i++) {
        handle.debug.advance(1 / 60);
        if (Function(`"use strict"; return (${condition});`)()) return i / 60;
      }
      return -1;
    },
    { condition, maxSeconds },
  );

/** Runs in the page: the boost set the current level is actually playing with. */
const readRamp = (page: Page) =>
  page.evaluate(() => {
    const sim = (window as unknown as GameWindow).__game.debug.sim;
    return { id: sim.level.id, onRamp: sim.level.onRamp ?? null, snapRadius: sim.physics.snapRadius };
  });

const problems: string[] = [];

function watch(page: Page): void {
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
  });
}

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let origin = '';
const contexts: BrowserContext[] = [];

/** Boots a fresh player: no save, no history, and the clock held as soon as the handle exists. */
async function freshPlayer(): Promise<Page> {
  const context = await browser!.newContext({ viewport: { width: 960, height: 540 } });
  contexts.push(context);
  await context.addInitScript('window.__name = (f) => f;');
  const page = await context.newPage();
  watch(page);
  await page.goto(origin);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 60000 });
  await page.evaluate(() => (window as unknown as GameWindow).__game.debug.holdClock(true));
  return page;
}

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  origin = started.url;
}, 90000);

afterAll(async () => {
  for (const context of contexts) await context.close().catch(() => undefined);
  await browser?.close();
  await server?.close();
}, 120000);

const runnable = (name: string, body: () => Promise<void>, timeout = 180000) =>
  it(
    name,
    async (ctx) => {
      if (!browser) ctx.skip();
      await body();
    },
    timeout,
  );

describe('the on-ramp a first-time player actually rides', () => {
  runnable('clears the first two levels of a fresh session without a single fall', async () => {
    const page = await freshPlayer();
    for (const id of ['scrapyard-00', 'scrapyard-01']) {
      await page.evaluate(
        ({ id, route }) => {
          const handle = (window as unknown as GameWindow).__game;
          handle.startLevel(id);
          handle.debug.autoplay(route);
        },
        { id, route: routeOf(id) },
      );
      const spent = await advanceUntil(page, 'window.__game.debug.sim.run.cleared', 90);
      expect(spent, id).toBeGreaterThanOrEqual(0);
      const run = await page.evaluate(() => {
        const run = (window as unknown as GameWindow).__game.debug.sim.run;
        return { cleared: run.cleared, fallCount: run.fallCount };
      });
      expect(run.cleared, id).toBe(true);
      expect(run.fallCount, id).toBe(0);
    }
    await page.context().close();
  });

  runnable('tapers the boosts: full to five, half to ten, gone at eleven', async () => {
    const page = await freshPlayer();
    const expectations: Array<{ id: string; catchWindow: number; assist: number | null; radius: number }> = [
      { id: 'scrapyard-00', catchWindow: 1.25, assist: 1.5, radius: 5.625 },
      { id: 'scrapyard-04', catchWindow: 1.25, assist: 1.5, radius: 5.625 },
      { id: 'scrapyard-05', catchWindow: 1.125, assist: 1.25, radius: 5.0625 },
      { id: 'scrapyard-09', catchWindow: 1.125, assist: 1.25, radius: 5.0625 },
      { id: 'scrapyard-10', catchWindow: 1, assist: null, radius: 4.5 },
    ];
    for (const want of expectations) {
      await page.evaluate((id) => (window as unknown as GameWindow).__game.startLevel(id), want.id);
      const ramp = await readRamp(page);
      expect(ramp.id).toBe(want.id);
      expect(ramp.onRamp?.catchWindow ?? 1, want.id).toBeCloseTo(want.catchWindow, 10);
      expect(ramp.onRamp?.assist ?? null, want.id).toBe(want.assist);
      expect(ramp.snapRadius, want.id).toBeCloseTo(want.radius, 3);
    }
    await page.context().close();
  });

  it('raised no console errors or page errors', () => {
    expect(problems).toEqual([]);
  });
});
