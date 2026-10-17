import { ALL_LEVELS } from '@/levels';
import { measureReliability, solveLevel } from './planner';

/**
 * Dry run of the completability gate: solves the named levels and prints the
 * outcome without touching the stored routes. Use it while a layout is still
 * being shaped; `npm run solve` is what records routes.
 */

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const budget = Number(process.argv.find((a) => a.startsWith('--budget='))?.split('=')[1] ?? 40);
const trials = Number(process.argv.find((a) => a.startsWith('--trials='))?.split('=')[1] ?? 0);
const targets = ids.length ? ALL_LEVELS.filter((l) => ids.includes(l.id)) : ALL_LEVELS;

for (const level of targets) {
  const result = await solveLevel(level, { maxExpansions: budget, robustTrials: trials });
  if (!result.solved) {
    console.log(`${level.id}: UNSOLVED after ${result.expansions} expansions, ${result.evaluated} macros, ${result.seconds.toFixed(0)}s, got to y=${result.reached.toFixed(1)} of ${level.summit.y}`);
    continue;
  }
  const reliability = await measureReliability(level, result.chain, 16);
  const hops = reliability.perHop.map((h) => Math.round(h * 100)).join(' ');
  console.log(
    `${level.id}: solved in ${result.seconds.toFixed(0)}s, route ${(result.clearTimeMs / 1000).toFixed(1)}s, ${result.route.length} macros, slip ${(reliability.failRate * 100).toFixed(0)}%, hops ${hops}`,
  );
}
