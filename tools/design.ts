import { ALL_LEVELS } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';
import type { LevelDef } from '@/sim/types';
import { solveLevel } from './planner';

/**
 * Design check for a level's signature props. Solves the level, counts which
 * props the route grabs, then removes the named kinds and reports whether the
 * planner can still reach the summit without them.
 *
 *   npm run design -- scrapyard-07 --kinds=loose-girder
 */

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const kinds = (process.argv.find((a) => a.startsWith('--kinds='))?.split('=')[1] ?? '').split(',').filter(Boolean);
const budget = Number(process.argv.find((a) => a.startsWith('--budget='))?.split('=')[1] ?? 40);
const rapier = await loadRapier();

async function grabs(level: LevelDef, recording: NonNullable<Awaited<ReturnType<typeof solveLevel>>['recording']>): Promise<Map<string, number>> {
  const sim = new Simulation(rapier, level);
  const player = new ReplayPlayer(recording);
  const counts = new Map<string, number>();
  sim.events.on('attach', () => {
    const at = sim.magno.view.position;
    let best = '';
    let bestDistance = Infinity;
    for (const prop of sim.physics.props) {
      const t = sim.physics.world.getRigidBody(prop.bodyHandle).translation();
      const distance = Math.hypot(t.x - at.x, t.y - at.y) - Math.max(prop.width, prop.height) / 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = prop.kind.id;
      }
    }
    counts.set(best, (counts.get(best) ?? 0) + 1);
  });
  while (!player.done && !sim.run.cleared) sim.step(player.next());
  sim.dispose();
  return counts;
}

for (const level of ALL_LEVELS.filter((l) => ids.includes(l.id))) {
  const result = await solveLevel(level, { maxExpansions: budget });
  if (!result.solved || !result.recording) {
    console.log(`${level.id}: UNSOLVED (best y=${result.reached.toFixed(1)} of ${level.summit.y})`);
    continue;
  }
  const counts = await grabs(level, result.recording);
  const used = kinds.reduce((sum, k) => sum + (counts.get(k) ?? 0), 0);
  let verdict = '';
  if (kinds.length) {
    const without = await solveLevel({ ...level, props: level.props.filter((p) => !kinds.includes(p.kind)) }, { maxExpansions: budget });
    verdict = without.solved ? '  optional (solvable without)' : `  REQUIRED (without: best y=${without.reached.toFixed(1)})`;
  }
  const summary = [...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}x${n}`).join(' ');
  console.log(`${level.id}: signature grabs ${used}${verdict}  | ${summary}`);
}
