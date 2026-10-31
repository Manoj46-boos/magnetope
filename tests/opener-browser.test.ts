import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * A first-time player's opening minutes in a real browser, on the real game
 * loop (PRD 15 and 16): the boot poster shot, the idle ladder, the staged HUD
 * finishing on its own, the first-catch beat, and the 45-second contract —
 * timed against a fresh save, with the clock held so every assertion lands on
 * an exact frame.
 */

interface GameWindow {
  __game: {
    startLevel(id: string): void;
    debug: {
      phase: string;
      sim: {
        run: { started: boolean; cleared: boolean; timeMs: number };
        level: { id: string };
        magno: { view: { position: { x: number; y: number } } };
      };
      save: { data: { seen: string[] } };
      renderer: {
        cameraRig: { focus: { x: number; y: number }; verticalExtent: number; baseVisibleHeight: number };
      };
      openerLog: string[];
      slowScale(): number;
      holdClock(held: boolean): void;
      advance(seconds: number): void;
      autoplay(recording: unknown): void;
    };
  };
}

const advance = (page: Page, seconds: number) =>
  page.evaluate((s) => {
    const handle = (window as unknown as GameWindow).__game;
    for (let i = 0; i < Math.round(s * 60); i++) handle.debug.advance(1 / 60);
  }, seconds);

const camera = (page: Page) =>
  page.evaluate(() => {
    const debug = (window as unknown as GameWindow).__game.debug;
    const rig = debug.renderer.cameraRig;
    return { focusY: rig.focus.y, extent: rig.verticalExtent, follow: rig.baseVisibleHeight, playerY: debug.sim.magno.view.position.y };
  });

const log = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).__game.debug.openerLog as string[]);

const firstMark = async (page: Page, what: string): Promise<number | null> => {
  const hit = (await log(page)).find((entry) => entry.startsWith(`${what}@`));
  return hit ? Number(hit.split('@')[1]) : null;
};

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

const problems: string[] = [];
const requests: string[] = [];

function watch(page: Page): void {
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
  });
  page.on('request', (r) => requests.push(r.url()));
}

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let origin = '';

/** Boots a fresh player: no save, no history, and the clock held as soon as the handle exists. */
const contexts: BrowserContext[] = [];

