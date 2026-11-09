import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error plain ESM script without type declarations
import { BUDGET, auditBuild } from '../scripts/check-budget.mjs';

/**
 * The Poki acceptance quality bar (visual renewal PRD 21): twenty-five binary
 * checks, a passing game at twenty-two or more. The machine legs are verified
 * live against the real build, the real suites and the real files — never
 * assumed from a previous run — and the human legs are read from the dossier's
 * own evidence slots, so the score says what is honestly done, not what the
 * rubric wishes. The scoring model is the chapter's own: twenty-five green is
 * the strong-accept candidate, twenty-two to twenty-four accept with
 * revisions, and anything lower is told to iterate before submitting.
 *
 *   npm run quality-bar                 # fresh build, all machine legs
 *   npm run quality-bar -- --fast       # audit the tree as it stands
 */

const MB = 1024 * 1024;
const here = fileURLToPath(new URL('..', import.meta.url));

/** The thumbnail audit report `tools/check-thumbnail.py` writes. */
interface ThumbnailReport {
  audits?: { legibility128?: boolean; ocrEmpty?: boolean; hueCollision?: boolean; contrast?: number; poles64?: boolean };
  panel?: { score?: number | null; forcedChoiceWinner?: string | null; n?: number };
  detail?: Record<string, { failures?: string[] }>;
}

export interface QualityCheck {
  number: number;
  check: string;
  /** machine: this run verifies it. human: only the developer can, and the state reads from the dossier. */
  kind: 'machine' | 'human';
  state: boolean;
  /** What the run did to verify it, or the leg the developer owes. */
  evidence: string;
}

/** A slot still shows its underscores until a hand fills it. */
const slotFilled = (text: string): boolean => !/_{3,}/.test(text);

/** Runs a suite and reports whether it passed; the runner never fakes a green. */
function suitePassed(name: string, file: string): { state: boolean; evidence: string } {
  try {
    execFileSync('npx', ['vitest', 'run', file], { cwd: here, stdio: 'pipe', timeout: 300_000 });
    return { state: true, evidence: `${name} passes in this run` };
  } catch (error) {
    const out = error instanceof Error && 'stdout' in error ? String((error as { stdout?: Buffer }).stdout ?? '') : '';
    return { state: false, evidence: `${name} fails in this run${out ? `: ${out.split('\n').filter((l) => l.includes('×')).slice(0, 3).join('; ')}` : ''}` };
  }
}

/** The size of a file on disk, in bytes. */
const sizeOf = (rel: string): number => statSync(resolve(here, rel)).size;

/**
 * The whole bar: every check numbered exactly as the chapter's table, each
 * verified against the tree this run stands on. The human legs read the
 * dossier's own slots — the panel's score, the matrix and rehearsal tables,
 * the ledger's signature — because those are the only honest records of work
 * no machine can do for the developer.
 */
