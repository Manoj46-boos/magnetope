import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { t } from '@/locale';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The portrait visit, played end to end in a real phone-shaped browser
 * (P-MO-01, P-MO-06, P-MO-08). This is the suite the 4/10 review owes its
 * retest to: a 390x844 touch context boots the game, lives through the
 * opener's portrait composition, charges and launches by the game's own
 * input, earns and dismisses the landscape chip without ever losing the
 * controls to it, and turns the screen mid-climb without losing MAGNO.
 * Every measurement is the renderer's own projection — where the robot, the
 * frame and the summit actually land — never a style string.
 */

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

interface FrameRead {
  levelId: string;
  aspect: number;
  magnoWidthShare: number;
  magnoFromBottom: number;
  summitFromBottom: number | null;
  phase: string;
  magnoState: string;
  chipShown: boolean;
  chipText: string;
  chipPointer: string;
}

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
  context = await browser.newContext({ viewport: { ...PORTRAIT }, hasTouch: true, isMobile: true });
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

async function advance(ticks: number): Promise<void> {
  await page!.evaluate((n) => {
    const game = (window as unknown as { __game: { debug: { advance(s: number): void } } }).__game;
    for (let i = 0; i < n; i++) game.debug.advance(1 / 60);
  }, ticks);
}

/** Boots a fresh visit and holds the clock, so every read below is a settled frame. */
async function boot(): Promise<void> {
  await page!.goto(origin);
  await page!.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 30000 });
  await page!.evaluate(() => {
    const game = (window as unknown as { __game: { debug: { holdClock(h: boolean): void } } }).__game;
    game.debug.holdClock(true);
  });
}

/** The renderer's own projection of MAGNO's body, the summit and the chrome. */
async function readFrame(): Promise<FrameRead> {
  return page!.evaluate(() => {
    const game = (window as unknown as Record<string, any>).__game;
    const renderer = game.debug.renderer;
    const sim = game.debug.sim;
    const pos = sim.magno.view.position;
    const project = (x: number, y: number) => renderer.project(x, y);
    const a = project(pos.x - 0.3, pos.y);
    const b = project(pos.x + 0.3, pos.y);
    const c = project(pos.x, pos.y);
    const chip = document.querySelector<HTMLElement>('.landscape-chip');
    return {
      levelId: sim.level.id,
      aspect: renderer.cameraRig.camera.aspect,
      magnoWidthShare: (b.x - a.x) / window.innerWidth,
      magnoFromBottom: 1 - c.y / window.innerHeight,
      summitFromBottom: 1 - project(sim.level.summit.x, sim.level.summit.y).y / window.innerHeight,
      phase: game.debug.phase,
      magnoState: sim.magno.view.state,
      chipShown: chip?.classList.contains('show') ?? false,
      chipText: chip?.querySelector('p')?.textContent ?? '',
      chipPointer: chip ? getComputedStyle(chip).pointerEvents : 'none',
    };
  });
}

