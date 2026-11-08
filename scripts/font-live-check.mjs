import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
await page.goto('https://manoj46-boos.github.io/magnetope/', { waitUntil: 'commit' });
await page.waitForSelector('.hud', { timeout: 90000 });
const checks = await page.evaluate(async () => {
  const loaded = await document.fonts.load('700 16px Comfortaa');
  const face = getComputedStyle(document.querySelector('.hud') || document.body).fontFamily;
  return { comfortaaLoaded: loaded.length > 0, face: face.slice(0, 40), check: document.fonts.check('700 16px Comfortaa') };
});
await page.keyboard.down('Space'); await page.waitForTimeout(700); await page.keyboard.up('Space');
await page.waitForTimeout(1200);
await page.screenshot({ path: '/home/z/my-project/download/thumb-review/font-live.png' });
console.log(JSON.stringify(checks), 'errors:', problems.length);
await browser.close();
