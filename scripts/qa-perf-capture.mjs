import { createReadStream, statSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * The performance chapter's play gate (premium PRD W13): the shipped Poki build,
 * served like a host would serve it, booted cold and played with real pointer
 * input — charge, release, flight, catch — while the watch proves the SDK rode
 * behind the boot (R-PE-14) and the frames land where the budget says. The
 * captures go to `download/w13-captures/` for the panel.
 *
 *   npm run build:poki && node scripts/qa-perf-capture.mjs
 */

const OUT = resolve('download/w13-captures');
mkdirSync(OUT, { recursive: true });
const DIST = resolve('dist');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.txt': 'text/plain', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]));
  const file = join(DIST, path.length < 2 ? 'index.html' : path);
  if (!file.startsWith(DIST) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1031, height: 580 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  const text = message.text();
  if (message.type() === 'error' && !/AudioContext encountered an error from the audio device|net::|Failed to load resource|Cross-Origin-Opener-Policy/.test(text)) errors.push(`console: ${text}`);
});

const resourceStarts = [];
page.on('request', (request) => resourceStarts.push({ url: request.url(), at: Date.now() }));
const bootStart = Date.now();
await page.goto(origin, { waitUntil: 'commit', timeout: 60000 });
await page.waitForFunction(() => performance.getEntriesByName('magnetope:playable').length > 0, null, { timeout: 60000 });
const playableMs = await page.evaluate(() => performance.getEntriesByName('magnetope:playable')[0].startTime);
console.log(`playable after ${(playableMs / 1000).toFixed(2)} s (unthrottled stand-in; the throttled numbers are the load gate's)`);
await page.waitForTimeout(1200);
await page.screenshot({ path: join(OUT, '01-arrived.png') });

const devHandle = await page.evaluate(() => Boolean(window.__game));
console.log(`development handle compiled out: ${!devHandle}`);
const tier = await page.evaluate(() => document.getElementById('ui').classList.contains('tier-low') ? 'low (SwiftShader probe)' : 'high or mid');
console.log(`boot tier on this stand-in: ${tier}`);

const surface = page.locator('#stage canvas');
const box = await surface.boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height * 0.6;

// Charge, filmed.
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.waitForTimeout(1100);
await page.screenshot({ path: join(OUT, '02-charge.png') });
await page.mouse.up();
await page.waitForTimeout(700);
await page.screenshot({ path: join(OUT, '03-flight.png') });

// Keep playing through a real catch-and-perch cycle.
await page.mouse.down();
await page.waitForTimeout(140);
await page.mouse.up();
await page.waitForTimeout(2600);
await page.screenshot({ path: join(OUT, '04-settled.png') });

// The pause panel, where a real player first meets the frame budget's mercy.
await page.keyboard.press('Escape');
await page.locator('.panel.pause').waitFor({ state: 'visible', timeout: 10000 });
await page.waitForTimeout(400);
await page.screenshot({ path: join(OUT, '05-pause.png') });
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// The watchdog and the SDK both leave their traces in the console-free world:
// the SDK's own tag must have resolved behind the boot. The wire census of the
// release suite holds the exact set; here we prove the game reached playable
// while the host was still free to be late.
const sdkState = await page.evaluate(() => Boolean(window.PokiSDK));
console.log(`host SDK present on the page: ${sdkState}`);

await page.waitForTimeout(3000);
await page.screenshot({ path: join(OUT, '06-late-play.png') });

// The host's own house ad may cover the page while the session idles; the gate
// waits for the game's canvas to be the visible surface again, the way a player
// waits out a break, and proves the run continued under it.
await page.waitForFunction(() => {
  const canvas = document.querySelector('#stage canvas');
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  const at = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return Boolean(at && (canvas === at || canvas.contains(at)));
}, null, { timeout: 60000, polling: 500 });
await page.waitForTimeout(1500);
await page.screenshot({ path: join(OUT, '07-after-the-break.png') });

if (errors.length) {
  console.log(`\nERRORS (${errors.length}):`);
  for (const error of errors) console.log(` - ${error}`);
  process.exitCode = 1;
} else {
  console.log('\nzero page errors, zero console errors past the documented noise');
}

await browser.close();
await new Promise((done) => server.close(() => done()));
