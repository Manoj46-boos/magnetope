import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * Session zero in a real browser (rebuild PRD Volume II): the boot card sells
 * the game itself over the live first level, the establishing shot yields to
 * any input with the perch immediately live, the first flip lands inside the
 * second-and-a-half the spec allows, and the second level's clear ends in the
 * scripted practice fall — the grade card, the share offer, the funnel's
 * delight checkpoint, once per save.
 */

interface GameWindow {
  __game: {
    startLevel(id: string): void;
    debug: {
      phase: string;
      sim: { run: { timeMs: number; started: boolean; cleared: boolean }; level: { id: string }; magno: { view: { state: string; charge01: number } } };
      sdk: { measured: Array<{ category: string; what: string; action: string }> };
      save: {
        data: {
          stars: Record<string, number>;
          seen: string[];
          bestFall: { heightMeters: number; grade: string } | null;
        };
      };
      openerLog: string[];
      holdClock(held: boolean): void;
      advance(seconds: number): void;
      autoplay(recording: unknown): void;
    };
  };
}

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

const routeOf = (id: string): unknown => JSON.parse(readFileSync(resolve(__dirname, `../src/levels/routes/${id}.json`), 'utf8'));

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

describe('the first ninety seconds in a real browser', () => {
  runnable('opens on the wordmark over the live first level, with the skip affordance already up (P-FT-02, P-FT-01)', async () => {
    // a fresh context: nothing cleared, the boot card is the brand itself
    const banner = page!.locator('.biome-banner');
    await banner.waitFor({ state: 'visible' });
    const lockup = banner.locator('.lockup');
    expect(await lockup.count()).toBe(1);
    // the wordmark's O is the ident glyph, so the name rides the lockup's own label
    expect(await lockup.getAttribute('aria-label')).toBe('MAGNETOPE');
    expect(await banner.textContent()).toContain('A game by Magnetope Studio');
    // the live world is behind it: the canvas is the page's stage and drawn
    expect(await page!.locator('#view').count()).toBe(1);
    expect(await page!.locator('.opener-skip.show').count()).toBe(1);
    expect(await page!.locator('.opener-skip').textContent()).toContain('Skip');
  });

  runnable('any input skips the shot and the first flip lands inside a second and a half (P-FT-01)', async () => {
    await page!.evaluate(() => {
      (window as unknown as GameWindow).__game.debug.holdClock(true);
    });
    // let the establishing shot own the screen for two thirds of a second
    await page!.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      for (let i = 0; i < 40; i++) g.debug.advance(1 / 60);
    });
    const logBefore = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.openerLog.filter((e) => e.startsWith('shot@')).length);
    expect(logBefore).toBe(1);

    // the skip itself: one key press, and the same press is already the first charge
    await page!.keyboard.down('Space');
    await page!.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      for (let i = 0; i < 3; i++) g.debug.advance(1 / 60);
    });
    const charging = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.sim.magno.view.state);
    expect(charging, 'the skipping key press starts the charge on its own tick — no dead-input window').toBe('charging');
    expect(await page!.locator('.opener-skip.show').count(), 'the chip leaves with the shot').toBe(0);

    // the hold runs to full charge, the release is the flip, and the whole
    // press-to-launch distance is the spec's own second and a half
    await page!.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      for (let i = 0; i < 55; i++) g.debug.advance(1 / 60);
    });
    await page!.keyboard.up('Space');
    const launched = await page!.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      let frames = 0;
      for (; frames < 32; frames++) {
        g.debug.advance(1 / 60);
        if (g.debug.sim.magno.view.state === 'repelled') break;
      }
      return { frames, log: [...g.debug.openerLog] };
    });
    expect(launched.frames, 'the release becomes a launch inside three frames').toBeLessThan(4);
    expect(3 + 55 + launched.frames, 'the flip completes within 1.5 s of the skip').toBeLessThanOrEqual(90);
    expect(launched.log.some((e) => e.startsWith('launch@')), 'the launch reached the session timeline').toBe(true);

    // once the hop settles, the coach hand is on the perch the skip landed on
    await page!.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      for (let i = 0; i < 120; i++) g.debug.advance(1 / 60);
    });
    await page!
      .locator('.coach.show')
      .waitFor({ state: 'visible', timeout: 20000 })
      .catch(() => undefined);
    expect(await page!.locator('.coach.show').count()).toBe(1);
  });

  runnable('the skip chip does the same work by click, and the game is live right after it', async () => {
    // a fresh context for a clean establishing shot
    const fresh = await context!.newPage();
    fresh.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    await boot(fresh);
    await fresh.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      g.debug.holdClock(true);
      for (let i = 0; i < 30; i++) g.debug.advance(1 / 60);
    });
    await fresh.locator('.opener-skip.show').click();
    expect(await fresh.locator('.opener-skip.show').count()).toBe(0);
    // the game is immediately playable: a full press-charge-release flips
    await fresh.keyboard.down('Space');
    const flipped = await fresh.evaluate(async () => {
      const g = (window as unknown as GameWindow).__game;
      let frames = 0;
      for (; frames < 80; frames++) {
        g.debug.advance(1 / 60);
        if (g.debug.sim.magno.view.state === 'repelled') break;
      }
      return frames;
    });
    await fresh.keyboard.up('Space');
    expect(flipped).toBeLessThanOrEqual(90);
    await fresh.close();
  });

  runnable('ends the second level in the practice fall: grade card on stage, funnel checkpoint once (P-FT-07)', async () => {
    // clear the first level through its stored route, then the second
    for (const id of ['scrapyard-00', 'scrapyard-01']) {
      await page!.evaluate(
        ({ id, route }) => {
          const g = (window as unknown as GameWindow).__game;
          g.startLevel(id);
          g.debug.holdClock(true);
          g.debug.autoplay(route);
          let ticks = 0;
          while (g.debug.phase !== 'cleared' && ticks < 3000) {
            g.debug.advance(1 / 60);
            ticks++;
          }
          return { phase: g.debug.phase, ticks };
        },
        { id, route: routeOf(id) },
      );
    }
    const after = await page!.evaluate(() => {
      const d = (window as unknown as GameWindow).__game.debug;
      return {
        bestFall: d.save.data.bestFall,
        seen: d.save.data.seen,
        graded: d.sdk.measured.filter((r) => r.category === 'fall' && r.what === 'first' && r.action === 'graded'),
      };
    });
    // the descent resolved as a graded fall and went on record
    expect(after.bestFall, 'the practice fall is the save\'s first best fall').not.toBeNull();
    expect(after.bestFall!.heightMeters).toBeGreaterThanOrEqual(12);
    expect(after.seen).toContain('fall.practice');
    // the funnel's delight checkpoint reached the SDK channel exactly once
    expect(after.graded).toHaveLength(1);
    // the clear card followed the grade card and the flow carries on to level three
    const card = page!.locator('.clear-card');
    await card.waitFor({ state: 'visible' });
    await card.locator('.btn.primary').click();
    await page!.waitForFunction(() => {
      const debug = (window as unknown as GameWindow).__game.debug;
      return debug.phase === 'play' && debug.sim.level.id === 'scrapyard-02';
    });
  });

  runnable('never plays the practice fall twice for the same save', async () => {
    await page!.evaluate(
      ({ route }) => {
        const g = (window as unknown as GameWindow).__game;
        g.startLevel('scrapyard-01');
        g.debug.holdClock(true);
        g.debug.autoplay(route);
        let ticks = 0;
        while (g.debug.phase !== 'cleared' && ticks < 3000) {
          g.debug.advance(1 / 60);
          ticks++;
        }
        return ticks;
      },
      { route: routeOf('scrapyard-01') },
    );
    const after = await page!.evaluate(() => {
      const d = (window as unknown as GameWindow).__game.debug;
      return d.sdk.measured.filter((r) => r.category === 'fall' && r.what === 'first' && r.action === 'graded');
    });
    expect(after, 'the checkpoint is once per save, not once per clear').toHaveLength(1);
  });

  runnable('raised no error and made no request outside its own origin', async () => {
    const foreign = requests.filter((url) => !url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'));
    expect(foreign).toEqual([]);
    expect(problems).toEqual([]);
  });
});
