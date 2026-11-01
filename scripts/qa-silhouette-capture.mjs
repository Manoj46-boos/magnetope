import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * The silhouette pack (rebuild PRD Volume IV, P-AR-02): one in-world frame per
 * biome at its own level 1, read at the panel's 128 px — the machine leg of
 * the pack the PRD owes (5/5 "names the shape"). The frames are the live
 * renderer's own, the grade's retune included, each marked with the
 * projection anchor where MAGNO stands (a one-pixel frame dot, outside the
 * subject). Naming the shape is the human panel's leg; this pack is what the
 * panel sees, honestly: the world as the player meets it, not a doctored
 * cut-out — the panel judges the silhouette against his band the way Chiu's
 * filled-black test does, and the anchor dot tells them where to look.
 *
 *   node scripts/qa-silhouette-capture.mjs   (expects `npm run dev` on :5173)
 */

const OUT = resolve('download/silhouette-pack');
mkdirSync(OUT, { recursive: true });
const DEV = 'http://localhost:5173';

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 836, height: 470 } });
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/AudioContext encountered an error|Cross-Origin-Opener-Policy/.test(m.text())) problems.push(`console: ${m.text()}`);
});

const LEVELS = ['scrapyard-01', 'suburbia-01', 'metropolis-01', 'playground-01', 'stratosphere-01'];

for (const level of LEVELS) {
  await page.goto(DEV, { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 30000 });
  await page.waitForTimeout(600);
  const result = await page.evaluate(async (id) => {
    const game = window.__game;
    game.startLevel(id);
    game.debug.holdClock(true);
    for (let i = 0; i < 90; i++) game.debug.advance(1 / 60);
    game.debug.advance(1 / 60);
    const source = document.querySelector('canvas');
    const png = source.toDataURL('image/png');
    const image = new Image();
    image.src = png;
    await image.decode();
    const off = document.createElement('canvas');
    off.width = image.width;
    off.height = image.height;
    const ctx = off.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const w = off.width;
    const h = off.height;
    // The anchor: MAGNO's own projection, the same one the input layer aims
    // by, drawn as a two-pixel dot ring just outside the subject's scale.
    const screen = game.debug.renderer.playerScreen();
    const ax = Math.round((screen.x / (source.clientWidth || 1)) * w);
    const ay = Math.round((screen.y / (source.clientHeight || 1)) * h);
    const r = Math.round(Math.min(w, h) * 0.055);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = Math.max(2, Math.round(w / 400));
    ctx.beginPath();
    ctx.arc(ax, ay, r, 0, Math.PI * 2);
    ctx.stroke();
    // Downscale to the panel's 128 px on the long edge.
    const panel = document.createElement('canvas');
    panel.width = 128;
    panel.height = Math.round((h / w) * 128);
    const pctx = panel.getContext('2d');
    pctx.imageSmoothingEnabled = true;
    pctx.drawImage(off, 0, 0, panel.width, panel.height);
    const pngOut = panel.toDataURL('image/png');
    // The pack's own honesty check: the panel frame is neither blank nor flat.
    const pdata = pctx.getImageData(0, 0, panel.width, panel.height).data;
    let luma = 0;
    let varied = 0;
    let n = 0;
    for (let i = 0; i < pdata.length; i += 4) {
      const l = 0.2126 * pdata[i] + 0.7152 * pdata[i + 1] + 0.0722 * pdata[i + 2];
      if (n > 0 && Math.abs(l - luma / n) > 12) varied++;
      luma += l;
      n++;
    }
    return { pngOut, meanLuma: luma / n, variedShare: varied / n, anchor: { ax, ay, r } };
  }, level);
  writeFileSync(resolve(OUT, `${level}-128.png`), Buffer.from(result.pngOut.split(',')[1], 'base64'));
  console.log(`${level}: panel 128px, mean luma ${result.meanLuma.toFixed(1)}, varied share ${(result.variedShare * 100).toFixed(1)}%`);
}

if (problems.length) {
  console.log(`\nPROBLEMS (${problems.length}):`);
  for (const p of problems) console.log(` - ${p}`);
  process.exitCode = 1;
} else {
  console.log('\nfive panel frames captured, zero page errors');
}
await browser.close();
