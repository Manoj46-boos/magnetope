import { mkdirSync, statSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer as viteServer } from 'vite';

/**
 * QA capture of the accessibility pass (premium PRD W12) as a player meets it.
 * The production gate plays for real: boot, first pointer input, the HUD with
 * its contrast-held timer pill and starred rail, the pause menu, the controls
 * screen with the accessibility group, the interface at 150%, reduced motion
 * on, and a real charge-and-launch under both profiles. The dev leg walks the
 * pseudo locale through the surfaces, because the shipped build never offers
 * the QA fixture.
 *
 *   node scripts/qa-a11y-capture.mjs
 */

const OUT = resolve('qa-captures/w12');
mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'image/font', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

function serveStatic(root) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]));
    const file = join(root, path === '/' || path === '\\' ? 'index.html' : path);
    if (!file.startsWith(root) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ server, origin: `http://127.0.0.1:${server.address().port}/` })));
}

const LAUNCH = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] };
const NOISE = [/AudioContext/, /Cross-Origin-Opener/];
const problems = [];
const browser = await chromium.launch(LAUNCH);

const open = async (viewport, origin) => {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !NOISE.some((pattern) => pattern.test(message.text()))) problems.push(`console: ${message.text()}`);
  });
  await page.goto(origin, { waitUntil: 'load' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(3200);
  return page;
};

const shoot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`) });

/** The host may serve a house ad over the page after a resume; the gate waits for the game to own the screen again. */
const awaitGameSurface = (page, label) =>
  page
    .waitForFunction(
      () => {
        const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        return Boolean(el && (el.tagName === 'CANVAS' || el.closest('#ui')));
      },
      null,
      { timeout: 45000 },
    )
    .catch(() => problems.push(`the ${label} surface never returned after the ad`));

// ---------------------------------------------------------------- prod leg

{
  const { server, origin } = await serveStatic(resolve('dist'));
  const page = await open({ width: 960, height: 540 }, origin);

  // The game is present and the dev handle is gone on the shipped build.
  const hasDevHandle = await page.evaluate(() => Boolean(window.__game));
  if (hasDevHandle) problems.push('the dev handle is present on the production build');

  // First pointer input: the boot presentation hands over to play.
  await page.mouse.move(480, 300);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await shoot(page, '01-first-charge');
  await page.mouse.up();
  await page.waitForTimeout(1200);

  // The HUD as it lives over a bright sky: timer pill, rail, summit chip.
  await page.mouse.move(200, 270);
  await page.mouse.down();
  await page.waitForTimeout(260);
  await page.mouse.up();
  await page.waitForTimeout(700);
  await shoot(page, '02-hud-over-sky');

  // The pause menu.
  await page.locator('.pause-btn').click();
  await page.locator('.panel.pause').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  await shoot(page, '03-pause');

  // The controls screen carries the accessibility group.
  await page.locator('.panel.pause [data-opens="controls"]').click();
  await page.locator('.panel.controls').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  await shoot(page, '04-controls-a11y-group');

  // The interface at 150%.
  await page.locator(".panel.controls [data-value='1.5']").click();
  await page.waitForTimeout(250);
  await shoot(page, '05-controls-at-150');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  await shoot(page, '06-pause-at-150');

  // Reduced motion from its own toggle, then a launch under the profile.
  const motion = page.locator(".panel.pause .toggle:has([data-i18n='reducedMotion'])");
  await motion.click();
  await page.waitForTimeout(200);
  const pressed = await motion.getAttribute('aria-pressed');
  if (pressed !== 'true') problems.push('the reduced-motion toggle did not hold its state');
  await page.locator('.panel.pause .btn.primary').click();
  await awaitGameSurface(page, 'reduced-motion play');
  await page.waitForTimeout(400);
  await page.mouse.move(480, 320);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await shoot(page, '07-charge-reduced-motion');
  await page.mouse.up();
  await page.waitForTimeout(1500);
  await shoot(page, '08-flight-reduced-motion');

  // The defaults return while the menus are still up, so the one remaining
  // resume of this session leaves nothing for an ad to intercept.
  await page.locator('.pause-btn').click();
  await page.locator('.panel.pause [data-opens="controls"]').click();
  await page.locator(".panel.controls [data-value='1']").click();
  await page.locator(".panel.controls [data-setting='reducedMotion']").click();
  await shoot(page, '09-controls-restored');
  await page.keyboard.press('Escape');
  await page.locator('.panel.pause .btn.primary').click();
  await awaitGameSurface(page, 'closing play');
  await page.waitForTimeout(900);
  await shoot(page, '09-play-restored');

  console.log(hasDevHandle ? 'prod leg: dev handle PRESENT' : 'prod leg: dev handle compiled out');
  await page.close();
  server.close();
}

// ---------------------------------------------------------------- dev leg

{
  const server = await viteServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } });
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  const page = await open({ width: 568, height: 320 }, origin);

  // The QA fixture rides the language menu in dev builds only.
  const hasPseudo = await page.locator("#ui .lang select option[value='pseudo']").count();
  if (!hasPseudo) problems.push('the pseudo locale option is missing from the dev language menu');

  await page.evaluate(() => window.__game.debug.holdClock(true));
  await page.keyboard.press('Escape');
  await page.locator('.panel.pause').waitFor({ state: 'visible' });
  await page.locator('#ui .lang select').selectOption('pseudo');
  await page.waitForTimeout(300);
  await shoot(page, '10-pseudo-pause-568');

  await page.locator('.panel.pause [data-opens="controls"]').click();
  await page.locator('.panel.controls').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
  await shoot(page, '11-pseudo-controls-568');

  await page.keyboard.press('Escape');
  await page.locator('.panel.pause [data-opens="map"]').click();
  await page.locator('.screen.open').waitFor({ state: 'visible' });
  await page.waitForTimeout(350);
  await shoot(page, '12-pseudo-map-568');

  console.log('dev leg: pseudo surfaces captured');
  await page.close();
  await server.close();
}

await browser.close();
console.log(problems.length === 0 ? 'GATE PASS: no page errors, no console errors' : `GATE FAIL:\n  ${problems.join('\n  ')}`);
