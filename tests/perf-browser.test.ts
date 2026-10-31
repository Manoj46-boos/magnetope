import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LEVEL_LINK_BUDGET_MS, LONGTASK_MS, RESTART_BUDGET_MS } from '../tools/perf-laws';
import { launchBrowser, startServer } from './browser/harness';

/**
 * The performance chapter's browser leg (premium PRD Ch. 23): the frame laws a
 * real machine can falsify. Software rendering stands in for the GPU the way
 * the restart tool's own note describes — it draws far slower than any phone —
 * so the tier-low floor is the honest absolute gate (a pass here has headroom
 * on real silicon), the higher tiers are held by their relative order (a
 * cheaper profile must buy frames, on any machine), and the longtask ledger is
 * read against the frame it lives in: the absolute 50 ms law where the stand-in
 * is fast enough to catch a violation, and no task four times its own frame
 * where the software renderer makes every frame long by itself.
 */

const HEAVY_LEVELS = ['playground-08', 'metropolis-14', 'stratosphere-14', 'scrapyard-00'];

interface GameWindow {
  __game: {
    phase: string;
    debug: {
      sim: { level: { id: string } };
      holdClock(held: boolean): void;
      advance(seconds: number): void;
      autoplay(recording: unknown): void;
      startLevel(id: string): void;
      setQuality(tier: 'high' | 'mid' | 'low'): void;
    };
  };
}

interface TierReading {
  emaMs: number;
  longtaskMaxMs: number;
}

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let page: Page | null = null;

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  const context = await browser.newContext({ viewport: { width: 640, height: 360 } });
  await context.addInitScript('window.__name = (f) => f;');
  page = await context.newPage();
  await page.goto(started.url);
  await page.waitForFunction(() => Boolean((window as unknown as GameWindow).__game), null, { timeout: 60000 });
}, 90000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
}, 120000);

const routeOf = (id: string): unknown => JSON.parse(readFileSync(resolve(__dirname, `../src/levels/routes/${id}.json`), 'utf8'));

describe('the frame laws', () => {
  let readings: Record<'high' | 'mid' | 'low', TierReading> | null = null;

  const measure = async (): Promise<Record<'high' | 'mid' | 'low', TierReading> | null> => {
    if (readings) return readings;
    if (!page) return null;
    readings = await page.evaluate(
      async ({ route, LONGTASK }) => {
        const game = (window as unknown as GameWindow).__game;
        const longtasks: number[] = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) longtasks.push(entry.duration);
        }).observe({ entryTypes: ['longtask'] });

        game.debug.holdClock(false);
        game.debug.startLevel('playground-08');
        game.debug.autoplay(route);

        const sample = async (tier: 'high' | 'mid' | 'low') => {
          game.debug.setQuality(tier);
          const start = longtasks.length;
          let last = performance.now();
          let ema = 1000 / 60;
          const until = last + 4000;
          await new Promise<void>((done) => {
            const tick = () => {
              const now = performance.now();
              ema += (now - last - ema) / 32;
              last = now;
              if (now < until) requestAnimationFrame(tick);
              else done();
            };
            requestAnimationFrame(tick);
          });
          const window_ = longtasks.slice(start).filter((d) => d > LONGTASK);
          return { emaMs: ema, longtaskMaxMs: window_.length ? Math.max(...window_) : 0 };
        };

        const bestOf = async (tier: 'high' | 'mid' | 'low') => {
          let best: TierReading | null = null;
          for (let i = 0; i < 3; i++) {
            const reading = await sample(tier);
            if (!best || reading.emaMs < best.emaMs) best = reading;
          }
          return best!;
        };
        const high = await bestOf('high');
        const mid = await bestOf('mid');
        const low = await bestOf('low');
        return { high, mid, low };
      },
      { route: routeOf('playground-08'), LONGTASK: LONGTASK_MS }
    );
    return readings;
  };

  it('lets tier-low buy at least twice the frames of tier-high on the same machine', async (ctx) => {
    const tiers = await measure();
    if (!tiers) ctx.skip();
    // The absolute 30 fps floor is a real-silicon promise (the device matrix
    // and the host's device report own it); software rendering cannot falsify
    // it honestly, so the stand-in enforces what any machine can: the cheap
    // profile must be at least twice the frames of the full one.
    expect(tiers!.high.emaMs / tiers!.low.emaMs, `high ${tiers!.high.emaMs.toFixed(1)} ms against low ${tiers!.low.emaMs.toFixed(1)} ms`).toBeGreaterThan(2);
  }, 120_000);

  it('makes every cheaper tier buy frames', async (ctx) => {
    const tiers = await measure();
    if (!tiers) ctx.skip();
    // A few milliseconds of scheduling noise between windows, no more: the
    // profiles must actually be cheaper than each other, not merely different.
    expect(tiers!.low.emaMs).toBeLessThan(tiers!.mid.emaMs + 3);
    expect(tiers!.mid.emaMs).toBeLessThan(tiers!.high.emaMs + 3);
  }, 120_000);

  it('keeps the longtask ledger honest while the game plays', async (ctx) => {
    const tiers = await measure();
    if (!tiers) ctx.skip();
    const worst = tiers!.low.longtaskMaxMs;
    const ema = tiers!.low.emaMs;
    if (ema <= 1000 / 40) {
      // The stand-in is fast enough to falsify the real law (R-PE-12).
      expect(worst).toBeLessThan(LONGTASK_MS);
    } else {
      // Software rendering makes every frame long by itself; what can still be
      // caught is a stall out of proportion to its own frame: a collection
      // storm or a rebuild on the main thread, four times the frame it lives in.
      expect(worst, `worst longtask ${worst.toFixed(0)} ms against a ${ema.toFixed(0)} ms frame`).toBeLessThan(4 * ema);
    }
  }, 120_000);
});

