import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_LEVELS } from '@/levels';
import { auditVerdicts, blankForm, ENDING_ROW, parseVerdicts } from '../tools/verdict-form';

/**
 * The Final Gate and the funnel-ops chapter's dossier laws (premium PRD W16,
 * Ch. 35, R-QA-05…08, R-QA-11). The scorecard is an instrument, not a mood:
 * every section's sum must be ten minus half a point per pending point it
 * names, every pending point must cite its requirement, and the grand total
 * must be the sections summed — so a half-point moved without its arithmetic
 * fails the build. The human protocols are held the same way the ledger is:
 * the form exists, covers the campaign exactly, and stays honestly pending
 * until the only hands that can fill it do.
 */

const here = __dirname;
const root = resolve(here, '..');
const dossier = readFileSync(join(root, 'docs/SUBMISSION.md'), 'utf8');

const sectionOf = (title: string): string => {
  const start = dossier.indexOf(`## ${title}`);
  expect(start, `the dossier must carry section "${title}"`).toBeGreaterThan(-1);
  const next = dossier.indexOf('\n## ', start + 1);
  return dossier.slice(start, next === -1 ? undefined : next);
};

describe('the Final Gate scorecard (PRD Ch. 35)', () => {
  const scorecard = sectionOf('16. The Final Gate scorecard');
  const rows = [...scorecard.matchAll(/^\| ([A-J])\. ([^|]+) \| ([\d.]+) \| (.+) \|$/gm)];

  it('is ten sections, A through J, every one with its sum and its pending list', () => {
    expect(rows.map((row) => row[1])).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
  });

  it('sums each section as ten minus half a point per pending point it names', () => {
    expect(rows).toHaveLength(10);
    for (const [, , name, sum, pending] of rows) {
      const segments = pending!.split(';').map((s) => s.trim()).filter((s) => s !== '—' && s.length > 0);
      expect(Number(sum!), `${name}'s sum must obey the arithmetic`).toBeCloseTo(10 - 0.5 * segments.length, 5);
      for (const segment of segments) {
        expect(segment, `every pending point cites its requirement: "${segment}"`).toMatch(/R-[A-Z]{2}-\d{2}|Ch\. 35/);
      }
    }
  });

  it('states the grand total the table actually sums to', () => {
    const total = rows.reduce((sum, row) => sum + Number(row[3]), 0);
    expect(total).toBeCloseTo(91.5, 5);
    expect(scorecard).toContain('91.5');
    expect(scorecard).toContain('95');
  });

  it('names the pending points the human protocols own', () => {
    for (const citation of ['R-QA-05', 'R-QA-06', 'R-QA-07', 'R-QA-08', 'R-CM-03', 'R-CM-04', 'R-AU-11', 'R-TH-07']) {
      expect(scorecard, `the scorecard must name ${citation}`).toContain(citation);
    }
  });
});

describe('the submission-day runbook (R-QA-08, R-QA-10)', () => {
  const runbook = sectionOf('12. The submission-day runbook');

  it('walks its machine legs through one command and names the version discipline', () => {
    expect(runbook).toContain('npm run preflight');
    expect(runbook).toContain('git tag v1.0.0');
    expect(runbook).toContain('CHANGELOG.md');
    expect(runbook).toContain('dossier state hash');
  });

  it('keeps the build playable while the funnel runs, and says how', () => {
    expect(runbook).toContain('https://manoj46-boos.github.io/magnetope/');
    expect(runbook).toContain('scripts/deploy-pages.mjs');
  });

  it('hands the post-submission protocol the stuck/drift read the Friday report owns', () => {
    expect(runbook).toContain('stuck/drift protocol');
    expect(runbook).toContain("Friday report's sixth section");
    expect(runbook).toContain('R-LD-16, R-RT-10, R-GD-08');
  });
});

