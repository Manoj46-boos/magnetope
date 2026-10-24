import { execFileSync } from 'node:child_process';
import { createReadStream, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser } from './browser/harness';

/**
 * Behavioral verification that the snap "juice" actually fires. The prior
 * art in magnet-signature.test.ts checks the magnet silhouette renders; this
 * file checks the game *feels* right: when MAGNO snaps to a steel surface,
 * the cyan additive particle burst must light up. A snap without a burst is a
 * broken renewal; the player would not feel the magnetic click.
 *
 * The test serves itself as the production build: a strict-CSP HTTP server
 * over `vite build` output, driven in Chromium with swiftshader WebGL.
 *
 * What belongs here is what a player can be promised to see at play pace:
 * presence, not geometry. The envelopes — the launch stretch, the camera
 * lunge, the lens pop — are exactly measured by the unit suites (juice.test,
 * render.test) and frozen frame-exact by the held-clock capture set, because
 * a follow camera that lags the flight makes any silhouette span it reads on
 * the way a measurement of distance, not of the rig.
 */

const root = resolve(__dirname, '..');
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };

const POLICY = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

let distDir = '';
let server: Server | null = null;
let origin = '';
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
const errors: string[] = [];

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  distDir = mkdtempSync(join(tmpdir(), 'magnetope-snap-juice-'));
  execFileSync(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', distDir, '--emptyOutDir'], { cwd: root, stdio: 'pipe' });

  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!));
    const file = join(distDir, path === '/' || path === '\\' ? 'index.html' : path);
    if (!file.startsWith(distDir) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'content-security-policy': POLICY });
    createReadStream(file).pipe(res);
  });
  await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;

  context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) errors.push(m.text());
  });
  await page.goto(origin);
  await page.waitForSelector('.loading', { state: 'detached', timeout: 30000 }).catch(() => undefined);
}, 180000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
  if (distDir) rmSync(distDir, { recursive: true, force: true });
});

const runnable = (name: string, body: () => Promise<void>) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    90000,
  );

/** Counts bright additive-blended pixels: cyan-white and pure-white glow from sparks. */
async function glowPixelCount(target: Page): Promise<number> {
  const png = (await target.screenshot()).toString('base64');
  return target.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let glow = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]!;
      const g = pixels[i + 1]!;
      const b = pixels[i + 2]!;
      // Bright cyan-white: the additive snap burst and the field-line core.
      const bright = r > 200 && g > 200 && b > 200;
      // Cyan glow: the field-line and snap ring color.
      const cyan = b > 180 && g > 150 && r < 120;
      if (bright || cyan) glow++;
    }
    return glow;
  }, png);
}

interface FrameRead {
  /** Cyan additive pixels: the catch burst, the snap ring, the surface glow. */
  cyan: number;
  /** Red and blue pole pixels: the signature colours the silhouette lives on. */
  red: number;
  blue: number;
}

/**
 * One screenshot, one pass, three counts. The cyan class is the catch's
 * witness; the pole classes are the wash guard. Reading them from the same
 * frozen frame is what makes a coexistence claim honest.
 */
async function readFrame(target: Page): Promise<FrameRead> {
  const png = (await target.screenshot()).toString('base64');
  return target.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let cyan = 0;
    let red = 0;
    let blue = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]!;
      const g = pixels[i + 1]!;
      const b = pixels[i + 2]!;
      if (b > 180 && g > 150 && r < 120) cyan++;
      if (r > 180 && g < 90 && b < 90) red++;
      if (b > 180 && r < 90 && g > 60 && g < 180) blue++;
    }
    return { cyan, red, blue };
  }, png);
}

