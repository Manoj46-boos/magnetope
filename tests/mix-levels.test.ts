import type { Browser, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AD_DUCK_DB } from '@/audio/engine';
import { launchBrowser, startServer } from './browser/harness';
import type { RenderReport, RenderSpec } from './browser/audio-fixture';

/**
 * Renders the game's real audio graph offline in Chrome, while the real simulation
 * plays a stored route, and measures the result the way broadcast does (ITU-R BS.1770
 * loudness, 4x true peak). The PRD's mix standard is -14 LUFS integrated and a true
 * peak under -1.5 dBTP. Skipped on machines with no browser.
 */

const TARGET_LUFS = -14;
const PLAY_TOLERANCE_LU = 2;
const FILM_TOLERANCE_LU = 2.5;
const TRUE_PEAK_CEILING_DBTP = -1.5;
const LOUDEST_PASSAGE_OVER_PROGRAMME_LU = 6;

let server: ViteDevServer | null = null;
let browser: Browser | null = null;
let page: Page | null = null;
const pageErrors: string[] = [];

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  page = await browser.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript('window.__name = (f) => f;');
  await page.goto(`${started.url}tests/browser/audio.html`);
  const ready = await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true, null, { timeout: 30000 }).then(
    () => true,
    () => false,
  );
  if (!ready) page = null;
}, 90000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

const render = (spec: RenderSpec): Promise<RenderReport> =>
  page!.evaluate((s) => (window as unknown as { renderAudio: (spec: RenderSpec) => Promise<RenderReport> }).renderAudio(s), spec);

const run = (name: string, body: () => Promise<void>) =>
  it(name, { timeout: 180_000 }, async (ctx) => {
    if (!page) ctx.skip();
    await body();
  });

describe('the mix of a real run, measured offline', () => {
  for (const levelId of ['scrapyard-03', 'metropolis-03', 'playground-03']) {
    run(`${levelId} plays at the PRD level without a peak past the ceiling`, async () => {
      const r = await render({ scenario: { kind: 'route', levelId }, seconds: 30 });
      expect(r.integratedLufs).toBeGreaterThan(TARGET_LUFS - PLAY_TOLERANCE_LU);
      expect(r.integratedLufs).toBeLessThan(TARGET_LUFS + PLAY_TOLERANCE_LU);
      expect(r.truePeakDb).toBeLessThanOrEqual(TRUE_PEAK_CEILING_DBTP);
    });
  }

  run('a long fall in thin air stays inside the mix: the whistle never towers over the rest', async () => {
    const r = await render({ scenario: { kind: 'route', levelId: 'stratosphere-03' }, seconds: 40 });
    expect(r.integratedLufs).toBeGreaterThan(TARGET_LUFS - PLAY_TOLERANCE_LU);
    expect(r.integratedLufs).toBeLessThan(TARGET_LUFS + PLAY_TOLERANCE_LU);
    expect(r.shortTermMaxLufs - r.integratedLufs).toBeLessThan(LOUDEST_PASSAGE_OVER_PROGRAMME_LU);
    expect(r.truePeakDb).toBeLessThanOrEqual(TRUE_PEAK_CEILING_DBTP);
  });

  run('a tumble off the route is as loud as the climb that preceded it', async () => {
    const climb = await render({ scenario: { kind: 'route', levelId: 'scrapyard-03' }, seconds: 30 });
    const tumble = await render({ scenario: { kind: 'tumble', levelId: 'scrapyard-03', fallAtSeconds: 14 }, seconds: 30 });
    expect(Math.abs(tumble.integratedLufs - climb.integratedLufs)).toBeLessThan(2.5);
    expect(tumble.truePeakDb).toBeLessThanOrEqual(TRUE_PEAK_CEILING_DBTP);
  });

  run('the ending film holds the same level through its swells and the fanfare', async () => {
    const r = await render({ scenario: { kind: 'ending' }, seconds: 60 });
    expect(r.integratedLufs).toBeGreaterThan(TARGET_LUFS - FILM_TOLERANCE_LU);
    expect(r.integratedLufs).toBeLessThan(TARGET_LUFS + FILM_TOLERANCE_LU);
    expect(r.truePeakDb).toBeLessThanOrEqual(TRUE_PEAK_CEILING_DBTP);
  });

  run('before mastering, effects peak above the score and the ambience stays far under it', async () => {
    const scenario = { kind: 'route', levelId: 'scrapyard-03' } as const;
    const effects = await render({ scenario, seconds: 30, mute: ['music', 'amb'], flatMaster: true });
    const score = await render({ scenario, seconds: 30, mute: ['sfx', 'amb', 'ui'], flatMaster: true });
    const ambience = await render({ scenario, seconds: 30, mute: ['sfx', 'music', 'ui'], flatMaster: true });
    expect(effects.samplePeakDb).toBeGreaterThan(score.samplePeakDb + 2);
    expect(score.integratedLufs).toBeGreaterThan(ambience.integratedLufs + 10);
  });

  run('raises no script error while rendering', async () => {
    expect(pageErrors).toEqual([]);
  });

  run('music steps back at least 6 dB for the length of an ad, and the cut is the engine ducking it', async () => {
    const scenario = { kind: 'route', levelId: 'scrapyard-03' } as const;
    const quiet = { scenario, seconds: 24, mute: ['sfx', 'amb', 'ui'] } satisfies RenderSpec;
    const open = await render(quiet);
    const ducked = await render({ ...quiet, adBetween: [8, 20] });
    const window = (r: RenderReport): number => r.perSecondDb.slice(12, 18).reduce((s, db) => s + db, 0) / 6;
    expect(window(open) - window(ducked)).toBeGreaterThan(-AD_DUCK_DB - 0.5);
    const before = (r: RenderReport): number => r.perSecondDb.slice(2, 7).reduce((s, db) => s + db, 0) / 5;
    expect(Math.abs(before(open) - before(ducked))).toBeLessThan(0.5);
  });
});
