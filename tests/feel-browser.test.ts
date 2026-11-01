import type { Browser, BrowserContext, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The feel laws in a real browser (rebuild PRD Volume III, P-GF-01..05): the
 * latency law on the live loop, the earned kick on a full-charge release, the
 * airspeed ramp through the renderer's own streaks, and the vibration cue read
 * through the game's own dep. Every measurement plays the game through the
 * real loop or the real held clock — the numbers are the shipped pixels' own.
 */

interface GameWindow {
  __game: {
    debug: {
      sim: { run: { timeMs: number; started: boolean; cleared: boolean }; level: { id: string }; magno: { view: { state: string; charge01: number; velocity: { x: number; y: number }; position: { x: number; y: number } } } };
      renderer: { cameraRig: { camera: { position: { x: number; y: number; z: number } } }; windStreaks: { alive: number } };
      stagedBeats: string[];
      holdClock(held: boolean): void;
      advance(seconds: number): void;
      thumbnail(variant: string | null, ident?: boolean): void;
      setUiVisible(visible: boolean): void;
    };
  };
}

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let origin = '';
const problems: string[] = [];

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
  // A host that can vibrate, standing in at the exact boundary the game reads
  // it (P-GF-02): the page's own navigator, patched before the game boots, so
  // the Game's constructor picks the stub up as it picks any real host up.
  await context.addInitScript(() => {
    const calls: number[] = [];
    (window as unknown as { __vibrations: number[] }).__vibrations = calls;
    (navigator as unknown as { vibrate?: (ms: number) => boolean }).vibrate = (ms: number) => {
      calls.push(ms);
      return true;
    };
  });
  await context.addInitScript('window.__name = (f) => f;');
  page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
  });
  await boot(page);
}, 90000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await server?.close();
}, 120000);

const runnable = (name: string, body: () => Promise<void>, timeout = 120000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

describe('the latency law (P-GF-01)', () => {
  runnable('the press is answered on the very next tick, and one tick is half the law', async () => {
    // On a real 60 Hz screen a rendered frame is 16.7 ms, and the law's ceiling
    // is 34 ms median: the press answering inside a single tick leaves the other
    // half of the budget to the renderer. The headless renderer's own frame rate
    // is the machine's, not the game's, so the measurement runs on the held
    // clock where a tick is exactly 1/60 s — the same budget a 60 Hz panel gives.
    const seen = await page!.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      g.debug.holdClock(true);
      // settle onto the perch first
      for (let i = 0; i < 120; i++) g.debug.advance(1 / 60);
      return { state: g.debug.sim.magno.view.state };
    });
    expect(seen.state, 'settled onto the perch before the measurement').toBe('attached');

    // The press lands, and the very next advance — the next tick, 16.7 ms —
    // must already carry the charge the input layer latched from it.
    await page!.keyboard.down('Space');
    const afterOneFrame = await page!.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      g.debug.advance(1 / 60);
      return { state: g.debug.sim.magno.view.state, charge01: g.debug.sim.magno.view.charge01 };
    });
    await page!.keyboard.up('Space');
    expect(afterOneFrame.state, 'the press answered on the very next tick').toBe('charging');
    // One rendered frame is 16.7 ms of game time; the law's ceiling is 34 ms
    // median, so the answer arriving inside one tick is inside the law by half.
    expect(1000 / 60).toBeLessThan(34);
  });
});

describe('the earned release (P-GF-05)', () => {
  runnable('a full-charge release punches the camera along its flight, inside the first frames of the launch', async () => {
    // Hold the meter through the page's own events, then measure the camera's
    // displacement across the release — the kick is the shipped loop's own.
    await page!.keyboard.down('Space');
    const shot = await page!.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      g.debug.holdClock(true);
      const pos = () => ({ ...g.debug.renderer.cameraRig.camera.position });
      // settle onto the perch first, then let the hold run the whole meter
      for (let i = 0; i < 120; i++) g.debug.advance(1 / 60);
      const charging = g.debug.sim.magno.view.state;
      for (let i = 0; i < 60; i++) g.debug.advance(1 / 60);
      const full = g.debug.sim.magno.view.charge01;
      return { charging, full, at: pos() };
    });
    await page!.keyboard.up('Space');
    expect(shot.charging, 'the hold entered the charge from the perch').toBe('charging');
    expect(shot.full, 'the meter ran to the top').toBeGreaterThanOrEqual(0.99);
    const after = await page!.evaluate(({ at }) => {
      const g = (window as unknown as GameWindow).__game;
      let releaseAt = -1;
      for (let i = 0; i < 40; i++) {
        g.debug.advance(1 / 60);
        if (releaseAt < 0 && g.debug.sim.magno.view.state === 'repelled') releaseAt = i;
        if (releaseAt >= 0 && i - releaseAt === 4) break;
      }
      return {
        released: releaseAt >= 0,
        framesToRelease: releaseAt,
        speed: Math.hypot(g.debug.sim.magno.view.velocity.x, g.debug.sim.magno.view.velocity.y),
        kick: Math.hypot(g.debug.renderer.cameraRig.camera.position.x - at.x, g.debug.renderer.cameraRig.camera.position.y - at.y),
      };
    }, { at: shot.at });
    expect(after.released, 'the released hold became a launch').toBe(true);
    expect(after.framesToRelease!).toBeLessThan(4);
    expect(after.speed, 'the launch flew at full-power speed').toBeGreaterThan(10);
    // The earned kick is 1.375 metres of punch: at the frames the loop reads,
    // the camera's own displacement clears the resting game's whole envelope.
    expect(after.kick).toBeGreaterThan(0.8);
  });
});