describe('the snap burst fires when MAGNO sticks to a steel surface', () => {
  runnable('boots clean and draws an initial frame', async () => {
    expect(await page!.locator('.loading').count()).toBe(0);
    expect(await page!.locator('canvas').count()).toBe(1);
    expect(errors).toEqual([]);
  });

  runnable('emits a visible particle burst on the first snap', async () => {
    // Press space once to start the run (clears the coach overlay).
    await page!.keyboard.press('Space');
    await page!.waitForTimeout(400);

    // Charge a flip: hold space, release to launch.
    await page!.keyboard.down('Space');
    await page!.waitForTimeout(500);
    await page!.keyboard.up('Space');
    // MAGNO is now airborne. Wait for him to travel toward the next surface.
    await page!.waitForTimeout(700);

    // Press space again mid-air to arm and engage a snap. The snap fires when
    // MAGNO is close enough to a steel surface; the game auto-targets.
    await page!.keyboard.press('Space');
    await page!.waitForTimeout(150);

    // Sample the glow pixel count in the window right after the snap engages.
    // The additive burst lives roughly 300-550ms, so catch it now.
    const duringSnap = await glowPixelCount(page!);

    // The snap frame must carry a meaningful additive glow: the burst particles
    // plus the field-line core plus the snap ring. An absolute floor catches the
    // burst regardless of where MAGNO ended up relative to the camera.
    expect(duringSnap).toBeGreaterThan(300);
  });

  runnable('keeps the magnet poles visible throughout the snap sequence', async () => {
    // The wash guard (R-GF-04): the catch must light its burst without costing
    // MAGNO his colours. The player-visible truth is the settled rig the
    // aftermath leaves behind — both pole tips reading again once the burst
    // has spent itself. A single sample taken at an arbitrary moment instead
    // asks where a lagging follow camera happens to have left him: under
    // worker contention a whiffed snap parks him mid-flight, and the counts
    // answer distance, not visibility. So the case polls the aftermath until
    // the rig reads settled — the field lines go quiet only once he is
    // holding on, and a whiffed flight keeps them loud — and a real wash
    // shows up as no frame ever reading again.
    let readable = 0;
    let bestRed = 0;
    let bestBlue = 0;
    for (let frame = 0; frame < 12 && readable < 2; frame++) {
      const read = await readFrame(page!);
      bestRed = Math.max(bestRed, read.red);
      bestBlue = Math.max(bestBlue, read.blue);
      if (read.cyan < 140 && read.red > 25 && read.blue > 25) readable++;
      await page!.waitForTimeout(300);
    }
    expect(readable, `the poles read through the snap aftermath (best red ${bestRed}, best blue ${bestBlue})`).toBeGreaterThanOrEqual(2);
    expect(errors).toEqual([]);
  });

  runnable('fires a full-power launch into live flight (R-GF-01)', async () => {
    // The launch's durable, player-visible half at play pace is the flight
    // itself: the field lines flip live the moment the magnet lets go and
    // stay loud while he flies — quiet again the moment he catches. The rest
    // of the composition — the hit-stop, the camera lunge, the lens pop, the
    // stretch the rig unwinds, and the warm ring the origin blows — is spent
    // inside half a second, too fast for a screenshot round trip to sample
    // honestly, so it lives where it can be measured exactly: the unit suites
    // (juice.test spawns the rings off the real event bus, render.test pins
    // the stretch and the coil) and the held-clock capture set that froze the
    // release frame-exact. A follow camera that lags the flight makes any
    // silhouette span it reads on the way a measurement of distance, not of
    // the rig.
    //
    // One attempt is not a verdict: a weak perch can crumble under a long
    // charge and a cornered launch can re-catch inside the burst's life, so
    // the case retries from wherever the run parks him. What must happen in
    // every attempt is that the charge is real — the rig holding on, field
    // lines quiet — before the release is trusted to mean anything.
    let launched = false;
    let lastCoiled = 0;
    for (let attempt = 0; attempt < 3 && !launched; attempt++) {
      // Let the run settle — a catch holds, a miss falls and respawns docked.
      // Under worker load the fixed stepper clamps its frame time, so the
      // simulation runs slower than the wall clock and every wait here is
      // given the margin a slowed run needs to live through in sim time.
      await page!.waitForTimeout(2500);

      // Full charge. The charge caps and holds at the top — the meter pulses
      // and the rig shivers on the edge of letting go — so holding long costs
      // nothing and buys the sim the time it needs to actually fill the coil.
      await page!.keyboard.down('Space');
      await page!.waitForTimeout(3000);
      const coiled = await readFrame(page!);
      lastCoiled = coiled.cyan;
      const holding = coiled.cyan < 140;

      // Release either way, so the next attempt starts from a clean key.
      await page!.keyboard.up('Space');
      if (!holding) continue;

      // The flight spends the coil: poll while the burst or the live field
      // lines can still be read — either one proves the launch moved him.
      // A slowed run stretches the flight in wall time, which the poll rides.
      for (let frame = 0; frame < 8 && !launched; frame++) {
        launched = (await readFrame(page!)).cyan > 140;
      }
    }
    expect(launched, `a full-power launch spends its coil into a live, field-lit flight (last coiled cyan ${lastCoiled})`).toBe(true);
    expect(errors).toEqual([]);
  });
});
