import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_LEVELS } from '@/levels';
import { readJsonLines } from './analytics/records';
import { buildFridayReport, fridayToMarkdown } from './analytics/report';

/**
 * The Friday report (premium PRD R-AN-07). One command over the week's
 * telemetry export regenerates everything the weekly retune ritual reads:
 * the difficulty heatmap, the session-0 funnel, the economy pacing medians,
 * the dangle ratios and the perf tier distribution, each segmented by the
 * locale and device class the visits booted on.
 *
 *   npm run friday -- export.jsonl --out=analytics
 */

const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: npm run friday -- <telemetry.jsonl> [--out=analytics] [--band=0.15]');
  process.exit(1);
}
const flag = (name: string, fallback: string): string => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const out = resolve(flag('out', 'analytics'));
mkdirSync(out, { recursive: true });

const records = readJsonLines(readFileSync(file, 'utf8'));
const report = buildFridayReport(records, ALL_LEVELS, { band: Number(flag('band', '0.15')), minAttempts: Number(flag('min-attempts', '30')) });
writeFileSync(resolve(out, 'friday.md'), fridayToMarkdown(report));
console.log(`${records.length} records, ${report.funnel.visits} first-time visit(s) of ${report.tiers.reduce((sum, t) => sum + t.visits, 0)} -> ${resolve(out, 'friday.md')}`);
