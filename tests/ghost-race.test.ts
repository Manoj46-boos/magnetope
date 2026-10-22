import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * Racing a friend, end to end in a real browser: a friend's ghost on the level,
 * a clear played through the real loop, the result on the clear card, and the
 * exchange screen opened from it with a code typed into a real text box.
 */

interface GameWindow {
  __game: {
    startLevel(id: string): void;
    save: { update(mutate: (draft: { friends: Record<string, { name: string; ghost: string }>; ghosts: Record<string, string> }) => void): void; data: { friends: Record<string, unknown> } };
    debug: {
      phase: string;
      holdClock(held: boolean): void;
      advance(seconds: number): void;
      autoplay(recording: unknown): void;
    };
  };
}

const LEVEL = 'scrapyard-01';

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let origin = '';
const problems: string[] = [];

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  origin = started.url;
  context = await browser.newContext({ viewport: { width: 640, height: 360 } });
  await context.addInitScript('window.__name = (f) => f;');
  page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
  });
  await page.goto(origin);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
  await page.waitForTimeout(800);
}, 90000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await server?.close();
}, 120000);

const route = JSON.parse(readFileSync(resolve(__dirname, `../src/levels/routes/${LEVEL}.json`), 'utf8')) as unknown;
const parGhost = readFileSync(resolve(__dirname, `../src/levels/ghosts/${LEVEL}.json`), 'utf8');

const runnable = (name: string, body: () => Promise<void>, timeout = 120000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

/** Puts a friend on the level whose run lasts `durationMs`, then plays the level through. */
async function clearAgainst(friendMs: number): Promise<void> {
  await page!.evaluate(
    ({ id, friendMs, route, parGhost }) => {
      const game = (window as unknown as GameWindow).__game;
      const track = { ...JSON.parse(parGhost), d: friendMs };
      game.save.update((s) => {
        s.friends[id] = { name: 'Mina', ghost: JSON.stringify(track) };
      });
      game.startLevel(id);
      game.debug.holdClock(true);
      game.debug.autoplay(route);
      let ticks = 0;
      while (game.debug.phase !== 'cleared' && ticks < 3000) {
        game.debug.advance(1 / 60);
        ticks++;
      }
    },
    { id: LEVEL, friendMs, route, parGhost },
  );
  await page!.locator('.clear-card').waitFor({ state: 'visible' });
}

describe('racing a friend ghost in a real browser', () => {
  runnable('congratulates a player who finishes ahead of the friend and offers to share the win', async () => {
    await clearAgainst(600_000);
    const tag = page!.locator('.clear-card .duel-tag');
    expect(await tag.innerText()).toMatch(/you beat mina/i);
    expect(await page!.locator('.clear-card .btn', { hasText: 'Share the win' }).count()).toBe(1);
  });

  runnable('shows how far ahead the friend finished when the player is slower, with nothing to share', async () => {
    await clearAgainst(1_000);
    expect(await page!.locator('.clear-card .duel-tag').innerText()).toMatch(/mina is \d+\.\d\ds ahead/i);
    expect(await page!.locator('.clear-card .btn', { hasText: 'Share the win' }).count()).toBe(0);
  });

  runnable('opens the exchange from the clear card and keeps typed letters out of the game', async () => {
    await clearAgainst(600_000);
    await page!.locator('.clear-card .btn', { hasText: 'Ghosts' }).click();
    const box = page!.locator('.exchange-import textarea');
    await box.waitFor({ state: 'visible' });
    await box.click();
    await page!.keyboard.type('rrp wasd 1234');
    expect(await box.inputValue()).toBe('rrp wasd 1234');
    expect(await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.phase)).toBe('cleared');
  });

  runnable('refuses a code that is not a ghost and says so in words', async () => {
    const box = page!.locator('.exchange-import textarea');
    await page!.locator('.exchange .btn', { hasText: 'Add ghost' }).click();
    expect(await page!.locator('.exchange-status').innerText()).toMatch(/not a ghost code/i);
    expect(await box.inputValue()).toBe('rrp wasd 1234');
  });

  runnable('hands a player\'s own ghost to a friend as a code that the friend\'s game accepts', async () => {
    await page!.evaluate(
      ({ id, parGhost }) => {
        const game = (window as unknown as GameWindow).__game;
        game.save.update((s) => {
          s.ghosts[id] = parGhost;
          delete s.friends[id];
        });
      },
      { id: LEVEL, parGhost },
    );

    await page!.keyboard.press('Escape');
    await page!.locator('.clear-card .btn', { hasText: 'Ghosts' }).click();
    await page!.locator('.name-field').fill('Kit');
    await page!.locator('.exchange .btn', { hasText: 'Copy code' }).click();
    const code = await page!.locator('.exchange-block textarea[readonly]').inputValue();
    expect(code).toMatch(/^MGH1\./);

    const box = page!.locator('.exchange-import textarea');
    await box.fill(`  ${code.slice(0, 40)}\n${code.slice(40)}  `);
    await page!.locator('.exchange .btn', { hasText: 'Add ghost' }).click();
    await page!.locator('.friend-line').waitFor({ state: 'visible' });
    expect(await page!.locator('.friend-line').innerText()).toContain('Kit');
    expect(await page!.locator('.exchange-status').innerText()).toMatch(/kit added to/i);
  });

  runnable('raised no console errors or page errors', async () => {
    expect(problems).toEqual([]);
  });
});