async function freshPlayer(options: { mobile?: boolean } = {}): Promise<Page> {
  const context = await browser!.newContext(
    options.mobile
      ? { viewport: { width: 480, height: 270 }, hasTouch: true, isMobile: true }
      : { viewport: { width: 960, height: 540 } },
  );
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

const runnable = (name: string, body: () => Promise<void>, timeout = 120000) =>
  it(
    name,
    async (ctx) => {
      if (!browser) ctx.skip();
      await body();
    },
    timeout,
  );

describe('the opener a first-time player actually gets', () => {
  runnable('opens on MAGNO, reveals the climb, and is home within three seconds', async () => {
    const page = await freshPlayer({ mobile: true });

    const boot = await page.evaluate(() => ({
      canvas: Boolean(document.getElementById('view')),
      fullBleed: (() => {
        const view = document.getElementById('view');
        if (!view) return false;
        const box = view.getBoundingClientRect();
        return box.width === window.innerWidth && box.height === window.innerHeight;
      })(),
      playable: performance.getEntriesByName('magnetope:playable').length,
      fatal: Boolean(document.querySelector('.fatal')),
      touchRest: Boolean(document.querySelector('.touch.on.rest')),
    }));
    expect(boot.canvas).toBe(true);
    expect(boot.fullBleed).toBe(true);
    expect(boot.playable).toBeGreaterThan(0);
    expect(boot.fatal).toBe(false);
    expect(boot.touchRest).toBe(true);

    // The first frame is the character portrait: MAGNO himself at readable scale.
    const hero = await camera(page);
    expect(hero.extent).toBeLessThan(hero.follow * 0.4);

    await advance(page, 1.4);
    const vista = await camera(page);
    // The two-hop tutorial's climb is short enough that the vista rides its own
    // floor (a seventeenth again wider than the follow shot) and still holds the
    // whole climb — the taller biomes pull out to twice and beyond.
    expect(vista.extent).toBeGreaterThan(vista.follow * 1.5);

    await advance(page, 1.5);
    const home = await camera(page);
    expect(home.extent).toBeLessThan(home.follow * 1.01);
    expect(Math.abs(home.focusY - home.playerY)).toBeLessThan(1);
    await page.context().close();
  });

  runnable('hands the camera over the moment the player touches anything', async () => {
    const page = await freshPlayer();
    await advance(page, 0.3);
    await page.keyboard.down('Space');
    await advance(page, 0.1);
    await page.keyboard.up('Space');
    await advance(page, 1.4);

    const released = await camera(page);
    expect(released.extent).toBeLessThan(released.follow * 1.6);
    await page.context().close();
  });

  runnable('climbs the idle ladder for a player who waits: hand, hop, then a look at the goal', async () => {
    const page = await freshPlayer();
    await page.evaluate(() => (window as unknown as GameWindow).__game.startLevel('scrapyard-03'));

    await advance(page, 2.6);
    expect(await page.locator('.coach.show').count()).toBe(0);

    await advance(page, 0.9);
    expect(await page.locator('.coach.show').count()).toBe(1);

    await advance(page, 4.6);
    const hop = await firstMark(page, 'hop');
    expect(hop).toBeGreaterThanOrEqual(7900);
    expect(hop).toBeLessThan(9000);

    await advance(page, 2.2);
    expect(await page.locator('.hud.on').count()).toBe(1);

    await advance(page, 5.2);
    const midPan = await camera(page);
    expect(midPan.focusY).toBeGreaterThan(midPan.playerY + 2);

    await advance(page, 2.4);
    const home = await camera(page);
    expect(Math.abs(home.focusY - home.playerY)).toBeLessThan(1);
    expect(await firstMark(page, 'pan')).toBeGreaterThanOrEqual(14900);

    const capped = await log(page);
    expect(capped.filter((e) => e.startsWith('pan@'))).toHaveLength(1);
    await page.context().close();
  });

  runnable('slows the world for the first catch, gives it back, and never plays the beat twice', async () => {
    const page = await freshPlayer();
    await page.evaluate((route) => {
      const handle = (window as unknown as GameWindow).__game;
      handle.startLevel('scrapyard-00');
      handle.debug.autoplay(route);
    }, routeOf('scrapyard-00'));

    const wait = await advanceUntil(page, `window.__game.debug.openerLog.some((e) => e.startsWith('first-catch@'))`, 40);
    expect(wait).toBeGreaterThanOrEqual(0);

    await advance(page, 0.1);
    const beat = await page.evaluate(() => (window as unknown as GameWindow).__game.debug.slowScale());
    expect(beat).toBeLessThan(0.9);

    await advance(page, 2.6);
    expect(await page.evaluate(() => (window as unknown as GameWindow).__game.debug.slowScale())).toBe(1);

    const seen = await page.evaluate(() => (window as unknown as GameWindow).__game.debug.save.data.seen);
    expect(seen).toContain('opener.first-catch');
    await page.context().close();
  });

  runnable('interrupts the beat on the first input, exactly like the rest of the opener', async () => {
    const page = await freshPlayer();
    await page.evaluate((route) => {
      const handle = (window as unknown as GameWindow).__game;
      handle.startLevel('scrapyard-00');
      handle.debug.autoplay(route);
    }, routeOf('scrapyard-00'));

    const wait = await advanceUntil(page, `window.__game.debug.openerLog.some((e) => e.startsWith('first-catch@'))`, 40);
    expect(wait).toBeGreaterThanOrEqual(0);

    await advance(page, 0.1);
    await page.keyboard.down('Space');
    await advance(page, 0.05);
    await page.keyboard.up('Space');
    await advance(page, 0.8);
    expect(await page.evaluate(() => (window as unknown as GameWindow).__game.debug.slowScale())).toBe(1);
    await page.context().close();
  });

  runnable('keeps the 45-second contract on the canonical first route', async () => {
    const page = await freshPlayer();
    await page.evaluate((route) => {
      const handle = (window as unknown as GameWindow).__game;
      handle.startLevel('scrapyard-00');
      handle.debug.autoplay(route);
    }, routeOf('scrapyard-00'));

    const wait = await advanceUntil(page, 'window.__game.debug.sim.run.cleared', 60);
    expect(wait).toBeGreaterThanOrEqual(0);
    await advance(page, 2);

    const launch = await firstMark(page, 'launch');
    const snap = await firstMark(page, 'snap');
    const clear = await firstMark(page, 'clear');
    expect(launch).not.toBeNull();
    expect(snap).not.toBeNull();
    expect(clear).not.toBeNull();
    expect(launch!).toBeLessThan(10_000);
    expect(snap!).toBeLessThan(25_000);
    expect(clear!).toBeLessThan(45_000);
    await page.context().close();
  });

  runnable('survives a pause thrown into the middle of the ladder, and resumes cleanly', async () => {
    const page = await freshPlayer();
    await page.evaluate(() => (window as unknown as GameWindow).__game.startLevel('scrapyard-03'));
    await advance(page, 15.6);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'paused');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'play');
    await advance(page, 1.6);

    const eased = await camera(page);
    expect(eased.extent).toBeLessThan(eased.follow * 1.6);
    expect(Math.abs(eased.focusY - eased.playerY)).toBeLessThan(1);
    expect(await page.evaluate(() => (window as unknown as GameWindow).__game.debug.phase)).toBe('play');
    await page.context().close();
  });

  runnable('raised no error and made no request outside its own origin', async () => {
    const foreign = requests.filter((url) => !url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'));
    expect(foreign).toEqual([]);
    expect(problems).toEqual([]);
  });
});
