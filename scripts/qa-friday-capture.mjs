import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * The W11 play gate: serves the production build the way a host would, injects
 * a measure channel that keeps every record, plays the first level with real
 * pointer and keyboard input — the way a person meets the game — then quits to
 * the map, which is a natural stop, and writes exactly what the queue flushed
 * as a dashboard-style export. Run the Friday report over the result:
 *
 *   node scripts/qa-friday-capture.mjs
 *   npm run friday -- download/friday-capture/export.jsonl --out=download/friday-capture
 */

const dist = resolve('dist');
const OUT = resolve('download/friday-capture');
mkdirSync(OUT, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
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
const origin = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1031, height: 580 } });
await context.route('**/game-cdn.poki.com/**', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }));
await context.addInitScript(() => {
  window.__name = (f) => f;
  window.__measured = [];
  window.__rejected = [];
  // The real SDK's own two laws, applied before the record is kept: the
  // alphabet, and at most two runs of digits across the three arguments.
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
      const record = { category, what, action };
      if (lawful(category, what, action)) window.__measured.push(record);
      else window.__rejected.push(record);
    },
  };
});
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

// Real input, the way a person plays: hold to charge, release to launch, aim
// with the mouse, and take the falls the level gives. A few restarts round out
// the attempt records the way a real player's session does.
const canvas = page.locator('#view');
for (let attempt = 0; attempt < 8; attempt++) {
  const x = 300 + attempt * 60;
  await page.mouse.move(x, 260);
  await canvas.click({ trial: true });
  await page.mouse.down();
  await page.waitForTimeout(500 + attempt * 80);
  await page.mouse.up();
  await page.waitForTimeout(1600);
  // a fall that settled leaves a card; any input sends it away
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(900);
}
for (let retry = 0; retry < 3; retry++) {
  await page.keyboard.press('r');
  await page.waitForTimeout(900);
}

// A pause and a quit to the map is the natural stop that flushes the queue.
await page.keyboard.press('Escape');
await page.locator('.modal.open [data-i18n="quitToMap"]').click({ timeout: 10000 });
await page.waitForSelector('.map-frame', { timeout: 10000 });
await page.waitForTimeout(600);

const measured = await page.evaluate(() => ({ kept: window.__measured, rejected: window.__rejected }));
const categories = {};
for (const record of measured.kept) categories[record.category] = (categories[record.category] ?? 0) + 1;

writeFileSync(resolve(OUT, 'export.jsonl'), measured.kept.map((record) => JSON.stringify(record)).join('\n') + '\n');

await browser.close();
server.close();

console.log(`played a real session on the production build: ${measured.kept.length} records kept, ${measured.rejected.length} rejected by the platform's own laws`);
if (measured.rejected.length) {
  console.log('the platform would drop these:');
  for (const record of measured.rejected.slice(0, 5)) console.log(`  ${JSON.stringify(record)}`);
}
console.log('categories:', JSON.stringify(categories));
if (problems.length) {
  console.log('problems:');
  for (const problem of problems) console.log(`  ${problem}`);
} else {
  console.log('no page errors');
}
console.log(`export: ${OUT}/export.jsonl`);
console.log('next: npm run friday -- download/friday-capture/export.jsonl --out=download/friday-capture');
process.exitCode = problems.length || measured.rejected.length ? 1 : 0;
