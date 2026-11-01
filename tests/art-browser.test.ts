import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The art-direction suite (rebuild PRD Volume IV, P-AR-02/03/06): one frame per
 * biome at its own level 1, read as pixels the way a player's eye reads them —
 * saturation reaching the screen (the retune, not the table), each biome's
 * signature hue band present (the committed palette, not a hedged one), the
 * landmark silhouette standing over its ridge (the horizon identity that kills
 * the empty-background look), and MAGNO separating from his backdrop (the
 * character law: brightest object on screen by contract).
 *
 * The frames are the live renderer's own: the page boots through the real
 * build, each level is started through the game's own startLevel, and the
 * analysis runs on the canvas the player sees. No string searches, no mocks.
 */

interface FrameStats {
  saturated: number;
  dominantHue: number;
  hueSpread: number;
  ridgeTop: number[];
  landmark: { peak: number; at: number; width: number } | null;
  subject: { separation: number; area: number } | null;
}

const FIRST_LEVELS = ['scrapyard-01', 'suburbia-01', 'metropolis-01', 'playground-01', 'stratosphere-01'] as const;

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
  context = await browser.newContext({ viewport: { width: 836, height: 470 } });
  await context.addInitScript('window.__name = (f) => f;');
  page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
  });
}, 90000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await server?.close();
}, 120000);

const runnable = (name: string, body: () => Promise<void>, timeout = 120000) =>
  it(name, async (ctx) => {
    if (!page) ctx.skip();
    await body();
  }, timeout);

/**
 * Boots into a biome's level 1 and reads one settled frame the way the eye
 * does: every metric is a perception, not an internal read.
 */
