import type { Browser, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { railGradient } from '@/ui/rail-palette';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The altitude rail as a player meets it (visual renewal PRD 14.9): played in
 * a real browser through the game's own loop, on levels from three different
 * biomes, it dresses itself in each biome's climb before the title card fades,
 * fills with real altitude as MAGNO actually climbs, and carries the horseshoe
 * marker — the game's signature shape — the whole way. Every read is the live
 * DOM's own computed style, never a source string.
 */

interface RailRead {
  biome: string;
  fillImage: string;
  fillStops: number[][];
  fillHeightPct: number;
  markerPct: number;
  markerGlyph: boolean;
  markerPoles: boolean;
  railWidth: string;
  railShown: boolean;
  railHeight: number;
}

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let origin = '';
let page: Page | null = null;
const problems: string[] = [];

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  origin = started.url;
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript('window.__name = (f) => f;');
  page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
  });
}, 90000);

afterAll(async () => {
  await page?.context().close();
  await browser?.close();
  await server?.close();
});

async function boot(fresh = false): Promise<void> {
  if (fresh) await page!.context().clearCookies();
  await page!.goto(origin);
  if (fresh) {
    // The rail's reveal is earned by this visit's own climb, so the first case
    // must meet it the way a new player does: nothing earned, nothing shown.
    await page!.evaluate(() => localStorage.clear());
    await page!.reload();
  }
  await page!.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 30000 });
  await page!.evaluate(() => {
    const game = (window as unknown as { __game: { debug: { holdClock(h: boolean): void } } }).__game;
    game.debug.holdClock(true);
  });
}

async function advance(ticks: number): Promise<void> {
  await page!.evaluate((n) => {
    const game = (window as unknown as { __game: { debug: { advance(s: number): void } } }).__game;
    for (let i = 0; i < n; i++) game.debug.advance(1 / 60);
  }, ticks);
}

async function readRail(): Promise<RailRead> {
  return page!.evaluate(() => {
    const rail = document.querySelector<HTMLElement>('.rail')!;
    const fill = rail.querySelector<HTMLElement>('.fill')!;
    const marker = rail.querySelector<HTMLElement>('.marker')!;
    const markerSvg = marker.querySelector('svg');
    const glyph = markerSvg?.querySelector('path');
    const rect = rail.getBoundingClientRect();
    // The browser normalises any authored colour function to rgb(), so the
    // gradient is read as its computed stops — the colours the eye gets.
    const fillStops = [...getComputedStyle(fill).backgroundImage.matchAll(/rgb\(([^)]+)\)/g)].map((m) =>
      m[1]!.split(',').map(Number),
    );
    return {
      biome: rail.dataset.biome ?? '',
      fillImage: getComputedStyle(fill).backgroundImage,
      fillStops,
      fillHeightPct: fill.getBoundingClientRect().height / Math.max(1, rect.height),
      markerPct: Number(marker.style.bottom.replace('%', '') || 0) / 100,
      markerGlyph: Boolean(glyph && /V20|V5/.test(glyph.getAttribute('d') ?? '')),
      markerPoles: Boolean(markerSvg && markerSvg.querySelectorAll('rect').length === 2),
      railWidth: getComputedStyle(rail).width,
      railShown: rail.classList.contains('show'),
      railHeight: rect.height,
    };
  });
}

/** hsl() as the derivation speaks it, to the rgb() channels the browser computes. */
function hslToRgbChannels(h: number, s: number, l: number): number[] {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number): number => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number): number => Math.round(255 * (light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [channel(0), channel(8), channel(4)];
}

/** Both stops of a railGradient pair, as the browser will have normalised them. */
function gradientStops(biome: Parameters<typeof railGradient>[0]): number[][] {
  const pair = railGradient(biome);
  return [pair.ground, pair.summit].map((css) => {
    const [h, s, l] = css.match(/hsl\((\d+) (\d+)% (\d+)%\)/)!.slice(1).map(Number);
    return hslToRgbChannels(h!, s!, l!);
  });
}

const close = (a: number[] | undefined, b: number[] | undefined): boolean =>
  Boolean(a && b && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) <= 1));

/** Reaches live play in a level: skip the opener, first input, then hand back. */
async function enterPlay(levelId: string): Promise<void> {
  await page!.evaluate((id) => {
    const game = (window as unknown as { __game: { startLevel(id: string): void } }).__game;
    game.startLevel(id);
  }, levelId);
  await advance(30);
  await page!.keyboard.press('Space');
  await advance(30);
}

const runnable = (name: string, body: () => Promise<void>, timeout = 120000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

describe('the altitude rail in live play', () => {
  runnable('dresses itself in the biome the level boots in, before the climb earns it', async () => {
    await boot(true);
    // Enter the level with no input at all: the opener's establishing shot runs
    // under a held clock, and the rail is already dressed in the biome's own
    // climb while the world has yet to move (the reveal is earned later, PRD 12.1).
    await page!.evaluate(() => {
      const game = (window as unknown as { __game: { startLevel(id: string): void } }).__game;
      game.startLevel('scrapyard-00');
    });
    await advance(30);
    const rail = await readRail();
    expect(rail.biome).toBe('scrapyard');
    const [ground, summit] = gradientStops('scrapyard') as number[][];
    expect(close(rail.fillStops[0]!, ground), `${rail.fillStops[0]} vs ${ground}`).toBe(true);
    expect(close(rail.fillStops[1]!, summit), `${rail.fillStops[1]} vs ${summit}`).toBe(true);
    // Nothing climbed, nothing shown: the fill carries only the spawn's own
    // standing height (a fraction of a metre), not a climb.
    expect(rail.railShown).toBe(false);
    expect(rail.fillHeightPct).toBeLessThan(0.05);
  });

  runnable('re-dresses for each biome the level boots in, every climb its own', async () => {
    const seen: string[] = [];
    for (const levelId of ['suburbia-01', 'stratosphere-01']) {
      const biome = levelId.split('-')[0]!;
      await enterPlay(levelId);
      const rail = await readRail();
      expect(rail.biome, levelId).toBe(biome);
      const [ground, summit] = gradientStops(biome as Parameters<typeof railGradient>[0]) as number[][]
      expect(close(rail.fillStops[0]!, ground), `${levelId}: ${rail.fillStops[0]} vs ${ground}`).toBe(true);
      expect(close(rail.fillStops[1]!, summit), `${levelId}: ${rail.fillStops[1]} vs ${summit}`).toBe(true);
      // And no two biomes share a pair: every visit dressed differently.
      seen.push(rail.fillImage);
    }
    expect(new Set(seen).size).toBe(2);
  });

  runnable('reveals with real altitude and carries the horseshoe marker up the climb', async () => {
    await boot();
    await enterPlay('scrapyard-00');
    // A full-charge launch: hold, release, and let the flight settle.
    await page!.keyboard.down('Space');
    await advance(110);
    await page!.keyboard.up('Space');
    await advance(40);
    const rail = await readRail();
    expect(rail.railShown).toBe(true);
    // The fill and the marker moved with the climb the simulation actually made.
    expect(rail.fillHeightPct).toBeGreaterThan(0.02);
    expect(rail.markerPct).toBeGreaterThan(0.02);
    // The marker is the game's signature: the horseshoe with both pole tips.
    expect(rail.markerGlyph).toBe(true);
    expect(rail.markerPoles).toBe(true);
    expect(rail.railWidth).toBe('8px');
    expect(rail.railHeight).toBeGreaterThan(100);
  });

  runnable('raised no console errors or page errors through the whole visit', async () => {
    expect(problems).toEqual([]);
  });
});
