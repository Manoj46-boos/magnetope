import { execFileSync } from 'node:child_process';
import { createReadStream, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isHeadlessAudioNoise, launchBrowser } from './browser/harness';

/**
 * The production bundle, served the way a locked-down host would serve it: a
 * strict content security policy and no network beyond its own origin. This is
 * the "CSP-simulated sandbox run" of the Poki checklist (PRD 14.1).
 */

const root = resolve(__dirname, '..');
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };

/** Scripts only from the page itself (plus WebAssembly compilation for the physics engine); nothing else may load. */
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
const violations: string[] = [];
const errors: string[] = [];
const requests: string[] = [];
const failures: string[] = [];

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  distDir = mkdtempSync(join(tmpdir(), 'magnetope-release-'));
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

  context = await browser.newContext({ viewport: { width: 640, height: 360 } });
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __violations: string[] }).__violations ??= [];
      (window as unknown as { __violations: string[] }).__violations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) errors.push(m.text());
  });
  page.on('request', (r) => requests.push(r.url()));
  page.on('requestfailed', (r) => failures.push(r.url()));
  await page.goto(origin);
  await page.waitForSelector('.loading', { state: 'detached', timeout: 30000 }).catch(() => undefined);
}, 180000);

afterAll(async () => {
  violations.push(...((await page?.evaluate(() => (window as unknown as { __violations?: string[] }).__violations ?? []).catch(() => [])) ?? []));
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

/** Counts distinct colours on screen, decoded in the browser: a blank or crashed canvas has almost none. */
async function distinctColours(target: Page): Promise<number> {
  const png = (await target.screenshot()).toString('base64');
  return target.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0, 160, 90);
    const pixels = ctx.getImageData(0, 0, 160, 90).data;
    const seen = new Set<number>();
    for (let i = 0; i < pixels.length; i += 4) seen.add(((pixels[i]! >> 3) << 10) | ((pixels[i + 1]! >> 3) << 5) | (pixels[i + 2]! >> 3));
    return seen.size;
  }, png);
}

describe('the production bundle under a strict content security policy', () => {
  runnable('boots, drops its loading screen and draws a scene', async () => {
    expect(await page!.locator('.loading').count()).toBe(0);
    expect(await page!.locator('canvas').count()).toBe(1);
    expect(await distinctColours(page!)).toBeGreaterThan(40);
  });

  runnable('serves its own rounded font, so the text looks the same on every device', async () => {
    const loaded = await page!.evaluate(async () => {
      await document.fonts.load("600 16px Fredoka");
      return document.fonts.check("600 16px Fredoka");
    });
    expect(loaded).toBe(true);
    expect(requests.some((url) => url.endsWith('fredoka-latin.woff2'))).toBe(true);
    expect(requests.filter((url) => !url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'))).toEqual([]);
  });

  runnable('pauses on Escape and resumes on Escape in the shipped build', async () => {
    await page!.keyboard.press('Space');
    await page!.waitForTimeout(600);
    await page!.keyboard.press('Escape');
    await page!.waitForSelector('.modal.open', { timeout: 5000 });
    await page!.keyboard.press('Escape');
    await page!.waitForSelector('.modal.open', { state: 'detached', timeout: 5000 });
  });

  runnable('keeps running with the network cut', async () => {
    await context!.setOffline(true);
    try {
      await page!.keyboard.press('Space');
      await page!.waitForTimeout(800);
      expect(await distinctColours(page!)).toBeGreaterThan(40);
    } finally {
      await context!.setOffline(false);
    }
  });

  runnable('has no outbound links and exposes no development handle', async () => {
    expect(await page!.locator('a[href^="http"]').count()).toBe(0);
    expect(await page!.evaluate(() => (window as unknown as { __game?: { debug: unknown } }).__game?.debug ?? null)).toBeNull();
  });

  runnable('made only same-origin requests, with no violation, failure or error', async () => {
    const foreign = requests.filter((url) => !url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'));
    const blocked = await page!.evaluate(() => (window as unknown as { __violations?: string[] }).__violations ?? []);
    expect(foreign).toEqual([]);
    expect(blocked).toEqual([]);
    expect(failures).toEqual([]);
    expect(errors).toEqual([]);
    expect(violations).toEqual([]);
  });
});
