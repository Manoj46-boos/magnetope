import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The store-card composition scene (PRD 17.3) end to end in the real engine:
 * the debug stage must boot the level it names with the player neutered, the
 * three variants must render the frames the audits measured (the subject's
 * poles, the catching arc, the poses that separate the cards), the ident must
 * fire its one flash on the catch frame, and leaving the stage must hand the
 * controls back. Every frame is stepped on a held clock, so each probe lands
 * on an exact frame of the timeline.
 */

interface GameWindow {
  __game: {
    debug: {
      phase: string;
      sim: { level: { id: string }; magno: { view: { position: { x: number; y: number } } } };
      openerLog: string[];
      setQuality(tier: string): void;
      settings: { ghosts: boolean; rimTint: boolean };
      holdClock(held: boolean): void;
      advance(seconds: number): void;
      setUiVisible(visible: boolean): void;
      thumbnail(variant: string | null, ident?: boolean): void;
      renderer: { thumbFlash: number };
    };
  };
}

const game = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).__game.debug);
const stage = (page: Page, variant: string | null, ident = false) =>
  page.evaluate(({ variant, ident }) => (window as unknown as GameWindow).__game.debug.thumbnail(variant, ident), { variant, ident });

/** MAGNO's own view is behind a getter, so it must be walked in the page, not through a serialised handle. */
const magnoPosition = (page: Page) =>
  page.evaluate(() => {
    const { x, y } = (window as unknown as GameWindow).__game.debug.sim.magno.view.position;
    return { x, y };
  });

/** The staged flash's own state: 1 on the frame it fires, decaying to 0 on the shell veil's curve. */
const flashLevel = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).__game.debug.renderer.thumbFlash);

const advance = (page: Page, seconds: number) =>
  page.evaluate((s) => {
    const handle = (window as unknown as GameWindow).__game;
    for (let i = 0; i < Math.round(s * 60); i++) handle.debug.advance(1 / 60);
  }, seconds);

const log = (page: Page) => page.evaluate(() => [...((window as unknown as GameWindow).__game.debug.openerLog as string[])]);

interface CardProbe {
  luma: number;
  saturated: number;
  red: number;
  blue: number;
  arc: number;
  blueX: number;
  blueY: number;
}

/**
 * Steps one frame and reads it back inside the same page task, before the
 * drawing buffer clears: a frame-exact probe that never waits on the compositor
 * (hundreds of held-clock renders queue up behind a screenshot on software GL).
 */
function probe(page: Page): Promise<CardProbe> {
  return page.evaluate(async () => {
    const handle = (window as unknown as GameWindow).__game;
    handle.debug.advance(1 / 60);
    const png = (document.querySelector('canvas') as HTMLCanvasElement).toDataURL('image/png');
    const image = new Image();
    image.src = png;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let luma = 0;
    let saturated = 0;
    let red = 0;
    let blue = 0;
    let arc = 0;
    let blueX = 0;
    let blueY = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]!;
      const g = pixels[i + 1]!;
      const b = pixels[i + 2]!;
      luma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (Math.max(r, g, b) - Math.min(r, g, b) > 50) saturated++;
      if (r > 180 && g < 90 && b < 90) red++;
      // the south pole: MAGNO's horseshoe tip, the one colour no prop on the card shares
      if (b > 180 && r < 90 && g > 60 && g < 180) {
        blue++;
        blueX += (i / 4) % canvas.width;
        blueY += Math.floor(i / 4) / canvas.width;
      }
      if (b - r >= 40 && b > 200 && g > 160) arc++;
    }
    const count = pixels.length / 4;
    return {
      luma: luma / count,
      saturated,
      red,
      blue,
      arc,
      blueX: blue > 0 ? blueX / blue / canvas.width : -1,
      blueY: blue > 0 ? blueY / blue / canvas.height : -1,
    };
  });
}

const problems: string[] = [];
const requests: string[] = [];

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let origin = '';
let page: Page | null = null;
let context: BrowserContext | null = null;

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  origin = started.url;
  // One player for the whole suite: the stage reboots the world on every entry,
  // so no save state can leak between tests — only the probes need a clean frame.
  context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await context.addInitScript('window.__name = (f) => f;');
  page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
  });
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(origin);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).__game), null, { timeout: 60000 });
  await page.evaluate(() => {
    const handle = (window as unknown as GameWindow).__game;
    handle.debug.holdClock(true);
    handle.debug.setQuality('high');
    handle.debug.settings.ghosts = false;
    handle.debug.settings.rimTint = false;
  });
  await advance(page, 3);
}, 90000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await server?.close();
}, 120000);

