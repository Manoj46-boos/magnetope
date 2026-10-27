import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_LEVELS } from '@/levels';

/**
 * The human playthrough's own form (premium PRD R-QA-06): one row per level
 * plus the ending, three honest questions each — fair, fun, flow — and a
 * verdict that names what happens next. The form is docs/VERDICTS.md; this
 * tool never writes it, because the only hand that can fill it is the
 * developer's. It audits instead: the form must cover the campaign exactly,
 * every cell must be either still pending or a legal verdict, and the run
 * says how much of the pass is done.
 *
 *   npm run verdicts            # audit the form's coverage and fill state
 *   npm run verdicts -- --emit  # print a blank form for a fresh copy
 */

const here = fileURLToPath(new URL('..', import.meta.url));
const FORM = resolve(here, 'docs/VERDICTS.md');

export interface VerdictRow {
  levelId: string;
  /** The campaign order, with the ending last. */
  order: number;
  fair: string;
  fun: string;
  flow: string;
  verdict: string;
}

/** The one row the campaign cannot supply: the wordless film after the last summit. */
export const ENDING_ROW = 'the ending';

const expectedIds = (): string[] => [...ALL_LEVELS.map((level) => level.id), ENDING_ROW];

const pending = (cell: string): boolean => cell.trim() === '—';

/** Reads the form's rows. Anything that is not a table row with five cells is not a verdict. */
export function parseVerdicts(form: string): VerdictRow[] {
  const rows: VerdictRow[] = [];
  const order = new Map(expectedIds().map((id, index) => [id, index]));
  for (const line of form.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length !== 7 || !order.has(cells[1]!)) continue;
    rows.push({ levelId: cells[1]!, order: order.get(cells[1]!)!, fair: cells[2]!, fun: cells[3]!, flow: cells[4]!, verdict: cells[5]! });
  }
  return rows;
}

export interface FormAudit {
  ok: boolean;
  problems: string[];
  rows: number;
  filled: number;
  pendingCount: number;
}

/** The form's two laws: it covers the campaign exactly, and every cell is pending or a legal verdict. */
export function auditVerdicts(form: string): FormAudit {
  const problems: string[] = [];
  const rows = parseVerdicts(form);
  const seen = new Map<string, number>();
  for (const row of rows) seen.set(row.levelId, (seen.get(row.levelId) ?? 0) + 1);
  for (const id of expectedIds()) if ((seen.get(id) ?? 0) === 0) problems.push(`${id} has no row`);
  for (const [id, count] of seen) if (count > 1) problems.push(`${id} has ${count} rows`);
  for (const extra of seen.keys()) if (!expectedIds().includes(extra)) problems.push(`${extra} is not part of the campaign`);

  let filled = 0;
  for (const row of rows) {
    const cells = [row.fair, row.fun, row.flow, row.verdict];
    const pendingCells = cells.filter(pending).length;
    if (pendingCells === cells.length) continue;
    if (pendingCells > 0) {
      problems.push(`${row.levelId}: a verdict is either all pending or all filled`);
      continue;
    }
    if (!/^(yes|no)$/i.test(row.fair)) problems.push(`${row.levelId}: fair says "${row.fair}" — yes or no`);
    if (!/^[1-5]$/.test(row.fun)) problems.push(`${row.levelId}: fun says "${row.fun}" — 1 to 5`);
    if (!/^(keep|retune|re-lay)/.test(row.verdict)) problems.push(`${row.levelId}: verdict says "${row.verdict}" — keep, retune or re-lay, then what`);
    filled++;
  }
  return { ok: problems.length === 0, problems, rows: rows.length, filled, pendingCount: rows.length - filled };
}

/** The blank form, generated from the campaign so it can never miss a level. */
export function blankForm(): string {
  const lines = [
    '# The playthrough verdicts (R-QA-06)',
    '',
    'One row per level and one for the ending, filled by the only hand that can: the developer\'s, playing the whole campaign start to finish. Three honest questions a row — **fair** (could I see it was my fault? yes or no), **fun** (1 to 5), **flow** (where the rhythm broke) — and a **verdict**: keep, retune or re-lay, with what to do. A dull level is a bug, not a taste: every retune or re-lay row joins the weekly retune cycle (R-LD-16) and closes there. `npm run verdicts` audits this file and never writes it.',
    '',
    '| Level | Fair | Fun | Flow | Verdict |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const id of expectedIds()) lines.push(`| ${id} | — | — | — | — |`);
  return lines.join('\n') + '\n';
}

if (process.argv[1]?.endsWith('verdict-form.ts')) {
  if (process.argv.includes('--emit')) {
    process.stdout.write(blankForm());
    process.exit(0);
  }
  const audit = auditVerdicts(readFileSync(FORM, 'utf8'));
  console.log(`${audit.rows} rows, ${audit.filled} verdict(s) recorded, ${audit.pendingCount} still pending.`);
  for (const problem of audit.problems) console.log(`- ${problem}`);
  process.exit(audit.ok ? 0 : 1);
}
