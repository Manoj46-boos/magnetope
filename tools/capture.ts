import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright';

/**
 * In-engine capture for thumbnails and trailers (PRD 6.6). The game clock is
 * held, so every frame is rendered at exactly 1/60 s whatever the machine
 * speed, and the canvas is read back without any UI on top. The dev server
 * must be running.
 *
 *   npx tsx tools/capture.ts --level=scrapyard-02 --size=628 --from=40 --frames=1 --center=2,8 --height=22
 *   npx tsx tools/capture.ts --level=scrapyard-02 --trace
 *   npx tsx tools/capture.ts --level=scrapyard-04 --from=60 --frames=180 --chase=2.4,2.2 --height=9 --roll=-7
 *   npx tsx tools/capture.ts --thumb=hero-launch --size=628 --from=20 --frames=1
 *   npx tsx tools/capture.ts --thumb=hero-launch --ident --size=628 --frames=180
 *
 * `--chase=dx,dy` eases the camera after MAGNO instead of holding the framing.
 * `--thumb` renders the composition scene instead of gameplay (PRD 17.3), and
 * `--ident` plays its 3 s Cooper timeline frame by frame.
 */

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const levelId = arg('level') ?? 'scrapyard-01';
const size = Number(arg('size') ?? 628);
const scale = Number(arg('scale') ?? 2);
const from = Number(arg('from') ?? 0);
const frames = Number(arg('frames') ?? 1);
const every = Number(arg('every') ?? 1);
const center = (arg('center') ?? '0,10').split(',').map(Number) as [number, number];
const height = Number(arg('height') ?? 20);
const roll = Number(arg('roll') ?? 0);
const follow = flag('follow');
const chase = arg('chase')?.split(',').map(Number) as [number, number] | undefined;
const rim = flag('rim');
const thumb = arg('thumb');
const ident = flag('ident');
const url = arg('url') ?? 'http://localhost:5173';
const outDir = resolve(arg('out') ?? 'thumbnails/frames');
const name = arg('name');

interface TracePoint {
  tick: number;
  state: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

async function prepare(page: Page): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  if (thumb) {
    await page.evaluate(
      ({ thumb, ident, rim }) => {
        const g = (window as any).__game;
        g.debug.setQuality('high');
        g.debug.holdClock(true);
        g.debug.setUiVisible(false);
        g.debug.settings.ghosts = false;
        g.debug.settings.rimTint = rim;
        g.debug.thumbnail(thumb, ident);
      },
      { thumb, ident, rim },
    );
    return;
  }
  await page.evaluate(
    async ({ id, framing, follow, rim }) => {
      const g = (window as any).__game;
      const text = (await import(/* @vite-ignore */ `/src/levels/routes/${id}.json?raw`)).default;
      g.startLevel(id);
      g.debug.setQuality('high');
      g.debug.holdClock(true);
      g.debug.setUiVisible(false);
      g.debug.settings.ghosts = false;
      g.debug.settings.rimTint = rim;
      g.debug.autoplay(JSON.parse(text));
      if (!follow) g.debug.renderer.directCamera(framing);
    },
    { id: levelId, framing: { center: { x: center[0], y: center[1] }, visibleHeight: height, rollDeg: roll }, follow, rim },
  );
}

async function trace(page: Page, ticks: number): Promise<TracePoint[]> {
  return page.evaluate((count) => {
    const g = (window as any).__game;
    const out: TracePoint[] = [];
    for (let i = 0; i < count; i++) {
      g.debug.advance(1 / 60);
      const v = g.debug.sim.magno.view;
      out.push({ tick: i, state: v.state, x: v.position.x, y: v.position.y, vx: v.velocity.x, vy: v.velocity.y });
    }
    return out;
  }, ticks);
}

let browser: import('playwright').Browser | null = null;
const launchArgs = { headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] };
for (const channel of ['chrome' as const, undefined]) {
  try {
    browser = await chromium.launch(channel ? { channel, ...launchArgs } : launchArgs);
    break;
  } catch {
    /* a machine without that distribution falls through to the bundled one */
  }
}
if (!browser) throw new Error('no Chromium distribution available to capture');
const context = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: scale });
await context.addInitScript('window.__name = (f) => f;');
const page = await context.newPage();
page.on('pageerror', (e) => console.error(`pageerror: ${e.message}`));
await prepare(page);

if (flag('trace')) {
  const points = await trace(page, Number(arg('ticks') ?? 900));
  let last = '';
  for (const p of points) {
    if (p.state === last && p.tick % 30 !== 0) continue;
    last = p.state;
    console.log(`${String(p.tick).padStart(4)} ${p.state.padEnd(10)} x=${p.x.toFixed(1).padStart(6)} y=${p.y.toFixed(1).padStart(6)} v=${p.vx.toFixed(1)},${p.vy.toFixed(1)}`);
  }
} else {
  mkdirSync(outDir, { recursive: true });
  await page.evaluate((n) => {
    const g = (window as any).__game;
    for (let i = 0; i < n; i++) g.debug.advance(1 / 60);
  }, from);
  if (chase) {
    await page.evaluate((c) => {
      const p = (window as any).__game.debug.sim.magno.view.position;
      (window as any).__cam = { x: p.x + c[0], y: p.y + c[1] };
    }, chase);
  }
  for (let i = 0; i < frames; i++) {
    const data = await page.evaluate(
      ({ step, chase, framing }) => {
        const g = (window as any).__game;
        const w = window as any;
        w.__cam ??= { ...framing.center };
        for (let k = 0; k < step; k++) {
          if (chase) {
            const p = g.debug.sim.magno.view.position;
            w.__cam.x += (p.x + chase[0] - w.__cam.x) * 0.1;
            w.__cam.y += (p.y + chase[1] - w.__cam.y) * 0.1;
            g.debug.renderer.directCamera({ center: { ...w.__cam }, visibleHeight: framing.visibleHeight, rollDeg: framing.rollDeg });
          }
          g.debug.advance(1 / 60);
        }
        return (document.querySelector('canvas') as HTMLCanvasElement).toDataURL('image/png');
      },
      { step: every, chase, framing: { center: { x: center[0], y: center[1] }, visibleHeight: height, rollDeg: roll } },
    );
    writeFileSync(resolve(outDir, `${name ?? `${levelId}-${String(from + i * every).padStart(4, '0')}`}.png`), Buffer.from(data.split(',')[1]!, 'base64'));
  }
  console.log(`wrote ${frames} frame(s) to ${outDir}`);
}
await browser.close();
