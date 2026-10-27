// W15 craft-signature capture (premium PRD R-CM-05): the five moments no template
// produces, photographed off the shipped game for the review minute. Three frames
// come from the production Poki dist played by real input — the arrived biome's
// colour script, the first launch's landing beat, the junk orchestra's flight.
// The other two are staged on the dev server, where the development handle can
// reach what a fresh visit cannot: a fall (the tutorial's on-ramp catches every
// drop by design, R-ON-03, so the comedy's card is staged the same way the
// ad-block suite stages it) and the ending, seventy levels deep. The frames are
// still the shipped code's own. Captures land in download/w15-captures.
//
//   npm run build:poki && node scripts/qa-signature-capture.mjs
//   (the dev leg expects `npm run dev` on http://localhost:5173)
import { createReadStream, statSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const OUT = resolve('download/w15-captures');
mkdirSync(OUT, { recursive: true });
const DIST = resolve('dist');
const DEV = 'http://localhost:5173';

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
const problems = [];

// ---- leg 1: the production build, played by hand -------------------------------------------

const page = await browser.newPage({ viewport: { width: 1031, height: 580 } });
page.on('pageerror', (e) => problems.push(`dist pageerror: ${e.message}`));
page.on('console', (m) => {
  const text = m.text();
  if (m.type() === 'error' && !/AudioContext encountered an error from the audio device|net::|Failed to load resource|Cross-Origin-Opener-Policy/.test(text)) problems.push(`dist console: ${text}`);
});

await page.goto(origin, { waitUntil: 'commit', timeout: 60000 });
await page.waitForFunction(() => performance.getEntriesByName('magnetope:playable').length > 0, null, { timeout: 60000 });
const playableMs = await page.evaluate(() => performance.getEntriesByName('magnetope:playable')[0].startTime);
console.log(`dist playable after ${(playableMs / 1000).toFixed(2)} s`);

// The opener hands the controls over on the first real input; let its establishing
// move settle onto the start perch first, then hold the arrived frame — the biome's
// own palette, grade and fog, before anything moves.
await page.waitForTimeout(4200);
await page.screenshot({ path: join(OUT, '01-colour-script.png') });
console.log('  01 the arrived biome (colour script, R-AR-05)');

// The first full-charge launch (R-SM-01): charge, the release's Nijman stack, and
// the slow-mo landing the camera settles onto MAGNO's blink inside.
const surface = page.locator('#stage canvas');
const box = await surface.boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height * 0.6;
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.waitForTimeout(1100);
await page.mouse.up();
await page.waitForTimeout(1150);
await page.screenshot({ path: join(OUT, '02-first-launch.png') });
console.log('  02 the first launch landing beat (R-SM-01)');
await page.waitForTimeout(1800);

// The junk orchestra (R-AU-04) is heard, not seen — its instruments are the world's
// own junk, and its ten-track blind-listen pack is the audio evidence. The frame
// here is the moment it plays loudest: a full-power release with its burst still
// live, the Scrapyard's orchestra pit spread below the flight.
await page.mouse.down();
await page.waitForTimeout(1150);
await page.mouse.up();
await page.waitForTimeout(420);
await page.screenshot({ path: join(OUT, '03-junk-orchestra.png') });
console.log('  03 the orchestra in full swing (R-AU-04)');
await page.waitForTimeout(600);
await page.close();

// ---- leg 2: the dev server, where the fall and the ending are reachable ---------------------

let devUp = true;
try {
  await fetch(DEV, { method: 'HEAD' });
} catch {
  devUp = false;
  problems.push(`dev server not reachable at ${DEV} — run \`npm run dev\` and re-run for the ending frame`);
}
if (devUp) {
  const devPage = await browser.newPage({ viewport: { width: 1031, height: 580 } });
  devPage.on('pageerror', (e) => problems.push(`dev pageerror: ${e.message}`));
  await devPage.goto(DEV, { waitUntil: 'commit', timeout: 60000 });
  await devPage.waitForFunction(() => {
    const game = window.__game;
    return game && game.debug && game.debug.sim;
  }, null, { timeout: 60000 });

  // The fall-grade comedy (R-GF-07): the same staging the ad-block suite uses —
  // the body is placed high and the simulation is stepped idle until the fall
  // resolves, so the card opens on a real thirty-metre tumble through the junk.
  await devPage.evaluate(() => {
    const game = window.__game;
    const sim = game.debug.sim;
    const body = sim.physics.magnoBody;
    const before = sim.run.fallCount;
    body.setTranslation({ x: 2.6, y: 30, z: 0 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    const idle = { tiltX: 0, tiltY: 0, flipHeld: false, flipDown: false, flipUp: false };
    for (let i = 0; i < 1500 && sim.run.fallCount === before; i++) sim.step(idle);
  });
  await devPage.waitForSelector('.fall-card.open', { timeout: 10000 });
  await devPage.screenshot({ path: join(OUT, '04-fall-grade-comedy.png') });
  console.log('  04 the fall card mid-grade (R-GF-07)');
  await devPage.locator('.fall-card .actions .btn').first().click();
  await devPage.waitForTimeout(700);

  // The wordless ending (R-SM-05): the film runs sixty seconds and its credits
  // beat — the wordmark card with the thank-you, no other words — lands in the
  // last span (48-60 s, visible once the credits fade passes half). The clock is
  // held and advanced there so the frame is the card, not a wait.
  await devPage.evaluate(() => window.__game.debug.beginEnding());
  await devPage.waitForTimeout(1200);
  await devPage.evaluate(() => {
    const game = window.__game;
    game.debug.holdClock(true);
    // Fast-forward the film's own clock without rendering a frame of it; one
    // rendered tick at the credits then paints the wordmark card whole.
    const director = game.debug.ending();
    for (let i = 0; i < Math.round(55.5 * 60); i++) director.update(1 / 60);
    game.debug.advance(1 / 60);
  });
  await devPage.waitForTimeout(500);
  await devPage.screenshot({ path: join(OUT, '05-wordless-ending.png'), timeout: 60000 });
  console.log('  05 the wordless ending (R-SM-05)');
  await devPage.close();
}

if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`);
  for (const p of problems) console.log(` - ${p}`);
  process.exitCode = 1;
} else {
  console.log('\nfive signature frames captured, zero page errors');
}

await browser.close();
await new Promise((done) => server.close(() => done()));
