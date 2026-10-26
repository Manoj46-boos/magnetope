import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * What a player sees when the device lets the game down: the GPU context is taken away,
 * a frame throws, or WebGL is not there at all. Each case runs in real Chrome through the
 * real loop and must end in a game that is either still playable or says so and offers a reload.
 */

interface GameWindow {
  __game: {
    startLevel(id: string): void;
    debug: {
      phase: string;
      sim: { run: { timeMs: number } };
      save: { data: { stars: Record<string, number>; scrap: number } };
      holdClock(held: boolean): void;
      advance(seconds: number): void;
      autoplay(recording: unknown): void;
      renderer: { frame: (...args: unknown[]) => void; renderer: { getContext(): WebGL2RenderingContext } };
    };
  };
}

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let origin = '';
const contexts: BrowserContext[] = [];

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  origin = started.url;
}, 60000);

afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

afterAll(async () => {
  await Promise.all(contexts.map((c) => c.close()));
  await browser?.close();
  await server?.close();
});

interface Session {
  page: Page;
  errors: string[];
}

async function openPage(init?: string): Promise<Session> {
  const context = await browser!.newContext({ viewport: { width: 480, height: 270 } });
  contexts.push(context);
  await context.addInitScript('window.__name = (f) => f;');
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) errors.push(m.text());
  });
  await page.goto(origin);
  return { page, errors };
}

async function openGame(init?: string): Promise<Session> {
  const session = await openPage(init);
  await session.page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
  await session.page.waitForTimeout(600);
  return session;
}

const phase = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).__game.debug.phase);

const runnable = (name: string, body: () => Promise<void>, timeout = 60000) =>
  it(
    name,
    async (ctx) => {
      if (!browser) ctx.skip();
      await body();
    },
    timeout,
  );

describe('when the graphics context is lost', () => {
  runnable('pauses without errors, and draws and plays again once the browser restores it', async () => {
    const { page, errors } = await openGame();
    await page.evaluate(() => {
      const gl = (window as unknown as GameWindow).__game.debug.renderer.renderer.getContext();
      const lose = gl.getExtension('WEBGL_lose_context')!;
      (window as unknown as { __lose: WEBGL_lose_context }).__lose = lose;
      lose.loseContext();
    });
    await page.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'paused');

    await page.evaluate(() => {
      (window as unknown as { __lose: WEBGL_lose_context }).__lose.restoreContext();
    });
    await page.waitForTimeout(500);
    expect(await page.locator('.fatal').count()).toBe(0);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'play');

    const drawn = await page.evaluate(
      () =>
        new Promise<{ distinct: number }>((resolve) => {
          requestAnimationFrame(() => {
            const source = document.getElementById('view') as HTMLCanvasElement;
            const probe = document.createElement('canvas');
            probe.width = 32;
            probe.height = 18;
            const ctx = probe.getContext('2d')!;
            ctx.drawImage(source, 0, 0, 32, 18);
            const data = ctx.getImageData(0, 0, 32, 18).data;
            const colours = new Set<number>();
            for (let i = 0; i < data.length; i += 4) colours.add((data[i]! >> 4) * 256 + (data[i + 1]! >> 4) * 16 + (data[i + 2]! >> 4));
            resolve({ distinct: colours.size });
          });
        }),
    );
    expect(drawn.distinct).toBeGreaterThan(6);
    expect(errors).toEqual([]);
  });

  runnable('offers a reload when the context never comes back', async () => {
    const { page } = await openGame();
    await page.evaluate(() => (window as unknown as GameWindow).__game.debug.renderer.renderer.getContext().getExtension('WEBGL_lose_context')!.loseContext());
    await page.locator('.fatal button').waitFor({ state: 'visible', timeout: 12000 });
    expect(await page.locator('.fatal h1').innerText()).toMatch(/something went wrong/i);
  });
});

describe('when a frame throws', () => {
  runnable('carries on through a few bad frames and logs the fault once', async () => {
    const { page, errors } = await openGame();
    await page.evaluate(() => {
      const renderer = (window as unknown as GameWindow).__game.debug.renderer;
      const original = renderer.frame.bind(renderer);
      let left = 3;
      renderer.frame = (...args) => {
        if (left-- > 0) throw new Error('shader exploded');
        original(...args);
      };
    });
    await page.waitForTimeout(800);
    expect(await phase(page)).toBe('play');
    expect(await page.locator('.fatal').count()).toBe(0);
    expect(errors.filter((e) => e.includes('shader exploded'))).toHaveLength(1);
  });

  runnable('rebuilds the level once, then stops with a reload offer instead of an endless error loop', async () => {
    const { page, errors } = await openGame();
    await page.evaluate(() => {
      (window as unknown as GameWindow).__game.debug.renderer.frame = () => {
        throw new Error('always broken');
      };
    });
    await page.locator('.fatal button').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);
    expect(errors.filter((e) => e.includes('always broken'))).toHaveLength(1);
  });
});

describe('when WebGL is not available', () => {
  runnable('shows the reload screen instead of a loading bar that never finishes', async () => {
    const init = `
      const real = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
        return /webgl/.test(kind) ? null : real.call(this, kind, ...rest);
      };`;
    const { page } = await openPage(init);
    await page.locator('.fatal button').waitFor({ state: 'visible', timeout: 20000 });
    expect(await page.locator('.loading').count()).toBe(0);
  });
});

describe('when the measure channel is blocked (R-AN-08)', () => {
  runnable('plays and saves exactly the same with an SDK that rejects and throws on every call', async () => {
    const init = `
      window.PokiSDK = {
        init: async () => { throw new Error('blocked'); },
        gameLoadingFinished() {},
        gameplayStart() {},
        gameplayStop() {},
        commercialBreak: async () => {},
        rewardedBreak: async () => true,
        getLanguage: () => 'en',
        measure() { throw new Error('blocked'); },
      };`;
    const { page, errors } = await openGame(init);
    const route = JSON.parse(readFileSync(resolve(__dirname, '../src/levels/routes/scrapyard-00.json'), 'utf8'));
    const outcome = await page.evaluate(
      ({ route }) => {
        const game = (window as unknown as GameWindow).__game;
        game.startLevel('scrapyard-00');
        game.debug.holdClock(true);
        game.debug.autoplay(route);
        let ticks = 0;
        while (game.debug.phase !== 'cleared' && ticks < 3000) {
          game.debug.advance(1 / 60);
          ticks++;
        }
        return { phase: game.debug.phase, stars: game.debug.save.data.stars['scrapyard-00'] ?? 0, scrap: game.debug.save.data.scrap };
      },
      { route },
    );
    // analytics absence changes nothing: the clear, the stars and the Scrap all land anyway
    expect(outcome.phase).toBe('cleared');
    expect(outcome.stars).toBeGreaterThanOrEqual(1);
    expect(outcome.scrap).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});
