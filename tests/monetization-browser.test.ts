import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The ad moments that carry the game's revenue (PRD 13.1), driven the way a player meets them:
 * fall far, read the card, tap a button. The platform SDK is replaced by a stand-in whose ads stay
 * open until the test ends them, so what happens while a video plays can be looked at.
 *
 * Level scrapyard-03 has wooden planks over open air: a MAGNO dropped onto one lands hard and goes
 * limp, where the steel floor would simply catch him.
 */

interface Probe {
  phase: string;
  busState: string;
  fallCardOpen: boolean;
  buttons: string[];
  fallCount: number;
  beyondSafetyLine: number;
  checkpoint: number;
  position: { x: number; y: number };
  calls: string[];
}

const LEVEL = 'scrapyard-03';
const DROP_X = 2.6;
const DROP_FROM = 30;

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let origin = '';
let context: BrowserContext | null = null;
let page: Page | null = null;
const problems: string[] = [];

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  origin = started.url;
  context = await browser.newContext({ viewport: { width: 640, height: 360 } });
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
});

/** A fresh session: new page, a clock the test drives, and an SDK whose ads wait for `endAd`. */
async function begin(): Promise<void> {
  await page!.goto(origin);
  await page!.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 30000 });
  await page!.waitForTimeout(500);
  await page!.evaluate(
    ({ level }) => {
      const w = window as unknown as Record<string, any>;
      const game = w.__game;
      game.startLevel(level);
      game.debug.holdClock(true);
      game.debug.save.update((s: any) => {
        s.seen = [...new Set([...s.seen, 'coach'])];
      });
      const sdk = game.debug.bus.sdk;
      w.__calls = [];
      w.__ad = null;
      for (const name of ['gameplayStart', 'gameplayStop']) {
        const original = sdk[name].bind(sdk);
        sdk[name] = (...args: unknown[]) => {
          w.__calls.push(name);
          return original(...args);
        };
      }
      sdk.commercialBreak = () => {
        w.__calls.push('commercialBreak');
        return Promise.resolve();
      };
      sdk.rewardedBreak = () => {
        w.__calls.push('rewardedBreak');
        return new Promise<boolean>((resolve) => {
          w.__ad = resolve;
        });
      };
    },
    { level: LEVEL },
  );
  await page!.keyboard.press('Space');
  await advance(3);
}

async function advance(ticks: number): Promise<void> {
  await page!.evaluate((n) => {
    const game = (window as unknown as { __game: any }).__game;
    for (let i = 0; i < n; i++) game.debug.advance(1 / 60);
  }, ticks);
}

/**
 * Puts MAGNO high over the yard and steps the simulation (no drawing, which is slow in a software
 * renderer and the card closes itself after a few seconds) until the fall has landed and its card is up.
 */
async function fallFar(from = DROP_FROM): Promise<void> {
  await page!.evaluate(
    ({ x, y }) => {
      const game = (window as unknown as { __game: any }).__game;
      const sim = game.debug.sim;
      const body = sim.physics.magnoBody;
      const before = sim.run.fallCount;
      body.setTranslation({ x, y, z: 0 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      const idle = { tiltX: 0, tiltY: 0, flipHeld: false, flipDown: false, flipUp: false };
      for (let i = 0; i < 1500 && sim.run.fallCount === before; i++) sim.step(idle);
      game.debug.advance(1 / 60);
    },
    { x: DROP_X, y: from },
  );
}

async function probe(): Promise<Probe> {
  return page!.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    const game = w.__game;
    const sim = game.debug.sim;
    const card = document.querySelector('.fall-card');
    return {
      phase: game.debug.phase,
      busState: game.debug.bus.state,
      fallCardOpen: Boolean(card?.classList.contains('open')),
      buttons: card ? [...card.querySelectorAll('.actions button')].map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? '') : [],
      fallCount: sim.run.fallCount,
      beyondSafetyLine: sim.run.beyondSafetyLine,
      checkpoint: sim.run.checkpoint,
      position: { ...sim.magno.view.position },
      calls: [...w.__calls],
    };
  });
}

