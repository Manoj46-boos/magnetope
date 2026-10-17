import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The two input promises of PRD table 4.2 that a unit test cannot keep: a key
 * the player picks really drives the game (and survives a reload), and on a
 * phone the system back button pauses instead of throwing the run away.
 */

interface GameWindow {
  __game: {
    startLevel(id: string): void;
    debug: {
      phase: string;
      sim: { magno: { view: { state: string } } };
      settings: { keys: { flip: string[] } };
      holdClock(held: boolean): void;
      advance(seconds: number): void;
    };
  };
}

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let origin = '';

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  origin = started.url;
}, 90000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

const boot = async (page: Page): Promise<void> => {
  await page.goto(origin);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
  await page.waitForTimeout(800);
};

const phase = (page: Page): Promise<string> => page.evaluate(() => (window as unknown as GameWindow).__game.debug.phase);
const magnoState = (page: Page): Promise<string> => page.evaluate(() => (window as unknown as GameWindow).__game.debug.sim.magno.view.state);
const advance = (page: Page, seconds: number): Promise<void> => page.evaluate((s) => (window as unknown as GameWindow).__game.debug.advance(s), seconds);

const runnable = (page: () => Page | null, name: string, body: () => Promise<void>, timeout = 60000) =>
  it(
    name,
    async (ctx) => {
      if (!page()) ctx.skip();
      await body();
    },
    timeout,
  );

describe('remapping a key in a real browser', () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const problems: string[] = [];

  beforeAll(async () => {
    if (!browser) return;
    context = await browser.newContext({ viewport: { width: 640, height: 360 } });
    await context.addInitScript('window.__name = (f) => f;');
    page = await context.newPage();
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
    });
    await boot(page);
    await page.evaluate(() => (window as unknown as GameWindow).__game.debug.holdClock(true));
  }, 90000);

  afterAll(async () => {
    await context?.close();
  });

  const it_ = (name: string, body: () => Promise<void>) => runnable(() => page, name, body);

  /** Starts the opening level afresh, MAGNO standing on his platform, so every press meets the same ground. */
  const freshStart = (): Promise<void> =>
    page!.evaluate(() => {
      const game = (window as unknown as GameWindow).__game;
      game.startLevel('scrapyard-00');
      game.debug.holdClock(true);
      game.debug.advance(1);
    });

  /** Holds a key for half a second of game time and reports what MAGNO did. */
  const holdFor = async (code: string): Promise<string> => {
    await freshStart();
    await page!.keyboard.down(code);
    await advance(page!, 0.5);
    const state = await magnoState(page!);
    await page!.keyboard.up(code);
    return state;
  };

  it_('flips on Space to begin with, and not on F', async () => {
    expect(await holdFor('KeyF')).toBe('attached');
    expect(await holdFor('Space')).toBe('charging');
  });

  it_('binds F from the Controls screen, one click and one key press', async () => {
    await page!.keyboard.press('Escape');
    await page!.locator('.panel.pause [data-opens="controls"]').click();
    await page!.locator('.panel.controls [data-opens="keys"]').click();
    const cap = page!.locator('.key-cap[data-action="flip"][data-slot="0"]');
    await cap.click();
    expect(await cap.innerText()).toMatch(/press a key/i);
    await page!.keyboard.press('KeyF');
    expect(await cap.innerText()).toBe('F');
    expect(await page!.locator('.key-cap[data-action="flip"][data-slot="1"]').innerText()).toBe('J');
  });

  it_('keeps the game paused while keys are captured, and Escape only cancels the capture', async () => {
    const cap = page!.locator('.key-cap[data-action="up"][data-slot="0"]');
    await cap.click();
    await page!.keyboard.press('Escape');
    expect(await cap.innerText()).toBe('W');
    expect(await phase(page!)).toBe('paused');
    expect(await page!.locator('.panel.keys').isVisible()).toBe(true);
  });

  it_('plays with the new key: F charges a flip and Space no longer does', async () => {
    await page!.keyboard.press('Escape');
    await page!.keyboard.press('Escape');
    await page!.locator('.panel.pause .btn.primary').click();
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'play');
    expect(await holdFor('Space')).toBe('attached');
    expect(await holdFor('KeyF')).toBe('charging');
    expect(await holdFor('KeyJ')).toBe('charging');
  });

  it_('keeps the layout after a reload', async () => {
    await boot(page!);
    await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.holdClock(true));
    expect(await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.settings.keys.flip)).toEqual(['KeyF', 'KeyJ']);
    expect(await holdFor('KeyF')).toBe('charging');
    expect(await holdFor('Space')).toBe('attached');
  });

  it_('raised no console errors or page errors', async () => {
    expect(problems).toEqual([]);
  });
});

describe('the back button on a phone', () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const problems: string[] = [];

  beforeAll(async () => {
    if (!browser) return;
    context = await browser.newContext({ viewport: { width: 640, height: 360 }, hasTouch: true, isMobile: true });
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
  });

  const it_ = (name: string, body: () => Promise<void>) => runnable(() => page, name, body);
  const entries = (): Promise<number> => page!.evaluate(() => history.length);

  it_('leaves the history alone until the player has touched the game', async () => {
    expect(await entries()).toBe(2);
    expect(await phase(page!)).toBe('play');
  });

  it_('pauses on back, and is ready for the next press', async () => {
    await page!.touchscreen.tap(560, 300);
    await page!.waitForFunction(() => history.length === 3);
    await page!.goBack();
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'paused');
    expect(await page!.locator('.panel.pause').isVisible()).toBe(true);
    expect(await entries()).toBe(3);
  });

  it_('closes a screen on back before anything else', async () => {
    await page!.locator('.panel.pause [data-opens="controls"]').tap();
    await page!.locator('.panel.controls').waitFor({ state: 'visible' });
    await page!.goBack();
    await page!.locator('.panel.controls').waitFor({ state: 'hidden' });
    expect(await page!.locator('.panel.pause').isVisible()).toBe(true);
    expect(await phase(page!)).toBe('paused');
  });

  it_('lets the player leave once the game is paused with nothing else open', async () => {
    await page!.goBack().catch(() => null);
    await page!.waitForURL('about:blank', { timeout: 10000 });
  });

  it_('raised no console errors or page errors', async () => {
    expect(problems).toEqual([]);
  });
});

describe('a desktop browser', () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  beforeAll(async () => {
    if (!browser) return;
    context = await browser.newContext({ viewport: { width: 640, height: 360 } });
    await context.addInitScript('window.__name = (f) => f;');
    page = await context.newPage();
    await boot(page);
  }, 90000);

  afterAll(async () => {
    await context?.close();
  });

  runnable(() => page, 'is never given a history entry, so its back button is its own', async () => {
    await page!.mouse.click(300, 200);
    await page!.keyboard.press('Space');
    await page!.waitForTimeout(300);
    expect(await page!.evaluate(() => history.length)).toBe(2);
  });
});
