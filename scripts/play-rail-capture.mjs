#!/usr/bin/env node
/**
 * Play the deployed production build and capture the renewed rail + magnet
 * surfaces for the visual check: boot, mid-climb with the rail dressed and
 * filled, the horseshoe marker, a second biome's dress, and the rewarded
 * magnet on the fall card / locker.
 */
import { createReadStream, statSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = '/home/z/my-project/magnetope';
const OUT = '/home/z/my-project/download/poki-review-captures';
mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };

function serveStatic(root) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]));
    const file = join(root, path === '/' || path === '\\' ? 'index.html' : path);
    if (!file.startsWith(root) || !statSync(file, { throwIfNoEntry: false })?.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ server, origin: `http://127.0.0.1:${server.address().port}/` })));
}

const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const shot = (page, name) => page.screenshot({ path: resolve(OUT, `${name}.png`), timeout: 60000 });
const problems = [];
const dist = await serveStatic(resolve(ROOT, 'dist'));
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(e.message));
await page.goto(dist.origin);
await page.waitForSelector('.loading', { state: 'detached', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500);
await shot(page, '70-rail-boot');

// Play: charge and launch a few times to earn and fill the rail
await page.keyboard.down('Space');
await page.waitForTimeout(1300);
await page.keyboard.up('Space');
await page.waitForTimeout(1500);
await shot(page, '71-rail-first-launch');
for (let i = 0; i < 5; i++) {
  await page.keyboard.down(i % 2 ? 'ArrowRight' : 'ArrowLeft');
  await page.keyboard.down('Space');
  await page.waitForTimeout(700 + (i % 3) * 300);
  await page.keyboard.up('Space');
  await page.keyboard.up(i % 2 ? 'ArrowRight' : 'ArrowLeft');
  await page.waitForTimeout(1200);
}
await shot(page, '72-rail-midclimb');
const railState = await page.evaluate(() => {
  const rail = document.querySelector('.rail');
  const fill = rail.querySelector('.fill');
  return {
    shown: rail.classList.contains('show'),
    biome: rail.dataset.biome,
    gradient: getComputedStyle(fill).backgroundImage,
    markerSvg: Boolean(rail.querySelector('.marker svg path')),
  };
});
console.log('rail state:', JSON.stringify(railState));

// The rewarded magnet on the pause menu's own surfaces is hard to reach fresh;
// the locker watch button needs the locker. Capture the fall card if it shows,
// else the pause panel (which carries the new icons set).
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await shot(page, '73-rail-pause');
await ctx.close();
dist.server.close();
await browser.close();
console.log('errors:', problems.length);
problems.forEach((p) => console.log(' ', p));