const endAd = (granted: boolean): Promise<void> =>
  page!.evaluate((value) => {
    const w = window as unknown as { __ad: ((granted: boolean) => void) | null };
    w.__ad?.(value);
    w.__ad = null;
  }, granted);

const checkpointOf = (): Promise<{ x: number; y: number }> =>
  page!.evaluate(() => {
    const sim = (window as unknown as { __game: any }).__game.debug.sim;
    return { ...sim.level.checkpoints[0] };
  });

const runnable = (name: string, body: () => Promise<void>, timeout = 90000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

describe('Second Wind', () => {
  beforeEach(async () => {
    if (page) await begin();
  }, 60000);

  runnable('is offered after a long fall, with Retry still the primary button', async () => {
    await fallFar();
    const state = await probe();
    expect(state.fallCardOpen).toBe(true);
    expect(state.buttons.slice(0, 2)).toEqual(['Retry', 'Second Wind']);
    expect(await page!.locator('.fall-card .actions .btn').first().getAttribute('class')).toContain('primary');
    expect(await page!.locator('.fall-card .actions .btn').nth(1).innerText()).toMatch(/second wind/i);
  });

  runnable('records one long tumble as one fall everywhere it is counted', async () => {
    await fallFar();
    await advance(60);
    const counted = await page!.evaluate(() => {
      const game = (window as unknown as { __game: any }).__game;
      const queued: Array<{ category: string }> = game.debug.telemetry.queue;
      return {
        run: game.debug.sim.run.fallCount,
        telemetry: queued.filter((r) => r.category === 'fall').length,
        highlights: game.highlights.list.length,
      };
    });
    expect(counted).toEqual({ run: 1, telemetry: 1, highlights: 1 });
  });

  runnable('is not offered for a short tumble', async () => {
    await fallFar(21.5);
    const state = await probe();
    expect(state.fallCount).toBeGreaterThan(0);
    expect(state.buttons.join(' ')).not.toMatch(/second wind/i);
  });

  runnable('holds the game quiet while the video plays, then puts MAGNO back on the checkpoint and refunds the fall', async () => {
    await page!.evaluate(() => {
      const sim = (window as unknown as { __game: any }).__game.debug.sim;
      const cp = sim.level.checkpoints[0];
      const body = sim.physics.magnoBody;
      body.setTranslation({ x: cp.x, y: cp.y + 0.4, z: 0 }, true);
    });
    await advance(20);
    expect((await probe()).checkpoint).toBe(0);

    await fallFar();
    const landed = await probe();
    expect(landed.fallCount).toBe(1);
    expect(landed.beyondSafetyLine).toBe(1);

    await page!.locator('.fall-card .actions .btn').nth(1).click();
    const during = await probe();
    expect(during.phase).toBe('busy');
    expect(during.busState).toBe('ad');
    expect(during.fallCardOpen).toBe(false);
    expect(during.calls.at(-1)).toBe('rewardedBreak');

    await advance(60);
    expect((await probe()).position.y, 'the world stands still during the ad').toBeCloseTo(during.position.y, 1);

    await endAd(true);
    await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'play');
    await advance(30);
    const cp = await checkpointOf();
    const after = await probe();
    expect(Math.hypot(after.position.x - cp.x, after.position.y - (cp.y + 0.3))).toBeLessThan(1);
    expect(after.fallCount).toBe(0);
    expect(after.beyondSafetyLine).toBe(0);
    expect(after.busState).toBe('idle');

    await page!.keyboard.press('Space');
    await advance(2);
    const calls = (await probe()).calls;
    expect(calls.filter((c) => c === 'gameplayStart').length, `trace ${calls.join(' > ')}`).toBe(2);
    expect(calls.slice(calls.indexOf('rewardedBreak') - 1)).toEqual(['gameplayStop', 'rewardedBreak', 'gameplayStart']);
    expect(problems).toEqual([]);
  });

  runnable('changes nothing when the video is not completed', async () => {
    await fallFar();
    const landed = await probe();
    await page!.locator('.fall-card .actions .btn').nth(1).click();
    await endAd(false);
    await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'play');
    const after = await probe();
    expect(after.fallCount).toBe(landed.fallCount);
    expect(after.beyondSafetyLine).toBe(landed.beyondSafetyLine);
    expect(Math.hypot(after.position.x - landed.position.x, after.position.y - landed.position.y)).toBeLessThan(1.5);
    expect(after.fallCardOpen).toBe(false);
  });
});

