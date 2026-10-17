import { ALL_LEVELS } from '@/levels';
import { solveLevel, type PlannerOptions } from './planner';

/**
 * Finds levels that can be finished without the magnet's real tricks, so the game cannot be filed as
 * "just a climbing game". Each level is searched twice with a weakened bot:
 *
 *   crawl  - may stick, crawl and wait, but never launch (pure climbing)
 *   tap    - may also tap-flip, but never charges a flip or snaps (no charge, no snap)
 *
 * A level a weakened bot can still clear does not need the verb it was denied.
 *
 *   npx tsx tools/crawl-audit.ts [level ids...] [--budget=30]
 */

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const budget = Number(process.argv.find((a) => a.startsWith('--budget='))?.split('=')[1] ?? 30);
const targets = ids.length ? ALL_LEVELS.filter((l) => ids.some((id) => l.id === id || l.id.startsWith(`${id}-`))) : ALL_LEVELS;

const MODES: ReadonlyArray<{ name: string; options: PlannerOptions }> = [
  { name: 'crawl', options: { maxExpansions: budget, holds: [] } },
  { name: 'tap', options: { maxExpansions: budget, holds: [0], snapDelays: [] } },
];

const pad = (text: string, width: number): string => text.padEnd(width);
console.log(`${pad('level', 16)}${pad('crawl bot', 22)}tap bot (no charge, no snap)`);

let crawlClears = 0;
let tapClears = 0;
for (const level of targets) {
  const cells: string[] = [];
  for (const mode of MODES) {
    const result = await solveLevel(level, mode.options);
    if (result.solved) {
      if (mode.name === 'crawl') crawlClears++;
      else tapClears++;
      cells.push('CLEARS');
    } else {
      cells.push(`stops at ${result.reached.toFixed(0)} of ${level.summit.y.toFixed(0)} m`);
    }
  }
  console.log(`${pad(level.id, 16)}${pad(cells[0]!, 22)}${cells[1]}`);
}
console.log(`\n${targets.length} levels: ${crawlClears} cleared by crawling alone, ${tapClears} cleared without charging or snapping.`);
