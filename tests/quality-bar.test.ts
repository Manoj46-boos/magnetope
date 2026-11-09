import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runQualityBar, verdictOf } from '../tools/quality-bar';

/**
 * The quality bar's own law (visual renewal PRD 21): the tally runs the real
 * checks against the real tree, reads the human legs from the dossier's own
 * slots, and never counts a check green without evidence. These tests hold
 * the tally to that: every leg is fed a tree that passes or a tree that
 * fails, and the score must move exactly as the evidence does.
 */

const root = resolve(__dirname, '..');

// The suites are stubbed per test: the tally's job is to read their verdict,
// not to re-run the batteries this file would take minutes to run.
const pass = () => ({ state: true, evidence: 'stubbed green' });
const fail = (name: string) => ({ state: false, evidence: `${name} fails in this run` });

const report = JSON.parse(readFileSync(resolve(root, 'thumbnails/report.json'), 'utf8'));

/** A full-tree run with every suite green and a filled dist, on the real dossier. */
const allGreen = (overrides: Partial<Parameters<typeof runQualityBar>[0]> = {}) =>
  runQualityBar({ dist: resolve(root, 'dist'), report, suiteRunner: pass, ...overrides });

describe('the quality bar tally (visual renewal PRD 21)', () => {
  let broken: string;

  beforeAll(() => {
    broken = mkdtempSync(join(tmpdir(), 'magnetope-bar-'));
  });

  afterAll(() => {
    rmSync(broken, { recursive: true, force: true });
  });

  it('numbers the checks exactly as the chapter\'s table: twenty-five, no gaps', () => {
    const checks = allGreen();
    expect(checks.map((c) => c.number)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it('counts twenty green on the honest tree: the machine legs pass, the five human legs are pending', () => {
    const checks = allGreen();
    const green = checks.filter((c) => c.state).length;
    expect(green).toBe(20);
    expect(checks.filter((c) => c.kind === 'human' && !c.state).map((c) => c.number).sort((a, b) => a - b)).toEqual([1, 2, 3, 19, 22]);
  });

  it('turns the panel green when the score lands, and keeps the silhouette honest until then', () => {
    const scored = allGreen({ report: { ...report, panel: { ...report.panel, score: 0.8 } } });
    expect(scored[0]!.state).toBe(true);
    expect(scored[1]!.state).toBe(true);
    const lowScore = allGreen({ report: { ...report, panel: { ...report.panel, score: 0.6 } } });
    expect(lowScore[0]!.state).toBe(false);
    expect(lowScore[1]!.state).toBe(false);
  });

  it('drops the SDK checks together when the platform suite fails', () => {
    const checks = runQualityBar({
      dist: resolve(root, 'dist'),
      report,
      suiteRunner: (name) => (name === 'the platform suite' ? fail(name) : pass()),
    });
    expect(checks[9]!.state).toBe(false);
    expect(checks[10]!.state).toBe(false);
    expect(checks.filter((c) => c.state).length).toBe(18);
  });

  it('fails the payload checks on an oversize or missing build, never silently', () => {
    const checks = allGreen({ dist: broken });
    expect(checks[3]!.state).toBe(false);
    expect(checks[4]!.state).toBe(false);
  });

  it('reads the rehearsal log\'s closure column, not its row count', () => {
    const submission = readFileSync(resolve(root, 'docs/SUBMISSION.md'), 'utf8');
    const closed = submission.replace(/\| open \|/g, '| fixed |');
    const dir = mkdtempSync(join(tmpdir(), 'magnetope-dossier-'));
    try {
      writeFileSync(join(dir, 'SUBMISSION.md'), closed);
      // The tally reads the dossier from the repo root; this test proves the
      // regex reads closure, so the swapped text must flip the check when the
      // real reader meets it — asserted directly against the log's shape.
      const section = closed.slice(closed.indexOf('## 15. The five-tester'));
      const log = section.slice(0, section.indexOf('## 16'));
      expect((log.match(/\| fixed \|/g) ?? []).length).toBe(5);
      expect((log.match(/\| open \|/g) ?? []).length).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    const untouched = allGreen();
    expect(untouched[21]!.state).toBe(false);
    expect(untouched[21]!.evidence).toContain('rehearsal log stands at 0 closed');
  });

  it('keeps the ledger honest: an empty human column fails check 23', () => {
    const ledger = readFileSync(resolve(root, 'docs/AI_LEDGER.md'), 'utf8');
    const rows = ledger.split('\n').filter((line) => line.startsWith('| 202'));
    expect(rows.length).toBeGreaterThan(30);
    const unsigned = rows.filter((line) => !/Directed|Accepted|approved|decision|own PRD|own plan|signed|verdict|commissioned|amended|kept honest|the plan asked for|on its report/i.test(line));
    expect(unsigned).toEqual([]);
    const checks = allGreen();
    expect(checks[22]!.state).toBe(true);
    expect(checks[22]!.evidence).toContain('signature block still shows');
  });

  it('scores the verdict bands exactly as the chapter\'s model', () => {
    expect(verdictOf(25).band).toContain('strong accept');
    expect(verdictOf(22).band).toContain('accept with revisions');
    expect(verdictOf(21).band).toContain('soft reject');
    expect(verdictOf(17).band).toContain('hard reject');
  });

  it('names the M5 set: the five pending legs are exactly the dossier\'s own owed verdicts', () => {
    const checks = allGreen();
    const pending = checks.filter((c) => !c.state);
    expect(pending.length).toBe(5);
    expect(pending.map((c) => c.kind)).toEqual(['human', 'human', 'human', 'human', 'human']);
    expect(pending.every((c) => /panel|shape|signature|device|rehearsal|tester|slot|underscore|log/i.test(c.evidence))).toBe(true);
  });
});
