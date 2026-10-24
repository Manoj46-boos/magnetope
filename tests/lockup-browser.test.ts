import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The lockup must read as one word (PRD 17.3, R-TH-08): the horseshoe sits in
 * the word's own rhythm at every size the ending card's clamp() can produce.
 * Measured as ink, in a real browser — per-letter advance boxes from the DOM,
 * ink extents from the same font through canvas metrics, and the magnet's ink
 * straight from its vector geometry — because box edges and letter-spacing
 * both lie around an inline-block: no spacing is applied around one, so the
 * only honest check is where the ink actually lands.
 */

interface GameWindow {
  __game: {
    ui: {
      ending: {
        show(summary: unknown, onSkip: () => void): void;
        render(state: { letterbox: number; credits: number }): void;
      };
    };
  };
}

const CLIMB = { stars: 210, maxStars: 210, levelsCleared: 70, totalLevels: 70, bestFall: { heightMeters: 123.4, grade: 'SSS' } };

const SIZES = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'small phone landscape', width: 568, height: 320 },
] as const;

/** Ink span of one glyph in page pixels: where it starts, where it ends. */
type Span = [start: number, end: number];

interface InkReport {
  font: number;
  spans: Span[];
  problems: string[];
}

/** Runs in the page: the ink spans of every glyph in the ending's wordmark. */
function measureInk(): InkReport {
  const problems: string[] = [];
  const lockup = document.querySelector<HTMLElement>('.ending .credits .mark .lockup');
  if (!lockup) return { font: 0, spans: [], problems: ['the lockup is not on the card'] };

  const style = getComputedStyle(lockup);
  const font = parseFloat(style.fontSize);
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return { font, spans: [], problems: ['no canvas 2d for font metrics'] };
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

  const inkOf = (origin: number, glyph: string): Span => {
    const m = ctx.measureText(glyph);
    return [origin - m.actualBoundingBoxLeft, origin + m.actualBoundingBoxRight];
  };

  const spans: Span[] = [];
  const range = document.createRange();
  for (const node of lockup.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        spans.push(inkOf(range.getBoundingClientRect().left, text.charAt(i)));
      }
    } else if (node instanceof HTMLElement && node.classList.contains('lockup-o')) {
      const box = node.getBoundingClientRect();
      const svg = node.querySelector('svg');
      if (!svg) {
        problems.push('the magnet span carries no ident');
        continue;
      }
      const view = svg.viewBox.baseVal;
      let min = Infinity;
      let max = -Infinity;
      for (const el of svg.querySelectorAll('rect')) {
        min = Math.min(min, el.x.baseVal.value);
        max = Math.max(max, el.x.baseVal.value + el.width.baseVal.value);
      }
      for (const el of svg.querySelectorAll('path')) {
        const bounds = el.getBBox();
        const half = (parseFloat(el.getAttribute('stroke-width') ?? '0') || 0) / 2;
        min = Math.min(min, bounds.x - half);
        max = Math.max(max, bounds.x + bounds.width + half);
      }
      spans.push([box.left + (min / view.width) * box.width, box.left + (max / view.width) * box.width]);
    } else if (node instanceof HTMLElement) {
      spans.push(inkOf(node.getBoundingClientRect().left, node.textContent ?? ''));
    }
  }
  return { font, spans, problems };
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

describe.each(SIZES)('the ending wordmark at $name ($width x $height)', ({ name, width, height }) => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const failures: string[] = [];

  beforeAll(async () => {
    if (!browser) return;
    context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript('window.__name = (f) => f;');
    page = await context.newPage();
    page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) failures.push(`console: ${m.text()}`);
    });
    await page.goto(origin);
    await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
    await page.evaluate(() => {
      const ending = (window as unknown as GameWindow).__game.ui.ending;
      ending.show(
        { stars: 210, maxStars: 210, levelsCleared: 70, totalLevels: 70, bestFall: { heightMeters: 123.4, grade: 'SSS' } },
        () => undefined,
      );
      ending.render({ letterbox: 1, credits: 1 });
    });
    await page.locator('.ending .credits .mark .lockup').waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);
  }, 90000);

  afterAll(async () => {
    await context?.close();
  });

  const runnable = (title: string, body: () => Promise<void>, timeout = 120000) =>
    it(
      title,
      async (ctx) => {
        if (!page) ctx.skip();
        await body();
      },
      timeout,
    );

  runnable('sets the magnet into the word\'s own rhythm', async () => {
    const report = await page!.evaluate(measureInk);
    expect(report.problems).toEqual([]);
    // M A G N E T [magnet] P E — the magnet is the seventh glyph of nine
    expect(report.spans).toHaveLength(9);
    const font = report.font;
    expect(font).toBeGreaterThan(0);

    const gaps = report.spans.slice(1).map((span, i) => span[0] - report.spans[i]![1]);
    const names = ['M-A', 'A-G', 'G-N', 'N-E', 'E-T', 'T-O', 'O-P', 'P-E'];
    for (let i = 0; i < gaps.length; i++) {
      expect(gaps[i], `${names[i]} ink gap at ${name}`).toBeGreaterThan(0.03 * font);
    }

    // the six letter-letter gaps set the rhythm; both magnet gaps must sit in it
    const rhythm = gaps.filter((_, i) => i !== 5 && i !== 6);
    const low = Math.min(...rhythm) - 0.05 * font;
    const high = Math.max(...rhythm) + 0.05 * font;
    for (const side of [gaps[5]!, gaps[6]!]) {
      expect(side, `a magnet gap of ${Math.round((side / font) * 1000) / 1000}em at ${name}`).toBeGreaterThan(low);
      expect(side).toBeLessThan(high);
    }
  });

  runnable('draws the magnet at letter weight, not illustration scale', async () => {
    const report = await page!.evaluate(measureInk);
    expect(report.problems).toEqual([]);
    const widths = report.spans.map(([a, b]) => b - a);
    const letters = widths.filter((_, i) => i !== 6).sort((a, b) => a - b);
    const median = (letters[3]! + letters[4]!) / 2;
    const magnet = widths[6]! / median;
    expect(magnet, `the ident is ${Math.round(magnet * 100) / 100}x a letter at ${name}`).toBeGreaterThan(0.8);
    expect(magnet).toBeLessThan(1.25);
  });

  runnable('raised no console errors or page errors', async () => {
    expect(failures).toEqual([]);
  });
});
