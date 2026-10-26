import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEVICES, measureColdLoad, serveGzipped } from '../tools/cold-load';
import { C2P_BUDGET_MS } from '../tools/perf-laws';
import { launchBrowser } from './browser/harness';

/**
 * PRD 10.3 and 23.3: the click-to-play numbers (R-PE-06) — playable-first-input
 * on the throttled profiles of the load gate, 1.5 s desktop, 4.0 s mid-range over
 * 4G, 10 s low-end on slow 4G, with the host SDK racing behind the boot (R-PE-14),
 * which is why the Poki build must meet the same lines as the plain one.
 *
 * The production bundles are built, served gzipped and loaded cold the way a
 * CDN would deliver them. Wall-clock timing is only meaningful when nothing
 * else is using the machine, so the timed cases run from `npm run test:load`.
 */

const root = resolve(__dirname, '..');
const MB = 1024 * 1024;

let browser: Browser | null = null;
let distDir = '';
let pokiDir = '';
let origin = '';
let pokiOrigin = '';
let close: () => Promise<void> = async () => undefined;
let pokiClose: () => Promise<void> = async () => undefined;

const build = (dir: string, mode: string) =>
  execFileSync(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'build', '--mode', mode, '--outDir', dir, '--emptyOutDir'], { cwd: root, stdio: 'pipe' });

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  distDir = mkdtempSync(join(tmpdir(), 'magnetope-load-'));
  pokiDir = mkdtempSync(join(tmpdir(), 'magnetope-poki-load-'));
  build(distDir, 'production');
  build(pokiDir, 'poki');
  ({ origin, close } = await serveGzipped(distDir));
  ({ origin: pokiOrigin, close: pokiClose } = await serveGzipped(pokiDir));
}, 480_000);

afterAll(async () => {
  await browser?.close();
  await close();
  await pokiClose();
  if (distDir) rmSync(distDir, { recursive: true, force: true });
  if (pokiDir) rmSync(pokiDir, { recursive: true, force: true });
});

/** Wall-clock timing is only meaningful when nothing else is using the machine, so it runs from `npm run test:load`. */
const timed = process.env.MAGNETOPE_LOAD_GATE === '1';

const runnable = (name: string, body: () => Promise<void>) =>
  it(
    name,
    async (ctx) => {
      if (!browser || !timed) ctx.skip();
      await body();
    },
    300_000,
  );

describe('cold load of the production build', () => {
  it('ships the physics engine as a file the browser compiles while it downloads, not as text inside a script', (ctx) => {
    if (!browser) ctx.skip();
    const assets = join(distDir, 'assets');
    const files = readdirSync(assets);
    expect(files.some((f) => f.endsWith('.wasm'))).toBe(true);

    const longestBase64Run = (text: string): number => Math.max(0, ...(text.match(/[A-Za-z0-9+/=]{1000,}/g) ?? []).map((run) => run.length));
    const scripts = files.filter((f) => f.endsWith('.js'));
    expect(Math.max(...scripts.map((f) => longestBase64Run(readFileSync(join(assets, f), 'utf8'))))).toBeLessThan(100_000);
  });

  runnable('is playable within the desktop line', async () => {
    const { playableMs } = await measureColdLoad(browser!, origin, DEVICES.desktop, 2);
    expect(Math.min(...playableMs), `loads took ${playableMs.map((ms) => Math.round(ms)).join(', ')} ms`).toBeLessThan(C2P_BUDGET_MS.desktop);
  });

  runnable('is playable within the mid-range line over 4G', async () => {
    const { playableMs, bytes } = await measureColdLoad(browser!, origin, DEVICES.mid, 2);
    expect(Math.min(...playableMs), `loads took ${playableMs.map((ms) => Math.round(ms)).join(', ')} ms`).toBeLessThan(C2P_BUDGET_MS.mid);
    expect(bytes).toBeLessThan(1.7 * MB);
  });

  runnable('is playable within the low-end line on slow 4G', async () => {
    const { playableMs } = await measureColdLoad(browser!, origin, DEVICES.low, 2);
    expect(Math.min(...playableMs), `loads took ${playableMs.map((ms) => Math.round(ms)).join(', ')} ms`).toBeLessThan(C2P_BUDGET_MS.low);
  });

  // R-PE-14: the SDK races the boot instead of leading it, so the Poki build —
  // with the host's script and everything it pulls loading behind the boot
  // decision — meets the same lines the plain build does. The delta between
  // the two is the host's own share of the wire, and it must not be on the
  // player's critical path.
  runnable('holds the same lines with the Poki SDK racing the boot', async () => {
    const [plain, withSdk] = await Promise.all([
      measureColdLoad(browser!, origin, DEVICES.mid, 2),
      measureColdLoad(browser!, pokiOrigin, DEVICES.mid, 2),
    ]);
    expect(Math.min(...withSdk.playableMs), `Poki build took ${withSdk.playableMs.map((ms) => Math.round(ms)).join(', ')} ms`).toBeLessThan(C2P_BUDGET_MS.mid);
    const delta = Math.min(...withSdk.playableMs) - Math.min(...plain.playableMs);
    expect(delta, 'the SDK costs the boot nothing before playable').toBeLessThan(500);
  });
});
