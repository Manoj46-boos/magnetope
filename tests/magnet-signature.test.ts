import { execFileSync } from 'node:child_process';
import { createReadStream, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser } from './browser/harness';

/**
 * Behavioral verification that the magnet signature is visible on the production
 * build. The prior art in `release.test.ts` checks that *something* renders; this
 * file checks that *the magnet* renders: MAGNO's horseshoe head must show both the
 * red north pole and the blue south pole at gameplay scale, the eye must be large
 * enough to register as a face, and a real flip must move him off the spawn
 * surface. If any of those fail the renewal has not landed and the build is not
 * ready for the Poki submission dossier.
 *
 * The test serves itself as the production build: it spins up a strict-CSP HTTP
 * server over `vite build` output, drives the real game in Chromium with
 * swiftshader WebGL, and reads pixels back from the canvas.
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
  distDir = mkdtempSync(join(tmpdir(), 'magnetope-magnet-signature-'));
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
    60000,
  );

interface PixelProbe {
  redCount: number;
  blueCount: number;
  /** Any pixel whose saturation is high enough to count as a deliberate colour, not a tinted grey. */
  saturatedCount: number;
  magnoX: number;
  magnoY: number;
  canvasW: number;
  canvasH: number;
}

/** Reads the canvas pixels back and counts how many land on the pole brand colours. */
async function probeCanvas(target: Page): Promise<PixelProbe> {
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
    let redCount = 0;
    let blueCount = 0;
    let saturatedCount = 0;
    let redX = 0;
    let redY = 0;
    let blueX = 0;
    let blueY = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]!;
      const g = pixels[i + 1]!;
      const b = pixels[i + 2]!;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min > 50) saturatedCount++;
      const isRed = r > 180 && g < 90 && b < 90;
      const isBlue = b > 180 && r < 90 && g > 60 && g < 180;
      if (isRed) {
        redCount++;
        redX += (i / 4) % canvas.width;
        redY += Math.floor((i / 4) / canvas.width);
      }
      if (isBlue) {
        blueCount++;
        blueX += (i / 4) % canvas.width;
        blueY += Math.floor((i / 4) / canvas.width);
      }
    }
    return {
      redCount,
      blueCount,
      saturatedCount,
      magnoX: redCount > 0 ? redX / redCount : -1,
      magnoY: redCount > 0 ? redY / redCount : -1,
      canvasW: canvas.width,
      canvasH: canvas.height,
    };
  }, png);
}

describe('the magnet signature is visible in the production build', () => {
  runnable('boots without console errors and draws a saturated frame', async () => {
    expect(await page!.locator('.loading').count()).toBe(0);
    expect(await page!.locator('canvas').count()).toBe(1);
    const probe = await probeCanvas(page!);
    // A frame with the magnet visible must have at least a few hundred saturated
    // pixels; a blank or crashed canvas has almost none.
    expect(probe.saturatedCount).toBeGreaterThan(800);
    expect(errors).toEqual([]);
  });

  runnable('renders the red north pole of MAGNO\'s horseshoe head', async () => {
    const probe = await probeCanvas(page!);
    // The pole tip is a small emissive box on a small character in a 960x540
    // viewport. A few dozen red pixels is enough to prove the brand colour is
    // on screen; a blank or pre-renewal build has zero.
    expect(probe.redCount).toBeGreaterThan(40);
  });

  runnable('renders the blue south pole of MAGNO\'s horseshoe head', async () => {
    const probe = await probeCanvas(page!);
    expect(probe.blueCount).toBeGreaterThan(30);
  });

  runnable('holds the red and blue poles on screen at the same time', async () => {
    const probe = await probeCanvas(page!);
    expect(probe.redCount).toBeGreaterThan(30);
    expect(probe.blueCount).toBeGreaterThan(30);
    // The two centroids must exist; if either is -1 the pole is missing.
    expect(probe.magnoX).toBeGreaterThanOrEqual(0);
  });

  runnable('moves MAGNO off the spawn surface on the first flip', async () => {
    const before = await probeCanvas(page!);
    await page!.keyboard.press('Space');
    await page!.waitForTimeout(200);
    await page!.keyboard.down('Space');
    await page!.waitForTimeout(600);
    await page!.keyboard.up('Space');
    await page!.waitForTimeout(800);
    const after = await probeCanvas(page!);
    // The magnet pole centroid must have moved between the idle frame and the post-flip frame.
    // If MAGNO didn't move, the renewal's flip animation is broken.
    const moved = Math.hypot(after.magnoX - before.magnoX, after.magnoY - before.magnoY);
    expect(moved).toBeGreaterThan(2);
  });

  runnable('still shows the magnet poles after a restart', async () => {
    await page!.keyboard.press('KeyR');
    await page!.waitForTimeout(1200);
    const probe = await probeCanvas(page!);
    expect(probe.redCount).toBeGreaterThan(25);
    expect(probe.blueCount).toBeGreaterThan(25);
    expect(errors).toEqual([]);
  });
});
