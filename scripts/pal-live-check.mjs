/** Plays the deployed build on the locked palette: screenshots + computed tokens + a climb. */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Audio|audio/i.test(m.text())) problems.push(m.text()); });

await page.goto('https://manoj46-boos.github.io/magnetope/', { waitUntil: 'commit' });
await page.waitForTimeout(1200);
await page.screenshot({ path: '/home/z/my-project/download/thumb-review/pal-loading.png' });
await page.waitForSelector('.hud', { timeout: 90000 });

// The deployed :root must match the module the repo shipped.
const vars = await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  return ['--ink', '--amber', '--cyan', '--danger', '--ui-bg', '--btn-top', '--success', '--night-hi'].map((n) => `${n}=${root.getPropertyValue(n).trim()}`);
});
console.log(vars.join(' | '));

// a real climb + pause screen (the chrome's biggest surface)
await page.keyboard.down('Space');
await page.waitForTimeout(1300);
await page.keyboard.up('Space');
await page.waitForTimeout(1500);
await page.screenshot({ path: '/home/z/my-project/download/thumb-review/pal-play.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.screenshot({ path: '/home/z/my-project/download/thumb-review/pal-pause.png' });
const state = await page.evaluate(() => ({
  rail: Boolean(document.querySelector('.rail')),
  biome: document.querySelector('.rail')?.dataset?.biome ?? null,
}));
console.log('play:', JSON.stringify(state));
console.log('errors:', problems.length);
problems.slice(0, 4).forEach((p) => console.log(' ', p.slice(0, 110)));
await browser.close();
