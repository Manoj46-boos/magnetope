import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };
const root = resolve('dist');
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]));
  const file = join(root, path === '/' || path === '\\' ? 'index.html' : path);
  if (!file.startsWith(root) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

for (const setup of [
  { name: 'desktop 960x540', options: { viewport: { width: 960, height: 540 } } },
  { name: 'desktop 1280x720', options: { viewport: { width: 1280, height: 720 } } },
]) {
  const context = await browser.newContext(setup.options);
  const page = await context.newPage();
  await page.goto(origin);
  await page.waitForSelector('.loading', { state: 'detached', timeout: 60000 });
  const probe = await page.evaluate(() => ({
    pointerCoarse: matchMedia('(pointer: coarse)').matches,
    anyCoarse: matchMedia('(any-pointer: coarse)').matches,
    anyFine: matchMedia('(any-pointer: fine)').matches,
    maxTouchPoints: navigator.maxTouchPoints,
    touchClass: document.querySelector('.touch')?.className,
    touchOpacity: getComputedStyle(document.querySelector('.touch')).opacity,
    flipBtnVisible: Boolean(document.querySelector('.flip-btn') && (() => {
      let el = document.querySelector('.flip-btn');
      let visible = true;
      while (el && el !== document.body) {
        const s = getComputedStyle(el);
        if (s.opacity === '0' || s.display === 'none' || s.visibility === 'hidden') visible = false;
        el = el.parentElement;
      }
      return visible;
    })()),
    hudOpacity: getComputedStyle(document.querySelector('.hud')).opacity,
    coachShow: Boolean(document.querySelector('.coach.show')),
  }));
  console.log(setup.name, JSON.stringify(probe, null, 1));
  await context.close();
}

await browser.close();
server.close();
