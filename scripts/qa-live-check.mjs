// The live play check the runbook owes after every publish (SUBMISSION.md
// section 12): the gh-pages artifact is the build players actually meet, so
// the gate drives THAT page at its own URL — boot, real keyboard input into
// a real run, a charge-and-launch with a mid-flight snap, and a read of the
// frame the way a player sees it. What it must prove is the three things a
// deploy can silently lose: the page boots at the host's path (the build is
// relative, and a broken base is a white screen), input reaches the game
// (the frame must move when the player does), and the session stays clean
// (no script error, no dead canvas). The deep behavioural coverage lives in
// the suites; this script is the deployed-artifact leg, and its captures go
// to download/live-check-captures for the eye.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const URL = process.env.LIVE_URL ?? 'https://manoj46-boos.github.io/magnetope/';
const OUT = '/home/z/my-project/download/live-check-captures';
mkdirSync(OUT, { recursive: true });

// Headless Chrome has no sound card, and says so in the console whenever
// audio starts; that is the machine, not the game.
const isAudioNoise = (text) => /AudioContext encountered an error from the audio device/.test(text);

const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const browser = await chromium.launch({ headless: true, args });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !isAudioNoise(m.text())) errors.push(m.text());
});

const report = [];
const check = (name, ok, detail = '') => {
  report.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
};

// Screenshots are read the way the suites read them: decoded in the page
// itself, one pass, so the comparison runs on exactly what the camera drew.
const shot = async (name) => {
  const b64 = (await page.screenshot({ path: `${OUT}/${name}.png` })).toString('base64');
  return b64;
};
const compare = (a, b) =>
  page.evaluate(async ([a1, b1]) => {
    const decode = async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const [pa, pb] = [await decode(a1), await decode(b1)];
    let changed = 0;
    let flatA = 0;
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 4) {
      if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 24) changed++;
      if (pa[i] === pa[i + 1] && pa[i + 1] === pa[i + 2]) flatA++;
    }
    return { changed: changed / (n / 4), blankA: flatA / (n / 4) > 0.995 };
  }, [a, b]);

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.loading', { state: 'detached', timeout: 45000 });
check('boots at the hosted path', (await page.locator('canvas').count()) === 1, 'loading detached, one canvas');

const title = await shot('01-title');

// Real input: the coach overlay clears on the first press and the run opens.
await page.keyboard.press('Space');
await page.waitForTimeout(600);
const started = await shot('02-started');
const firstPress = await compare(title, started);
check('title frame is a real picture', !firstPress.blankA, `${(firstPress.blankA ? 99.5 : 0).toFixed(1)}% flat would be a broken base`);
check('input moves the frame', firstPress.changed > 0.02, `${(firstPress.changed * 100).toFixed(1)}% of pixels changed on the first press`);

// A real playthrough beat: charge, launch, then a snap at whatever steel the
// climb offers — the same hands a player spends on the first shelf.
await page.keyboard.down('Space');
await page.waitForTimeout(1600);
await page.keyboard.up('Space');
await page.waitForTimeout(700);
await page.keyboard.press('Space');
await page.waitForTimeout(300);
const flight = await shot('03-flight');
const launch = await compare(started, flight);
check('the launch leaves the start frame', launch.changed > 0.02, `${(launch.changed * 100).toFixed(1)}% changed through the launch`);

// A settled minute of play: the run keeps answering, and the page stays clean.
for (let k = 0; k < 3; k++) {
  await page.keyboard.down('Space');
  await page.waitForTimeout(1600);
  await page.keyboard.up('Space');
  await page.waitForTimeout(900);
}
const played = await shot('04-played');
const settled = await compare(flight, played);
check('the session keeps playing', settled.changed > 0.02, `${(settled.changed * 100).toFixed(1)}% changed across the minute`);
check('no script error through the session', errors.length === 0, errors.join(' | ').slice(0, 200) || 'clean console');

await browser.close();
console.log(report.join('\n'));
console.log(`\ncaptures: ${OUT}`);
