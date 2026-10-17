import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

/**
 * Plays levels in a real browser, the way a player would see them: records a
 * video, takes screenshots on a timer, and reports page errors and frame rate.
 * The dev server must be running.
 *
 *   npx tsx tools/playtest.ts stratosphere-14 --shots=6 --seconds=70
 */

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (name: string, fallback: number): number => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const everySeconds = flag('shots', 6);
const maxSeconds = flag('seconds', 90);
const url = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1] ?? 'http://localhost:5173';
const out = resolve('playtests');

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

for (const id of ids) {
  const dir = resolve(out, id);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir, size: { width: 960, height: 540 } } });
  await context.addInitScript('window.__name = (f) => f;');
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  });

  await page.goto(url);
  await page.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.mouse.click(480, 270);

  await page.evaluate(async (levelId) => {
    const g = (window as any).__game;
    g.startLevel(levelId);
    const text = (await import(/* @vite-ignore */ `/src/levels/routes/${levelId}.json?raw`)).default;
    g.debug.autoplay(JSON.parse(text));
    (window as any).__frames = [];
    let last = performance.now();
    const tick = (now: number) => {
      (window as any).__frames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, id);

  const started = Date.now();
  let shot = 0;
  let phase = 'play';
  while ((Date.now() - started) / 1000 < maxSeconds) {
    await page.waitForTimeout(everySeconds * 1000);
    await page.screenshot({ path: resolve(dir, `shot-${String(shot++).padStart(2, '0')}.png`), timeout: 120000 });
    phase = await page.evaluate(() => (window as any).__game.phase as string);
    if (phase === 'cleared') {
      await page.waitForTimeout(1500);
      await page.screenshot({ path: resolve(dir, `shot-${String(shot++).padStart(2, '0')}-end.png`), timeout: 120000 });
      break;
    }
  }

  const stats = await page.evaluate(() => {
    const g = (window as any).__game;
    const frames: number[] = (window as any).__frames;
    const sorted = [...frames].sort((a, b) => a - b);
    return {
      phase: g.phase as string,
      cleared: Boolean(g.sim?.run.cleared),
      falls: g.sim?.run.fallCount as number,
      frames: frames.length,
      medianMs: sorted[Math.floor(sorted.length / 2)] ?? 0,
      p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      audio: g.audioEngine.ctx?.state ?? 'none',
    };
  });
  await context.close();
  console.log(`${id}: ${JSON.stringify(stats)}`);
  console.log(`  ${problems.length ? problems.slice(0, 8).join('\n  ') : 'no page errors or warnings'}`);
  console.log(`  video and shots in ${dir}`);
}
await browser.close();
