import { existsSync, readFileSync } from 'node:fs';
import { ALL_LEVELS } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';

/**
 * Which props a level's stored route actually grabs. A prop kind that the
 * route never touches is scenery, so this shows whether a level's signature
 * element is really part of the way up.
 */

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = ids.length ? ALL_LEVELS.filter((l) => ids.includes(l.id)) : ALL_LEVELS;
const rapier = await loadRapier();

for (const level of targets) {
  const file = `src/levels/routes/${level.id}.json`;
  if (!existsSync(file)) {
    console.log(`${level.id}: no stored route`);
    continue;
  }
  const sim = new Simulation(rapier, level);
  const player = new ReplayPlayer(decodeRecording(readFileSync(file, 'utf8')));
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
  const summary = [...counts].sort((a, b) => b[1] - a[1]).map(([kind, n]) => `${kind}x${n}`).join(' ');
  console.log(`${level.id}: ${sim.run.cleared ? 'cleared' : 'NOT CLEARED'}  ${summary}`);
  sim.dispose();
}
