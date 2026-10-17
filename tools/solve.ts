import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_LEVELS } from '@/levels';
import { encodeRecording } from '@/sim/replay';
import { measureReliability, solveLevel } from './planner';

interface LevelReport {
  clearSeconds: number;
  macros: number;
  slipRate: number;
  worstHop: number;
  perHop: number[];
}

const here = dirname(fileURLToPath(import.meta.url));
const routesDir = resolve(here, '../src/levels/routes');
const reportPath = resolve(routesDir, 'report.json');

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const budget = Number(process.argv.find((a) => a.startsWith('--budget='))?.split('=')[1] ?? 60);
const targets = ids.length ? ALL_LEVELS.filter((l) => ids.includes(l.id)) : ALL_LEVELS;

mkdirSync(routesDir, { recursive: true });
const readReport = (): Record<string, LevelReport> => (existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {});
const fresh: Record<string, LevelReport | null> = {};

for (const level of targets) {
  process.stdout.write(`${level.id} ... `);
  let result = await solveLevel(level, { maxExpansions: budget, robustTrials: 8 });
  if (!result.solved) result = await solveLevel(level, { maxExpansions: budget });
  if (!result.solved || !result.recording) {
    console.log(`UNSOLVED after ${result.expansions} expansions (${result.evaluated} macros, ${result.seconds.toFixed(1)}s)`);
    fresh[level.id] = null;
    continue;
  }
  writeFileSync(resolve(routesDir, `${level.id}.json`), encodeRecording(result.recording));
  const reliability = await measureReliability(level, result.chain, 24);
  fresh[level.id] = {
    clearSeconds: Math.round(result.clearTimeMs / 100) / 10,
    macros: result.route.length,
    slipRate: Math.round(reliability.failRate * 100) / 100,
    worstHop: Math.round(Math.min(...reliability.perHop) * 100) / 100,
    perHop: reliability.perHop.map((h) => Math.round(h * 100) / 100),
  };
  const r = fresh[level.id]!;
  console.log(`solved: ${r.clearSeconds}s route, ${r.macros} macros, slip ${(r.slipRate * 100).toFixed(0)}%, worst hop ${(r.worstHop * 100).toFixed(0)}%`);
}

// Several solves can run side by side, so merge into whatever the report holds now.
const report = readReport();
for (const [id, entry] of Object.entries(fresh)) {
  if (entry) report[id] = entry;
  else delete report[id];
}
const ordered = Object.fromEntries(ALL_LEVELS.filter((l) => report[l.id]).map((l) => [l.id, report[l.id]]));
writeFileSync(reportPath, `${JSON.stringify(ordered, null, 2)}\n`);
