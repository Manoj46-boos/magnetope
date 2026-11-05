#!/usr/bin/env node
/**
 * The live play check on the deployed project page (the runbook's own leg):
 * the shipped bundle boots, the rail dresses in the Scrapyard before the first
 * press, a real climb fills it, and the visit raises nothing. Reads the live
 * DOM only — the same laws the browser suite holds, against the page a player
 * would actually open.
 */
import { chromium } from 'playwright';

const URL = 'https://manoj46-boos.github.io/magnetope/';
const problems = [];

const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/AudioContext encountered an error|net::|Failed to load resource/i.test(m.text())) problems.push(`console: ${m.text()}`);
});
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForSelector('.loading', { state: 'detached', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2000);

// dressed before the first press?
const before = await page.evaluate(() => ({
  biome: document.querySelector('.rail')?.dataset.biome ?? null,
  shown: document.querySelector('.rail')?.classList.contains('show') ?? false,
}));
// a real climb: charge, release
await page.keyboard.down('Space');
await page.waitForTimeout(1300);
await page.keyboard.up('Space');
await page.waitForTimeout(1800);
const after = await page.evaluate(() => {
  const rail = document.querySelector('.rail');
  const fill = rail.querySelector('.fill');
  const marker = rail.querySelector('.marker');
  return {
    biome: rail.dataset.biome,
    shown: rail.classList.contains('show'),
    gradient: getComputedStyle(fill).backgroundImage,
    markerHasHorseshoe: Boolean(marker.querySelector('svg path')),
    markerPoles: marker.querySelectorAll('svg rect').length,
    fillHeightPct: fill.getBoundingClientRect().height / rail.getBoundingClientRect().height,
  };
});
await page.screenshot({ path: '/home/z/my-project/download/poki-review-captures/80-live-page-rail.png', timeout: 60000 });
console.log('before press:', JSON.stringify(before));
console.log('after climb :', JSON.stringify(after));
console.log('errors:', problems.length);
problems.forEach((p) => console.log(' ', p));
await browser.close();
