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

    // Sample the glow pixel count at idle (after the coach hint, before any snap).
    const beforeSnap = await glowPixelCount(page!);

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

    // The snap burst must light up the screen. The before-count includes the
    // idle field-line glow, so the delta is the burst contribution.
    expect(duringSnap).toBeGreaterThan(beforeSnap + 20);
  });

  runnable('keeps the magnet poles visible throughout the snap sequence', async () => {
    // After the snap, MAGNO should still have his red and blue poles on screen.
    // This guards against the burst washing out the signature colours.
    const png = (await page!.screenshot()).toString('base64');
    const probe = await page!.evaluate(async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let red = 0;
      let blue = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i]!;
        const g = pixels[i + 1]!;
        const b = pixels[i + 2]!;
        if (r > 180 && g < 90 && b < 90) red++;
        if (b > 180 && r < 90 && g > 60 && g < 180) blue++;
      }
      return { red, blue };
    }, png);
    expect(probe.red).toBeGreaterThan(30);
    expect(probe.blue).toBeGreaterThan(30);
    expect(errors).toEqual([]);
  });
});