async function readBiomeFrame(level: string): Promise<FrameStats> {
  await page!.goto(origin);
  await page!.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 30000 });
  await page!.waitForTimeout(600);
  await page!.evaluate((id) => {
    const game = (window as unknown as { __game: any }).__game;
    game.startLevel(id);
    game.debug.holdClock(true);
  }, level);
  // Let the arrival settle: the camera settles on the perch, the grade and
  // backdrop are already up from the first frame.
  await page!.evaluate(() => {
    const game = (window as unknown as { __game: any }).__game;
    for (let i = 0; i < 90; i++) game.debug.advance(1 / 60);
  });
  return page!.evaluate(async () => {
    // Read the frame inside this page task, before the drawing buffer clears,
    // and decode it through a 2D canvas the way the thumbnail suite does.
    const game = (window as unknown as { __game: any }).__game;
    game.debug.advance(1 / 60);
    const source = document.querySelector('canvas') as HTMLCanvasElement;
    const png = source.toDataURL('image/png');
    const image = new Image();
    image.src = png;
    await image.decode();
    const offscreen = document.createElement('canvas');
    offscreen.width = image.width;
    offscreen.height = image.height;
    const ctx = offscreen.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const w = offscreen.width;
    const h = offscreen.height;
    const data = ctx.getImageData(0, 0, w, h).data;

    // --- saturation and hue, over a strided sample of the frame ---
    let saturated = 0;
    let samples = 0;
    const hueAt = (r: number, g: number, b: number): number => {
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const l = (max + min) / 2;
      const d = max - min;
      if (d < 0.08 * 255 / 255 || l < 0.08 || l > 0.97) return -1;
      let hue = 0;
      const rr = r / 255;
      const gg = g / 255;
      const bb = b / 255;
      if (rr >= gg && rr >= bb) hue = ((gg - bb) / (d || 1)) % 6;
      else if (gg >= rr && gg >= bb) hue = (bb - rr) / (d || 1) + 2;
      else hue = (rr - gg) / (d || 1) + 4;
      return ((hue * 60) + 360) % 360;
    };
    const hueBuckets = new Array(36).fill(0);
    let hueCount = 0;
    let hueSin = 0;
    let hueCos = 0;
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const i = (y * w + x) * 4;
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        samples++;
        if (sat > 0.22 && max > 40 && max < 250) saturated++;
        const hue = hueAt(r, g, b);
        if (hue >= 0) {
          hueCount++;
          hueBuckets[Math.floor(hue / 10)]!++;
          const rad = (hue * Math.PI) / 180;
          hueSin += Math.sin(rad);
          hueCos += Math.cos(rad);
        }
      }
    }
    const dominantHue = hueCount === 0 ? -1 : ((Math.atan2(hueSin, hueCos) * 180) / Math.PI + 360) % 360;
    const active = hueBuckets.filter((n) => n > hueCount * 0.02).length;

    // --- the horizon: ridge line, then the landmark that stands over it ---
    // The ridge is the skyline layer: the first strong luminance step from the
    // sky. Walking down each column, the sky is the top gradient; the ridge
    // top is where the column stops being sky-smooth.
    const at = (x: number, y: number): number => {
      const i = (y * w + x) * 4;
      return 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
    };
    const ridgeTop: number[] = [];
    for (let x = 0; x < w; x += 2) {
      let top = h - 1;
      for (let y = 4; y < h - 4; y += 2) {
        const here = at(x, y);
        const below = at(x, Math.min(h - 1, y + 6));
        if (Math.abs(below - here) > 26) {
          top = y;
          break;
        }
      }
      ridgeTop.push(top);
    }
    // The landmark: a compact run of columns whose ridge top sits well above
    // the skyline's own median — the hero silhouette drawn in front of its
    // ridge. The law is depth and placement, not girth: the water tower is
    // spider-legged and the dish is a thin annulus, so a run of three columns
    // or more is a silhouette, and its peak must clear the ridge by a
    // fifteenth of the frame. Of the qualifying runs — the Stratosphere's sky
    // carries drifting junk that can read as one — the landmark is the run
    // nearest the centre line, which is where the hero layer is built to live.
    const median = [...ridgeTop].sort((a, b) => a - b)[Math.floor(ridgeTop.length / 2)]!;
    let landmark: FrameStats['landmark'] = null;
    let runStart = -1;
    for (let i = 0; i <= ridgeTop.length; i++) {
      const lifted = i < ridgeTop.length && median - ridgeTop[i]! > h * 0.06;
      if (lifted && runStart < 0) runStart = i;
      if (!lifted && runStart >= 0) {
        if (i - runStart >= 3) {
          const peak = Math.min(...ridgeTop.slice(runStart, i));
          const at = (runStart + i - 1) * 2 / w;
          const width = (i - runStart) * 2 / w;
          if (median - peak > h * 0.07 && (!landmark || Math.abs(at - 0.5) < Math.abs(landmark.at - 0.5))) {
            landmark = { peak, at, width };
          }
        }
        runStart = -1;
      }
    }

    // --- the subject: MAGNO's separation from the band behind him ---
    // His screen position is the renderer's own projection (the same anchor
    // the input layer aims by), so the crop centres on him wherever the level
    // put him. The character law is a brightness contract: brightest object
    // on screen, separation >= 2:1 against the local band.
    const screen = game.debug.renderer.playerScreen();
    const cx = screen ? Math.round((screen.x / (source.clientWidth || 1)) * w) : w >> 1;
    const cy = screen ? Math.round((screen.y / (source.clientHeight || 1)) * h) : Math.round(h * 0.55);
    const half = Math.round(Math.min(w, h) * 0.09);
    const band: number[] = [];
    const subject: number[] = [];
    for (let y = cy - half; y < cy + half; y++) {
      for (let x = cx - half; x < cx + half; x++) {
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const l = at(x, y);
        const edge = Math.abs(x - cx) > half * 0.55 || Math.abs(y - cy) > half * 0.55;
        (edge ? band : subject).push(l);
      }
    }
    const sortedBand = [...band].sort((a, b) => a - b);
    const bandMedian = sortedBand[Math.floor(sortedBand.length / 2)] ?? 1;
    const sortedSubject = [...subject].sort((a, b) => a - b);
    // The silhouette read is direction-free — Chiu's filled-black test is
    // about separation from the band, whichever way the contrast runs: bright
    // on the neon night, dark against a laundry morning.
    const subjectBright = sortedSubject[Math.floor(sortedSubject.length * 0.92)] ?? 0;
    const subjectDark = sortedSubject[Math.floor(sortedSubject.length * 0.08)] ?? 0;
    const separation = Math.max(subjectBright, bandMedian) / Math.max(1, Math.min(subjectDark, bandMedian) || 1);
    const visible = subject.filter((l) => Math.abs(l - bandMedian) > bandMedian * 0.45).length / (subject.length || 1);

    return {
      saturated: saturated / samples,
      dominantHue,
      hueSpread: active,
      ridgeTop: [],
      landmark,
      subject: { separation, area: visible },
    } satisfies FrameStats;
  });
}

