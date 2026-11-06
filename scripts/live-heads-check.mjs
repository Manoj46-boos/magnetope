import { chromium } from 'playwright';
const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
await page.goto('https://manoj46-boos.github.io/magnetope/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForSelector('.loading', { state: 'detached', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2000);
// Play a real climb on the live page
await page.keyboard.down('Space');
await page.waitForTimeout(1300);
await page.keyboard.up('Space');
await page.waitForTimeout(1500);
const state = await page.evaluate(() => {
  const rail = document.querySelector('.rail');
  return {
    biome: rail?.dataset.biome ?? null,
    railShown: rail?.classList.contains('show') ?? false,
    marker: Boolean(rail?.querySelector('.marker svg path')),
  };
});
await page.screenshot({ path: '/home/z/my-project/download/summit-head-captures/live-page.png', timeout: 60000 });
console.log('live state:', JSON.stringify(state));
console.log('errors:', problems.length);
problems.forEach((p) => console.log(' ', p));
await browser.close();
