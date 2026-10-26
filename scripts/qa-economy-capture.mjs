import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

/**
 * Captures the clear card the way a panel reads it (premium PRD W10): boots the
 * real game with a seeded save — three stars, a personal ghost waiting on the
 * level, a locker half-filled — autoplays the level's stored route on the held
 * clock, and photographs the card with its ghost delta and dangle plus the map
 * and locker the card leads to. Output lands under `download/w10-captures/`.
 *
 *   node scripts/qa-economy-capture.mjs
 */

const OUT = resolve('download/w10-captures');
mkdirSync(OUT, { recursive: true });
const GHOST = JSON.parse(readFileSync(resolve('scripts/qa-w10-ghost-seed.json'), 'utf8'));
const ROUTE = JSON.parse(readFileSync(resolve('src/levels/routes/scrapyard-00.json'), 'utf8'));

const save = {
  version: 2,
  stars: { 'scrapyard-00': 3, 'scrapyard-01': 2, 'scrapyard-02': 2, 'scrapyard-03': 1 },
  bestMs: { 'scrapyard-00': 18230, 'scrapyard-01': 21440, 'scrapyard-02': 26500, 'scrapyard-03': 31200 },
  scrap: 260,
  owned: ['skin.classic', 'field.classic', 'skin.sunny', 'skin.antenna'],
  equipped: { skin: 'skin.classic', field: 'field.classic' },
  bestFall: { heightMeters: 21.4, grade: 'B' },
  bestGrade: { 'scrapyard-00': 'B' },
  ghosts: { 'scrapyard-00': GHOST },
  clearTally: {},
  friends: {},
  alias: '',
  seen: [],
  settings: { sound: true, music: true, language: 'en', assist: true, reducedMotion: false },
};

const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } });
await server.listen();
const origin = server.resolvedUrls.local[0];

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1031, height: 580 } });
await context.addInitScript((seed) => {
  window.__name = (f) => f;
  window.localStorage.setItem('magnetope.save', seed);
}, JSON.stringify(save));
const page = await context.newPage();
page.on('pageerror', (error) => {
  if (!/localStorage/.test(error.message)) console.log(`pageerror: ${error.message}`);
});

await page.goto(origin, { timeout: 45000 });
await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 30000 });
await page.evaluate(({ route }) => {
  window.__game.startLevel('scrapyard-00');
  window.__game.debug.holdClock(true);
  window.__game.debug.autoplay(route);
  let ticks = 0;
  while (window.__game.debug.phase !== 'cleared' && ticks < 3000) {
    window.__game.debug.advance(1 / 60);
    ticks++;
  }
}, { route: ROUTE });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/05-clear-card.png`, timeout: 120000 });
console.log('wrote 05-clear-card.png');

await page.locator('.clear-card [data-i18n="quitToMap"]').click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/06-map.png`, timeout: 120000 });
console.log('wrote 06-map.png');

await page.evaluate(() => window.__game.debug.holdClock(false));
await browser.close();
await server.close();
