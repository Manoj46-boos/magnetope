// W14 deploy-and-play gate (premium PRD): the production Poki dist boots against a
// dead ad stack — every SDK call throws, the way a blocker leaves it — and real
// input plays it: charge, launch, tumble, pause, resume past a break that throws.
// The second leg pins this session's own surfaces on the dev server: the clear
// card's earned doubler and the pay's flourish, plus the fall card's video-glyph
// revive. Captures land in download/w14-captures for the vision panel.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer as viteCreate } from 'vite';

const OUT = '/home/z/my-project/download/w14-captures';
mkdirSync(OUT, { recursive: true });

const HOSTILE_SDK = `
  window.__hostile = [];
  const hostile = (name) => () => { window.__hostile.push(name); throw new Error('blocked'); };
  window.PokiSDK = {
    init: () => { window.__hostile.push('init'); return Promise.reject(new Error('blocked')); },
    gameLoadingFinished: hostile('loadingFinished'),
    gameplayStart: hostile('gameplayStart'),
    gameplayStop: hostile('gameplayStop'),
    commercialBreak: () => { window.__hostile.push('commercialBreak'); return Promise.reject(new Error('blocked')); },
    rewardedBreak: () => { window.__hostile.push('rewardedBreak'); return Promise.reject(new Error('blocked')); },
    getLanguage: hostile('getLanguage'),
    measure: hostile('measure'),
  };
`;

const save = {
  version: 2,
  stars: { 'scrapyard-00': 3, 'scrapyard-01': 2, 'scrapyard-02': 2 },
  bestMs: { 'scrapyard-00': 18230, 'scrapyard-01': 21440, 'scrapyard-02': 26500 },
  scrap: 260,
  owned: ['skin.classic', 'field.classic', 'skin.sunny'],
  equipped: { skin: 'skin.classic', field: 'field.classic' },
  bestFall: { heightMeters: 21.4, grade: 'B' },
  bestGrade: {},
  ghosts: {},
  clearTally: {},
  friends: {},
  alias: '',
  seen: [],
  settings: { sound: true, music: true, language: 'en', assist: true, reducedMotion: false },
};

const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const browser = await chromium.launch({ headless: true, args });

// ---------------------------------------------------------------- the dist leg
const distServer = createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = `${process.cwd()}/dist${url}`;
  try {
    const body = readFileSync(file);
    const type = url.endsWith('.html') ? 'text/html' : url.endsWith('.js') ? 'text/javascript' : url.endsWith('.wasm') ? 'application/wasm' : url.endsWith('.css') ? 'text/css' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => distServer.listen(8091, done));
console.log('dist served on 8091');

const problems = [];
const report = { dist: {}, surfaces: {} };

{
  const context = await browser.newContext({ viewport: { width: 1031, height: 580 } });
  await context.addInitScript((seed) => {
    try {
      window.localStorage.setItem('magnetope.save', seed);
    } catch {
      /* The live host's sandbox may block storage; the game degrades to memory. */
    }
  }, JSON.stringify(save));
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/AudioContext|Cross-Origin-Opener/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  const foreign = [];
  const hostOwns = /poki\.io|poki-cdn\.com|doubleclick\.net|googlesyndication\.com/;
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:8091') && !r.url().startsWith('data:') && !hostOwns.test(r.url())) foreign.push(r.url());
  });

  const t0 = Date.now();
  await page.goto('http://localhost:8091', { timeout: 45000 });
  await page.waitForSelector('#view', { timeout: 30000 });
  const viewReady = Date.now() - t0;
  await page.waitForTimeout(2400);
  await page.screenshot({ path: `${OUT}/01-boot-poster.png` });
  await page.keyboard.press('Space');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/02-opening.png` });

  const hold = async (ms) => {
    await page.keyboard.down('Space');
    await page.waitForTimeout(Math.min(ms, 700));
    await page.screenshot({ path: `${OUT}/03-charge-coil.png` });
    await page.waitForTimeout(Math.max(0, ms - 700));
    await page.keyboard.up('Space');
  };
  let fellAt = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    await hold(900 + (attempt % 3) * 300);
    await page.waitForTimeout(2100);
    if (await page.locator('.fall-card.open').count()) {
      fellAt = Date.now();
      await page.screenshot({ path: `${OUT}/04-fall-card.png` });
      await page.locator('.fall-card .actions .btn').first().click();
      await page.waitForTimeout(600);
      break;
    }
    if (await page.locator('.clear-card').count()) break;
  }
  await page.screenshot({ path: `${OUT}/05-mid-climb.png` });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/06-pause-glass.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/07-resumed-alive.png` });
  const hostileCalls = await page.evaluate(() => [...(window.__hostile ?? [])]);
  const alive = await page.evaluate(() => Boolean(document.querySelector('#view')));

  report.dist = { viewReadyMs: viewReady, hostileCalls: [...new Set(hostileCalls)], aliveAfterResume: alive, sawFallCard: fellAt > 0, foreign };
  await context.close();
}
distServer.close();

