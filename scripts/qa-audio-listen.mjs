import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

/**
 * Renders the blind-listen panel's own material (premium PRD W9, R-AU-11): the
 * five harmonizations as a player meets them in each biome, the boot hum with
 * its motif, the stinger set with the bed under them, and the ending's one
 * through-composed cue — real offline renders of the real audio graph, saved
 * as WAV under download/audio-listen/ with the panel's protocol beside them.
 *
 *   node scripts/qa-audio-listen.mjs
 *
 * The protocol: five listeners, three reference tracks from top-tier platform
 * titles interleaved in random order, one question — "does this fit a premium
 * game?" — four of five required before milestone M4. If the panel says no,
 * iterate the recipes (macro tuning, chord voicings, reverb character); the
 * two-minute menu cue commission stays the developer's own call.
 */

const OUT = resolve('download/audio-listen');
mkdirSync(OUT, { recursive: true });

const server = await createServer({ logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false } });
await server.listen();
const origin = server.resolvedUrls.local[0];

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
const problems = [];
page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !/AudioContext|Cross-Origin-Opener/.test(message.text())) problems.push(`console: ${message.text()}`);
});
await page.addInitScript('window.__name = (f) => f;');
await page.goto(`${origin}tests/browser/audio.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });

const render = (spec) => page.evaluate((s) => window.renderAudioWav(s), spec);
const save = (name, spec) =>
  render(spec).then((base64) => {
    writeFileSync(resolve(OUT, `${name}.wav`), Buffer.from(base64, 'base64'));
    console.log(`wrote ${name}.wav`);
  });

const runs = [
  ['01-boot-hum-the-motif', { scenario: { kind: 'stinger', levelId: 'scrapyard-00', callAtSeconds: 999, call: 'none' }, seconds: 14 }],
  ['02-scrapyard-jaunty', { scenario: { kind: 'route', levelId: 'scrapyard-03' }, seconds: 30 }],
  ['03-suburbia-breezy', { scenario: { kind: 'route', levelId: 'suburbia-03' }, seconds: 30 }],
  ['04-metropolis-neon-pulse', { scenario: { kind: 'route', levelId: 'metropolis-03' }, seconds: 30 }],
  ['05-playground-toy-box', { scenario: { kind: 'route', levelId: 'playground-03' }, seconds: 30 }],
  ['06-stratosphere-thin-air', { scenario: { kind: 'route', levelId: 'stratosphere-03' }, seconds: 30 }],
  ['07-thin-air-first-level-air-stem-only', { scenario: { kind: 'stinger', levelId: 'stratosphere-01', callAtSeconds: 999, call: 'none' }, seconds: 20 }],
  ['08-clear-card-the-motif-quote', { scenario: { kind: 'stinger', levelId: 'scrapyard-03', callAtSeconds: 3, call: 'clear' }, seconds: 10 }],
  ['09-biome-call-reharmonized', { scenario: { kind: 'stinger', levelId: 'suburbia-03', callAtSeconds: 3, call: 'biome' }, seconds: 10 }],
  ['10-ending-through-composed', { scenario: { kind: 'ending' }, seconds: 60 }],
];
for (const [name, spec] of runs) await save(name, spec);

await browser.close();
await server.close();

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

writeFileSync(
  resolve(OUT, 'PANEL.md'),
  [
    '# The blind-listen panel (R-AU-11)',
    '',
    'These renders are the game\u2019s real audio graph, rendered offline from the live code \u2014 the five harmonizations as a player meets them, the boot hum with its motif, the stinger set over the ducked bed, the thin-air level that teaches the ear, and the ending\u2019s one through-composed cue.',
    '',
    '## The protocol',
    '',
    '1. Five listeners, headphones, a quiet room.',
    '2. Interleave these tracks with three reference tracks from top-tier platform titles, in random order, unlabelled.',
    '3. One question per track: **does this fit a premium game?**',
    '4. The gate is **\u2265 4 of 5** before milestone M4 (the Risk-6 answer).',
    '5. If the panel says no: iterate the recipes \u2014 macro tuning, chord voicings, reverb character \u2014 and re-render. Commissioning a single two-minute menu cue is the documented budget fallback, decided by the developer, not defaulted to.',
    '',
    '## The tracks',
    '',
    '| File | What the listener hears |',
    '| --- | --- |',
    '| 01-boot-hum | The score from boot: the motif stated inside three seconds, then the breathing rest |',
    '| 02\u201306 | One harmonization per biome, a real route\u2019s climb: rest, play, flight |',
    '| 07-thin-air | The Stratosphere\u2019s first level: the air stem alone, the composed silence (R-AU-12) |',
    '| 08-clear-card | The verdict chain: the motif quote, then the stamps, the par coda |',
    '| 09-biome-call | The announce: the same five notes in a new key |',
    '| 10-ending | The wordless homecoming, one continuous cue from seat to credits |',
    '',
  ].join('\n'),
);
console.log('wrote PANEL.md');
console.log('LISTEN GATE: material ready \u2014 panel leg is the developer\u2019s own ear');