const runnable = (name: string, body: () => Promise<void>, timeout = 120000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

describe('a portrait visit on a phone-sized screen', () => {
  runnable('boots full-bleed and frames MAGNO at character scale in the follow shot', async () => {
    await boot();
    await page!.keyboard.press('Space');
    await advance(90);
    const frame = await readFrame();
    expect(frame.phase).toBe('play');
    expect(frame.aspect).toBeCloseTo(PORTRAIT.width / PORTRAIT.height, 3);
    // The letterbox is gone: MAGNO's own body reads past a ninth of the frame (P-MO-01).
    expect(frame.magnoWidthShare).toBeGreaterThan(0.11);
    // Sixty-two percent of the frame rides above him.
    expect(frame.magnoFromBottom).toBeGreaterThan(0.32);
    expect(frame.magnoFromBottom).toBeLessThan(0.44);
  });

  runnable('opens on the character and shows the destination at the vista, before any input', async () => {
    await boot();
    await advance(93);
    const frame = await readFrame();
    // The destination law, in the orientation players arrive in: the summit
    // rides the upper third with sky still above it, and MAGNO keeps his floor.
    expect(frame.summitFromBottom).not.toBeNull();
    expect(frame.summitFromBottom!).toBeGreaterThan(0.6);
    expect(frame.summitFromBottom!).toBeLessThan(0.85);
    expect(frame.magnoFromBottom).toBeGreaterThan(0.05);
    expect(frame.magnoFromBottom).toBeLessThan(0.3);
  });

  runnable('charges and launches by real input while the follow holds him in frame', async () => {
    await boot();
    await page!.keyboard.press('Space');
    await advance(30);
    await page!.keyboard.down('Space');
    await advance(90);
    const charging = await readFrame();
    expect(charging.magnoState).toBe('charging');
    await page!.keyboard.up('Space');
    await advance(12);
    const flying = await readFrame();
    expect(['repelled', 'airborne']).toContain(flying.magnoState);
    expect(flying.magnoFromBottom).toBeGreaterThan(-0.1);
    expect(flying.magnoFromBottom).toBeLessThan(1.1);
  });

  runnable('offers the landscape chip once, after two failed attempts, and never takes the controls', async () => {
    await boot();
    await page!.keyboard.press('Space');
    await page!.evaluate(() => {
      const game = (window as unknown as { __game: { startLevel(id: string): void } }).__game;
      game.startLevel('metropolis-01');
    });
    await advance(30);
    for (let i = 0; i < 2; i++) {
      await page!.keyboard.press('KeyR');
      await advance(30);
    }
    const offered = await readFrame();
    expect(offered.chipShown).toBe(true);
    expect(offered.chipText).toBe(t('landscapeHint'));
    // The chip never blocks by construction: its container cannot take a pointer (P-MO-06).
    expect(offered.chipPointer).toBe('none');
    // And the game still plays under it.
    await page!.keyboard.down('Space');
    await advance(60);
    const chargingUnderChip = await readFrame();
    expect(chargingUnderChip.magnoState).toBe('charging');
    await page!.keyboard.up('Space');
    await advance(6);

    await page!.locator('.landscape-chip .chip-dismiss').click();
    await page!.waitForTimeout(80);
    const dismissed = await readFrame();
    expect(dismissed.chipShown).toBe(false);

    // One sentence per session, however the fight goes.
    for (let i = 0; i < 3; i++) {
      await page!.keyboard.press('KeyR');
      await advance(20);
    }
    const quiet = await readFrame();
    expect(quiet.chipShown).toBe(false);
  });

  runnable('turns the screen mid-climb, retiring the chip and keeping MAGNO in the follow shot', async () => {
    await boot();
    await page!.keyboard.press('Space');
    await page!.evaluate(() => {
      const game = (window as unknown as { __game: { startLevel(id: string): void } }).__game;
      game.startLevel('metropolis-01');
    });
    await advance(30);
    for (let i = 0; i < 2; i++) {
      await page!.keyboard.press('KeyR');
      await advance(20);
    }
    const withChip = await readFrame();
    expect(withChip.chipShown).toBe(true);

    await page!.setViewportSize({ width: LANDSCAPE.width, height: LANDSCAPE.height });
    await advance(90);
    const turned = await readFrame();
    // The player answered the chip by turning the screen: it retires the moment it is taken.
    expect(turned.chipShown).toBe(false);
    expect(turned.aspect).toBeCloseTo(LANDSCAPE.width / LANDSCAPE.height, 3);
    expect(turned.magnoFromBottom).toBeGreaterThan(0.35);
    expect(turned.magnoFromBottom).toBeLessThan(0.55);

    await page!.setViewportSize({ width: PORTRAIT.width, height: PORTRAIT.height });
    // The same settling window the unit test gives a mid-climb turn: the follow
    // spring runs at 1.5 Hz, and a frame-rate-locked 4 s is its full ease home.
    await advance(240);
    const back = await readFrame();
    expect(back.aspect).toBeCloseTo(PORTRAIT.width / PORTRAIT.height, 3);
    expect(back.magnoFromBottom).toBeGreaterThan(0.32);
    expect(back.magnoFromBottom).toBeLessThan(0.44);
  });

  runnable('raised no console errors or page errors through the whole visit', async () => {
    expect(problems).toEqual([]);
  });
});