// ------------------------------------------------------------- the surface leg
{
  const server = await viteCreate({ logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } });
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await context.addInitScript('window.__name = (f) => f;');
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`surface pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/AudioContext/.test(m.text())) problems.push(`surface console: ${m.text()}`);
  });

  await page.goto(origin);
  await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 30000 });
  await page.waitForTimeout(400);

  // The fall card: a real tumble's verdict, with the revive carrying its video glyph.
  await page.evaluate(() => {
    const game = window.__game;
    game.startLevel('scrapyard-03');
    game.debug.holdClock(true);
    game.debug.save.update((s) => {
      s.seen = [...new Set([...s.seen, 'coach'])];
    });
  });
  const drive = (seconds) =>
    page.evaluate((n) => {
      const game = window.__game;
      for (let left = n; left > 0; left -= 5) game.debug.advance(Math.min(5, left));
    }, seconds);
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__game.debug.advance(1 / 60));
  console.log('staging the fall');
  await page.evaluate(() => {
    const game = window.__game;
    const sim = game.debug.sim;
    const before = sim.run.fallCount;
    sim.physics.magnoBody.setTranslation({ x: 2.6, y: 30, z: 0 }, true);
    sim.physics.magnoBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    const idle = { tiltX: 0, tiltY: 0, flipHeld: false, flipDown: false, flipUp: false };
    for (let i = 0; i < 1500 && sim.run.fallCount === before; i++) sim.step(idle);
    game.debug.advance(1 / 60);
  });
  await page.waitForTimeout(900);
  console.log('capturing the fall card');
  await page.screenshot({ path: `${OUT}/08-fall-card.png`, timeout: 60000 });
  const fallButtons = await page.evaluate(() => [...document.querySelectorAll('.fall-card .actions button')].map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim() ?? ''));
  if (await page.locator('.fall-card.open').count()) {
    await page.locator('.fall-card .actions .btn').first().click();
    await page.waitForTimeout(400);
  }

  // The fall's ask spent the prompt window (R-MZ-06): slide it before the clear,
  // the way a real session would, so the doubler may earn its place (R-MZ-11).
  await drive(125);
  const route = JSON.parse(readFileSync('src/levels/routes/playground-07.json', 'utf8'));
  console.log('replaying playground-07 route...');
  await page.evaluate((r) => {
    const game = window.__game;
    game.startLevel('playground-07');
    game.debug.autoplay(r);
    for (let i = 0; i < 1200 && game.debug.phase !== 'cleared'; i++) game.debug.advance(5 / 60);
  }, route);
  console.log('route replay done, waiting for the card');
  await page.locator('.clear-card').waitFor({ state: 'visible', timeout: 60000 });
  console.log('card visible, stamping');
  await page.waitForTimeout(2600);
  console.log('capturing the clear card');
  await page.screenshot({ path: `${OUT}/09-clear-card-doubler.png`, timeout: 60000 });
  console.log('clear card captured');

  const doubler = page.locator('.clear-card .btn', { hasText: /double/i });
  const doublerSeen = await doubler.count();
  console.log('doubler count:', doublerSeen);
  if (doublerSeen) {
    await doubler.click();
    await page.waitForTimeout(700);
    console.log('capturing the flourish');
    await page.screenshot({ path: `${OUT}/10-rewarded-flourish.png`, timeout: 60000 });
  }
  const flourish = await page.locator('.clear-card .fact.rewarded').count();
  report.surfaces = { fallButtons, doublerSeen, flourish };
  await context.close();
  await server.close();
}

console.log(JSON.stringify({ report, problems }, null, 1));
await browser.close();
process.exit(problems.length > 0 ? 1 : 0);
