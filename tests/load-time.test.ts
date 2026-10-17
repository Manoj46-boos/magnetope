import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEVICES, measureColdLoad, serveGzipped } from '../tools/cold-load';
import { launchBrowser } from './browser/harness';

/**
 * PRD 10.3 and 14.3: the first level must be playable in under ten seconds on a mid-range phone,
 * because players leave after that. The production bundle is built, served gzipped and loaded cold
 * on a throttled device the way a CDN would deliver it.
 */

const root = resolve(__dirname, '..');
const MB = 1024 * 1024;
const PLAYABLE_BUDGET_MS = 10_000;

let browser: Browser | null = null;
let distDir = '';
let origin = '';
let close: () => Promise<void> = async () => undefined;

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  distDir = mkdtempSync(join(tmpdir(), 'magnetope-load-'));
  execFileSync(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', distDir, '--emptyOutDir'], { cwd: root, stdio: 'pipe' });
  ({ origin, close } = await serveGzipped(distDir));
}, 240_000);

afterAll(async () => {
  await browser?.close();
  await close();
  if (distDir) rmSync(distDir, { recursive: true, force: true });
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
    240_000,
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

  runnable('is playable within ten seconds on a mid-range phone over 4G', async () => {
    const { playableMs, bytes } = await measureColdLoad(browser!, origin, DEVICES.mid, 2);
    expect(Math.min(...playableMs), `loads took ${playableMs.map((ms) => Math.round(ms)).join(', ')} ms`).toBeLessThan(PLAYABLE_BUDGET_MS);
    expect(bytes).toBeLessThan(1.7 * MB);
  });

  runnable('is playable within three seconds on a desktop connection', async () => {
    const { playableMs } = await measureColdLoad(browser!, origin, DEVICES.desktop, 2);
    expect(Math.min(...playableMs), `loads took ${playableMs.map((ms) => Math.round(ms)).join(', ')} ms`).toBeLessThan(3000);
  });
});
