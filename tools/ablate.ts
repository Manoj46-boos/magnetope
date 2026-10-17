import { ALL_LEVELS } from '@/levels';
import type { LevelDef, PropPlacement } from '@/sim/types';
import { solveLevel } from './planner';

/**
 * Proves a level's twist is load-bearing: removes every moving, hung, flickering or switch-driven
 * prop and checks the planner can no longer reach the summit.
 */

const isTwist = (p: PropPlacement): boolean => Boolean(p.motion || p.hinge || p.cycle || p.follow || p.weld || p.pin);
const twist = (level: LevelDef): boolean => level.props.some(isTwist);
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = ALL_LEVELS.filter((l) => twist(l) && (ids.length === 0 || ids.includes(l.id)));

for (const level of targets) {
  const plain: LevelDef = { ...level, props: level.props.filter((p) => !isTwist(p)) };
  const result = await solveLevel(plain, { maxExpansions: 80 });
  const verdict = result.solved ? 'STILL SOLVABLE without its twist' : `needs its twist (best y=${result.reached.toFixed(1)} of ${level.summit.y})`;
  console.log(`${level.id}: ${verdict}`);
}