describe('the retry break', () => {
  beforeEach(async () => {
    if (page) await begin();
  }, 60000);

  const retry = async (): Promise<void> => {
    await page!.locator('.fall-card .actions .btn').first().click();
    await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'play');
  };

  runnable('lets two falls retry straight away, with no ad', async () => {
    await fallFar();
    await retry();
    await fallFar();
    await retry();
    expect((await probe()).calls).not.toContain('commercialBreak');
  });

  runnable('signals one natural stop on the retry after the third fall in a row, and resets the count', async () => {
    for (let i = 0; i < 3; i++) {
      await fallFar();
      if (i < 2) await retry();
    }
    expect((await probe()).calls).not.toContain('commercialBreak');
    await retry();
    expect((await probe()).calls.filter((c) => c === 'commercialBreak')).toHaveLength(1);

    await fallFar();
    await retry();
    expect((await probe()).calls.filter((c) => c === 'commercialBreak')).toHaveLength(1);
  });
});

describe('the clear card', () => {
  const routeOf = (id: string): unknown => JSON.parse(readFileSync(resolve(__dirname, `../src/levels/routes/${id}.json`), 'utf8'));

  /** Plays the stored route through the real game loop until the clear card is up. */
  const clearLevel = async (id: string): Promise<void> => {
    await page!.evaluate(
      ({ route }) => {
        const game = (window as unknown as { __game: any }).__game;
        game.debug.autoplay(route);
        for (let i = 0; i < 1200 && game.debug.phase !== 'cleared'; i++) game.debug.advance(5 / 60);
      },
      { route: routeOf(id) },
    );
    await page!.locator('.clear-card').waitFor({ state: 'visible' });
  };

  const scrap = (): Promise<number> => page!.evaluate(() => (window as unknown as { __game: any }).__game.debug.save.data.scrap);
  const cardScrap = async (): Promise<number> => Number((await page!.locator('.clear-card .fact').nth(2).locator('b').innerText()).trim());
  const doubleButton = () => page!.locator('.clear-card .btn', { hasText: /double/i });

  beforeEach(async () => {
    if (!page) return;
    await begin();
    await page.evaluate(() => (window as unknown as { __game: any }).__game.startLevel('scrapyard-01'));
    await clearLevel('scrapyard-01');
  }, 120000);

  runnable('pays the award once more for a watched video, and only once', async () => {
    const award = await cardScrap();
    const before = await scrap();
    expect(award).toBeGreaterThan(0);

    await doubleButton().click();
    expect((await probe()).busState).toBe('ad');
    expect(await scrap(), 'nothing is paid while the video plays').toBe(before);
    await endAd(true);
    await page!.waitForFunction((expected) => (window as unknown as { __game: any }).__game.debug.save.data.scrap === expected, before + award);

    expect(await cardScrap()).toBe(award * 2);
    expect(await doubleButton().count(), 'the offer is gone once taken').toBe(0);
    expect(await scrap()).toBe(before + award);
  }, 120000);

  runnable('pays nothing when the video is not completed, and offers it again', async () => {
    const before = await scrap();
    await doubleButton().click();
    await endAd(false);
    await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.bus.state === 'idle');
    expect(await scrap()).toBe(before);
    expect(await doubleButton().count()).toBe(1);
  }, 120000);

  runnable('signals one natural stop when the player moves on to the next level', async () => {
    await page!.evaluate(() => ((window as unknown as { __calls: string[] }).__calls.length = 0));
    await page!.locator('.clear-card .btn.primary').click();
    await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.sim.level.id === 'scrapyard-02');
    const state = await probe();
    expect(state.phase).toBe('play');
    expect(state.calls.filter((c) => c === 'commercialBreak')).toHaveLength(1);
    expect(state.calls).not.toContain('rewardedBreak');
  }, 120000);
});

