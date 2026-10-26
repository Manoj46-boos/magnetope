import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The options a player can change in the pause menu, in a real browser: they
 * apply to the running game, they are saved, and they are still there after a reload.
 */

interface GameWindow {
  __game: {
    debug: {
      phase: string;
      holdClock(held: boolean): void;
      advance(seconds: number): void;
      settings: { touchLayout: string; aimMode: string; touchSensitivity: number; rimTint: boolean };
      renderer: { rimMeshes: Array<{ visible: boolean }> };
    };
    startLevel(id: string): void;
  };
}

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let origin = '';
const problems: string[] = [];

const boot = async (target: Page): Promise<void> => {
  await target.goto(origin);
  await target.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
  await target.waitForTimeout(800);
};

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
  await boot(page);
}, 90000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await server?.close();
});

const runnable = (name: string, body: () => Promise<void>, timeout = 60000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

const settings = () => page!.evaluate(() => (window as unknown as GameWindow).__game.debug.settings);
const visibleRims = () =>
  page!.evaluate(() => {
    const game = (window as unknown as GameWindow).__game;
    game.debug.holdClock(true);
    game.debug.advance(1 / 60);
    const rims = game.debug.renderer.rimMeshes;
    return { total: rims.length, shown: rims.filter((m) => m.visible).length };
  });

const openControls = async (): Promise<void> => {
  await page!.keyboard.press('Escape');
  await page!.locator('#ui .btn', { hasText: 'Controls' }).click();
  await page!.locator('.panel.controls').waitFor({ state: 'visible' });
};

describe('changing controls in a real browser', () => {
  runnable('starts on the defaults, with the rim tint marking grabbable surfaces', async () => {
    expect(await settings()).toMatchObject({ touchLayout: 'split', aimMode: 'auto', touchSensitivity: 1, rimTint: true });
    const rims = await visibleRims();
    expect(rims.total).toBeGreaterThan(0);
    expect(rims.shown).toBe(rims.total);
  });

  runnable('applies each choice to the running game as soon as it is made', async () => {
    await openControls();
    await page!.locator('.segment', { hasText: 'Button' }).click();
    await page!.locator('.segment', { hasText: 'Mouse' }).click();
    await page!.locator('.range').fill('0.7');
    await page!.locator(".panel.controls [data-setting='rimTint']").click();
    expect(await settings()).toMatchObject({ touchLayout: 'single', aimMode: 'mouse', touchSensitivity: 0.7, rimTint: false });
  });

  runnable('takes the rim tint off every surface when the player turns it off', async () => {
    const rims = await visibleRims();
    expect(rims.total).toBeGreaterThan(0);
    expect(rims.shown).toBe(0);
  });

  runnable('goes back to the pause menu from the controls screen, and the game is still paused', async () => {
    await page!.keyboard.press('Escape');
    await page!.locator('.panel.controls').waitFor({ state: 'hidden' });
    expect(await page!.locator('#ui .btn', { hasText: 'Resume' }).isVisible()).toBe(true);
    expect(await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.phase)).toBe('paused');
  });

  runnable('keeps the choices after the page is reloaded', async () => {
    await boot(page!);
    expect(await settings()).toMatchObject({ touchLayout: 'single', aimMode: 'mouse', touchSensitivity: 0.7, rimTint: false });
    await openControls();
    expect(await page!.locator('.segment[aria-checked="true"]').allInnerTexts()).toEqual(['Button', 'Mouse', '100%']);
    expect(await page!.locator('.range').inputValue()).toBe('0.7');
    expect(await page!.locator(".panel.controls [data-setting='rimTint']").getAttribute('aria-pressed')).toBe('false');
  });

  runnable('raised no console errors or page errors', async () => {
    expect(problems).toEqual([]);
  });
});