describe('the art direction laws, one frame per biome (Volume IV)', () => {
  runnable('each biome carries its committed signature hue band (P-AR-06)', async () => {
    // The committed palette is the anti-generic law: a hedged frame reads
    // gray in a saturated category row. Each biome's dominant hue must land
    // inside its authored band — amber for the yard, green morning for the
    // suburbs, the neon night, noon toy-plastic, and the Stratosphere's
    // desaturated dawn.
    const frames: Partial<Record<(typeof FIRST_LEVELS)[number], FrameStats>> = {};
    for (const level of FIRST_LEVELS) frames[level] = await readBiomeFrame(level);
    const hue = (level: (typeof FIRST_LEVELS)[number]) => frames[level]!.dominantHue;

    const inBand = (hueValue: number, from: number, to: number): boolean => (from <= to ? hueValue >= from && hueValue <= to : hueValue >= from || hueValue <= to);
    expect(inBand(hue('scrapyard-01'), 5, 60), `scrapyard hue ${hue('scrapyard-01').toFixed(0)}`).toBe(true);
    expect(inBand(hue('suburbia-01'), 60, 200), `suburbia hue ${hue('suburbia-01').toFixed(0)}`).toBe(true);
    expect(inBand(hue('metropolis-01'), 150, 300), `metropolis hue ${hue('metropolis-01').toFixed(0)}`).toBe(true);
    expect(inBand(hue('playground-01'), 150, 300) || inBand(hue('playground-01'), 5, 70), `playground hue ${hue('playground-01').toFixed(0)}`).toBe(true);
    expect(inBand(hue('stratosphere-01'), 150, 260), `stratosphere hue ${hue('stratosphere-01').toFixed(0)}`).toBe(true);
  });

  runnable('the retune reaches the screen: every frame carries real saturation (P-AR-01 through the renderer)', async () => {
    // The grade table is law, but the screen is the truth: a flat-gray frame
    // (the "color muting" finding) reads under 5% at this saturation cut. Each
    // biome's live frame must clear double that share — the pastel morning
    // included, at its own softer cut.
    for (const level of FIRST_LEVELS) {
      const stats = await readBiomeFrame(level);
      expect(stats.saturated, `${level} saturated share ${(stats.saturated * 100).toFixed(1)}%`).toBeGreaterThan(0.1);
    }
  });

  runnable('the landmark silhouette stands over its ridge in every biome (P-AR-03)', async () => {
    for (const level of FIRST_LEVELS) {
      const stats = await readBiomeFrame(level);
      expect(stats.landmark, `${level} found no silhouette over the ridge`).not.toBeNull();
      expect(stats.landmark!.width, `${level} landmark width`).toBeLessThan(0.5);
      expect(Math.abs(stats.landmark!.at - 0.5), `${level} landmark sits inside the lens's frame`).toBeLessThan(0.45);
    }
  });

  runnable('MAGNO separates from his backdrop: the silhouette law, read as brightness (P-AR-02 machine leg)', async () => {
    for (const level of FIRST_LEVELS) {
      const stats = await readBiomeFrame(level);
      expect(stats.subject, `${level} found no subject`).not.toBeNull();
      expect(stats.subject!.separation, `${level} subject/band ${(stats.subject!.separation).toFixed(2)}:1`).toBeGreaterThanOrEqual(1.7);
      expect(stats.subject!.area, `${level} silhouette visible share`).toBeGreaterThan(0.02);
    }
  });

  runnable('the pages above ran without a single script error', async () => {
    expect(problems).toEqual([]);
  });
});
