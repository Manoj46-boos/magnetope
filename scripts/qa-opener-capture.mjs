import { createReadStream, statSync } from 'node:fs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * QA capture of the opener as a player meets it. The production Poki build
 * proves the shipped artifact: boot health, the touch affordance at rest (with
 * a DOM probe, because pixels lie about opacity), and the tutorial hand on the
 * real loop. Everything frame-critical is captured on the dev server with the
 * clock held, which freezes the world between advances: the hero portrait, the
 * vista, the settle, each idle-ladder rung, the first-catch beat with its flash
 * still on the frame, and a biome entry.
 *
 *   node scripts/qa-opener-capture.mjs
 */

const OUT = resolve('qa-captures');
mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

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
const problems = [];
const browser = await chromium.launch(LAUNCH);
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `${name}.png`), timeout: 60000 });

// ------------------------------------------------ phase A: the shipped build

console.log('phase A: the production Poki build');
const dist = await serveStatic(resolve('dist'));

const touchContext = await browser.newContext({ viewport: { width: 480, height: 270 }, hasTouch: true, isMobile: true });
const touchPage = await touchContext.newPage();
touchPage.on('pageerror', (e) => problems.push(`A-touch pageerror: ${e.message}`));
await touchPage.goto(dist.origin);
await touchPage.waitForSelector('.loading', { state: 'detached', timeout: 60000 });
await touchPage.waitForTimeout(1500);
const touchProbe = await touchPage.evaluate(() => ({
  touchOpacity: getComputedStyle(document.querySelector('.touch')).opacity,
  flipBtnDisplayed: getComputedStyle(document.querySelector('.flip-btn')).display,
  stickRingDisplayed: getComputedStyle(document.querySelector('.stick-ring')).display,
  hudOpacity: getComputedStyle(document.querySelector('.hud')).opacity,
  coachShown: Boolean(document.querySelector('.coach.show')),
}));
await shot(touchPage, '01-mobile-touch-rest');
console.log(`  touch at rest: ${JSON.stringify(touchProbe)}`);
await touchContext.close();

const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
page.on('pageerror', (e) => problems.push(`A pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/AudioContext encountered an error|Cross-Origin-Opener-Policy/.test(m.text())) problems.push(`A console: ${m.text()}`);
});
await page.goto(dist.origin);
await page.waitForSelector('.loading', { state: 'detached', timeout: 60000 });
const boot = await page.evaluate(() => ({ fatal: Boolean(document.querySelector('.fatal')), canvas: Boolean(document.getElementById('view')), playable: performance.getEntriesByName('magnetope:playable').length }));
console.log(`  boot state: ${JSON.stringify(boot)}`);
// Wall clock runs ahead of game time while the first frames compile under
// swiftshader, so the hand rung gets a generous margin: 6 s wall is at least
// 4 s of game time on this machine.
await page.waitForTimeout(6000);
const handProbe = await page.evaluate(() => ({ coachShown: Boolean(document.querySelector('.coach.show')), cue: document.querySelector('.coach-stage')?.dataset.cue ?? '' }));
await shot(page, '02-hand-rung');
console.log(`  tutorial hand on the shipped build: ${JSON.stringify(handProbe)}`);
await context.close();
dist.server.close();

// ------------------------------------------------- phase B: the exact frames

console.log('phase B: the dev server, frame-exact shots');
const { createServer: createViteServer } = await import('vite');
const vite = await createViteServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } });
await vite.listen();
const devOrigin = vite.resolvedUrls.local[0];

const devContext = await browser.newContext({ viewport: { width: 960, height: 540 } });
const devPage = await devContext.newPage();
devPage.on('pageerror', (e) => problems.push(`B pageerror: ${e.message}`));
await devPage.goto(devOrigin);
await devPage.waitForFunction(() => Boolean(window.__game), null, { timeout: 60000 });
await devPage.evaluate(() => window.__game.debug.holdClock(true));

const advance = (seconds) =>
  devPage.evaluate((s) => {
    const game = window.__game;
    for (let i = 0; i < Math.round(s * 60); i++) game.debug.advance(1 / 60);
  }, seconds);

// The boot level is scrapyard-00 with a fresh save, so the establishing move
// runs from game time zero: 15 frames = the hero hold, 95 = the vista hold,
// 150 = the settle, then the ladder rungs at 3.3 s, 8.05 s and 16.0 s.
await advance(0.25);
await shot(devPage, '03-boot-hero');
await advance(1.333);
await shot(devPage, '04-vista-reveal');
await advance(0.917);
await shot(devPage, '05-home-framing');
await advance(0.8);
await shot(devPage, '06-hand-rung');
await advance(4.75);
await shot(devPage, '07-hop-rung');
await advance(7.95);
await shot(devPage, '08-goal-pan');
console.log('  opening move and idle ladder captured on their keyframes');

const route = JSON.parse(readFileSync(resolve('src/levels/routes/scrapyard-00.json'), 'utf8'));
await devPage.evaluate((r) => {
  const game = window.__game;
  game.startLevel('scrapyard-00');
  game.debug.autoplay(r);
}, route);
const caught = await devPage.evaluate(() => {
  const game = window.__game;
  const frames = Math.round(40 * 60);
  for (let i = 0; i < frames; i++) {
    game.debug.advance(1 / 60);
    if (game.debug.openerLog.some((e) => e.startsWith('first-catch@'))) return i / 60;
  }
  return -1;
});
if (caught < 0) {
  problems.push('B: the first-catch beat never fired on the route');
} else {
  // Two frames in, the flash is still on the frame and the clock is held, so
  // the screenshot freezes the beat exactly as the player first sees it.
  await advance(2 / 60);
  await shot(devPage, '09-first-catch-beat');
  console.log(`  first catch at ${caught.toFixed(2)} s, beat captured with its flash live`);
}

await devPage.evaluate(() => window.__game.startLevel('suburbia-01'));
await advance(0.25);
await shot(devPage, '10-suburbia-entry');
console.log('  suburbia establishing shot captured on its keyframe');

console.log(`  opener log: ${(await devPage.evaluate(() => window.__game.debug.openerLog)).join(', ')}`);
await devContext.close();
await browser.close();
await vite.close();

console.log(problems.length ? `PROBLEMS:\n  ${problems.join('\n  ')}` : 'no page errors');
console.log(`captures in ${OUT}`);
