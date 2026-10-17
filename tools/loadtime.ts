import { resolve } from 'node:path';
import { DEVICES, launchThrottleBrowser, measureColdLoad, serveGzipped } from './cold-load';

/**
 * Cold-load time of the production build on a throttled phone (PRD 10.3: playable in under 10 s on
 * a mid-range phone).
 *
 *   npm run build && npm run loadtime -- --device=mid --runs=3
 *
 * Devices: desktop, mid (4x CPU, 4G), low (6x CPU, slow 4G).
 */

const flag = (name: string, fallback: string): string => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const key = flag('device', 'mid') as keyof typeof DEVICES;
const device = DEVICES[key];
if (!device) {
  console.error(`unknown device; choose one of ${Object.keys(DEVICES).join(', ')}`);
  process.exit(1);
}

const dist = resolve(flag('dist', 'dist'));
const runs = Number(flag('runs', '3'));
const { origin, close } = await serveGzipped(dist);
const browser = await launchThrottleBrowser();
const { playableMs, bytes } = await measureColdLoad(browser, origin, device, runs);
await browser.close();
await close();

const seconds = playableMs.map((ms) => (ms / 1000).toFixed(1)).join(', ');
const best = Math.min(...playableMs) / 1000;
console.log(`${device.name}: playable after ${seconds} s (best ${best.toFixed(1)} s), ${(bytes / 1024 / 1024).toFixed(2)} MB on the wire`);
