import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * A player's first minutes in a real browser: boot, play three levels through the
 * real game loop, pause with the keyboard, reload, cut the network. The levels are
 * played by the stored planner routes, so what is checked is the game around them:
 * the loop, the HUD, saving, and the Poki hygiene rules (no stray requests, no errors).
 */

interface GameWindow {
  __game: {
    startLevel(id: string): void;
    debug: {
      phase: string;
      sim: { run: { timeMs: number; started: boolean }; level: { id: string } };
      sdk: { measured: Array<{ category: string; what: string; action: string }> };
      save: {
        data: {
          stars: Record<string, number>;
          scrap: number;
          owned: string[];
          ghosts: Record<string, string>;
        };
      };
      soundOn(): boolean;
      holdClock(held: boolean): void;
      advance(seconds: number): void;
      autoplay(recording: unknown): void;
    };
  };
}

interface Outcome {
  phase: string;
  ticks: number;
  stars: number;
}

const FIRST_LEVELS = ['scrapyard-00', 'scrapyard-01', 'scrapyard-02'];

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let origin = '';
const problems: string[] = [];
const requests: string[] = [];

async function boot(target: Page): Promise<void> {
  await target.goto(origin);
  await target.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
  await target.waitForTimeout(800);
}

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  origin = started.url;
  context = await browser.newContext({ viewport: { width: 480, height: 270 } });
  await context.addInitScript('window.__name = (f) => f;');
  page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
  });
  page.on('request', (r) => requests.push(r.url()));
  await boot(page);
}, 90000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await server?.close();
}, 120000);

const routeOf = (id: string): unknown => JSON.parse(readFileSync(resolve(__dirname, `../src/levels/routes/${id}.json`), 'utf8'));

const play = (id: string): Promise<Outcome> =>
  page!.evaluate(
    ({ id, route }) => {
      const game = (window as unknown as GameWindow).__game;
      game.startLevel(id);
      game.debug.holdClock(true);
      game.debug.autoplay(route);
      let ticks = 0;
      while (game.debug.phase !== 'cleared' && ticks < 3000) {
        game.debug.advance(1 / 60);
        ticks++;
      }
      return { phase: game.debug.phase, ticks, stars: game.debug.save.data.stars[id] ?? 0 };
    },
    { id, route: routeOf(id) },
  );

