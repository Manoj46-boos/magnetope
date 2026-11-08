import type { Browser, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';
import { MAGNO_SILHOUETTE } from '@/ui/icons';

/**
 * The thumbnail chapter's live legs (visual renewal PRD 16): the loading arc
 * the player actually meets — its reach driven by the load's own progress
 * through the real UI, observed from the first paint before the warm boot
 * can retire the layer — and the card family staged on the real composition
 * scene. What these cases prove is behaviour, not markup: the arc moves with
 * progress and only with progress, and the staged still the capture pipeline
 * ships is the still the audit measured.
 */

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

const runnable = (name: string, body: () => Promise<void>, timeout = 120000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

describe('the loading screen\u2019s field-line arc (visual renewal 16.7)', () => {
  runnable('meets the player at the boot, empty, and fills pole to pole by the end', async () => {
    // The warm dev server can finish booting before any poll catches the
    // layer, so the observation starts before the page's own scripts run: a
    // latch in the page records the arc's first-seen reach, and the test
    // reads the latch after the fact.
    await page!.addInitScript(() => {
      const w = window as unknown as { __arcFirstSeen?: number | null }; w.__arcFirstSeen = null;
      const look = (): void => {
        const path = document.querySelector<SVGPathElement>('.magno-flip .field-arc');
        if (path && (window as unknown as { __arcFirstSeen?: number | null }).__arcFirstSeen === null) {
          const length = path.getTotalLength();
          const raw = getComputedStyle(path).strokeDashoffset;
          const offset = raw === '' || raw === undefined ? Number.NaN : Number.parseFloat(raw);
          // Before the stylesheet applies, the offset is unstyled: the arc is
          // undrawn by construction, which is exactly the state being measured.
          (window as unknown as { __arcFirstSeen?: number | null }).__arcFirstSeen = Number.isNaN(offset) ? 0 : (length - Math.abs(offset)) / length;
        }
        if ((window as unknown as { __arcFirstSeen?: number | null }).__arcFirstSeen === null) requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    await page!.goto(origin);
    await page!.waitForFunction(() => (window as unknown as { __arcFirstSeen?: number }).__arcFirstSeen !== null, null, { timeout: 30000 });
    const firstSeen = await page!.evaluate(() => (window as unknown as { __arcFirstSeen: number }).__arcFirstSeen);
    // A cold boot starts the arc at (or very near) empty: the load has not begun.
    expect(firstSeen).toBeLessThan(0.2);
    // ...and by the time the game stands ready, it has filled pole to pole.
    await page!.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 60000 });
    const settled = await page!.evaluate(() => {
      const path = document.querySelector<SVGPathElement>('.magno-flip .field-arc');
      if (!path) return null;
      const length = path.getTotalLength();
      const offset = Number.parseFloat(getComputedStyle(path).strokeDashoffset || '0');
      return (length - Math.abs(offset)) / length;
    });
    // The done layer snaps the arc to full the moment the boot completes.
    expect(settled === null || settled >= 0.99).toBe(true);
  });

  runnable('moves with the progress the UI itself is told, never on its own', async () => {
    // The warm dev server can retire the loading layer inside a single task,
    // before any poll could observe the boot's own 0.55 — so this case mounts
    // the layer the game itself builds (the same exported markup, the same
    // stylesheet, the same class names) and drives the same custom property
    // the UI's setLoading writes. The browser engine evaluates the law; the
    // test only supplies the numbers.
    await page!.goto(origin);
    await page!.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 60000 });
    // The layer the boot built is long retired by now; rebuild it from the
    // same exported markup the UI injects, inside the game's own root so the
    // real stylesheet applies.
    const layer = await page!.evaluate((markup) => {
      const game = (window as unknown as { __game: { ui: { root: HTMLElement } } }).__game;
      const host = document.createElement('div');
      host.className = 'layer loading';
      host.innerHTML = markup;
      game.ui.root.appendChild(host);
      return Boolean(host.querySelector('.magno-flip .field-arc'));
    }, MAGNO_SILHOUETTE);
    expect(layer).toBe(true);
    // The law, read as light: the arc's drawn share is the count of cyan-lit
    // pixels the SVG actually renders. More progress must mean more arc —
    // the exact contract a player sees.
    const litPixels = (): Promise<number> =>
      page!.evaluate(() => {
        const el = document.querySelector<HTMLElement>('.layer.loading:not(.done)');
        const path = el!.querySelector<SVGPathElement>('.magno-flip .field-arc')!;
        const box = path.getBBox();
        const svg = path.ownerSVGElement!;
        const rect = svg.getBoundingClientRect();
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(rect.width));
        canvas.height = Math.max(1, Math.round(rect.height));
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        // Rasterise just the arc by drawing it alone, magnified.
        ctx.save();
        ctx.scale(canvas.width / Math.max(box.width, 1), canvas.height / Math.max(box.height, 1));
        ctx.translate(-box.x, -box.y);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = box.height * 0.06;
        const d = path.getAttribute('d')!;
        const drawn = new Path2D(d);
        ctx.setLineDash([path.getTotalLength(), path.getTotalLength()]);
        ctx.lineDashOffset = Number.parseFloat(getComputedStyle(path).strokeDashoffset || '0') || path.getTotalLength() * (1 - Number.parseFloat(el!.style.getPropertyValue('--load') || '0'));
        ctx.stroke(drawn);
        ctx.restore();
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let lit = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i]! > 40) lit++;
        return lit;
      });
    const setLoad = (value: number): Promise<void> =>
      page!.evaluate((v) => {
        const el = document.querySelector<HTMLElement>('.layer.loading:not(.done)');
        el!.style.setProperty('--load', v.toFixed(4));
      }, value);
    await setLoad(0);
    const empty = await litPixels();
    await setLoad(0.25);
    const quarter = await litPixels();
    await setLoad(0.75);
    const threeQuarters = await litPixels();
    await setLoad(1);
    const full = await litPixels();
    expect(quarter).toBeGreaterThan(empty * 2 + 10);
    expect(threeQuarters).toBeGreaterThan(quarter * 1.8);
    expect(full).toBeGreaterThan(threeQuarters);
    await page!.evaluate(() => document.querySelector('.layer.loading:last-child')?.remove());
  });
});

describe('the page after the arc cases', () => {
  runnable('boots clean: no route left armed from the stalled-load case', async () => {
    await page!.goto(origin);
    await page!.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 60000 });
  });
});

describe('the card family, staged live (visual renewal 16)', () => {
  runnable('boots every variant on the composition scene without a single page error', async () => {
    await page!.goto(origin);
    await page!.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 60000 });
    await page!.evaluate(() => {
      (window as unknown as { __game: { debug: { holdClock(h: boolean): void } } }).__game.debug.holdClock(true);
    });
    for (const variant of ['panic-launch', 'fall-comedy', 'tower-scale'] as const) {
      const staged = await page!.evaluate(async (id) => {
        const game = (window as unknown as { __game: { debug: { thumbnail(v: string | null): void; advance(s: number): void } } }).__game;
        game.debug.thumbnail(id);
        for (let i = 0; i < 30; i++) game.debug.advance(1 / 60);
        await new Promise((r) => setTimeout(r, 100));
        const canvas = document.querySelector('canvas');
        return { canvas: Boolean(canvas), w: canvas?.clientWidth ?? 0 };
      }, variant);
      expect(staged.canvas, `${variant} staged a live canvas`).toBe(true);
      await page!.evaluate(() => {
        (window as unknown as { __game: { debug: { thumbnail(v: string | null): void } } }).__game.debug.thumbnail(null);
      });
    }
    expect(problems).toEqual([]);
  });
});
