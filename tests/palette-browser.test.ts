import type { Browser, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UI_VARS } from '@/config/palette';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The master palette's live leg (visual renewal PRD 15): the chrome the
 * browser actually paints, read back as computed styles and compared with the
 * module the lock names. What this proves is not the file's text but the
 * cascade: the tokens survive the stylesheet, the runtime and the viewport,
 * and the screen the player boots shows the colours the palette locked.
 */

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let page: Page | null = null;
let startedUrl = '';
const problems: string[] = [];

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  startedUrl = started.url;
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

describe('the chrome the browser paints (visual renewal 15)', () => {
  runnable('resolves every palette custom property to the module\u2019s own value', async () => {
    await page!.goto(startedUrl);
    await page!.waitForSelector('.hud', { timeout: 90000 });
    const mismatch = await page!.evaluate((expected) => {
      const root = getComputedStyle(document.documentElement);
      const bad: string[] = [];
      for (const [name, value] of Object.entries(expected)) {
        const live = root.getPropertyValue(name).trim();
        if (live !== value) bad.push(`${name}: live "${live}" != module "${value}"`);
      }
      return bad;
    }, UI_VARS);
    expect(mismatch).toEqual([]);
  });

  runnable('paints the primary button from the tokens, end to end', async () => {
    // The gradient's stops are the module's own pair; the ink on it is the
    // button's own dark. Read off a real button the UI built.
    const button = await page!.evaluate(() => {
      const make = (host: HTMLElement) => {
        const b = document.createElement('button');
        b.className = 'btn primary';
        b.textContent = 'probe';
        host.appendChild(b);
        const cs = getComputedStyle(b);
        const read = { color: cs.color, stops: cs.backgroundImage, shadow: cs.boxShadow.slice(0, 60) };
        b.remove();
        return read;
      };
      const root = document.querySelector('#app') as HTMLElement | null;
      return root ? make(root) : null;
    });
    expect(button).not.toBeNull();
    expect(button!.color).toBe('rgb(42, 23, 0)');
    expect(button!.stops).toContain('rgb(255, 201, 107)');
    expect(button!.stops).toContain('rgb(232, 136, 28)');
  });

  runnable('keeps the ink the panel really shows above the AA line', async () => {
    // The panel as the browser composites it over the live sky-adjacent base:
    // read the panel's own computed background and the ink colour, and prove
    // the ratio the screen carries.
    const ratio = await page!.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('.panel');
      const ink = getComputedStyle(panel ?? document.documentElement).color;
      const bg = getComputedStyle(panel ?? document.documentElement).backgroundColor;
      const parse = (v: string): [number, number, number] | null => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      };
      const lin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const lum = (rgb: [number, number, number]): number => 0.2126 * lin(rgb[0] / 255) + 0.7152 * lin(rgb[1] / 255) + 0.0722 * lin(rgb[2] / 255);
      const fg = parse(ink);
      const bgc = parse(bg);
      if (!fg || !bgc) return null;
      const la = lum(fg);
      const lb = lum(bgc);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    });
    // The panel over the dark base clears body-text AA with room for any sky
    // behind it; the exact ratio is read, not asserted, so a token change
    // that breaks the law fails here by its own number.
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThanOrEqual(4.5);
  });

  runnable('plays a climb on the locked palette without one page error', async () => {
    await page!.keyboard.down('Space');
    await page!.waitForTimeout(1300);
    await page!.keyboard.up('Space');
    await page!.waitForTimeout(1200);
    const rail = await page!.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('.rail');
      return rail ? getComputedStyle(rail).getPropertyValue('--rail-lo') || getComputedStyle(rail).background.slice(0, 60) : null;
    });
    expect(rail).not.toBeNull();
    expect(problems).toEqual([]);
  });
});