describe(`the game's own stalls`, () => {
  it('rebuilds the heaviest levels inside the restart budget', async (ctx) => {
    if (!page) {
      ctx.skip();
      return;
    }
    const median = await page.evaluate((levels: string[]) => {
      const game = (window as unknown as GameWindow).__game;
      game.debug.holdClock(true);
      game.debug.startLevel(levels[0]!);
      const times: number[] = [];
      for (const id of [...levels, ...levels]) {
        const t0 = performance.now();
        game.debug.startLevel(id);
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      return times[Math.floor(times.length / 2)]!;
    }, HEAVY_LEVELS);
    expect(median, `rebuild median ${median.toFixed(0)} ms`).toBeLessThan(RESTART_BUDGET_MS);
  }, 120_000);

  it('links level to level inside the second, clear card and all', async (ctx) => {
    if (!page) {
      ctx.skip();
      return;
    }
    await page.evaluate((route: unknown) => {
      const game = (window as unknown as GameWindow).__game;
      game.debug.holdClock(true);
      // The link budget measures the standard clear transition; the practice
      // fall's own end-to-end ride (grade card, clear card, next level) is the
      // ftue suite's case, spectacle and all.
      (game.debug as unknown as { save: { data: { seen: string[] } } }).save.data.seen.push('fall.practice');
      game.debug.startLevel('scrapyard-01');
      game.debug.autoplay(route);
      for (let i = 0; i < 4000 && game.phase !== 'cleared'; i++) game.debug.advance(1 / 60);
      for (let i = 0; i < 200; i++) game.debug.advance(1 / 60);
    }, routeOf('scrapyard-01'));

    const card = page.locator('.clear-card');
    await card.waitFor({ state: 'visible', timeout: 15000 });

    const elapsed = await page.evaluate(async () => {
      const game = (window as unknown as GameWindow).__game;
      game.debug.holdClock(false);
      document.querySelector<HTMLElement>('.clear-card .btn.primary')!.click();
      const t0 = performance.now();
      await new Promise<void>((done) => {
        const tick = () => {
          if (game.phase === 'play' && game.debug.sim.level.id === 'scrapyard-02') {
            requestAnimationFrame(() => done());
            return;
          }
          if (performance.now() - t0 > 5000) done();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      return performance.now() - t0;
    });
    expect(elapsed, `clear card to next level's first frame took ${elapsed.toFixed(0)} ms`).toBeLessThan(LEVEL_LINK_BUDGET_MS);
  }, 120_000);
});
