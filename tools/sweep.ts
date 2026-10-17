import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * Plays every level through the real game loop with its stored route and
 * photographs the climb at four moments, so the whole game can be looked at in
 * an afternoon. Also records, per level, whether it cleared, how long it took,
 * how heavy a frame was (draw calls, triangles) and any page error.
 * The dev server must be running.
 *
 *   npx tsx tools/sweep.ts --url=http://localhost:5192
 *   npx tsx tools/sweep.ts --only=playground,stratosphere-14 --quality=mid
 *
 * Then `python tools/sheets.py playtests/sweep` lays the shots out as contact sheets.
 */

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const url = arg('url') ?? 'http://localhost:5173';
const only = arg('only')?.split(',');
const quality = arg('quality') ?? 'high';
const width = Number(arg('width') ?? 640);
const height = Math.round((width * 9) / 16);
const out = resolve(arg('out') ?? 'playtests/sweep');
const MARKS = [0.06, 0.36, 0.66, 0.97];
const MAX_TICKS = 7200;
/** Frames drawn before each photograph, so the camera and moving props have settled into the picture. */
const LEAD_FRAMES = 45;

interface LevelReport {
  id: string;
  cleared: boolean;
  ticks: number;
  seconds: number;
  parSeconds: number;
  stars: number;
  msPerFrame: number;
  drawCalls: number;
  triangles: number;
  problems: string[];
}

mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width, height } });
await context.addInitScript('window.__name = (f) => f;');
const page = await context.newPage();
let problems: string[] = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const text = m.text();
  if (m.type() === 'error' && !/AudioContext encountered an error/.test(text)) problems.push(text);
});

await page.goto(url);
await page.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 30000 });
await page.waitForTimeout(1500);

const ids = await page.evaluate(async () => {
  const source = '/src/levels/index.ts';
  const levels = (await import(/* @vite-ignore */ source)) as { ALL_LEVELS: Array<{ id: string }> };
  return levels.ALL_LEVELS.map((l) => l.id);
});

const chosen = ids.filter((id) => !only || only.some((o) => id === o || id.startsWith(`${o}-`)));
const reports: LevelReport[] = [];

for (const id of chosen) {
  problems = [];
  const result = await page.evaluate(
    async ({ id, marks, maxTicks, quality, lead }) => {
      const g = (window as any).__game;
      const text = (await import(/* @vite-ignore */ `/src/levels/routes/${id}.json?raw`)).default as string;
      const route = JSON.parse(text);
      const canvas = document.getElementById('view') as HTMLCanvasElement;
      g.debug.setQuality(quality);
      g.debug.holdClock(true);
      g.debug.setUiVisible(false);
      g.debug.settings.ghosts = false;

      const scene = g.debug.renderer;
      const w = window as any;
      w.__drawFrame ??= scene.frame.bind(scene);
      w.__drawing = false;
      scene.frame = (ctx: unknown) => (w.__drawing ? w.__drawFrame(ctx) : undefined);

      const play = (shotAt: number[]) => {
        g.startLevel(id);
        g.debug.autoplay(route);
        const shots: string[] = [];
        let ticks = 0;
        let spent = 0;
        let calls = 0;
        let triangles = 0;
        const info = g.debug.renderer.renderer.info;
        while (g.debug.phase !== 'cleared' && ticks < maxTicks) {
          const counting = shotAt.includes(ticks + 1);
          w.__drawing = shotAt.some((at) => at - ticks <= lead && at - ticks > 0);
          if (counting) {
            info.autoReset = false;
            info.reset();
          }
          const began = performance.now();
          g.debug.advance(1 / 60);
          spent += performance.now() - began;
          ticks++;
          if (counting) {
            shots.push(canvas.toDataURL('image/jpeg', 0.84));
            calls = info.render.calls;
            triangles = info.render.triangles;
            info.autoReset = true;
          }
        }
        return { ticks, shots, spent, calls, triangles, cleared: g.debug.phase === 'cleared', timeMs: g.debug.sim.run.timeMs };
      };

      const measure = play([]);
      const at = marks.map((m: number) => Math.max(1, Math.round(measure.ticks * m)));
      const shot = play(at);
      return {
        cleared: shot.cleared,
        ticks: shot.ticks,
        timeMs: shot.timeMs,
        parSeconds: g.debug.sim.level.parSeconds as number,
        stars: (g.debug.save.data.stars[id] ?? 0) as number,
        msPerFrame: shot.spent / Math.max(1, shot.ticks),
        drawCalls: shot.calls,
        triangles: shot.triangles,
        shots: shot.shots,
      };
    },
    { id, marks: MARKS, maxTicks: MAX_TICKS, quality, lead: LEAD_FRAMES },
  );

  result.shots.forEach((data, i) => writeFileSync(resolve(out, `${id}-${i + 1}.jpg`), Buffer.from(data.split(',')[1]!, 'base64')));
  const report: LevelReport = {
    id,
    cleared: result.cleared,
    ticks: result.ticks,
    seconds: Math.round(result.timeMs / 100) / 10,
    parSeconds: result.parSeconds,
    stars: result.stars,
    msPerFrame: Math.round(result.msPerFrame * 10) / 10,
    drawCalls: result.drawCalls,
    triangles: result.triangles,
    problems: [...problems],
  };
  reports.push(report);
  const flag = report.cleared && report.problems.length === 0 ? 'ok ' : 'BAD';
  console.log(`${flag} ${id.padEnd(16)} ${String(report.seconds).padStart(6)}s par ${String(report.parSeconds).padStart(3)}  stars ${report.stars}  ${String(report.msPerFrame).padStart(5)} ms/frame  ${String(report.drawCalls).padStart(4)} calls  ${(report.triangles / 1000).toFixed(0).padStart(4)}k tris${report.problems.length ? `  ${report.problems[0]}` : ''}`);
}

writeFileSync(resolve(out, 'report.json'), JSON.stringify(reports, null, 2));
await browser.close();
