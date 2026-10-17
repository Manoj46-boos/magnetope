import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * A player's first minutes in a real browser: boot, play three levels through the
 * real game loop, pause with the keyboard, reload, cut the network. The levels are
 * played by the stored planner routes, so what is checked is the game around them:
 * the loop, the HUD, saving, and the Poki hygiene rules (no stray requests, no errors).
 */

interface GameWindow {
  __game: {
    startLevel(id: string): void;
    debug: {
      phase: string;
      sim: { run: { timeMs: number; started: boolean }; level: { id: string } };
      save: { data: { stars: Record<string, number>; scrap: number } };
      holdClock(held: boolean): void;
      advance(seconds: number): void;
      autoplay(recording: unknown): void;
    };
  };
}

interface Outcome {
  phase: string;
  ticks: number;
  stars: number;
}

const FIRST_LEVELS = ['scrapyard-00', 'scrapyard-01', 'scrapyard-02'];

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let origin = '';
const problems: string[] = [];
const requests: string[] = [];

async function boot(target: Page): Promise<void> {
  await target.goto(origin);
  await target.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
  await target.waitForTimeout(800);
}

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  origin = started.url;
  context = await browser.newContext({ viewport: { width: 480, height: 270 } });
  await context.addInitScript('window.__name = (f) => f;');
  page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
  });
  page.on('request', (r) => requests.push(r.url()));
  await boot(page);
}, 90000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await server?.close();
});

const routeOf = (id: string): unknown => JSON.parse(readFileSync(resolve(__dirname, `../src/levels/routes/${id}.json`), 'utf8'));

const play = (id: string): Promise<Outcome> =>
  page!.evaluate(
    ({ id, route }) => {
      const game = (window as unknown as GameWindow).__game;
      game.startLevel(id);
      game.debug.holdClock(true);
      game.debug.autoplay(route);
      let ticks = 0;
      while (game.debug.phase !== 'cleared' && ticks < 3000) {
        game.debug.advance(1 / 60);
        ticks++;
      }
      return { phase: game.debug.phase, ticks, stars: game.debug.save.data.stars[id] ?? 0 };
    },
    { id, route: routeOf(id) },
  );

const runnable = (name: string, body: () => Promise<void>, timeout = 120000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

describe('a first session in a real browser', () => {
  runnable('plays the first three levels through to the clear card and earns stars', async () => {
    for (const id of FIRST_LEVELS) {
      const outcome = await play(id);
      expect(outcome.phase, id).toBe('cleared');
      expect(outcome.ticks, id).toBeLessThan(2500);
      expect(outcome.stars, id).toBeGreaterThanOrEqual(1);
    }
    expect(await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.save.data.scrap)).toBeGreaterThan(0);
  });

  runnable('shows the clear card with its stars and carries on to the next level from the Next button', async () => {
    await play('scrapyard-01');
    const card = page!.locator('.clear-card');
    await card.waitFor({ state: 'visible' });
    expect(await card.locator('.banner').innerText()).toMatch(/level clear/i);
    expect(await card.locator('.slot').count()).toBe(3);

    await card.locator('.btn.primary').click();
    await page!.waitForFunction(() => {
      const debug = (window as unknown as GameWindow).__game.debug;
      return debug.phase === 'play' && debug.sim.level.id === 'scrapyard-02';
    });
  });

  runnable('pauses on Escape without the clock moving, and resumes on Escape', async () => {
    await page!.evaluate(() => {
      const game = (window as unknown as GameWindow).__game;
      game.startLevel('scrapyard-01');
      game.debug.holdClock(true);
    });
    await page!.keyboard.press('Space');
    await page!.evaluate(() => {
      for (let i = 0; i < 30; i++) (window as unknown as GameWindow).__game.debug.advance(1 / 60);
    });
    const before = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.sim.run.timeMs);

    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'paused');
    await page!.evaluate(() => {
      for (let i = 0; i < 60; i++) (window as unknown as GameWindow).__game.debug.advance(1 / 60);
    });
    const during = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.sim.run.timeMs);
    expect(during).toBe(before);

    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'play');
    await page!.evaluate(() => {
      for (let i = 0; i < 30; i++) (window as unknown as GameWindow).__game.debug.advance(1 / 60);
    });
    const after = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.sim.run.timeMs);
    expect(after).toBeGreaterThan(before);
  });

  runnable('remembers the stars after a reload', async () => {
    const saved = await page!.evaluate(() => JSON.parse(localStorage.getItem('magnetope.save') ?? '{}').stars as Record<string, number>);
    for (const id of FIRST_LEVELS) expect(saved[id], id).toBeGreaterThanOrEqual(1);

    await page!.reload();
    await page!.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
    const restored = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.save.data.stars);
    for (const id of FIRST_LEVELS) expect(restored[id], id).toBeGreaterThanOrEqual(1);
  });

  runnable('keeps playing after the network is cut', async () => {
    await context!.setOffline(true);
    try {
      const outcome = await play('scrapyard-03');
      expect(outcome.phase).toBe('cleared');
    } finally {
      await context!.setOffline(false);
    }
  });

  runnable('made no request outside its own origin and raised no error', async () => {
    const foreign = requests.filter((url) => !url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'));
    expect(foreign).toEqual([]);
    expect(problems).toEqual([]);
  });
});
