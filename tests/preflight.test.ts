import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUNBOOK_STEPS, signatureState, tagAudit, thumbnailPreflight, type ThumbnailReport } from '../tools/preflight';
import { SPINE_DOCS } from '../tools/doc-spine';

/**
 * The submission-day preflight's own laws (premium PRD W16, R-QA-08, R-QA-10).
 * The tool walks the runbook; these tests hold the walk itself — the steps are
 * the dossier's steps in the dossier's order, the tag audit reads what the
 * CHANGELOG really says, a signature slot is pending until a hand fills it,
 * and the thumbnail leg judges the report the cards really produced.
 */

const here = __dirname;
const root = resolve(here, '..');

describe('the runbook steps (R-QA-08)', () => {
  const dossier = readFileSync(join(root, 'docs/SUBMISSION.md'), 'utf8');

  it('are the dossier\u2019s own steps, numbered and in order', () => {
    expect(RUNBOOK_STEPS.map((step) => step.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const step of RUNBOOK_STEPS) {
      expect(dossier.toLowerCase(), `step ${step.id} must appear as the dossier prints it`).toContain(`${step.id}. **${step.title}`);
    }
  });

  it('name which legs are the machine\u2019s and which are the day\u2019s', () => {
    expect(RUNBOOK_STEPS.filter((step) => step.kind === 'machine').map((step) => step.title)).toEqual([
      'build green',
      'thumbnail pre-flight',
      'dossier current',
      'categories chosen',
      'version tagged',
    ]);
    expect(RUNBOOK_STEPS.filter((step) => step.kind === 'human').map((step) => step.title)).toEqual(['ledger signed']);
    expect(RUNBOOK_STEPS.filter((step) => step.kind === 'day').map((step) => step.title)).toEqual(['upload', 'playtest immediately', 'log the first 10 videos']);
  });
});

describe('the tag audit (R-QA-10)', () => {
  const changelog = '| Version | Date | The build |\n| --- | --- | --- |\n| v1.0.0-rc1 | 2026-10-27 | The release candidate |\n| v0.9.0 | 2026-09-01 | The beta |';

  it('passes when the CHANGELOG\u2019s newest version is tagged at HEAD', () => {
    expect(tagAudit(changelog, ['v1.0.0-rc1'])).toEqual({ ok: true, version: 'v1.0.0-rc1', problem: null });
  });

  it('names the version that is not tagged', () => {
    const audit = tagAudit(changelog, ['v0.9.0']);
    expect(audit.ok).toBe(false);
    expect(audit.version).toBe('v1.0.0-rc1');
    expect(audit.problem).toContain('v1.0.0-rc1 is not tagged at HEAD');
  });

  it('refuses a CHANGELOG with no version row at all', () => {
    expect(tagAudit('# Changelog\n\nnothing here', [])).toEqual({ ok: false, version: null, problem: 'CHANGELOG.md carries no version row' });
  });
});

describe('the signature slots', () => {
  it('read as pending while they show their underscores, signed once a hand fills them', () => {
    const pending = 'Reviewed and signed: ____________________\n\nDate: ____________________';
    expect(signatureState(pending)).toBe('pending');
    expect(signatureState('Director of record: Manoj\n\nSignature: M. Kumar\n\nDate: 2026-10-27')).toBe('signed');
  });

  it('read the shipped ledger and dossier as honestly pending', () => {
    expect(signatureState(readFileSync(join(root, 'docs/AI_LEDGER.md'), 'utf8'))).toBe('pending');
    expect(signatureState(readFileSync(join(root, 'docs/SUBMISSION.md'), 'utf8'))).toBe('pending');
  });
});

describe('the thumbnail pre-flight leg (R-TH-09)', () => {
  it('passes the four machine points on the report the cards really produced', () => {
    const report = JSON.parse(readFileSync(join(root, 'thumbnails/report.json'), 'utf8')) as ThumbnailReport;
    const leg = thumbnailPreflight(report);
    expect(leg.ok).toBe(true);
    expect(leg.problems).toEqual([]);
  });

  it('names every point a broken report breaks', () => {
    const broken: ThumbnailReport = {
      audits: { legibility128: false, ocrEmpty: false, hueCollision: true, contrast: 2.4 },
      detail: { 'hero-launch': { failures: ['the eye is under 12% of the frame'] } },
    };
    const leg = thumbnailPreflight(broken);
    expect(leg.ok).toBe(false);
    expect(leg.problems.some((p) => p.includes('OCR-empty'))).toBe(true);
    expect(leg.problems.some((p) => p.includes('128 px'))).toBe(true);
    expect(leg.problems.some((p) => p.includes('3:1'))).toBe(true);
    expect(leg.problems.some((p) => p.includes('playground background'))).toBe(true);
    expect(leg.problems.some((p) => p.includes('hero-launch: the eye is under 12% of the frame'))).toBe(true);
  });

  it('carries the panel score as its own state, never inventing one', () => {
    expect(thumbnailPreflight({ panel: { score: null } }).panelScore).toBeNull();
    expect(thumbnailPreflight({ panel: { score: 0.95 } }).panelScore).toBe(0.95);
  });
});

describe('the docs leg', () => {
  it('walks all nine spine docs', () => {
    expect(SPINE_DOCS.map(([name]) => name)).toEqual([
      'FEEL.md',
      'SPECTACLE.md',
      'COLOR_SCRIPT.md',
      'ECONOMY.md',
      'EVENTS.md',
      'KPI.md',
      'MAGNO.md',
      'AUDIO.md',
      'PERF_BUDGET.md',
    ]);
  });
});
