import { launchBrowser, startServer } from '../tests/browser/harness';
import type { RenderReport, RenderSpec } from '../tests/browser/audio-fixture';

/**
 * Renders the game's audio offline in Chrome on a stored route per biome, a
 * tumble and the ending film, and prints programme loudness and true peak
 * against the PRD 9.6 mix standard: -14 LUFS integrated, true peak -1.5 dBTP.
 *
 *   npm run loudness
 *   npm run loudness -- --only=stratosphere-03 --profile    one scenario, with its level second by second
 *   npm run loudness -- --full                               the full mix only, for quick tuning
 */

const TARGET_LUFS = -14;
const CEILING_DBTP = -1.5;

const SCENARIOS: Array<{ name: string; spec: RenderSpec }> = [
  ...(['scrapyard-03', 'suburbia-03', 'metropolis-03', 'playground-03', 'stratosphere-03'] as const).map((levelId) => ({
    name: levelId,
    spec: { scenario: { kind: 'route', levelId }, seconds: 45 } as RenderSpec,
  })),
  { name: 'tumble', spec: { scenario: { kind: 'tumble', levelId: 'scrapyard-03', fallAtSeconds: 14 }, seconds: 30 } },
  { name: 'ending', spec: { scenario: { kind: 'ending' }, seconds: 60 } },
];

const argument = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const only = argument('only');
const showProfile = process.argv.includes('--profile');
const fullMixOnly = process.argv.includes('--full');

const fmt = (v: number): string => (Number.isFinite(v) ? v.toFixed(1).padStart(6) : '  -inf');

async function main(): Promise<void> {
  const browser = await launchBrowser();
  if (!browser) throw new Error('no browser can start');
  const { server, url } = await startServer();
  const page = await browser.newPage();
  await page.addInitScript('window.__name = (f) => f;');
  await page.goto(`${url}tests/browser/audio.html`);
  await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true, null, { timeout: 30000 });

  const run = (spec: RenderSpec): Promise<RenderReport> =>
    page.evaluate((s) => (window as unknown as { renderAudio: (spec: RenderSpec) => Promise<RenderReport> }).renderAudio(s), spec);

  console.log(`target ${TARGET_LUFS} LUFS integrated, ceiling ${CEILING_DBTP} dBTP\n`);
  console.log('scenario        mix          LUFS  short-term  sample pk  true pk');
  for (const { name, spec } of SCENARIOS.filter((s) => !only || s.name === only)) {
    const mixes: Array<[string, RenderSpec]> = [
      ['full', spec],
      ['sfx+ui', { ...spec, mute: ['music', 'amb'] }],
      ['music', { ...spec, mute: ['sfx', 'amb', 'ui'] }],
      ['ambience', { ...spec, mute: ['sfx', 'music', 'ui'] }],
    ];
    for (const [mix, mixSpec] of fullMixOnly ? mixes.slice(0, 1) : mixes) {
      const r = await run(mixSpec);
      console.log(`${name.padEnd(15)} ${mix.padEnd(11)} ${fmt(r.integratedLufs)} ${fmt(r.shortTermMaxLufs)}     ${fmt(r.samplePeakDb)}    ${fmt(r.truePeakDb)}`);
      if (showProfile) console.log(`   per second dBFS: ${r.perSecondDb.map((db) => Math.round(db)).join(' ')}`);
    }
  }

  await browser.close();
  await server.close();
}

void main();