describe('pausing', () => {
  beforeEach(async () => {
    if (page) await begin();
  }, 60000);

  runnable('stops gameplay on pause, shows the ad only when play resumes, and restarts gameplay on the next input', async () => {
    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'paused');
    const paused = await probe();
    expect(paused.calls).toEqual(['gameplayStart', 'gameplayStop']);
    expect(paused.busState).toBe('idle');

    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'play');
    expect((await probe()).calls).toEqual(['gameplayStart', 'gameplayStop', 'commercialBreak']);

    await page!.keyboard.press('Space');
    await advance(2);
    expect((await probe()).calls).toEqual(['gameplayStart', 'gameplayStop', 'commercialBreak', 'gameplayStart']);
  });

  runnable('lets the player open and close the pause menu again and again without stacking ads or events', async () => {
    for (let i = 0; i < 4; i++) {
      await page!.keyboard.press('Escape');
      await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'paused');
      await page!.keyboard.press('Escape');
      await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'play');
      await page!.keyboard.press('Space');
      await advance(1);
    }
    const calls = (await probe()).calls;
    expect(calls.filter((c) => c === 'commercialBreak')).toHaveLength(4);
    calls.forEach((call, i) => {
      if (call === 'gameplayStart' || call === 'gameplayStop') expect(calls[i - 1], `${call} at ${i} in ${calls.join(' > ')}`).not.toBe(call);
    });
  }, 120000);
});

describe('falling out of the world', () => {
  beforeEach(async () => {
    if (page) await begin();
  }, 60000);

  runnable('puts MAGNO back on the checkpoint with the camera already there, and counts one fall', async () => {
    await page!.evaluate(() => {
      const sim = (window as unknown as { __game: any }).__game.debug.sim;
      const cp = sim.level.checkpoints[0];
      sim.physics.magnoBody.setTranslation({ x: cp.x, y: cp.y + 0.4, z: 0 }, true);
    });
    await advance(10);
    expect((await probe()).checkpoint).toBe(0);

    await page!.evaluate(() => {
      const game = (window as unknown as { __game: any }).__game;
      const sim = game.debug.sim;
      sim.physics.magnoBody.setTranslation({ x: 0, y: sim.level.killY - 3, z: 0 }, true);
      game.debug.advance(1 / 60);
    });
    const cp = await checkpointOf();
    const after = await probe();
    expect(after.fallCount).toBe(1);
    expect(after.beyondSafetyLine).toBe(1);
    expect(Math.hypot(after.position.x - cp.x, after.position.y - (cp.y + 0.4))).toBeLessThan(1);
    const drawn = await page!.evaluate(() => {
      const renderer = (window as unknown as { __game: any }).__game.debug.renderer;
      const focus = renderer.cameraRig.focus;
      return { jump: Math.hypot(renderer.curMagno.x - renderer.prevMagno.x, renderer.curMagno.y - renderer.prevMagno.y), cameraY: focus.y };
    });
    expect(drawn.jump, 'MAGNO is not drawn streaking across the level from the void').toBeLessThan(0.5);
    expect(Math.abs(drawn.cameraY - after.position.y), 'the camera is not left down in the void').toBeLessThan(8);
    expect(after.phase).toBe('play');
  });
});
