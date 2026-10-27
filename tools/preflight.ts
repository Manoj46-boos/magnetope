import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPINE_DOCS } from './doc-spine';

/**
 * The submission-day runbook's machine half (premium PRD R-QA-08, R-QA-10).
 * The runbook itself is SUBMISSION.md section 12; this tool walks its steps in
 * order, runs every leg a machine can run, and prints the human legs with the
 * state they are honestly in — a signature slot either still shows its
 * underscores or it does not, and the tool can tell the difference. Version
 * discipline rides at the foot: the CHANGELOG's newest version must be tagged
 * at HEAD, and the run prints the dossier state hash the platform's reviewers
 * answer against.
 *
 *   npm run preflight              # the full checklist, fresh build
 *   npm run preflight -- --fast    # no rebuild; audit the tree as it stands
 */

export interface RunbookStep {
  id: number;
  title: string;
  /** machine: this tool runs it. human: only the developer can. day: the submission day itself. */
  kind: 'machine' | 'human' | 'day';
}

/** The runbook's steps, in the order the dossier prints them (R-QA-08). */
export const RUNBOOK_STEPS: readonly RunbookStep[] = [
  { id: 1, title: 'build green', kind: 'machine' },
  { id: 2, title: 'thumbnail pre-flight', kind: 'machine' },
  { id: 3, title: 'dossier current', kind: 'machine' },
  { id: 4, title: 'ledger signed', kind: 'human' },
  { id: 5, title: 'categories chosen', kind: 'machine' },
  { id: 6, title: 'version tagged', kind: 'machine' },
  { id: 7, title: 'upload', kind: 'day' },
  { id: 8, title: 'playtest immediately', kind: 'day' },
  { id: 9, title: 'log the first 10 videos', kind: 'day' },
];

export interface TagAudit {
  ok: boolean;
  /** The version the CHANGELOG's newest row names, if the file parses. */
  version: string | null;
  problem: string | null;
}

/** R-QA-10: the CHANGELOG's newest version must be a tag on HEAD. */
export function tagAudit(changelog: string, tagsAtHead: readonly string[]): TagAudit {
  const rows = changelog.split('\n').filter((line) => line.startsWith('| v'));
  const newest = rows[0]?.match(/\| (v[\d.]+[a-z0-9-]*) \|/);
  if (!newest) return { ok: false, version: null, problem: 'CHANGELOG.md carries no version row' };
  const version = newest[1]!;
  if (!tagsAtHead.includes(version)) return { ok: false, version, problem: `${version} is not tagged at HEAD — git tag ${version} and push it` };
  return { ok: true, version, problem: null };
}

/** A signature slot still shows its underscores until a hand fills it. */
export function signatureState(text: string): 'pending' | 'signed' {
  return /^.{0,40}:\s*_{3,}\s*$/m.test(text) ? 'pending' : 'signed';
}

/** The thumbnail audit report `tools/check-thumbnail.py` writes, the shape this leg reads. */
export interface ThumbnailReport {
  audits?: { legibility128?: boolean; ocrEmpty?: boolean; hueCollision?: boolean; contrast?: number };
  panel?: { score?: number | null };
  detail?: Record<string, { failures?: string[] }>;
}

/** The five-point pre-flight's machine half: the four audits on every card and the ident budgets. */
export function thumbnailPreflight(report: ThumbnailReport): { ok: boolean; problems: string[]; panelScore: number | null } {
  const problems: string[] = [];
  const audits = report.audits ?? {};
  if (audits.ocrEmpty !== true) problems.push('the cards are not OCR-empty (R-TH-02)');
  if (audits.legibility128 !== true) problems.push('a card fails legibility at 128 px (R-TH-01)');
  if (typeof audits.contrast !== 'number' || audits.contrast < 3) problems.push('subject contrast sits under 3:1 (R-TH-05)');
  if (audits.hueCollision !== false) problems.push('a card collides with the playground background hue (R-TH-05)');
  for (const [name, detail] of Object.entries(report.detail ?? {})) {
    if ((detail.failures ?? []).length > 0) problems.push(`${name}: ${detail.failures!.join(', ')}`);
  }
  return { ok: problems.length === 0, problems, panelScore: report.panel?.score ?? null };
}

const git = (args: string[]): string => execFileSync('git', args, { cwd: fileURLToPath(new URL('..', import.meta.url)) }).toString().trim();

