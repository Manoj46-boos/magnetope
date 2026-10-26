import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { DEVICES, launchThrottleBrowser, serveGzipped, type DeviceProfile } from './cold-load';
import { C2P_BUDGET_MS } from './perf-laws';

/**
 * The cold-load filmstrip (R-PE-06): one frame a third of a second, from
 * navigation until the first level has been playable for a while, on each of
 * the three profiles the budget names. The truth a single number hides — what
 * the player actually watched while the game arrived — written beside the
 * frames as the milestone's evidence.
 *
 *   npm run filmstrip
 *   npm run filmstrip -- --device=mid --dist=dist
 */

const arg = (name: string, fallback: string): string => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const FRAME_EVERY_MS = 300;

interface LoadMarks {
  firstPaintMs: number;
  playableMs: number;
  bytes: number;
}

async function filmstripProfile(browser: Browser, dist: string, device: DeviceProfile, outDir: string): Promise<LoadMarks> {
  const { origin, close } = await serveGzipped(dist);
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const bytesPerSecond = (device.downMbps * 1_000_000) / 8;
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: device.rttMs, downloadThroughput: bytesPerSecond, uploadThroughput: bytesPerSecond / 3 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: device.cpu });

  let bytes = 0;
  cdp.on('Network.loadingFinished', (e: { encodedDataLength: number }) => {
    bytes += e.encodedDataLength;
  });

  const filmstrips = resolve(outDir, device.name);
  mkdirSync(filmstrips, { recursive: true });

  const started = Date.now();
  await page.goto(origin, { waitUntil: 'commit' });
  for (let frame = 1; ; frame++) {
    await page.screenshot({ path: resolve(filmstrips, `${String(frame).padStart(2, '0')}.png`) });
    const playable = await page.evaluate(() => {
      const mark = performance.getEntriesByName('magnetope:playable')[0];
      return mark ? mark.startTime : -1;
    });
    if (playable > 0) {
      // One frame of the arrived game, then the ledger stops.
      await page.screenshot({ path: resolve(filmstrips, 'done.png') });
      const firstPaint = await page.evaluate(() => performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')?.startTime ?? -1);
      await context.close();
      await close();
      return { firstPaintMs: firstPaint, playableMs: playable, bytes };
    }
    if (Date.now() - started > 120_000) throw new Error(`${device.name}: playable never arrived`);
    await page.waitForTimeout(FRAME_EVERY_MS);
  }
}

async function main(): Promise<void> {
  const dist = resolve(arg('dist', 'dist'));
  const wanted = arg('device', 'all');
  const outDir = resolve(arg('out', '../download/filmstrips'));
  const browser = await launchThrottleBrowser().catch(() => chromium.launch({ headless: true }));
  const profiles = Object.values(DEVICES).filter((d) => wanted === 'all' || d.name === wanted);
  if (!profiles.length) {
    console.error(`unknown device; choose one of ${Object.keys(DEVICES).join(', ')}`);
    process.exit(1);
  }
  let summary = '# The cold-load filmstrips (R-PE-06)\n\nOne frame every 0.3 s from navigation to the arrived game, on the load gate\'s own throttled profiles.\n\n';
  for (const device of profiles) {
    const key = (Object.keys(DEVICES) as Array<keyof typeof DEVICES>).find((k) => DEVICES[k] === device)!;
    const marks = await filmstripProfile(browser, dist, device, outDir);
    const budget = C2P_BUDGET_MS[key as keyof typeof C2P_BUDGET_MS];
    const verdict = marks.playableMs <= budget ? 'inside' : 'OVER';
    summary += `## ${device.name} (${key})\n\n`;
    summary += `- first paint: **${(marks.firstPaintMs / 1000).toFixed(1)} s**\n`;
    summary += `- playable: **${(marks.playableMs / 1000).toFixed(1)} s** against a ${(budget / 1000).toFixed(1)} s line (${verdict})\n`;
    summary += `- on the wire: **${(marks.bytes / 1024 / 1024).toFixed(2)} MB**\n`;
    summary += `- frames: \`filmstrips/${device.name}/01.png\` … \`done.png\`\n\n`;
    console.log(`${device.name}: playable at ${(marks.playableMs / 1000).toFixed(1)} s (first paint ${(marks.firstPaintMs / 1000).toFixed(1)} s), ${(marks.bytes / 1024 / 1024).toFixed(2)} MB on the wire`);
  }
  await browser.close();
  writeFileSync(resolve(outDir, 'report.md'), summary);
  console.log(`report: ${resolve(outDir, 'report.md')}`);
}

void main();
