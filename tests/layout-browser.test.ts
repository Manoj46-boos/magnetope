import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOCALES, type LocaleId } from '@/locale';
import { TABLES } from '@/locale/strings';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * Every screen in every language at the sizes people actually play on (PRD
 * 12.3: layouts hold up under the longest translations, German and Portuguese).
 * Measured in a real browser: text may not spill out of its box, a panel may not
 * leave the screen, a thumb needs something to hit, and the way forward is
 * always on screen without scrolling.
 */

const VIEWPORTS = [
  { name: 'phone landscape', width: 640, height: 360 },
  { name: 'small phone landscape', width: 568, height: 320 },
  { name: 'phone portrait', width: 360, height: 640 },
  { name: 'small phone portrait', width: 320, height: 568 },
  { name: 'desktop', width: 1280, height: 720 },
] as const;

const LIMITS = { target: 32, font: 11 };

interface Check {
  label: string;
  /** Selector of the surface being measured, once it is open. */
  root: string;
  /** The surface must show all of its content at once, with no scrolling. */
  fits: boolean;
  /** A full-screen layer that scrolls by design, so it may fill the viewport. */
  fullScreen?: boolean;
}

interface GameWindow {
  __game: {
    ui: Record<string, unknown>;
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

/** Runs in the page: one sentence for every rule the surface breaks. */
function measure({ check, limits }: { check: Check; limits: typeof LIMITS }): string[] {
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
  const nameOf = (e: HTMLElement): string => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? `.${e.className.split(' ')[0]}` : ''}`;

  if (!check.fullScreen && (rect.left < -0.5 || rect.top < -0.5 || rect.right > vw + 0.5 || rect.bottom > vh + 0.5)) {
    problems.push(`${check.label}: panel leaves the screen (${Math.round(rect.left)},${Math.round(rect.top)} to ${Math.round(rect.right)},${Math.round(rect.bottom)} of ${vw}x${vh})`);
  }
  if (root.scrollWidth > root.clientWidth + 1) problems.push(`${check.label}: scrolls sideways (${root.scrollWidth} in ${root.clientWidth})`);
  if (check.fits && root.scrollHeight > root.clientHeight + 1) problems.push(`${check.label}: needs scrolling (${root.scrollHeight} in ${root.clientHeight})`);

  for (const node of root.querySelectorAll<HTMLElement>('*')) {
    if (!shown(node)) continue;
    const style = getComputedStyle(node);
    const hasText = [...node.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
    if (hasText) {
      if (node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1 && !/auto|scroll/.test(style.overflowX)) {
        problems.push(`${check.label}: "${(node.textContent ?? '').trim().slice(0, 30)}" spills out of ${nameOf(node)} (${node.scrollWidth} in ${node.clientWidth})`);
      }
      if (parseFloat(style.fontSize) < limits.font) problems.push(`${check.label}: ${nameOf(node)} text is ${style.fontSize}`);
    }
    if (node.matches('button, select, input, [role="radio"]') && !node.matches('.tiny, [aria-hidden="true"]')) {
      const r = node.getBoundingClientRect();
      if (Math.min(r.width, r.height) < limits.target) problems.push(`${check.label}: ${nameOf(node)} is ${Math.round(r.width)}x${Math.round(r.height)}, too small to hit`);
    }
  }

  for (const primary of root.querySelectorAll<HTMLElement>('.btn.primary')) {
    const r = primary.getBoundingClientRect();
    const top = check.fullScreen ? 0 : Math.max(0, rect.top);
    const bottom = check.fullScreen ? vh : Math.min(vh, rect.bottom);
    if (r.top < top - 0.5 || r.bottom > bottom + 0.5 || r.left < 0 || r.right > vw) {
      problems.push(`${check.label}: the primary button is out of view (${Math.round(r.top)} to ${Math.round(r.bottom)} of ${Math.round(top)} to ${Math.round(bottom)})`);
    }
  }
  return problems;
}

/** Runs in the page: the heads-up display's parts must stay on screen and out of each other's way. */
function measureHud(): string[] {
  const problems: string[] = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const parts = ['.hud .rail.show', '.hud .timer.show', '.hud .stars-track.show', '.hud .pause-btn', '.touch.on .flip-btn'];
  const boxes = parts.map((selector) => ({ selector, element: document.querySelector<HTMLElement>(selector) }));
  for (const { selector, element } of boxes) {
    if (!element) {
      problems.push(`hud: ${selector} is not on screen`);
      continue;
    }
    const r = element.getBoundingClientRect();
    if (r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5) problems.push(`hud: ${selector} leaves the screen`);
    if (selector.includes('timer') && element.scrollWidth > element.clientWidth + 1) problems.push(`hud: the timer text spills (${element.scrollWidth} in ${element.clientWidth})`);
  }
  const found = boxes.filter((b) => b.element);
  for (let i = 0; i < found.length; i++) {
    for (let j = i + 1; j < found.length; j++) {
      const a = found[i]!.element!.getBoundingClientRect();
      const b = found[j]!.element!.getBoundingClientRect();
      if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) {
        problems.push(`hud: ${found[i]!.selector} overlaps ${found[j]!.selector}`);
      }
    }
  }
  return problems;
}

const HUD_STATE = { altitudeFrac: 0.5, showRail: true, timeMs: 93450, parSeconds: 90, bestStars: 3, showStars: true };
const CLIMB = { stars: 210, maxStars: 210, levelsCleared: 70, totalLevels: 70, bestFall: { heightMeters: 123.4, grade: 'SSS' } };

const TYPICAL_CLEAR = { levelName: 'Level', stars: 3, newBest: true, timeMs: 83450, parSeconds: 60, scrap: 50, hasNext: true, canDouble: true, doubled: false, finale: false, friend: null };
const BUSY_CLEAR = { ...TYPICAL_CLEAR, friend: { name: 'WWWWWWWWWWWW', beaten: true, marginMs: 1230 } };
const FALL = { heightMeters: 123.4, bounces: 12, junk: 34, grade: 'SSS', offerSecondWind: true, shareable: true };

describe.each(VIEWPORTS)('screens at $name ($width x $height)', ({ name, width, height }) => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  const failures: string[] = [];

  beforeAll(async () => {
    if (!browser) return;
    context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(`
      window.__name = (f) => f;
      let layoutReads = 0;
      for (const prop of ['offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight']) {
        const desc = Object.getOwnPropertyDescriptor(Element.prototype, prop);
        if (!desc || !desc.get) continue;
        Object.defineProperty(Element.prototype, prop, { get() { layoutReads++; return desc.get.call(this); } });
      }
      const rawRect = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function (...args) { layoutReads++; return rawRect.apply(this, args); };
      const rawStyles = window.getComputedStyle.bind(window);
      window.getComputedStyle = function (...args) { layoutReads++; return rawStyles(...args); };
      Object.defineProperty(window, '__layoutReads', { get: () => layoutReads });
    `);
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

  const runnable = (title: string, body: () => Promise<void>, timeout = 180000) =>
    it(
      title,
      async (ctx) => {
        if (!page) ctx.skip();
        await body();
      },
      timeout,
    );

  /** Calls a method on the game's UI by dotted path, e.g. `banner.show`. */
  const callUi = (path: string, ...args: unknown[]): Promise<void> =>
    page!.evaluate(
      ([target, params]) => {
        const steps = (target as string).split('.');
        const method = steps.pop()!;
        let owner = (window as unknown as GameWindow).__game.ui;
        for (const step of steps) owner = owner[step] as Record<string, unknown>;
        (owner[method] as (...a: unknown[]) => void).apply(owner, params as unknown[]);
      },
      [path, args] as const,
    );

  const setLanguage = (locale: string): Promise<void> =>
    page!.evaluate((value) => {
      const select = document.querySelector<HTMLSelectElement>('#ui .lang select')!;
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, locale);

  const openFromPause = async (screen: string, root: string): Promise<void> => {
    await page!.locator(`.panel.pause [data-opens="${screen}"]`).click();
    await page!.locator(root).waitFor({ state: 'visible' });
  };

  const back = async (): Promise<void> => {
    await page!.keyboard.press('Escape');
    await page!.waitForTimeout(80);
  };

  runnable(`holds up in all ${LOCALES.length} languages`, async () => {
    const found: string[] = [];
    for (const locale of LOCALES) {
      const record = async (check: Check): Promise<void> => {
        for (const issue of await page!.evaluate(measure, { check, limits: LIMITS })) found.push(`[${name} | ${locale}] ${issue}`);
      };

      await setLanguage(locale);
      await record({ label: 'pause', root: '.panel.pause', fits: true });

      await openFromPause('controls', '.panel.controls');
      await record({ label: 'controls', root: '.panel.controls', fits: height >= 360 });
      await page!.locator('.panel.controls [data-opens="keys"]').click();
      await page!.locator('.panel.keys').waitFor({ state: 'visible' });
      await record({ label: 'keys', root: '.panel.keys', fits: false });
      await back();
      await back();

      await openFromPause('exchange', '.panel.exchange');
      await record({ label: 'ghost exchange', root: '.panel.exchange', fits: false });
      await back();

      await openFromPause('locker', '.screen.open');
      await record({ label: 'locker', root: '.screen.open', fits: false, fullScreen: true });
      await back();

      await openFromPause('map', '.screen.open');
      await record({ label: 'level map', root: '.screen.open', fits: false, fullScreen: true });
      await back();

      await callUi('closeScreens');
      await callUi('showClear', TYPICAL_CLEAR);
      await record({ label: 'clear card', root: '.clear-card', fits: true });
      await callUi('hideClear');
      await callUi('showClear', BUSY_CLEAR);
      await record({ label: 'clear card with a friend ghost', root: '.clear-card', fits: false });
      await callUi('hideClear');

      await callUi('showFall', FALL);
      await record({ label: 'fall card', root: '.fall-card', fits: true });
      await callUi('hideFall');

      await callUi('showFatal', undefined);
      await record({ label: 'reload screen', root: '.fatal', fits: true, fullScreen: true });
      await page!.evaluate(() => document.querySelector('.fatal')?.remove());

      await callUi('showHud', true);
      await callUi('setTouchControls', true);
      await callUi('updateHud', HUD_STATE);
      for (const issue of await page!.evaluate(measureHud)) found.push(`[${name} | ${locale}] ${issue}`);
      await callUi('showHud', false);
      await callUi('setTouchControls', false);
      await callUi('updateHud', { ...HUD_STATE, showRail: false, timeMs: null, showStars: false });

      const tables = TABLES[locale as LocaleId];
      await callUi('banner.show', 'PLAYGROUND OF GIANTS', tables.metropolisTagline.length > tables.playgroundTagline.length ? tables.metropolisTagline : tables.playgroundTagline);
      await record({ label: 'biome banner', root: '.biome-banner.show', fits: true });
      await callUi('banner.hide');

      await page!.evaluate((summary) => {
        const ending = (window as unknown as GameWindow).__game.ui.ending as { show(s: unknown, onSkip: () => void): void };
        ending.show(summary, () => undefined);
      }, CLIMB);
      await callUi('ending.render', { letterbox: 1, credits: 1 });
      await record({ label: 'ending credits', root: '.ending .credits', fits: true });
      await record({ label: 'ending skip', root: '.ending .btn.skip', fits: true });
      await callUi('ending.hide');

      await callUi('openPause');
    }
    expect(found).toEqual([]);
  });

  // R-PE-04: a state change may force the synchronous layout only a few times
  // — the interface measures what it needs in one batch, then writes. Every
  // surface measures zero today, so the ceiling allows three reads for a
  // future focus scroll, not a write-read-write thrash. The counter is the
  // browser's own layout-reading APIs, patched in the page.
  runnable('forces only a handful of layout reads per state change', async () => {
    const count = async (label: string, action: () => Promise<void>): Promise<void> => {
      const before = await page!.evaluate(() => (window as unknown as { __layoutReads: number }).__layoutReads);
      await action();
      const reads = (await page!.evaluate(() => (window as unknown as { __layoutReads: number }).__layoutReads)) - before;
      expect(reads, `${label} forced ${reads} layout reads`).toBeLessThanOrEqual(3);
    };

    await count('opening the map from pause', () => openFromPause('map', '.screen.open'));
    await back();
    await count('opening the controls from pause', () => openFromPause('controls', '.panel.controls'));
    await back();
    await count('opening the locker from pause', () => openFromPause('locker', '.screen.open'));
    await back();
    await count('showing the clear card', async () => {
      await callUi('showClear', TYPICAL_CLEAR);
      await page!.locator('.clear-card').waitFor({ state: 'visible' });
    });
  });

  runnable('raised no console errors or page errors', async () => {
    expect(failures).toEqual([]);
  });
});
