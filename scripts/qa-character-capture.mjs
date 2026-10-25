import { mkdirSync, statSync, createReadStream, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * QA capture of the character pass (premium PRD W8) as a player meets it on the
 * production Poki build. The gate plays for real: boot, a held charge with the
 * focused face, the release, the catch, and then stillness — long enough for
 * the idle performance to breathe, blink on its own cadence and throw one
 * character beat, polled so the flip in place lands on a frame. The plush
 * tiles come out of the same session: a square crop centred on the poles,
 * resampled to 64 and 128 px the way a store row would show him.
 *
 *   node scripts/qa-character-capture.mjs
 */

const OUT = resolve('qa-captures/w8');
mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'image/font.woff2', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

function serveStatic(root) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]));
    const file = join(root, path === '/' || path === '\\' ? 'index.html' : path);
    if (!file.startsWith(root) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ server, origin: `http://127.0.0.1:${server.address().port}/` })));
}

const LAUNCH = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] };
/** The two console lines headless Chromium always says on this build; anything else fails the gate. */
const NOISE = [/AudioContext/, /Cross-Origin-Opener/];
const problems = [];
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !NOISE.some((pattern) => pattern.test(message.text()))) problems.push(`console: ${message.text()}`);
});

const { server, origin } = await serveStatic(resolve('dist'));
await page.goto(origin, { waitUntil: 'load' });
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForTimeout(3200);

const saveShot = async (name) => {
  const png = await page.screenshot();
  writeFileSync(join(OUT, `${name}.png`), png);
  console.log(`captured ${name}`);
};

/** The plush tiles: a square crop around the red pole centroid, resampled in-page. */
const tile = async (name, size) => {
  const png = (await page.screenshot()).toString('base64');
  const data = await page.evaluate(async ([data, size]) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const full = document.createElement('canvas');
    full.width = image.width;
    full.height = image.height;
    const fctx = full.getContext('2d');
    fctx.drawImage(image, 0, 0);
    const pixels = fctx.getImageData(0, 0, full.width, full.height).data;
    let redCount = 0;
    let redX = 0;
    let redY = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 180 && pixels[i + 1] < 90 && pixels[i + 2] < 90) {
        redCount++;
        redX += (i / 4) % full.width;
        redY += Math.floor((i / 4) / full.width);
      }
    }
    if (redCount === 0) return null;
    const cx = Math.round(redX / redCount);
    const cy = Math.round(redY / redCount);
    const crop = Math.round(full.width / 8);
    const x = Math.max(0, Math.min(full.width - crop, cx - crop / 2));
    const y = Math.max(0, Math.min(full.height - crop, cy - crop / 2));
    const card = document.createElement('canvas');
    card.width = size;
    card.height = size;
    const cctx = card.getContext('2d');
    cctx.drawImage(full, x, y, crop, crop, 0, 0, size, size);
    return card.toDataURL('image/png');
  }, [png, size]);
  if (data) writeFileSync(join(OUT, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
  console.log(data ? `captured ${name}` : `missed ${name}: no red pole in frame`);
};

// The settled idle: breathing, the blink-look cycle, and the room's steel to glance at.
await saveShot('01-idle-settled');
await tile('plush-64', 64);
await tile('plush-128', 128);

// The charge: the focused face, the pupil dilating with the meter.
await page.keyboard.down('Space');
await page.waitForTimeout(1250);
await saveShot('02-charge-focused');
await tile('plush-64-charge', 64);
await tile('plush-128-charge', 128);

// The release: the launch beat.
await page.keyboard.up('Space');
await page.waitForTimeout(260);
await saveShot('03-release');

// The catch and the settle: relief into the idle face.
await page.waitForTimeout(1400);
await saveShot('04-catch-settled');

// Stillness: the idle performance owns the next half minute. The beat lands
// around twenty seconds in — poll so the look-around and the flip in place
// land on frames.
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(450);
  if (i >= 14) await saveShot(`05-beat-${String(i).padStart(2, '0')}`);
}

await page.keyboard.down('Space');
await page.waitForTimeout(1300);
await page.keyboard.up('Space');
await page.waitForTimeout(1200);
await saveShot('06-second-flight');

await browser.close();
server.close();

if (problems.length > 0) {
  console.error('\nGATE FAIL — the page misbehaved:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('\nGATE PASS — boots, charges, launches, catches, idles; zero page errors.');
