import { createReadStream, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { chromium, type Browser } from 'playwright';

/**
 * Cold-load time of a production build on a throttled device (PRD 10.3, 14.3): from navigation start
 * until the loading screen has gone and the first level is built, which the game marks as
 * `magnetope:playable`. The build is served the way the host's CDN serves it — brotli where the
 * browser accepts it, gzip otherwise, both compressed once at server start so no measurement ever
 * pays for the compressor — with caching off, and the browser is slowed through the DevTools protocol.
 *
 * Software rendering (SwiftShader) stands in for the GPU, so shader compilation is slower than on a
 * phone; download, decode and start-up are a fair stand-in. The published payload budget in
 * check-budget.mjs stays gzipped on purpose: gzip is the conservative number a host could serve.
 */

export interface DeviceProfile {
  name: string;
  /** Main-thread slowdown; 4 is the usual stand-in for a mid-range phone. */
  cpu: number;
  downMbps: number;
  rttMs: number;
}

export const DEVICES = {
  desktop: { name: 'desktop', cpu: 1, downMbps: 100, rttMs: 20 },
  mid: { name: 'mid-range phone on 4G', cpu: 4, downMbps: 9, rttMs: 170 },
  low: { name: 'low-end phone on slow 4G', cpu: 6, downMbps: 1.6, rttMs: 300 },
} as const satisfies Record<string, DeviceProfile>;

export interface ColdLoad {
  /** One time to playable per run, in milliseconds. */
  playableMs: number[];
  /** Bytes on the wire, from the last run. */
  bytes: number;
}

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.wasm']);

/** Everything in `dist` that can be compressed, compressed once, before any request can be timed. */
function precompress(dist: string): Map<string, { br: Buffer; gz: Buffer }> {
  const bodies = new Map<string, { br: Buffer; gz: Buffer }>();
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  for (const file of walk(dist)) {
    if (!COMPRESSIBLE.has(extname(file))) continue;
    const raw = readFileSync(file);
    bodies.set(file, {
      br: brotliCompressSync(raw, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 9 } }),
      gz: gzipSync(raw),
    });
  }
  return bodies;
}

/** Serves `dist` the way a CDN would: brotli where the browser takes it, gzip otherwise. */
export async function serveGzipped(dist: string): Promise<{ origin: string; close: () => Promise<void> }> {
  const bodies = precompress(dist);
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!));
    const file = join(dist, path.length < 2 ? 'index.html' : path);
    if (!file.startsWith(dist) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    const type = MIME[extname(file)] ?? 'application/octet-stream';
    const body = bodies.get(file);
    if (body) {
      const brotli = String(req.headers['accept-encoding'] ?? '').includes('br');
      res
        .writeHead(200, { 'content-type': type, 'content-encoding': brotli ? 'br' : 'gzip', 'cache-control': 'no-store' })
        .end(brotli ? body.br : body.gz);
    } else {
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      createReadStream(file).pipe(res);
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as { port: number };
  return { origin: `http://127.0.0.1:${port}/`, close: () => new Promise<void>((done) => server.close(() => done())) };
}

/** Real Chrome where the machine has it, the bundled Chromium where it does not. */
export async function launchThrottleBrowser(): Promise<Browser> {
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
  try {
    return await chromium.launch({ channel: 'chrome', headless: true, args });
  } catch {
    return await chromium.launch({ headless: true, args });
  }
}

/** Loads the build `runs` times from a cold cache on the given device. */
export async function measureColdLoad(browser: Browser, origin: string, device: DeviceProfile, runs: number): Promise<ColdLoad> {
  const playableMs: number[] = [];
  let bytes = 0;
  for (let i = 0; i < runs; i++) {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const bytesPerSecond = (device.downMbps * 1_000_000) / 8;
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: device.rttMs, downloadThroughput: bytesPerSecond, uploadThroughput: bytesPerSecond / 3 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: device.cpu });
    bytes = 0;
    cdp.on('Network.loadingFinished', (e: { encodedDataLength: number }) => {
      bytes += e.encodedDataLength;
    });

    await page.goto(origin, { waitUntil: 'commit' });
    await page.waitForFunction(() => performance.getEntriesByName('magnetope:playable').length > 0, null, { timeout: 120_000, polling: 250 });
    playableMs.push(await page.evaluate(() => performance.getEntriesByName('magnetope:playable')[0]!.startTime));
    await context.close();
  }
  return { playableMs, bytes };
}