const runnable = (name: string, body: () => Promise<void>, timeout = 180000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

describe('the store-card composition scene', () => {
  runnable('boots the level it names, with the game input neutered', async () => {
    await stage(page!, 'hero-launch');
    expect((await game(page!)).sim.level.id).toBe('scrapyard-04');
    const marksAtEntry = await log(page!);
    // the shell keeps answering while the stage is live, so a stuck capture can
    // still be paused — and the handback after that resume stays neutered
    await page!.keyboard.press('Escape');
    await advance(page!, 1 / 60);
    expect((await game(page!)).phase).toBe('paused');
    await page!.keyboard.press('Escape');
    await advance(page!, 1 / 60);
    expect((await game(page!)).phase).toBe('play');
    // the flip key reaches nothing: MAGNO holds his spawn beyond whatever the
    // physics settles on its own — a real flip covers metres in the same window
    const before = await magnoPosition(page!);
    await advance(page!, 1);
    const settled = await magnoPosition(page!);
    const controlDrift = Math.hypot(settled.x - before.x, settled.y - before.y);
    await page!.keyboard.down('Space');
    await advance(page!, 1);
    await page!.keyboard.up('Space');
    const after = await magnoPosition(page!);
    const keyDrift = Math.hypot(after.x - settled.x, after.y - settled.y);
    expect(keyDrift).toBeLessThan(controlDrift + 0.5);
    // the opener never ticks inside the stage: no ladder rungs, no marks, even
    // after a pause cycle and held keys
    await advance(page!, 2);
    expect(await log(page!)).toEqual(marksAtEntry);
  });

  runnable('renders the hero card: subject, poles and catching arc', async () => {
    await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.setUiVisible(false));
    await stage(page!, 'hero-launch');
    await advance(page!, 24 / 60);
    const card = await probe(page!);
    expect(card.saturated).toBeGreaterThan(100_000);
    expect(card.blue).toBeGreaterThan(80);
    expect(card.red).toBeGreaterThan(100);
    // the read: MAGNO sits low and left, where the eye enters the card
    expect(card.blueX).toBeGreaterThan(0);
    expect(card.blueX).toBeLessThan(0.45);
    expect(card.blueY).toBeGreaterThan(0.55);
    expect(card.arc).toBeGreaterThan(800);
  });

  runnable('plays the ident: one flash on the catch frame, then the attached settle', async () => {
    await stage(page!, 'hero-launch', true);
    await advance(page!, 66 / 60);
    const midSwing = await probe(page!);
    expect(await flashLevel(page!)).toBe(0);
    const flash = await probe(page!);
    // the beat fires on the catch frame: the renderer's flash state is live and
    // the frame measurably lifts (the unit suite pins the exact frame and the
    // single fire; the ring pulse phases this page's shared clock, so the
    // pixel deltas stay loose)
    expect(await flashLevel(page!)).toBeGreaterThan(0.4);
    expect(flash.luma).toBeGreaterThan(midSwing.luma + 15);
    // the beam is the ident's protagonist: it connects on the catch frame
    expect(flash.arc).toBeGreaterThan(midSwing.arc);
    await advance(page!, 123 / 60);
    const settled = await probe(page!);
    expect(await flashLevel(page!)).toBe(0);
    // The settle breathes now (R-CH-02): the aura rides the rig, so its area
    // dips a percent or two with the idle breath. The bar keeps a margin under
    // that — the arc's presence at settle still reads by an order.
    expect(settled.arc).toBeGreaterThan(280);
  });

  runnable('stages the other two variants on their own poses', async () => {
    await stage(page!, 'fall-comedy');
    await advance(page!, 24 / 60);
    const blooper = await probe(page!);
    expect(blooper.saturated).toBeGreaterThan(100_000);
    // the windmill turn hides the south pole, and a failed flip arms no beam
    expect(blooper.blue).toBeLessThan(30);
    expect(blooper.arc).toBeLessThan(400);

    await stage(page!, 'tower-scale');
    await advance(page!, 24 / 60);
    expect((await game(page!)).sim.level.id).toBe('scrapyard-04');
    const wide = await probe(page!);
    // the ambience card: a whole world in frame, MAGNO too small for his poles to register
    expect(wide.saturated).toBeGreaterThan(150_000);
    expect(wide.red).toBeLessThan(80);
  });

  runnable('hands play back when the stage exits', async () => {
    await page!.evaluate(() => (window as unknown as GameWindow).__game.debug.setUiVisible(true));
    await stage(page!, null);
    await page!.keyboard.press('Escape');
    await advance(page!, 1 / 60);
    await page!.locator('.panel.pause').waitFor({ state: 'visible' });
    expect((await game(page!)).phase).toBe('paused');
    await page!.locator('.panel.pause .btn.primary').click();
    await page!.waitForFunction(() => (window as unknown as GameWindow).__game.debug.phase === 'play');
    // the controls came back with it: a held flip launches, and the session log says so
    const marks = await log(page!);
    await page!.keyboard.down('Space');
    await advance(page!, 1 / 2);
    await page!.keyboard.up('Space');
    await advance(page!, 1 / 2);
    expect((await log(page!)).length).toBeGreaterThan(marks.length);
    // re-entry after a handback still stages, and a second exit is a no-op
    await stage(page!, 'tower-scale');
    await stage(page!, null);
    expect((await game(page!)).phase).toBe('play');
  });

  runnable('keeps the session clean', async () => {
    expect(problems).toEqual([]);
    const offOrigin = requests.filter((url) => !url.startsWith(origin));
    expect(offOrigin).toEqual([]);
  });
});
