import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium, type Browser } from 'playwright';

/**
 * Cold-load time of a production build on a throttled device (PRD 10.3, 14.3): from navigation start
 * until the loading screen has gone and the first level is built, which the game marks as
 * `magnetope:playable`. The build is served gzipped, the way a CDN would, with caching off, and the
 * browser is slowed through the DevTools protocol.
 *
 * Software rendering (SwiftShader) stands in for the GPU, so shader compilation is slower than on a
 * phone; download, decode and start-up are a fair stand-in.
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

/** Serves `dist` with gzip on the text and wasm files; returns the origin and a way to stop. */
export async function serveGzipped(dist: string): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!));
    const file = join(dist, path.length < 2 ? 'index.html' : path);
    if (!file.startsWith(dist) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    const type = MIME[extname(file)] ?? 'application/octet-stream';
    if (COMPRESSIBLE.has(extname(file))) {
      res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', 'cache-control': 'no-store' }).end(gzipSync(readFileSync(file)));
    } else {
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      createReadStream(file).pipe(res);
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as { port: number };
  return { origin: `http://127.0.0.1:${port}/`, close: () => new Promise<void>((done) => server.close(() => done())) };
}

export const launchThrottleBrowser = (): Promise<Browser> =>
  chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });

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
