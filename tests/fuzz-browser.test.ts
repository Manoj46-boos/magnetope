import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';
import { violations, type TraceEntry } from './helpers/sdk-trace';

/**
 * PRD 14.3 event-trace protocol, through the real game: thousands of random keys, clicks, blurs,
 * falls and ad outcomes on every screen the game has, with the platform SDK replaced by a recorder.
 * Whatever the sequence, the Poki rules must hold (start on input, never two starts or two stops
 * in a row, nothing while an ad plays) and nothing may throw.
 */

const KEYS = ['Space', 'Space', 'Escape', 'Escape', 'KeyP', 'KeyR', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Enter', 'Tab', 'KeyJ'];
const PICK_BUTTON = `
  const visible = [...document.querySelectorAll('button')].filter((b) => {
    const r = b.getBoundingClientRect();
    const style = getComputedStyle(b);
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.pointerEvents !== 'none' && !b.disabled;
  });
  return visible;
`;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
const problems: string[] = [];
let currentStep = 0;

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  context = await browser.newContext({ viewport: { width: 640, height: 360 } });
  await context.addInitScript('window.__name = (f) => f;');
  page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('crash', () => problems.push(`the page crashed at step ${currentStep}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
  });
  await page.goto(started.url);
  await page.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    const game = w.__game;
    game.debug.holdClock(true);
    const sdk = game.debug.bus.sdk;
    w.__trace = [] as string[];
    w.__ads = [] as Array<(granted: boolean) => void>;
    const log = (entry: string) => w.__trace.push(entry);
    sdk.gameplayStart = () => log('start');
    sdk.gameplayStop = () => log('stop');
    const ad = (granted: boolean | null) => () => {
      log('ad+');
      return new Promise((resolve) => {
        w.__ads.push((outcome: boolean) => {
          log('ad-');
          resolve(granted === null ? outcome : granted);
        });
      });
    };
    sdk.commercialBreak = ad(true);
    sdk.rewardedBreak = ad(null);
  });
}, 90000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await server?.close();
});

const trace = (): Promise<TraceEntry[]> => page!.evaluate(() => [...(window as unknown as { __trace: TraceEntry[] }).__trace]);

async function fuzz(seed: number, steps: number): Promise<void> {
  const random = seeded(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const mark = () => page!.evaluate(() => (window as unknown as { __trace: string[] }).__trace.push('input'));

  for (let step = 0; step < steps; step++) {
    currentStep = step;
    const roll = random();
    if (roll < 0.34) {
      await mark();
      await page!.keyboard.press(pick(KEYS));
    } else if (roll < 0.42) {
      const key = pick(['Space', 'ArrowUp', 'KeyD']);
      await mark();
      await page!.keyboard.down(key);
      await page!.evaluate((n) => {
        const game = (window as unknown as { __game: any }).__game;
        for (let i = 0; i < n; i++) game.debug.advance(1 / 60);
      }, 2 + Math.floor(random() * 10));
      await page!.keyboard.up(key);
    } else if (roll < 0.58) {
      await mark();
      const index = Math.floor(random() * 1000);
      await page!.evaluate(
        ({ index, script }) => {
          const buttons = new Function(script)() as HTMLButtonElement[];
          if (buttons.length) buttons[index % buttons.length]!.click();
        },
        { index, script: PICK_BUTTON },
      );
    } else if (roll < 0.66) {
      await mark();
      await page!.mouse.click(random() * 640, random() * 360);
    } else if (roll < 0.86) {
      await page!.evaluate((n) => {
        const game = (window as unknown as { __game: any }).__game;
        for (let i = 0; i < n; i++) game.debug.advance(1 / 60);
      }, 1 + Math.floor(random() * 6));
    } else if (roll < 0.9) {
      await page!.evaluate(() => {
        const game = (window as unknown as { __game: any }).__game;
        const sim = game.debug.sim;
        if (!sim || game.debug.phase !== 'play') return;
        sim.physics.magnoBody.setTranslation({ x: sim.magno.view.position.x, y: sim.magno.view.position.y + 14, z: 0 }, true);
        sim.physics.magnoBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      });
    } else if (roll < 0.93) {
      await page!.evaluate(() => window.dispatchEvent(new Event('blur')));
    } else {
      await page!.evaluate((granted) => {
        const ads = (window as unknown as { __ads: Array<(granted: boolean) => void> }).__ads;
        ads.shift()?.(granted);
      }, random() < 0.7);
    }
    // An ad that nobody finishes would hold the game still forever, which is the platform's job to prevent.
    if (step % 7 === 0) {
      await page!.evaluate(() => (window as unknown as { __ads: Array<(g: boolean) => void> }).__ads.shift()?.(true));
    }
  }
}

const runnable = (name: string, body: () => Promise<void>, timeout: number) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

describe('random play through the real game', () => {
  for (const seed of [20260711, 7, 424242]) {
    runnable(
      `keeps every SDK rule and throws nothing (seed ${seed})`,
      async () => {
        await fuzz(seed, 700);
        await page!.evaluate(() => {
          const ads = (window as unknown as { __ads: Array<(g: boolean) => void> }).__ads;
          while (ads.length) ads.shift()!(true);
        });
        await page!.evaluate(() => (window as unknown as { __game: any }).__game.debug.advance(1 / 60));
        const entries = await trace();
        expect(entries.filter((e) => e !== 'input').length, 'the fuzz must have reached the SDK').toBeGreaterThan(10);
        expect(violations(entries)).toEqual([]);
        expect(problems).toEqual([]);
      },
      600000,
    );
  }

  runnable(
    'is still a working game afterwards: Escape pauses and resumes it',
    async () => {
      await page!.evaluate(() => {
        const game = (window as unknown as { __game: any }).__game;
        game.startLevel('scrapyard-01');
      });
      await page!.keyboard.press('Space');
      await page!.keyboard.press('Escape');
      await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'paused');
      await page!.keyboard.press('Escape');
      await page!.waitForFunction(() => (window as unknown as { __ads: unknown[] }).__ads.length > 0);
      await page!.evaluate(() => (window as unknown as { __ads: Array<(g: boolean) => void> }).__ads.shift()!(true));
      await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'play');
      expect(problems).toEqual([]);
    },
    60000,
  );
});
