/** Plays the deployed build: captures the loading arc mid-boot, the favicon, and a real climb. */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));

// Latch the arc's first-seen reach before the page's scripts run (production
// boots fast; the latch sees what a player sees in the first frames).
await page.addInitScript(() => {
  window.__arcSeen = [];
  const look = () => {
    const path = document.querySelector('.magno-flip .field-arc');
    if (path) {
      const length = path.getTotalLength();
      const raw = getComputedStyle(path).strokeDashoffset;
      const offset = raw === '' ? NaN : Number.parseFloat(raw);
      window.__arcSeen.push(Number.isNaN(offset) ? 0 : (length - Math.abs(offset)) / length);
    }
    if (window.__arcSeen.length < 40) requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
});
await page.goto('https://manoj46-boos.github.io/magnetope/', { waitUntil: 'commit' });
// capture the loading screen while it lives
await page.waitForTimeout(1500);
await page.screenshot({ path: '/home/z/my-project/download/thumb-review/live-loading.png', timeout: 60000 }).catch(() => {});
// Production carries no dev handle — the HUD's arrival is the boot's own 'done'.
await page.waitForSelector('.hud', { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(1000);
const arcSamples = await page.evaluate(() => window.__arcSeen);
console.log('arc samples over boot:', JSON.stringify(arcSamples.filter((_, i) => i % 4 === 0)));
// the favicon the tab actually carries
const icon = await page.evaluate(() => document.querySelector('link[rel="icon"]')?.href ?? null);
console.log('favicon:', icon ? icon.slice(0, 120) + '...' : null);
// a real climb: hold, release, land
await page.keyboard.down('Space');
await page.waitForTimeout(1300);
await page.keyboard.up('Space');
await page.waitForTimeout(1500);
const state = await page.evaluate(() => {
  const rail = document.querySelector('.rail');
  return { biome: rail?.dataset?.biome ?? null, railShown: rail?.classList?.contains('show') ?? false };
});
await page.screenshot({ path: '/home/z/my-project/download/thumb-review/live-play.png', timeout: 60000 });
console.log('play state:', JSON.stringify(state));
console.log('errors:', problems.length);
problems.forEach((p) => console.log(' ', p));
await browser.close();
