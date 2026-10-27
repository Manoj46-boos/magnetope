import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The ad-block parity suite (R-MZ-13, R-QA-04): the page boots against an SDK
 * whose every call throws — init rejects, breaks reject, gameplay events throw —
 * the way a blocker or a broken host leaves it. Nothing is patched or stubbed
 * here: the hostile global is injected before the page's own scripts run, so the
 * production adapter is the only defence under test. If every rewarded button
 * vanished tomorrow, this visit must still be a complete game: playable, clearable,
 * purchasable, and free of dead ends (R-MZ-02).
 */

interface State {
  phase: string;
  magnoState: string;
  fallCardOpen: boolean;
  clearCardOpen: boolean;
  scrap: number;
  owned: string[];
  fallCount: number;
  levelId: string;
}

/** Every PokiSDK call is recorded, then fails the way a blocked host fails. */
const HOSTILE_SDK = `
  window.__hostile = [];
  const hostile = (name) => () => { window.__hostile.push(name); throw new Error('blocked'); };
  window.PokiSDK = {
    init: () => { window.__hostile.push('init'); return Promise.reject(new Error('blocked')); },
    gameLoadingFinished: hostile('loadingFinished'),
    gameplayStart: hostile('gameplayStart'),
    gameplayStop: hostile('gameplayStop'),
    commercialBreak: () => { window.__hostile.push('commercialBreak'); return Promise.reject(new Error('blocked')); },
    rewardedBreak: () => { window.__hostile.push('rewardedBreak'); return Promise.reject(new Error('blocked')); },
    getLanguage: hostile('getLanguage'),
    measure: hostile('measure'),
  };
`;

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
  await context.addInitScript(HOSTILE_SDK);
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

/** A fresh visit against the hostile SDK: no stubs, no patched methods, the real boot path. */
async function boot(): Promise<void> {
  await page!.goto(origin);
  await page!.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 30000 });
  await page!.waitForTimeout(500);
  await page!.evaluate(() => {
    const game = (window as unknown as { __game: any }).__game;
    game.startLevel('scrapyard-03');
    game.debug.holdClock(true);
  });
  await page!.keyboard.press('Space');
  await advance(3);
}

async function advance(ticks: number): Promise<void> {
  await page!.evaluate((n) => {
    const game = (window as unknown as { __game: any }).__game;
    for (let i = 0; i < n; i++) game.debug.advance(1 / 60);
  }, ticks);
}

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

async function state(): Promise<State> {
  return page!.evaluate(() => {
    const w = window as unknown as Record<string, any>;
    const game = w.__game;
    return {
      phase: game.debug.phase,
      magnoState: game.debug.sim.magno.view.state,
      fallCardOpen: Boolean(document.querySelector('.fall-card.open')),
      clearCardOpen: Boolean(document.querySelector('.clear-card')?.closest('.modal')?.classList.contains('open')),
      scrap: game.debug.save.data.scrap,
      owned: [...game.debug.save.data.owned],
      fallCount: game.debug.sim.run.fallCount,
      levelId: game.debug.sim.level.id,
    };
  });
}

const hostileCalls = (): Promise<string[]> => page!.evaluate(() => [...(window as unknown as { __hostile: string[] }).__hostile]);