describe('the device matrix protocol (R-QA-05)', () => {
  const matrix = sectionOf('13. The device matrix');

  it('asks for the three devices in both orientations, with evidence slots', () => {
    for (const device of ['Phone', 'Tablet', 'Low-end laptop']) expect(matrix).toContain(device);
    expect(matrix).toContain('portrait + landscape');
    expect((matrix.match(/\| ______ \|/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('carries the one-thumb question and the tier floors the physical legs answer', () => {
    expect(matrix).toContain('one thumb clears the first two levels');
    expect(matrix).toContain('Mali-G52');
  });
});

describe('the human playthrough form (R-QA-06)', () => {
  const protocol = sectionOf('14. The human playthrough');
  const form = readFileSync(join(root, 'docs/VERDICTS.md'), 'utf8');

  it('is the protocol the dossier names, honestly pending', () => {
    expect(protocol).toContain('docs/VERDICTS.md');
    expect(protocol).toContain('71 rows, 0 verdicts, 71 pending');
    expect(protocol).toContain('dull level is a bug');
  });

  it('covers the campaign exactly: every level once, the ending last', () => {
    const audit = auditVerdicts(form);
    expect(audit.ok).toBe(true);
    expect(audit.rows).toBe(ALL_LEVELS.length + 1);
    expect(audit.filled).toBe(0);
    const ids = parseVerdicts(form).map((row) => row.levelId);
    expect(ids).toEqual([...ALL_LEVELS.map((level) => level.id), ENDING_ROW]);
  });

  it('regenerates from the campaign, so a level can never go missing', () => {
    const audit = auditVerdicts(blankForm());
    expect(audit.ok).toBe(true);
    expect(audit.rows).toBe(ALL_LEVELS.length + 1);
  });

  it('refuses a broken form by name: a missing level, a half-filled row, an illegal verdict', () => {
    const ids = [...ALL_LEVELS.map((level) => level.id), ENDING_ROW];
    const rowOf = (id: string, cells: [string, string, string, string]) => `| ${id} | ${cells.join(' | ')} |`;

    const missing = blankForm().replace(rowOf(ids[3]!, ['—', '—', '—', '—']) + '\n', '');
    expect(auditVerdicts(missing).problems.some((p) => p.includes(`${ids[3]} has no row`))).toBe(true);

    const half = blankForm().replace(rowOf(ids[0]!, ['—', '—', '—', '—']), rowOf(ids[0]!, ['yes', '—', '—', '—']));
    expect(auditVerdicts(half).problems.some((p) => p.includes('either all pending or all filled'))).toBe(true);

    const illegal = blankForm().replace(rowOf(ids[1]!, ['—', '—', '—', '—']), rowOf(ids[1]!, ['maybe', '6', 'the rhythm broke', 'ship it']));
    const problems = auditVerdicts(illegal).problems;
    expect(problems.some((p) => p.includes('yes or no'))).toBe(true);
    expect(problems.some((p) => p.includes('1 to 5'))).toBe(true);
    expect(problems.some((p) => p.includes('keep, retune or re-lay'))).toBe(true);

    const filled = blankForm().replace(rowOf(ids[2]!, ['—', '—', '—', '—']), rowOf(ids[2]!, ['yes', '4', 'the wind telegraph is late by a beat', 'retune — move the gust sign onto the beam']));
    const audit = auditVerdicts(filled);
    expect(audit.ok).toBe(true);
    expect(audit.filled).toBe(1);
    expect(audit.pendingCount).toBe(ALL_LEVELS.length);
  });
});

describe('the five-tester rehearsal protocol (R-QA-07)', () => {
  const rehearsal = sectionOf('15. The five-tester dress rehearsal');

  it('focuses on the three moments the funnel decides, five testers, honestly open', () => {
    for (const focus of ['first 90 seconds', 'first fall', 'first ad moment']) expect(rehearsal).toContain(focus);
    expect(rehearsal.match(/^\| [1-5] \|/gm)).toHaveLength(5);
    expect(rehearsal.match(/\| open \|/g)).toHaveLength(5);
    expect(rehearsal).toContain('fixed or declined-with-reason');
  });
});

describe('the category strategy (R-QA-11)', () => {
  it('suggests four categories with the rationale, and carries no tone-risky tag', () => {
    const categories = /\*\*Suggested categories:\*\* ([^—]+)—/.exec(dossier);
    expect(categories?.[1]?.trim()).toBe('physics · puzzle · skill · one-button');
    expect(dossier).toContain('adjacent-but-distinct from the swing-fling lineage');
    const tags = /\*\*Suggested tags:\*\* ([^\n]+)/.exec(dossier)![1]!;
    expect(tags).toContain('physics');
    expect(tags).toContain('one button');
    expect(tags.toLowerCase()).not.toContain('rage');
    expect(tags.toLowerCase()).not.toContain('ragdoll');
  });
});