const runnable = (name: string, body: () => Promise<void>, timeout = 120000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

describe('a first session in a real browser', () => {
  runnable('plays the first three levels through to the clear card and earns stars', async () => {
    for (const id of FIRST_LEVELS) {
      const outcome = await play(id);
      expect(outcome.phase, id).toBe('cleared');
      expect(outcome.ticks, id).toBeLessThan(2500);
      expect(outcome.stars, id).toBeGreaterThanOrEqual(1);
    }
    expect(await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.save.data.scrap)).toBeGreaterThan(0);
  });

  runnable('shows the clear card with its stars and carries on to the next level from the Next button', async () => {
    await play('scrapyard-01');
    const card = page!.locator('.clear-card');
    await card.waitFor({ state: 'visible' });
    expect(await card.locator('.banner').innerText()).toMatch(/level clear/i);
    expect(await card.locator('.slot').count()).toBe(3);

    await card.locator('.btn.primary').click();
    await page!.waitForFunction(() => {
      const debug = (window as unknown as GameWindow).__game.debug;
      return debug.phase === 'play' && debug.sim.level.id === 'scrapyard-02';
    });
  });

  runnable('pauses on Escape without the clock moving, and resumes on Escape', async () => {
    await page!.evaluate(() => {
      const game = (window as unknown as GameWindow).__game;
      game.startLevel('scrapyard-01');
      game.debug.holdClock(true);
    });
    await page!.keyboard.press('Space');
    await page!.evaluate(() => {
      for (let i = 0; i < 30; i++) (window as unknown as GameWindow).__game.debug.advance(1 / 60);
    });
    const before = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.sim.run.timeMs);

    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'paused');
    await page!.evaluate(() => {
      for (let i = 0; i < 60; i++) (window as unknown as GameWindow).__game.debug.advance(1 / 60);
    });
    const during = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.sim.run.timeMs);
    expect(during).toBe(before);

    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'play');
    await page!.evaluate(() => {
      for (let i = 0; i < 30; i++) (window as unknown as GameWindow).__game.debug.advance(1 / 60);
    });
    const after = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.sim.run.timeMs);
    expect(after).toBeGreaterThan(before);
  });

  runnable('speaks the visit into the SDK channel: the boot label first, then the funnel the player climbed (R-AN-02, R-AN-06)', async () => {
    const measured = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.sdk.measured);
    // the boot record leads the visit, labels this player first-time, and carries the segment (R-AN-09)
    const boot = measured.find((r) => r.category === 'boot')!;
    expect(measured[0]).toBe(boot);
    expect(boot.what).toBe('fresh');
    expect(boot.action).toMatch(/^[a-z][a-z]\|(touch|desktop)\|(high|mid|low)$/);
    // the input record landed with the Space the pause case pressed
    expect(measured.some((r) => r.category === 'input' && r.what === 'first' && /^\d+$/.test(r.action))).toBe(true);
    // the clears, their stars and seconds, the payments and the card's dangle all reached the channel
    expect(measured.some((r) => r.category === 'attempt' && r.action === 'clear')).toBe(true);
    expect(measured.some((r) => r.category === 'stars' && /^\d+$/.test(r.action))).toBe(true);
    expect(measured.some((r) => r.category === 'time' && /^\d+$/.test(r.action))).toBe(true);
    expect(measured.some((r) => r.category === 'scrap' && r.what === 'earn' && /^\d+$/.test(r.action))).toBe(true);
    expect(measured.some((r) => r.category === 'dangle' && r.action === 'shown')).toBe(true);
    // a stored ghost means the run went on record, and the channel says so too
    const ghosts = await page!.evaluate(() => Object.keys((window as unknown as GameWindow).__game.debug.save.data.ghosts));
    expect(measured.some((r) => r.category === 'ghost' && r.action === 'set')).toBe(ghosts.length > 0);
    // nothing the game said falls outside the published vocabulary (R-AN-01)
    const vocabulary = ['level', 'retry', 'fall', 'attempt', 'stars', 'time', 'fallcount', 'session', 'ending', 'boot', 'input', 'ghost', 'cosmetic', 'scrap', 'dangle'];
    for (const record of measured) expect(vocabulary, `${record.category}/${record.what} is not in the table`).toContain(record.category);
  });

  runnable('remembers the stars after a reload', async () => {
    const saved = await page!.evaluate(() => JSON.parse(localStorage.getItem('magnetope.save') ?? '{}').stars as Record<string, number>);
    for (const id of FIRST_LEVELS) expect(saved[id], id).toBeGreaterThanOrEqual(1);

    // Tearing down a page that has played routes costs tens of seconds under
    // swiftshader before the navigation's load event can fire; the budget reflects
    // that machine cost, not any game work.
    await page!.reload({ timeout: 90_000 });
    await page!.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
    const restored = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.save.data.stars);
    for (const id of FIRST_LEVELS) expect(restored[id], id).toBeGreaterThanOrEqual(1);
  });

  runnable('keeps playing after the network is cut', async () => {
    await context!.setOffline(true);
    try {
      const outcome = await play('scrapyard-03');
      expect(outcome.phase).toBe('cleared');
    } finally {
      await context!.setOffline(false);
    }
  });

  runnable('plays a full level with the sound off, the way a muted player meets it (R-AU-12)', async () => {
    // A live level first — the pause menu only belongs to a run in progress.
    await page!.evaluate(() => {
      const game = (window as unknown as GameWindow).__game;
      game.startLevel('scrapyard-00');
      game.debug.holdClock(true);
    });
    await page!.keyboard.press('Space');
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'play');
    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'paused');
    // The pause menu's own toggles, clicked the way a player clicks them.
    await page!.locator('button.toggle:has(span[data-i18n="sound"])').click();
    await page!.locator('button.toggle:has(span[data-i18n="music"])').click();
    expect(await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.soundOn())).toBe(false);
    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'play');

    const outcome = await play('scrapyard-00');
    expect(outcome.phase, 'the game is fully playable with the sound off').toBe('cleared');
    expect(outcome.stars).toBeGreaterThanOrEqual(1);
    expect(await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.soundOn())).toBe(false);

    // Sound back on, the way the same player would put it back.
    await page!.evaluate(() => {
      const game = (window as unknown as GameWindow).__game;
      game.startLevel('scrapyard-00');
      game.debug.holdClock(true);
    });
    await page!.keyboard.press('Space');
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'play');
    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'paused');
    await page!.locator('button.toggle:has(span[data-i18n="sound"])').click();
    await page!.locator('button.toggle:has(span[data-i18n="music"])').click();
    expect(await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.soundOn())).toBe(true);
    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'play');
  });

  runnable('rides the clear card with the dangle, and the ghost delta exactly when a ghost waited (R-EC-04, R-RT-07)', async () => {
    const ghosts = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.save.data.ghosts);
    const outcome = await play('scrapyard-00');
    expect(outcome.phase).toBe('cleared');
    const card = page!.locator('.clear-card');
    await card.waitFor({ state: 'visible' });
    // The dangle always names the next unlock while anything is left to own.
    const dangle = await card.locator('.dangle-tag').innerText();
    expect(dangle.length).toBeGreaterThan(0);
    // The delta line appears exactly when the player's own ghost was waiting on this level.
    const ghostTags = await card.locator('.ghost-tag').count();
    expect(ghostTags).toBe(ghosts['scrapyard-00'] ? 1 : 0);
  });

  runnable('reads the session back on the map, with the collection, the ghost pips and the locked vista (R-RT-02, R-RT-04)', async () => {
    await page!.locator('.clear-card [data-i18n="quitToMap"]').click();
    await page!.waitForFunction(() => document.querySelector('.map-frame .session-card.live') !== null);
    const sessionLine = await page!.locator('.session-card .session-line').innerText();
    expect(sessionLine, 'the session tally names its clears').toMatch(/cleared/i);
    // Three ladders on the head: stars, Scrap, collection (R-EC-06).
    expect(await page!.locator('.map-frame .chip').count()).toBeGreaterThanOrEqual(3);
    // Every stored ghost waits on its own level, one pip a piece (R-RT-02).
    const ghosts = await page!.evaluate(() => Object.keys((window as unknown as GameWindow).__game.debug.save.data.ghosts).length);
    expect(await page!.locator('.node .ghost-pip').count()).toBe(ghosts);
    // The next biome's vista card keeps its gate.
    expect(await page!.locator('.biome.sealed .gate').count()).toBeGreaterThanOrEqual(1);
  });

  runnable('keeps the return hooks on the next boot, and hands the spotlight week its free claim (R-RT-02, R-RT-05)', async () => {
    await page!.reload({ timeout: 90_000 });
    await page!.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 30000 });
    // The session tally is a visit, not a record: a fresh boot carries none (R-RT-08).
    await page!.evaluate(() => {
      const game = (window as unknown as GameWindow).__game;
      game.startLevel('scrapyard-01');
      game.debug.holdClock(true);
    });
    await page!.keyboard.press('Escape');
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'paused');
    await page!.locator('.modal.open [data-i18n="quitToMap"]').click();
    await page!.waitForFunction(() => document.querySelector('.map-frame') !== null);
    expect(await page!.locator('.session-card.live').count()).toBe(0);
    // The ghosts persisted across the boot, one pip a level.
    const ghosts = await page!.evaluate(() => Object.keys((window as unknown as GameWindow).__game.debug.save.data.ghosts).length);
    expect(await page!.locator('.node .ghost-pip').count()).toBe(ghosts);

    // The locker reads the sets, and the spotlight week's free claim stays free (R-EC-05, R-RT-05).
    await page!.locator('.map-frame [data-i18n="locker"]').click();
    await page!.waitForFunction(() => document.querySelector('.locker-frame') !== null);
    const sets = await page!.locator('.set-chip').allInnerTexts();
    expect(sets.length).toBe(5);
    expect(sets.some((text) => /[1-9]\/[45]/.test(text)), 'a half-filled set is the return hook that pulls').toBe(true);

    const scrapBefore = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.save.data.scrap);
    let spotlight = page!.locator('.card.spotlight');
    if ((await spotlight.count()) === 0) {
      await page!.locator('.tab[data-i18n="fieldLines"]').click();
      spotlight = page!.locator('.card.spotlight');
    }
    expect(await spotlight.count()).toBe(1);
    await spotlight.locator('.btn').click();
    await page!.waitForFunction(() => document.querySelectorAll('.card.spotlight').length === 0);
    const after = await page!.evaluate(() => ({
      scrap: (window as unknown as GameWindow).__game.debug.save.data.scrap,
      owned: (window as unknown as GameWindow).__game.debug.save.data.owned.length,
    }));
    expect(after.scrap).toBe(scrapBefore);
    expect(after.owned).toBeGreaterThan(0);
  });

  runnable('labels the next visit a return, and the free claim reaches the channel as an unlock (R-AN-06, R-AN-04)', async () => {
    // one more clear, so the queue flushes at the card the way the game always does
    await play('scrapyard-00');
    const measured = await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.sdk.measured);
    const boot = measured.find((r) => r.category === 'boot')!;
    expect(boot.what).toBe('return');
    expect(measured.some((r) => r.category === 'cosmetic' && r.action === 'unlock')).toBe(true);
    expect(measured.some((r) => r.category === 'boot' && r.what === 'fresh')).toBe(false);
  });

  runnable('made no request outside its own origin and raised no error', async () => {
    const foreign = requests.filter((url) => !url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'));
    expect(foreign).toEqual([]);
    expect(problems).toEqual([]);
  });
});