const runnable = (name: string, body: () => Promise<void>, timeout = 90000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

describe('an ad-blocked visit', () => {
  runnable('boots and stays playable with every SDK call throwing', async () => {
    await boot();
    await advance(30);
    const after = await state();
    expect(after.phase).toBe('play');
    expect(after.levelId).toBe(LEVEL);
    const calls = await hostileCalls();
    expect(calls).toContain('init');
    expect(calls).toContain('gameplayStart');
    expect(calls).toContain('loadingFinished');
  });

  runnable('never surfaces a rewarded card while the game is in motion (R-MZ-06)', async () => {
    await boot();
    await page!.keyboard.down('Space');
    await advance(120);
    const charging = await state();
    expect(charging.magnoState).toBe('charging');
    expect(charging.fallCardOpen || charging.clearCardOpen).toBe(false);

    await page!.keyboard.up('Space');
    await advance(6);
    const flying = await state();
    expect(['repelled', 'airborne']).toContain(flying.magnoState);
    expect(flying.fallCardOpen || flying.clearCardOpen).toBe(false);
    await advance(240);
    const settled = await state();
    expect(['attached', 'recovering', 'airborne']).toContain(settled.magnoState);
    if (settled.fallCardOpen || settled.clearCardOpen) {
      // The motion law's other half: whatever card the landing earned, it opened at rest.
      expect(['attached', 'recovering']).toContain(settled.magnoState);
    }
  });

  runnable('declines the fall card\u2019s rewarded revive gracefully, and the run just carries on', async () => {
    await boot();
    await fallFar();
    const landed = await state();
    expect(landed.fallCardOpen).toBe(true);
    expect(landed.fallCount).toBe(1);

    await page!.locator('.fall-card .actions .btn').nth(1).click();
    await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'play');
    const after = await state();
    expect((await hostileCalls()).slice(-1)).toEqual(['rewardedBreak']);
    expect(after.fallCardOpen).toBe(false);
    expect(after.fallCount).toBe(1);
    expect(after.scrap, 'a declined video pays nothing').toBe(landed.scrap);

    // The player is never stranded: the very next input is real play.
    await page!.keyboard.press('Space');
    await advance(10);
    expect((await state()).phase).toBe('play');
  });

  runnable('keeps the clear card honest: the doubler declines, and Next still goes next (R-MZ-02)', async () => {
    await boot();
    await page!.evaluate(() => (window as unknown as { __game: any }).__game.startLevel('playground-08'));
    const route = JSON.parse(readFileSync(resolve(__dirname, '../src/levels/routes/playground-08.json'), 'utf8')) as unknown;
    await page!.evaluate(
      (r) => {
        const game = (window as unknown as { __game: any }).__game;
        game.debug.autoplay(r);
        for (let i = 0; i < 1200 && game.debug.phase !== 'cleared'; i++) game.debug.advance(5 / 60);
      },
      route,
    );
    await page!.locator('.clear-card').waitFor({ state: 'visible' });
    const doubler = page!.locator('.clear-card .btn', { hasText: /double/i });
    expect(await doubler.count()).toBe(1);

    const before = (await state()).scrap;
    await doubler.click();
    await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.bus.state === 'idle');
    const declined = await state();
    expect(declined.scrap).toBe(before);
    expect((await hostileCalls()).slice(-1)).toEqual(['rewardedBreak']);
    expect(await doubler.count(), 'a declined video keeps the offer where it was').toBe(1);

    // The card still carries the player forward: a clear whose next level is open.
    await page!.evaluate(() => (window as unknown as { __game: any }).__game.startLevel('scrapyard-01'));
    const shortRoute = JSON.parse(readFileSync(resolve(__dirname, '../src/levels/routes/scrapyard-01.json'), 'utf8')) as unknown;
    await page!.evaluate(
      (r) => {
        const game = (window as unknown as { __game: any }).__game;
        game.debug.autoplay(r);
        for (let i = 0; i < 1200 && game.debug.phase !== 'cleared'; i++) game.debug.advance(5 / 60);
      },
      shortRoute,
    );
    await page!.locator('.clear-card').waitFor({ state: 'visible' });
    await page!.locator('.clear-card .btn.primary').click();
    await page!.waitForFunction(
      () => (window as unknown as { __game: any }).__game.debug.sim.level.id === 'scrapyard-02',
      null,
      { timeout: 30000 },
    );
    const moved = await state();
    expect(moved.phase).toBe('play');
    expect((await hostileCalls())).toContain('commercialBreak');
  }, 240000);

  runnable('the locker declines the watch, and the shelf still sells for Scrap (R-MZ-13)', async () => {
    await boot();
    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'paused');
    await page!.locator('.panel.pause [data-opens="locker"]').click();
    await page!.waitForSelector('[aria-labelledby="locker-title"].open');

    const item = page!
      .locator('[aria-labelledby="locker-title"] [data-item]')
      .filter({ has: page!.locator('.foot .icon-btn.small') })
      .first();
    const watch = item.locator('.foot .icon-btn.small');
    const id = (await item.getAttribute('data-item')) as string;
    expect((await state()).owned).not.toContain(id);

    await watch.click();
    await page!.waitForFunction(
      (wanted) => (window as unknown as { __hostile: string[] }).__hostile.slice(-1)[0] === wanted,
      'rewardedBreak',
    );
    expect((await state()).owned, 'a declined video unlocks nothing').not.toContain(id);
    await page!.waitForSelector('[aria-labelledby="locker-title"].open');

    // The economy stands on its own: what Scrap buys, no ad gate can touch.
    const price = Number((await item.locator('.foot .btn').first().innerText()).trim());
    expect(price).toBeGreaterThan(0);
    await page!.evaluate(
      ({ n, p }) => (window as unknown as { __game: any }).__game.debug.save.update((s: Record<string, any>) => (s.scrap += p + n)),
      { n: 5, p: price },
    );
    await item.locator('.foot .btn').first().click();
    await page!.waitForFunction(
      (wanted) => (window as unknown as { __game: any }).__game.debug.save.data.owned.includes(wanted),
      id,
    );
    expect(await page!.locator(`[data-item="${id}"]`).getAttribute('class')).toContain('equipped');
  }, 120000);

  runnable('keeps every surface reachable and survives the contract break that throws', async () => {
    await boot();
    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'paused');

    await page!.locator('.panel.pause [data-opens="map"]').click();
    await page!.waitForSelector('[aria-labelledby="map-title"].open');
    await page!.locator('[aria-labelledby="map-title"] [data-label="back"]').click();
    await page!.waitForSelector('.panel.pause');

    await page!.locator('.panel.pause [data-opens="controls"]').click();
    await page!.waitForSelector('[aria-labelledby="controls-title"].open');
    await page!.locator('[aria-labelledby="controls-title"] header .icon-btn').click();
    await page!.waitForSelector('.panel.pause');

    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as { __game: any }).__game.debug.phase === 'play');
    const calls = await hostileCalls();
    expect(calls).toContain('commercialBreak');
    expect(calls).toContain('gameplayStop');
    expect((await state()).phase).toBe('play');
  });

  runnable('leaves the visit with zero page errors', async () => {
    expect(problems).toEqual([]);
  });
});