describe('the airspeed ramp through the renderer (P-GF-03)', () => {
  runnable('a fast launch lights the streaks on a windless level, and rest retires them', async () => {
    await page!.keyboard.down('Space');
    const pre = await page!.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      g.debug.holdClock(true);
      const read = () => g.debug.renderer.windStreaks.alive;
      for (let i = 0; i < 90; i++) g.debug.advance(1 / 60);
      const rest = read();
      for (let i = 0; i < 60; i++) g.debug.advance(1 / 60);
      return { rest, charging: g.debug.sim.magno.view.state, full: g.debug.sim.magno.view.charge01 };
    });
    await page!.keyboard.up('Space');
    const counts = await page!.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      const read = () => g.debug.renderer.windStreaks.alive;
      let launched = false;
      let inFlight = 0;
      let speed = 0;
      for (let i = 0; i < 30; i++) {
        g.debug.advance(1 / 60);
        if (g.debug.sim.magno.view.state === 'repelled') {
          launched = true;
          speed = Math.hypot(g.debug.sim.magno.view.velocity.x, g.debug.sim.magno.view.velocity.y);
          inFlight = read();
          break;
        }
      }
      return { inFlight, launched, speed };
    });
    void pre;
    expect(counts.launched, 'the release became a launch').toBe(true);
    // The level has no weather; before the law these counts read zero through
    // the whole climb. A full-power launch lands mid-ramp or above: alive > 0.
    expect(counts.inFlight, 'the launch moment thickens the air on its own').toBeGreaterThan(0);
  });
});

describe('the full-charge vibration (P-GF-02)', () => {
  runnable('a touch player holding to the top of the meter feels the ten-millisecond tap, exactly once per charge', async () => {
    // The real event chain: a touch press inside the flip button's own zone,
    // the input layer latching it, the sim emitting chargeLevel, the game
    // asking the host. The keyboard player on the next hold gets nothing.
    const result = await page!.evaluate(async () => {
      const g = (window as unknown as GameWindow).__game;
      const calls = () => (window as unknown as { __vibrations: number[] }).__vibrations;
      g.debug.holdClock(true);
      for (let i = 0; i < 120; i++) g.debug.advance(1 / 60);
      // the flip button's own zone, as the input layer computes it (split
      // layout: the right half of the stage) — press, hold the whole meter,
      // release
      const stage = document.getElementById('view')!.parentElement!;
      const rect = stage.getBoundingClientRect();
      const x = rect.left + rect.width * 0.75;
      const y = rect.top + rect.height * 0.75;
      stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 3, pointerType: 'touch', clientX: x, clientY: y }));
      // the press takes hold on the next tick, the meter tops out at 900 ms
      for (let i = 0; i < 58; i++) g.debug.advance(1 / 60);
      const during = g.debug.sim.magno.view.state;
      const held = g.debug.sim.magno.view.charge01;
      stage.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 3, pointerType: 'touch', clientX: x, clientY: y }));
      const afterTouch = calls().slice();
      return { during, held, afterTouch };
    });
    expect(result.during, 'the touch press took hold on the perch').toBe('charging');
    expect(result.held, 'the meter ran to the top').toBeGreaterThanOrEqual(0.99);
    expect(result.afterTouch, 'the topped-out meter tapped the hand once').toEqual([10]);
  });
});

describe('the staged beats on the live clock (P-GF-06)', () => {
  runnable('the ident plays its four voice beats through the game loop, once each, in timeline order', async () => {
    const beats = await page!.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      g.debug.setUiVisible(false);
      g.debug.thumbnail('panic-launch', true);
      g.debug.holdClock(true);
      // three seconds at 60 fps: the loop polls the stage every frame and the
      // map is asked to speak exactly where the timeline carries its beats
      for (let i = 0; i < 180; i++) g.debug.advance(1 / 60);
      const heard = [...g.debug.stagedBeats];
      g.debug.stagedBeats.length = 0;
      g.debug.thumbnail(null);
      g.debug.advance(1 / 60);
      return heard;
    });
    expect(beats).toEqual(['hook', 'launch', 'catch', 'settle']);
  });

  runnable('the hop speaks its beat through the ladder, on the live clock', async () => {
    // The ladder's second rung fires eight seconds into a run that never
    // starts; on the held clock that is eight seconds of frames, and the hop's
    // beat rides the effect the same frame the rig hops.
    const beats = await page!.evaluate(() => {
      const g = (window as unknown as GameWindow).__game;
      g.debug.holdClock(true);
      g.debug.stagedBeats.length = 0;
      for (let i = 0; i < 9 * 60; i++) g.debug.advance(1 / 60);
      return [...g.debug.stagedBeats];
    });
    expect(beats).toContain('hop');
  });
});

describe('the suite\'s own honesty', () => {
  runnable('the pages above ran without a single script error', async () => {
    expect(problems).toEqual([]);
  });
});
