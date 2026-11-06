#!/usr/bin/env node
/**
 * Plays the live game on the project's own dev server (the build the browser
 * suites ride) and captures every summit head on the live rig for the visual
 * check: boot, equip each head through the game's own path, screenshot MAGNO
 * settled with it, and read the mounted casting.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = '/home/z/my-project/magnetope';
const OUT = '/home/z/my-project/download/summit-head-captures';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const vite = await createServer({ root: ROOT, logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } });
await vite.listen();
const origin = vite.resolvedUrls.local[0];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
await page.goto(origin);
await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 30000 });
await page.waitForSelector('.loading', { state: 'detached', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2000);

const HEADS = ['skin.classic', 'skin.industrial', 'skin.vintage', 'skin.neon', 'skin.carnival', 'skin.aurora', 'skin.trophy'];
for (const id of HEADS) {
  await page.evaluate((skinId) => {
    const game = window.__game;
    game.save.update((d) => {
      const owned = new Set(d.owned);
      owned.add(skinId);
      d.owned = [...owned];
    });
    game.debug.equip(skinId);
    for (let i = 0; i < 30; i++) game.debug.advance(1 / 60);
  }, id);
  await page.waitForTimeout(400);
  const mounted = await page.evaluate(() => {
    const heads = window.__game.debug.renderer.rig.heads;
    return Object.keys(heads).filter((name) => heads[name].visible);
  });
  await page.screenshot({ path: resolve(OUT, `${id.replace('skin.', '')}.png`), timeout: 60000 });
  console.log(id, '->', JSON.stringify(mounted));
}
console.log('errors:', problems.length);
problems.forEach((p) => console.log(' ', p));
await page.context().close();
vite.close();
await browser.close();
