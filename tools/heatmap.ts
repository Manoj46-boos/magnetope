import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_LEVELS } from '@/levels';
import { renderHeatmap } from './analytics/heatmap';
import { parseTelemetry, readJsonLines } from './analytics/records';
import { buildReport, toMarkdown } from './analytics/report';

/**
 * The weekly difficulty review (PRD 11.3). Reads the telemetry export from the
 * Poki dashboard (one JSON record per line, or whole batches) and writes a
 * report plus one fall heatmap per level.
 *
 *   npm run heatmap -- export.jsonl --out=analytics
 */

const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!file) {
  console.error('usage: npm run heatmap -- <telemetry.jsonl> [--out=analytics] [--band=0.15]');
  process.exit(1);
}
const flag = (name: string, fallback: string): string => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const out = resolve(flag('out', 'analytics'));
mkdirSync(out, { recursive: true });

const parsed = parseTelemetry(readJsonLines(readFileSync(file, 'utf8')));
const reports = buildReport(parsed, ALL_LEVELS, { band: Number(flag('band', '0.15')) });

for (const report of reports) {
  const level = ALL_LEVELS.find((l) => l.id === report.levelId)!;
  const svg = renderHeatmap({ level, falls: report.falls.map((f) => f.at), hotspots: report.hotspots, quitPoints: report.quitPoints });
  writeFileSync(resolve(out, `${report.levelId}.svg`), svg);
}
writeFileSync(resolve(out, 'review.md'), toMarkdown(reports));
writeFileSync(resolve(out, 'review.json'), JSON.stringify(reports.map(({ falls, ...rest }) => ({ ...rest, falls: falls.length })), null, 2));
console.log(`${reports.length} level(s) analysed, ${parsed.attempts.length} attempts, ${parsed.falls.length} falls -> ${out}`);
