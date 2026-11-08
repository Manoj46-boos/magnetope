/** Renders the real UI screens and reads back their computed colours against the master tokens. */
import { chromium } from 'playwright';
import { UI_VARS } from '../src/config/palette.ts';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
await page.goto('http://localhost:5173/');
await page.waitForSelector('.hud', { timeout: 90000 });

// 1) every :root var the module names resolves in the live document to the module's value
const mismatch = await page.evaluate((expected) => {
  const root = getComputedStyle(document.documentElement);
  const bad = [];
  for (const [name, value] of Object.entries(expected)) {
    const live = root.getPropertyValue(name).trim();
    if (live !== value) bad.push(`${name}: live "${live}" != module "${value}"`);
  }
  return bad;
}, UI_VARS);
console.log('var sync:', mismatch.length === 0 ? 'all in step' : mismatch);

// 2) the button the player actually clicks: computed bg/colour from the tokens
const button = await page.evaluate(() => {
  const b = document.querySelector('.btn.primary');
  if (!b) return null;
  const cs = getComputedStyle(b);
  return { color: cs.color, bg: cs.backgroundImage.slice(0, 90) };
});
console.log('primary button:', JSON.stringify(button));

// 3) pause screen renders and its ink reads against the panel
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const paused = await page.evaluate(() => Boolean(document.querySelector('.panel, .pause, [data-ui]')));
console.log('pause shown:', paused);
await page.screenshot({ path: '/home/z/my-project/download/thumb-review/palette-pause.png' });
await page.keyboard.press('Escape');
console.log('page errors:', problems.length);
problems.forEach((p) => console.log(' ', p));
await browser.close();
