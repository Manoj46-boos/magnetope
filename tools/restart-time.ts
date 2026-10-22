import { chromium } from 'playwright';
import { createServer } from 'vite';

/**
 * Times a restart (PRD pillar 2: under 400 ms, no loading screen) in headless
 * Chrome on software rendering, which draws far slower than any phone's GPU, so a
 * pass here has headroom. Two numbers per level: the rebuild itself, and the
 * rebuild plus the first frame drawn afterwards.
 *
 *   npm run restart-time
 *   npm run restart-time -- --levels=playground-14,scrapyard-00 --repeat=5
 */

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

export const HEAVY_LEVELS = ['scrapyard-00', 'scrapyard-13', 'suburbia-07', 'metropolis-14', 'playground-08', 'playground-14', 'stratosphere-14'];

export interface RestartTiming {
  id: string;
  rebuildMs: number;
  firstFrameMs: number;
  /** Whether any loading or menu surface was up once the restart finished. */
  coverShown: boolean;
}

export async function timeRestarts(ids: readonly string[], repeat: number): Promise<RestartTiming[]> {
  const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const launchArgs = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] };
  let browser: import('playwright').Browser | null = null;
  for (const channel of ['chrome' as const, undefined]) {
    try {
      browser = await chromium.launch(channel ? { channel, ...launchArgs } : launchArgs);
      break;
    } catch {
      /* a machine without that distribution falls through to the bundled one */
    }
  }
  if (!browser) throw new Error('no Chromium distribution available to measure restarts');
  try {
    const context = await browser.newContext({ viewport: { width: 640, height: 360 } });
    await context.addInitScript('window.__name = (f) => f;');
    const page = await context.newPage();
    await page.goto(server.resolvedUrls!.local[0]!);
    await page.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 30000 });
    await page.waitForTimeout(1000);

    const rows: RestartTiming[] = [];
    for (const id of ids) {
      const timing = await page.evaluate(
        async ({ id, repeat }) => {
          const game = (window as unknown as { __game: { startLevel(id: string): void } }).__game;
          const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          game.startLevel(id);
          await frame();
          const rebuilds: number[] = [];
          const firsts: number[] = [];
          for (let i = 0; i < repeat; i++) {
            const t0 = performance.now();
            game.startLevel(id);
            rebuilds.push(performance.now() - t0);
            await frame();
            firsts.push(performance.now() - t0);
          }
          const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
          const coverShown = document.querySelector('.layer.loading:not(.done), .layer.modal.open') !== null;
          return { rebuildMs: median(rebuilds), firstFrameMs: median(firsts), coverShown };
        },
        { id, repeat },
      );
      rows.push({ id, ...timing });
    }
    return rows;
  } finally {
    await browser.close();
    await server.close();
  }
}

if (process.argv[1]?.endsWith('restart-time.ts')) {
  const ids = arg('levels')?.split(',') ?? HEAVY_LEVELS;
  const rows = await timeRestarts(ids, Number(arg('repeat') ?? 5));
  console.log('level               rebuild ms   + first frame ms');
  for (const r of rows) console.log(`${r.id.padEnd(19)} ${r.rebuildMs.toFixed(0).padStart(9)} ${r.firstFrameMs.toFixed(0).padStart(18)}`);
}
