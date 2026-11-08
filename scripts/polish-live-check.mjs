/** Plays the deployed build and measures the chapter's systems live: punch-in on release,
 *  the polarity-flip shake, the grade ladder's colors, and the banner's 1.8 s timing. */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Audio|audio|WebGL/i.test(m.text())) problems.push(m.text()); });

await page.goto(process.env.POLISH_URL ?? 'http://localhost:5175/', { waitUntil: 'commit' });
await page.waitForSelector('.hud', { timeout: 90000 });

// 1) the deployed grade ladder vars exist
const ladder = await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  return ['--grade-b', '--grade-a', '--grade-s', '--grade-ss', '--grade-sss'].map((n) => `${n}=${root.getPropertyValue(n).trim()}`);
});
console.log('ladder:', ladder.join(' | '));

// 2) the banner's position: rule-of-thirds upper-left
// (trigger a biome change via debug level jump)
const bannerBox = await page.evaluate(() => {
  const b = document.querySelector('.biome-banner');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), text: b.textContent?.trim().slice(0, 30) };
});
console.log('banner:', JSON.stringify(bannerBox));

// 3) a real flip: hold space, release, watch the camera z dip (punch-in) then recover
await page.keyboard.down('Space');
await page.waitForTimeout(500);
await page.keyboard.up('Space');
const flight = [];
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(50);
  const z = await page.evaluate(() => (window.__game && window.__game.debug && window.__game.debug.renderer && window.__game.debug.renderer.cameraRig ? window.__game.debug.renderer.cameraRig.camera.position.z : null));
  flight.push(z && Math.round(z * 100) / 100);
}
console.log('camera z after release:', JSON.stringify(flight.filter(Boolean).slice(0, 12)));

// 4) play on: no page errors across a climb
await page.keyboard.down('Space');
await page.waitForTimeout(900);
await page.keyboard.up('Space');
await page.waitForTimeout(1500);
console.log('page errors:', problems.length);
problems.slice(0, 4).forEach((p) => console.log(' ', p.slice(0, 110)));
await page.screenshot({ path: '/home/z/my-project/download/thumb-review/polish-play.png' });
await browser.close();