export function runQualityBar(options: { dist?: string; report?: ThumbnailReport; suiteRunner?: (name: string, file: string) => { state: boolean; evidence: string } }): QualityCheck[] {
  const dist = options.dist ?? resolve(here, 'dist');
  const report = options.report ?? (JSON.parse(readFileSync(resolve(here, 'thumbnails/report.json'), 'utf8')) as ThumbnailReport);
  const runSuite = options.suiteRunner ?? suitePassed;
  const checks: QualityCheck[] = [];

  // 1. The 200 ms thumbnail test: the panel's score is the only record, and
  // the pack's own pre-flight reads the same number.
  const panel = report.panel;
  const panelScore = panel?.score ?? null;
  checks.push({
    number: 1,
    check: 'the 200ms thumbnail test passes (7/10 cold viewers say "magnet")',
    kind: 'human',
    state: panelScore !== null && panelScore >= 0.7,
    evidence: panelScore !== null ? `the forced-choice panel scored ${panelScore}` : 'the forced-choice panel has not run: ten naive viewers, 200 ms, "which would you click?" (R-TH-07)',
  });

  // 2. The silhouette: the pack's machine leg is the cards' pole pair at
  // 64 px; naming the shape stays the panel's.
  const silhouette = report.audits?.poles64 === true;
  checks.push({
    number: 2,
    check: 'MAGNO reads as a magnet at 64×64 silhouette',
    kind: 'human',
    state: silhouette && panelScore !== null && panelScore >= 0.7,
    evidence: silhouette
      ? 'the pole pair reads at 64 px in the card audit; the panel names the shape (the silhouette pack is the panel\'s own exhibit)'
      : 'the card audit\'s 64 px pole-pair leg fails — regenerate the cards (npm run thumbnails)',
  });

  // 3. The signature test: the five-frame pack, its blind-listen leg, the
  // dossier's own review of the set.
  const submission = readFileSync(resolve(here, 'docs/SUBMISSION.md'), 'utf8');
  const signatureHonest = /four of the five frames name the game from the frame alone/.test(submission);
  checks.push({
    number: 3,
    check: 'the signature test passes (5 screenshots grouped as one game by a cold viewer)',
    kind: 'human',
    state: false,
    evidence: signatureHonest
      ? 'the review-minute pack exists and the dossier names four of five frames naming the game; the cold-viewer grouping itself is the panel\'s leg'
      : 'the review-minute pack\'s dossier entry does not read as reviewed',
  });

  // 4-5. The payload lines, measured on the build this run audits. A
  // missing build is a red check with its reason, never a crash.
  let audited: { total: number; problems: string[] };
  try {
    audited = auditBuild(dist);
  } catch (error) {
    audited = { total: Number.POSITIVE_INFINITY, problems: [`no build to audit at ${dist}: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const totalMb = audited.total / MB;
  checks.push({
    number: 4,
    check: 'initial payload under Poki\'s 5 MB hard limit',
    kind: 'machine',
    state: Number.isFinite(audited.total) && audited.total < BUDGET.hardInitial && audited.problems.length === 0,
    evidence: Number.isFinite(audited.total) ? `${totalMb.toFixed(2)} MB gzipped, the full build audit green` : audited.problems[0]!,
  });
  checks.push({
    number: 5,
    check: 'initial payload under the 4 MB internal target',
    kind: 'machine',
    state: Number.isFinite(audited.total) && audited.total < BUDGET.initial,
    evidence: Number.isFinite(audited.total) ? `${totalMb.toFixed(2)} MB gzipped of the ${(BUDGET.initial / MB).toFixed(1)} MB target` : audited.problems[0]!,
  });

  // 6. No external requests at runtime: the build suite's own leg.
  checks.push({ number: 6, check: 'no external requests at runtime', kind: 'machine', ...runSuite('the build audit suite', 'tests/build.test.ts') });

  // 7. No splash screens or outbound links: the build audit's own lines.
  const noSplash = audited.problems.filter((problem: string) => /outbound|external/.test(problem)).length === 0;
  checks.push({
    number: 7,
    check: 'no splash screens or outbound links',
    kind: 'machine',
    state: noSplash,
    evidence: noSplash ? 'the build audit\'s external-request and outbound-anchor lines hold' : 'the build audit flags an external request or outbound anchor',
  });

  // 8-9. No purchases, no third-party ad systems, no ad-block prevention:
  // the monetization suite holds all three in real Chrome.
  const monetization = runSuite('the monetization suite', 'tests/monetization-browser.test.ts');
  checks.push({ number: 8, check: 'no in-app purchases or third-party ad systems', kind: 'machine', state: monetization.state, evidence: monetization.state ? 'the monetization suite holds: only the host\'s breaks, no purchase flows' : monetization.evidence });
  const adblock = runSuite('the ad-block suite', 'tests/adblock-browser.test.ts');
  checks.push({ number: 9, check: 'no ad-block prevention (the game plays through a blocked SDK)', kind: 'machine', state: adblock.state, evidence: adblock.state ? 'the ad-block suite holds: a blocked SDK never stops play' : adblock.evidence });

  // 10-11. The SDK event rules: the platform suite holds both laws.
  const platform = runSuite('the platform suite', 'tests/platform.test.ts');
  checks.push({ number: 10, check: 'Poki SDK events fire correctly (no doubles, none during ads)', kind: 'machine', state: platform.state, evidence: platform.state ? 'the SdkBus rules hold: one start, no double stops, silence during ad windows' : platform.evidence });
  checks.push({ number: 11, check: 'commercialBreak() fires only on pause-to-gameplay transitions', kind: 'machine', state: platform.state, evidence: platform.state ? 'the retry and next-level breaks fire only on their transitions' : platform.evidence });

  // 12. Rewarded buttons: the monetization suite's own ceremony law.
  checks.push({
    number: 12,
    check: 'rewarded buttons are not green, carry the magnet icon, and are not oversized',
    kind: 'machine',
    state: monetization.state,
    evidence: monetization.state ? 'the doubler is earned and its ceremony is the suite\'s own leg' : monetization.evidence,
  });

  // 13. Audio mutes during ad breaks.
  const audio = runSuite('the audio suite', 'tests/audio.test.ts');
  checks.push({ number: 13, check: 'audio mutes during ad breaks', kind: 'machine', state: audio.state, evidence: audio.state ? 'the mute and ducking law holds through every break' : audio.evidence });

  // 14. Playable with an ad blocker active: the ad-block suite again, from
  // the cold-load leg.
  checks.push({ number: 14, check: 'game playable with an ad blocker active', kind: 'machine', state: adblock.state, evidence: adblock.state ? 'the cold load with a blocked SDK reaches play' : adblock.evidence });

  // 15. Incognito: the session suite's storage law.
  const session = runSuite('the session suite', 'tests/session.test.ts');
  checks.push({ number: 15, check: 'game playable in incognito (storage never throws)', kind: 'machine', state: session.state, evidence: session.state ? 'the storage law holds: quota errors degrade to memory exactly once' : session.evidence });

  // 16-18. The thumbnail weight lines, on the deliverables themselves.
  const staticKb = sizeOf('thumbnails/static/thumbnail-panic-628.webp') / 1024;
  checks.push({
    number: 16,
    check: 'static thumbnail under 1 MB',
    kind: 'machine',
    state: staticKb < 1024,
    evidence: `the hero card's 628 px deliverable is ${staticKb.toFixed(0)} KB`,
  });
  const webmKb = sizeOf('thumbnails/animated/thumbnail-animated.webm') / 1024;
  checks.push({
    number: 17,
    check: 'animated thumbnail WebM under 500 KB',
    kind: 'machine',
    state: webmKb < 500,
    evidence: `the animated WebM is ${webmKb.toFixed(0)} KB`,
  });
  const gifKb = sizeOf('thumbnails/animated/thumbnail-animated.gif') / 1024;
  checks.push({
    number: 18,
    check: 'animated thumbnail GIF under 1 MB',
    kind: 'machine',
    state: gifKb < 1024,
    evidence: `the animated GIF is ${gifKb.toFixed(0)} KB`,
  });

  // 19. The device matrix: the dossier's evidence table, still slots until
  // the physical devices fill it.
  const matrixSection = submission.slice(submission.indexOf('## 13. The device matrix'));
  const matrixSlots = matrixSection.slice(0, matrixSection.indexOf('## 14'));
  checks.push({
    number: 19,
    check: 'runs on one Android phone, one iPhone, one tablet, one low-end Chromebook',
    kind: 'human',
    state: slotFilled(matrixSlots),
    evidence: slotFilled(matrixSlots)
      ? 'the device matrix\'s evidence table reads filled'
      : 'the device matrix\'s evidence slots are still open (SUBMISSION.md section 13): one phone, one tablet, one low-end laptop, both orientations',
  });

  // 20. Pause on ESC and Android back: the session suite plus the back-button
  // suite's own law.
  const back = runSuite('the back-button suite', 'tests/back-button.test.ts');
  checks.push({ number: 20, check: 'pauses on ESC and on the Android back button', kind: 'machine', state: back.state && session.state, evidence: back.state && session.state ? 'both pause laws hold in their suites' : `back button: ${back.evidence}; session: ${session.evidence}` });

  // 21. The save system's degradation law.
  checks.push({ number: 21, check: 'saves work and degrade to memory on quota error', kind: 'machine', state: session.state, evidence: session.state ? 'the quota law holds: one degradation, one notice, progress kept' : session.evidence });

  // 22. The five playtests: the rehearsal log's closure column.
  const rehearsalSection = submission.slice(submission.indexOf('## 15. The five-tester'));
  const rehearsal = rehearsalSection.slice(0, rehearsalSection.indexOf('## 16'));
  const closed = (rehearsal.match(/\| (?:fixed|declined-with-reason) \|/g) ?? []).length;
  const openRows = (rehearsal.match(/\| open \|/g) ?? []).length;
  checks.push({
    number: 22,
    check: 'five external playtests completed with screen recordings',
    kind: 'human',
    state: closed >= 5 && openRows === 0,
    evidence: closed >= 5 && openRows === 0
      ? 'the rehearsal log reads closed on all five testers'
      : `the rehearsal log stands at ${closed} closed and ${openRows} open rows (SUBMISSION.md section 15) — five strangers, screen recordings, the facilitator script verbatim`,
  });

  // 23. The ledger's human column: every row carries its decision and the
  // signature block is signed.
  const ledger = readFileSync(resolve(here, 'docs/AI_LEDGER.md'), 'utf8');
  const rows = ledger.split('\n').filter((line) => line.startsWith('| 202'));
  const unsigned = rows.filter((line) => !/Directed|Accepted|approved|decision|own PRD|own plan|signed|verdict|commissioned|amended|kept honest|the plan asked for|on its report/i.test(line)).length;
  checks.push({
    number: 23,
    check: 'AI_LEDGER.md human column filled for every entry',
    kind: 'human',
    state: unsigned === 0,
    evidence: unsigned === 0
      ? `every one of the ${rows.length} ledger rows carries its human decision; ${slotFilled(ledger) ? 'the signature block is signed' : "the signature block still shows its underscores — the preflight's own leg (R-QA-08)"}`
      : `${unsigned} ledger row(s) read without a human decision`,
  });

  // 24-25. The colour-vision and reduce-motion laws, live.
  const colour = runSuite('the colour-vision suite', 'tests/colour-vision.test.ts');
  checks.push({ number: 24, check: 'colour-vision safe palette verified', kind: 'machine', state: colour.state, evidence: colour.state ? 'every field pair stays distinct under all four vision models' : colour.evidence });
  const assist = runSuite('the assist suite', 'tests/assist.test.ts');
  checks.push({ number: 25, check: 'reduce-motion path verified', kind: 'machine', state: assist.state, evidence: assist.state ? 'the reduced-motion law holds: the snap assist and its tokens stay honest' : assist.evidence });

  return checks;
}

/** The chapter's scoring model, verbatim. */
export function verdictOf(green: number): { band: string; advice: string } {
  if (green >= 25) return { band: '25/25 — strong accept candidate (~60%)', advice: 'the remaining uncertainty is the platform\'s own, not the build\'s' };
  if (green >= 22) return { band: `${green}/25 — accept with revisions (~35%)`, advice: 'iterate on the failing checks before submitting' };
  if (green >= 18) return { band: `${green}/25 — soft reject with feedback (~10%)`, advice: 'do not submit: work the failing checks until the bar clears 22' };
  return { band: `${green}/25 — hard reject`, advice: 'do not submit: the chapter\'s directive is to iterate, not to hope' };
}

function main(): number {
  const fast = process.argv.includes('--fast');
  if (!fast) {
    execFileSync('npm', ['run', 'build'], { cwd: here, stdio: 'inherit' });
  }

  const checks = runQualityBar({});
  console.log('The Poki acceptance quality bar (visual renewal PRD 21) — twenty-five binary checks.\n');
  for (const check of checks) {
    const mark = check.state ? '✔' : '✘';
    const who = check.kind === 'machine' ? 'machine' : 'human ';
    console.log(`${mark} ${String(check.number).padStart(2)}. [${who}] ${check.check}`);
    console.log(`      ${check.evidence}`);
  }

  const green = checks.filter((c) => c.state).length;
  const humanPending = checks.filter((c) => !c.state && c.kind === 'human').length;
  const { band, advice } = verdictOf(green);
  console.log(`\n${band}`);
  console.log(`${green} green, ${25 - green} pending. ${advice}.`);
  if (humanPending > 0) console.log(`The ${humanPending} human leg(s) above are the developer's own: the panels, the devices, the strangers. The build cannot run them for you.`);
  return green >= 22 ? 0 : 1;
}

if (process.argv[1]?.endsWith('quality-bar.ts')) {
  process.exit(main());
}
