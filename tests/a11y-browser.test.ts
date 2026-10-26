import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TABLES } from '@/locale/strings';
import { pseudoTable } from '@/locale/pseudo';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The accessibility suite's real-browser leg (premium PRD W12): the DOM every
 * player actually receives is audited the way an accessibility reviewer walks
 * it — semantic controls with names, states that tell the truth, focus you can
 * see, Tab that stays inside the modal, text that clears 4.5:1 on its own
 * panel — and the interface scale and the pseudo locale are measured on the
 * sizes people play on, under the fit law's own rules. The font sweep draws
 * every character of every language through the shipped Fredoka file.
 */

interface GameWindow {
  __game: {
    ui: Record<string, unknown>;
    flash(amount: number): void;
    debug: { holdClock(held: boolean): void };
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

/** Runs in the page: one rules pass over a surface, returning every law it breaks. */
function auditSurface(selector: string): string[] {
  const root = document.querySelector(selector);
  if (!root) return [`${selector}: surface is not on screen`];
  const problems: string[] = [];
  const shown = (e: Element): boolean => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  for (const node of [...root.querySelectorAll<HTMLElement>('button, select, input, [role="radio"]')].filter(shown)) {
    const labelledBy = node.getAttribute('aria-labelledby');
    const namedBy =
      labelledBy?.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ') || '';
    const name = (node.getAttribute('aria-label') || namedBy || node.textContent || node.getAttribute('title') || '').trim();
    if (!name) problems.push(`a ${node.tagName.toLowerCase()} has no name a reader can speak`);
    if (Number(node.getAttribute('tabindex')) > 0) problems.push(`a control grabs the Tab order (${name || node.tagName})`);
    for (const state of ['aria-pressed', 'aria-checked']) {
      const value = node.getAttribute(state);
      if (value !== null && value !== 'true' && value !== 'false') problems.push(`a state attribute is neither true nor false (${name})`);
    }
  }
  for (const svg of root.querySelectorAll('svg')) {
    if (svg.getAttribute('aria-hidden') !== 'true' && svg.getAttribute('role') !== 'img' && !svg.querySelector('title')) {
      problems.push('a decorative svg is not marked aria-hidden');
    }
  }
  return problems;
}

/** Runs in the page: every visible word inside a panel clears 4.5:1 on what it sits on. */
function auditContrast(selector: string): string[] {
  const root = document.querySelector(selector);
  if (!root) return [`${selector}: surface is not on screen`];
  const problems: string[] = [];
  const parse = (color: string): { rgb: number[]; a: number } | null => {
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const n = m[1]!.split(/[\s,/]+/).map(Number);
    return { rgb: [n[0]!, n[1]!, n[2]!], a: n[3] === undefined ? 1 : n[3] };
  };
  const lum = (rgb: number[]): number => {
    const lin = rgb.map((c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  };
  const backdropOf = (node: Element): number[] => {
    let rgb = [21, 26, 34];
    let covered = 1;
    for (let e: Element | null = node; e && covered > 0; e = e.parentElement) {
      const style = getComputedStyle(e);
      // A gradient paints its own backdrop; the audit reads its average colour, the way the eye reads the whole button.
      const colors: number[][] = [];
      const image = style.backgroundImage;
      if (image && image !== 'none') {
        for (const match of image.matchAll(/rgba?\(([^)]+)\)/g)) {
          const n = match[1]!.split(/[\s,/]+/).map(Number);
          if (n.length >= 3) colors.push([n[0]!, n[1]!, n[2]!]);
        }
      }
      const parsed = parse(style.backgroundColor);
      if (colors.length > 0 && !parsed!.a) {
        const avg = [0, 1, 2].map((i) => Math.round(colors.reduce((sum, c) => sum + c[i]!, 0) / colors.length));
        rgb = avg;
        covered = 0;
        break;
      }
      if (parsed && parsed.a > 0) {
        rgb = rgb.map((c, i) => Math.round(parsed.rgb[i]! * parsed.a + c * (1 - parsed.a)));
        covered -= parsed.a;
      }
    }
    return rgb;
  };
  const walkers = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let e = walkers.currentNode as Element; e; e = walkers.nextNode() as Element) {
    const hasText = [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
    if (!hasText || !e.getBoundingClientRect().width) continue;
    const fg = parse(getComputedStyle(e).color);
    if (!fg) continue;
    const over = backdropOf(e);
    const ratio = (Math.max(lum(fg.rgb), lum(over)) + 0.05) / (Math.min(lum(fg.rgb), lum(over)) + 0.05);
    if (ratio < 4.5) problems.push(`"${(e.textContent ?? '').trim().slice(0, 24)}" reads at ${ratio.toFixed(2)}:1`);
  }
  return problems;
}

/** The layout battery's own rules (PRD 12.3), applied to a surface. The limits are inlined so the function carries them across the wire. */
function measureSurface(check: { label: string; root: string; fits: boolean; fullScreen?: boolean }): string[] {
  const LIMITS = { target: 32, font: 11 };
  const root = document.querySelector<HTMLElement>(check.root);
  if (!root) return [`${check.label}: surface is not on screen`];
  const problems: string[] = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = root.getBoundingClientRect();
  const shown = (e: Element): boolean => {
    const r = e.getBoundingClientRect();
    const style = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  if (!check.fullScreen && (rect.left < -0.5 || rect.top < -0.5 || rect.right > vw + 0.5 || rect.bottom > vh + 0.5)) {
    problems.push(`${check.label}: panel leaves the screen`);
  }
  if (check.fits && root.scrollHeight > root.clientHeight + 1) problems.push(`${check.label}: needs scrolling (${root.scrollHeight} in ${root.clientHeight})`);
  for (const node of root.querySelectorAll<HTMLElement>('*')) {
    if (!shown(node)) continue;
    const style = getComputedStyle(node);
    const hasText = [...node.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
    if (hasText) {
      if (node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1 && !/auto|scroll/.test(style.overflowX)) {
        problems.push(`${check.label}: text spills ("${(node.textContent ?? '').trim().slice(0, 24)}")`);
      }
      if (parseFloat(style.fontSize) < LIMITS.font) problems.push(`${check.label}: text renders at ${style.fontSize}`);
    }
    if (node.matches('button, select, input, [role="radio"]') && !node.matches('.tiny, [aria-hidden="true"]')) {
      const r = node.getBoundingClientRect();
      if (Math.min(r.width, r.height) < LIMITS.target) problems.push(`${check.label}: a control is ${Math.round(Math.min(r.width, r.height))}px, too small to hit`);
    }
  }
  return problems;
}

describe('the DOM a player receives (R-AC-07)', () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const failures: string[] = [];

  beforeAll(async () => {
    if (!browser) return;
    context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await context.newPage();
    page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) failures.push(`console: ${m.text()}`);
    });
    await page.goto(origin);
    await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
    await page.evaluate(() => (window as unknown as GameWindow).__game.debug.holdClock(true));
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
    await page.locator('.panel.pause').waitFor({ state: 'visible' });
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

  const openFromPause = async (screen: string, root: string): Promise<void> => {
    await page!.locator(`.panel.pause [data-opens="${screen}"]`).click();
    await page!.locator(root).waitFor({ state: 'visible' });
  };

  const back = async (): Promise<void> => {
    await page!.keyboard.press('Escape');
    await page!.waitForTimeout(80);
  };

  runnable('names every control, marks every icon, and keeps no liar states on any screen', async () => {
    const found: string[] = [];
    const audit = async (label: string, root: string): Promise<void> => {
      for (const problem of await page!.evaluate(auditSurface, root)) found.push(`[${label}] ${problem}`);
    };
    await audit('pause', '.panel.pause');
    await openFromPause('controls', '.panel.controls');
    await audit('controls', '.panel.controls');
    await page!.locator('.panel.controls [data-opens="keys"]').click();
    await page!.locator('.panel.keys').waitFor({ state: 'visible' });
    await audit('keys', '.panel.keys');
    await back();
    await back();
    await openFromPause('exchange', '.panel.exchange');
    await audit('ghost exchange', '.panel.exchange');
    await back();
    await openFromPause('locker', '.screen.open');
    await audit('locker', '.screen.open');
    await back();
    await openFromPause('map', '.screen.open');
    await audit('level map', '.screen.open');
    await back();
    expect(found, found.join('\n')).toEqual([]);
  });

  runnable('keeps every word it shows inside a panel above 4.5:1', async () => {
    const found: string[] = [];
    const audit = async (label: string, root: string): Promise<void> => {
      for (const problem of await page!.evaluate(auditContrast, root)) found.push(`[${label}] ${problem}`);
    };
    await audit('pause', '.panel.pause');
    await openFromPause('controls', '.panel.controls');
    await audit('controls', '.panel.controls');
    await page!.locator('.panel.controls [data-opens="keys"]').click();
    await page!.locator('.panel.keys').waitFor({ state: 'visible' });
    await audit('keys', '.panel.keys');
    await back();
    await back();
    await openFromPause('exchange', '.panel.exchange');
    await audit('ghost exchange', '.panel.exchange');
    await back();
    expect(found, found.join('\n')).toEqual([]);
  });

  runnable('traps Tab inside the open modal and shows the focus it lands on', async () => {
    const items = await page!.locator('.panel.pause [data-nav]').all();
    for (let i = 0; i < items.length + 2; i++) await page!.keyboard.press('Tab');
    const inside = await page!.evaluate(() => {
      const modal = document.querySelector('.panel.pause')!.closest('.modal')!;
      return modal.contains(document.activeElement);
    });
    expect(inside).toBe(true);
    const outline = await page!.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return { width: getComputedStyle(el).outlineWidth, style: getComputedStyle(el).outlineStyle, color: getComputedStyle(el).outlineColor };
    });
    expect(parseFloat(outline.width)).toBeGreaterThan(0);
    expect(outline.style).not.toBe('none');
    expect(outline.color).not.toBe('rgb(0, 0, 0)');
  });

  runnable('operates a toggle from the keyboard alone', async () => {
    const motion = page!.locator('.panel.pause .toggle:has([data-i18n="reducedMotion"])');
    await motion.focus();
    const before = await motion.getAttribute('aria-pressed');
    await page!.keyboard.press('Space');
    const after = await motion.getAttribute('aria-pressed');
    expect(after).not.toBe(before);
    await page!.keyboard.press('Space');
    expect(await motion.getAttribute('aria-pressed')).toBe(before);
  });

  runnable('obeys the flash law in the living DOM: three beats a second, halved for reduced motion', async () => {
    const veil = page!.locator('#ui .flash');
    let lifts = 0;
    for (let beat = 0; beat < 10; beat++) {
      await page!.evaluate((amount) => (window as unknown as GameWindow & { __game: { ui: { flash(a: number): void } } }).__game.ui.flash(amount), 0.35);
      await page!.waitForTimeout(60);
      const opacity = Number(await veil.evaluate((e) => (e as HTMLElement).style.opacity || '0'));
      if (opacity > 0.02) lifts++;
    }
    expect(lifts, 'at most three of ten rapid beats lift the veil').toBeLessThanOrEqual(3);

    await page!.locator('.panel.pause .toggle:has([data-i18n="reducedMotion"])').click();
    await page!.waitForTimeout(1100);
    await page!.evaluate((amount) => (window as unknown as GameWindow & { __game: { ui: { flash(a: number): void } } }).__game.ui.flash(amount), 1);
    const calm = Number(await veil.evaluate((e) => (e as HTMLElement).style.opacity || '0'));
    await page!.locator('.panel.pause .toggle:has([data-i18n="reducedMotion"])').click();
    await page!.waitForTimeout(1100);
    await page!.evaluate((amount) => (window as unknown as GameWindow & { __game: { ui: { flash(a: number): void } } }).__game.ui.flash(amount), 1);
    const full = Number(await veil.evaluate((e) => (e as HTMLElement).style.opacity || '0'));
    expect(calm).toBeCloseTo(full / 2, 5);
  });

  runnable('zooms the whole interface from its own settings, and the panel still fits the screen', async () => {
    await openFromPause('controls', '.panel.controls');
    const before = await page!.locator('.panel.controls h2').evaluate((e) => e.getBoundingClientRect().height);
    await page!.locator('.panel.controls [data-value="1.5"]').click();
    await page!.waitForTimeout(60);
    const after = await page!.locator('.panel.controls h2').evaluate((e) => e.getBoundingClientRect().height);
    expect(after).toBeGreaterThan(before * 1.4);
    const fits = await page!.evaluate(() => {
      const r = document.querySelector('.panel.controls')!.getBoundingClientRect();
      return r.left >= -0.5 && r.top >= -0.5 && r.right <= window.innerWidth + 0.5 && r.bottom <= window.innerHeight + 0.5;
    });
    expect(fits, 'the zoomed panel stays on screen').toBe(true);
    const scale = await page!.evaluate(() => document.documentElement.style.getPropertyValue('--ui-scale'));
    expect(scale).toBe('1.5');
    await page!.locator('.panel.controls [data-value="1"]').click();
  });

  runnable('draws every character of every language through the shipped font (R-LO-07)', async () => {
    const missing = await page!.evaluate(
      (tables) => {
        const problems: string[] = [];
        const faces = ['400 16px Fredoka', '700 16px Fredoka'];
        for (const [locale, strings] of tables) {
          const chars = [...new Set(Object.values(strings).join(''))].filter((c) => c.trim() !== '');
          for (const ch of chars) {
            if (!faces.every((face) => document.fonts.check(face, ch))) problems.push(`${locale}: ${ch} U+${ch.codePointAt(0)!.toString(16)}`);
          }
        }
        return problems;
      },
      [...Object.entries(TABLES), ['pseudo', pseudoTable()]] as Array<[string, Record<string, string>]>,
    );
    expect(missing, missing.join('\n')).toEqual([]);
  });
});

interface ScaleCase {
  name: string;
  width: number;
  height: number;
  scale: string;
  language: string;
}

const MATRIX: readonly ScaleCase[] = [
  { name: 'small phone at 125% in German', width: 568, height: 320, scale: '1.25', language: 'de' },
  { name: 'small phone at 150% in German', width: 568, height: 320, scale: '1.5', language: 'de' },
  { name: 'phone at 150% in German', width: 640, height: 360, scale: '1.5', language: 'de' },
  { name: 'desktop at 150% in German', width: 1280, height: 720, scale: '1.5', language: 'de' },
  { name: 'small phone in pseudo at 100%', width: 568, height: 320, scale: '1', language: 'pseudo' },
  { name: 'desktop in pseudo at 100%', width: 1280, height: 720, scale: '1', language: 'pseudo' },
];

describe.each(MATRIX)('the interface at $name', ({ name, width, height, scale, language }) => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const failures: string[] = [];

  beforeAll(async () => {
    if (!browser) return;
    context = await browser.newContext({ viewport: { width, height } });
    page = await context.newPage();
    page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) failures.push(`console: ${m.text()}`);
    });
    await page.goto(origin);
    await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
    await page.evaluate(() => (window as unknown as GameWindow).__game.debug.holdClock(true));
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');
    await page.locator('.panel.pause').waitFor({ state: 'visible' });
    await page.locator('#ui .lang select').selectOption(language);
    if (scale !== '1') {
      await page.locator('.panel.pause [data-opens="controls"]').click();
      await page.locator(`.panel.controls [data-value="${scale}"]`).click();
      await page.waitForTimeout(60);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(80);
    }
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