function run(fast: boolean): number {
  const here = fileURLToPath(new URL('..', import.meta.url));
  const failures: string[] = [];

  console.log('The submission-day checklist (R-QA-08) — the machine legs run, the human legs report their state.\n');

  console.log('1. build green');
  if (fast) {
    if (!existsSync(resolve(here, 'dist/index.html'))) {
      failures.push('no build to audit: run without --fast, or npm run build:poki first');
      console.log('   no build to audit');
    } else {
      execFileSync('node', ['scripts/check-budget.mjs', '--poki'], { cwd: here, stdio: 'inherit' });
      console.log('   the built tree audits clean (no fresh build under --fast)');
    }
  } else {
    execFileSync('npm', ['run', 'build:poki'], { cwd: here, stdio: 'inherit' });
  }

  console.log('\n2. thumbnail pre-flight');
  const thumb = thumbnailPreflight(JSON.parse(readFileSync(resolve(here, 'thumbnails/report.json'), 'utf8')) as ThumbnailReport);
  if (thumb.ok) console.log('   the four machine points pass on every card and the ident');
  else for (const problem of thumb.problems) failures.push(problem);
  if (thumb.panelScore !== null && thumb.panelScore >= 0.9) console.log(`   the forced-choice panel scored ${thumb.panelScore}`);
  else console.log('   the forced-choice panel has not run: ten naive viewers, 200 ms, "which would you click?" — nothing uploads before it scores 9/10 (R-TH-07)');

  console.log('\n3. dossier current');
  let drifted = 0;
  for (const [name, render] of SPINE_DOCS) {
    if (readFileSync(resolve(here, 'docs', name), 'utf8') !== render()) {
      failures.push(`docs/${name} has drifted from the code — npm run docs`);
      drifted++;
    }
  }
  if (drifted === 0) console.log('   all nine spine docs re-render byte for byte');

  console.log('\n4. ledger signed');
  const ledger = readFileSync(resolve(here, 'docs/AI_LEDGER.md'), 'utf8');
  const audit = readFileSync(resolve(here, 'docs/SUBMISSION.md'), 'utf8');
  const ledgerState = signatureState(ledger);
  const auditState = signatureState(audit);
  console.log(`   the ledger's director block: ${ledgerState}`);
  console.log(`   the safety audit and review pack signatures: ${auditState}`);
  if (ledgerState === 'pending' || auditState === 'pending') console.log('   yours: play the game, re-read the audit, then sign and date both — no build step can do this for you');

  console.log('\n5. categories chosen');
  const categories = /\*\*Suggested categories:\*\* [^\u2014|\n]+/.exec(audit);
  if (categories) console.log(`   ${categories[0]!.replace('**Suggested categories:**', '').trim()} — re-check against the live catalog at the door (R-QA-11)`);
  else failures.push('the dossier carries no suggested-categories line (R-QA-11)');

  console.log('\n6. version tagged (R-QA-10)');
  const changelog = readFileSync(resolve(here, 'CHANGELOG.md'), 'utf8');
  const tags = git(['tag', '--points-at', 'HEAD']).split('\n').filter(Boolean);
  const auditedTag = tagAudit(changelog, tags);
  if (auditedTag.ok) console.log(`   ${auditedTag.version} is tagged at HEAD`);
  else failures.push(auditedTag.problem!);
  try {
    console.log(`   dossier state hash: ${git(['rev-parse', 'HEAD:docs'])} — record it beside the submission`);
  } catch {
    console.log('   dossier state hash: (not a git worktree)');
  }

  console.log('\n7-9. the day itself');
  console.log('   upload the tagged build through the Poki dashboard');
  console.log('   playtest immediately and watch the first session; the play build is the project page (SUBMISSION.md section 12)');
  console.log('   log the first 10 videos and their confusions to docs/ROADMAP.md — the unlock for player-fit is watching them');
  console.log('   then the post-submission protocol (PRD Ch. 30.4) owns the calendar');

  if (failures.length > 0) {
    console.log(`\n${failures.length} machine leg(s) red:`);
    for (const failure of failures) console.log(`- ${failure}`);
    return 1;
  }
  console.log('\nEvery machine leg is green. The human legs above are the dossier\'s own owed verdicts — the runbook ends when they do.');
  return 0;
}

if (process.argv[1]?.endsWith('preflight.ts')) {
  process.exit(run(process.argv.includes('--fast')));
}
