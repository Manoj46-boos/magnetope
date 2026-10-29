import { createReadStream, statSync } from 'node:fs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * QA capture of the portrait visit (rebuild PRD P-MO-01/P-MO-06). The shipped
 * production build proves what a phone-held-upright player actually receives:
 * the boot frame, the opener's three keys on wall time, a real charge and
 * launch, and the touch affordances at rest (DOM-probed, because pixels lie
 * about opacity). The dev server then holds the clock for the frame-exact
 * reads the production build cannot give: the establishing keys again, the
 * summit approach shot on the stored route, the landscape chip earned by two
 * failed attempts, and the screen turned mid-climb.
 *
 *   node scripts/qa-portrait-capture.mjs
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
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const problems = [];
const browser = await chromium.launch(LAUNCH);
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `${name}.png`), timeout: 60000 });

// ------------------------------------------- phase A: the shipped build

console.log('phase A: the production build, held portrait');
const dist = await serveStatic(resolve('dist'));

const context = await browser.newContext({ ...PHONE });
const page = await context.newPage();
page.on('pageerror', (e) => problems.push(`A pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/AudioContext encountered an error|Cross-Origin-Opener-Policy/.test(m.text())) problems.push(`A console: ${m.text()}`);
});
await page.goto(dist.origin);
await page.waitForSelector('.loading', { state: 'detached', timeout: 60000 });
await page.waitForTimeout(900);
await shot(page, 'p01-portrait-first-frame');
// The opener runs on wall time while the first frames compile under
// swiftshader, so the keys get margins the way the opener capture gives them.
await page.waitForTimeout(900);
await shot(page, 'p02-portrait-vista-window');
await page.waitForTimeout(1200);
await shot(page, 'p03-portrait-settled');
const rest = await page.evaluate(() => ({
  fatal: Boolean(document.querySelector('.fatal')),
  touchOpacity: getComputedStyle(document.querySelector('.touch')).opacity,
  flipDisplayed: getComputedStyle(document.querySelector('.flip-btn')).display,
  stickDisplayed: getComputedStyle(document.querySelector('.stick-ring')).display,
}));
console.log(`  portrait rest: ${JSON.stringify(rest)}`);

await page.keyboard.down('Space');
await page.waitForTimeout(1600);
await shot(page, 'p04-portrait-charge');
await page.keyboard.up('Space');
await page.waitForTimeout(900);
await shot(page, 'p05-portrait-flight');
const flying = await page.evaluate(() => Boolean(window.__game) && window.__game !== undefined);
console.log(`  launch by real input on the shipped build: ${flying ? 'input taken' : 'no handle (production)'}`);
await context.close();
dist.server.close();

// --------------------------------------- phase B: the dev server, exact frames

console.log('phase B: the dev server, frame-exact portrait');
const { createServer: createViteServer } = await import('vite');
const vite = await createViteServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } });
await vite.listen();
const devOrigin = vite.resolvedUrls.local[0];

const devContext = await browser.newContext({ ...PHONE });
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

const frame = () =>
  devPage.evaluate(() => {
    const game = window.__game;
    const renderer = game.debug.renderer;
    const sim = game.debug.sim;
    const pos = sim.magno.view.position;
    const a = renderer.project(pos.x - 0.3, pos.y);
    const b = renderer.project(pos.x + 0.3, pos.y);
    const c = renderer.project(pos.x, pos.y);
    const summit = renderer.project(sim.level.summit.x, sim.level.summit.y);
    return {
      level: sim.level.id,
      magnoWidthShare: Number(((b.x - a.x) / window.innerWidth).toFixed(3)),
      magnoFromBottom: Number((1 - c.y / window.innerHeight).toFixed(3)),
      summitFromBottom: Number((1 - summit.y / window.innerHeight).toFixed(3)),
    };
  });

// The establishing keys, frame-exact: 15 frames the hero hold, 95 the vista,
// 150 the settle — the same keyframes the opener capture holds, in portrait.
await advance(0.25);
await shot(devPage, 'p06-portrait-hero-key');
await advance(1.333);
await shot(devPage, 'p07-portrait-vista-key');
console.log(`  vista key: ${JSON.stringify(await frame())}`);
await advance(0.917);
await shot(devPage, 'p08-portrait-home-key');
console.log(`  home key: ${JSON.stringify(await frame())}`);

// The summit approach shot: the stored route plays the level for real, and the
// camera holds the summit in the upper third as MAGNO closes on it.
const route = JSON.parse(readFileSync(resolve('src/levels/routes/scrapyard-00.json'), 'utf8'));
await devPage.evaluate((r) => {
  const game = window.__game;
  game.startLevel('scrapyard-00');
  game.debug.autoplay(r);
}, route);
const approach = await devPage.evaluate(() => {
  const game = window.__game;
  const frames = Math.round(40 * 60);
  for (let i = 0; i < frames; i++) {
    game.debug.advance(1 / 60);
    const sim = game.debug.sim;
    const gap = sim.level.summit.y - sim.magno.view.position.y;
    if (gap < 6 && sim.magno.view.state === 'attached') return i / 60;
  }
  return -1;
});
if (approach < 0) {
  problems.push('B: the route never brought MAGNO within the approach window');
} else {
  await advance(0.5);
  await shot(devPage, 'p09-portrait-summit-approach');
  console.log(`  summit approach at ${approach.toFixed(2)} s: ${JSON.stringify(await frame())}`);
}

// The landscape chip, earned the way a player earns it: two failed attempts at
// a wide metropolis climb, held portrait.
await devPage.evaluate(() => window.__game.startLevel('metropolis-01'));
await advance(0.5);
for (let i = 0; i < 2; i++) {
  await devPage.keyboard.press('KeyR');
  await advance(0.5);
}
const chip = await devPage.evaluate(() => ({
  shown: document.querySelector('.landscape-chip')?.classList.contains('show') ?? false,
  text: document.querySelector('.landscape-chip p')?.textContent ?? '',
}));
await shot(devPage, 'p10-portrait-landscape-chip');
console.log(`  chip after two failed attempts: ${JSON.stringify(chip)}`);
if (!chip.shown) problems.push('B: the landscape chip never came out');

// The screen turns mid-climb: the follow re-settles into the landscape framing,
// and the chip retires with its own fade — the wall wait lets both land.
await devPage.setViewportSize({ width: 844, height: 390 });
await devPage.waitForTimeout(500);
await advance(2);
await shot(devPage, 'p11-turned-landscape');
console.log(`  turned landscape: ${JSON.stringify(await frame())}`);
const retired = await devPage.evaluate(() => ({
  chipShown: document.querySelector('.landscape-chip')?.classList.contains('show') ?? false,
  chipOpacity: getComputedStyle(document.querySelector('.landscape-chip')).opacity,
}));
console.log(`  chip after the turn: ${JSON.stringify(retired)}`);
if (retired.chipShown || retired.chipOpacity !== '0') problems.push('B: the chip did not retire when the screen turned');

await devContext.close();
await browser.close();
await vite.close();

console.log(problems.length ? `PROBLEMS:\n  ${problems.join('\n  ')}` : 'no page errors');
console.log(`captures in ${OUT}`);