  const openFromPause = async (screen: string, root: string): Promise<void> => {
    await page!.locator(`.panel.pause [data-opens="${screen}"]`).click();
    await page!.locator(root).waitFor({ state: 'visible' });
  };

  const back = async (): Promise<void> => {
    await page!.keyboard.press('Escape');
    await page!.waitForTimeout(80);
  };

  runnable('holds every surface inside the fit law', async () => {
    const found: string[] = [];
    // A zoomed or pseudo-stretched panel may scroll inside its own capped box
    // — the trade every enlarged interface makes — but it may never leave the
    // screen, clip a word, or shrink a target below the floor. The strict
    // no-scroll fit law for real languages is held by the layout suite.
    const beyondWorstCase = scale !== '1' || language === 'pseudo';
    const record = async (label: string, root: string, fits: boolean, fullScreen = false): Promise<void> => {
      for (const problem of await page!.evaluate(measureSurface, { label, root, fits: fits && !beyondWorstCase, fullScreen })) found.push(problem);
    };
    await record('pause', '.panel.pause', true);
    await openFromPause('controls', '.panel.controls');
    await record('controls', '.panel.controls', height >= 360);
    await page!.locator('.panel.controls [data-opens="keys"]').click();
    await page!.locator('.panel.keys').waitFor({ state: 'visible' });
    await record('keys', '.panel.keys', false);
    await back();
    await back();
    await openFromPause('exchange', '.panel.exchange');
    await record('ghost exchange', '.panel.exchange', false);
    await back();
    await openFromPause('locker', '.screen.open');
    await record('locker', '.screen.open', false, true);
    await back();
    await openFromPause('map', '.screen.open');
    await record('level map', '.screen.open', false, true);
    await back();
    expect(found, `${name}: ${found.join(' | ')}`).toEqual([]);
    expect(failures, failures.join(' | ')).toEqual([]);
  });
});
