import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * The W16 play gate: plays the production build the way a person does, rides a
 * real fail-repeat streak, and hands the week's export to the Friday report —
 * the whole funnel-ops loop (play, trail, detector, action) proven on one
 * session instead of a fixture. With a URL argument it plays the live project
 * page instead, SDK and all, and proves the deployment the player meets.
 *
 *   node scripts/qa-w16-capture.mjs                 # the local dist
 *   node scripts/qa-w16-capture.mjs https://...     # the live page
 *
 * Then: npm run friday -- download/w16-capture/export.jsonl --out=download/w16-capture
 */

const live = process.argv[2];
const OUT = resolve('download/w16-capture');
mkdirSync(OUT, { recursive: true });

let origin = live;
let server;
if (!live) {
  const dist = resolve('dist');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.woff2': 'font/woff2' };
  server = createServer((req, res) => {
    const path = req.url?.split('?')[0] ?? '/';
    const file = join(dist, path === '/' ? 'index.html' : path);
    if (!file.startsWith(dist) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}/`;
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1031, height: 580 } });
if (!live) {
  // the local leg keeps its own measure channel, the way the friday capture does
  await context.route('**/game-cdn.poki.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await context.addInitScript(() => {
    window.__measured = [];
    const lawful = (category, what, action) =>
      [category, what, action].every((part) => !/[^A-Za-z0-9_: .+|-]/.test(part)) &&
      `${category} ${what} ${action}`.split(/\d+|\{n\}/i).length - 1 <= 2;
    window.PokiSDK = {
      init: async () => {},
      gameLoadingFinished() {},
      gameplayStart() {},
      gameplayStop() {},
      commercialBreak: async () => {},
      rewardedBreak: async () => true,
      getLanguage: () => 'en',
      measure(category, what, action) {
        if (lawful(category, what, action)) window.__measured.push({ category, what, action });
      },
    };
  });
}

const page = await context.newPage();
const problems = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  const text = message.text();
  // headless Chrome has no sound card; plain HTTP localhost ignores the COOP header the SDK sets. Both are the machine, not the game.
  if (message.type() === 'error' && !/AudioContext encountered an error from the audio device/.test(text) && !/Cross-Origin-Opener-Policy/.test(text)) problems.push(text);
});

await page.goto(origin);
await page.waitForSelector('#view', { timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: resolve(OUT, '01-arrived.png') });

// Real input, the way a person plays: hold to charge, release to launch, aim with the mouse.
const canvas = page.locator('#view');
for (let attempt = 0; attempt < 4; attempt++) {
  const x = 300 + attempt * 60;
  await page.mouse.move(x, 260);
  await canvas.click({ trial: true });
  await page.mouse.down();
  await page.waitForTimeout(500);
  if (attempt === 1) await page.screenshot({ path: resolve(OUT, '02-charge.png') });
  await page.mouse.up();
  await page.waitForTimeout(1600);
  if (attempt === 1) await page.screenshot({ path: resolve(OUT, '03-flight.png') });
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(900);
}

// A real fail-repeat streak: five restarts in a row at one level, the exact
// trail the stuck law exists to read (four is the line; five is a loop).
for (let retry = 0; retry < 5; retry++) {
  await page.keyboard.press('r');
  await page.waitForTimeout(900);
}

// The pause glass, then the natural stop that flushes the queue.
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(OUT, '04-pause.png') });
await page.locator('.modal.open [data-i18n="quitToMap"]').click({ timeout: 10000 });
await page.waitForSelector('.map-frame', { timeout: 10000 });
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(OUT, '05-map.png') });

let restarts = 0;
if (!live) {
  const measured = await page.evaluate(() => window.__measured);
  writeFileSync(resolve(OUT, 'export.jsonl'), measured.map((record) => JSON.stringify(record)).join('\n') + '\n');
  restarts = measured.filter((record) => record.category === 'attempt' && record.action === 'restart').length;
}

await browser.close();
server?.close();

console.log(`played ${live ?? 'the production dist'}: five frames in ${OUT}, ${problems.length === 0 ? 'zero page errors' : `${problems.length} problem(s)`}`);
if (!live) console.log(`the session flushed ${restarts} restart records: the stuck read should find the streak the five R-presses rode`);
if (problems.length) {
  for (const problem of problems) console.log(`- ${problem}`);
  process.exitCode = 1;
}
