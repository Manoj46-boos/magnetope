import { existsSync, readFileSync } from 'node:fs';
import { ALL_LEVELS } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';

/**
 * Which props a level's stored route actually grabs. A prop kind that the
 * route never touches is scenery, so this shows whether a level's signature
 * element is really part of the way up. The same replay counts the
 * magnet-native moments (R-LD-10): a level whose route never snaps a catch or
 * launches off a surface is filler and is named as one.
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
  let snaps = 0;
  let launches = 0;

  sim.events.on('attach', (ev) => {
    if (ev.viaSnap) snaps++;
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
  sim.events.on('repel', () => launches++);

  while (!player.done && !sim.run.cleared) sim.step(player.next());
  const summary = [...counts].sort((a, b) => b[1] - a[1]).map(([kind, n]) => `${kind}x${n}`).join(' ');
  const native = snaps + launches > 0 ? `${snaps} snaps + ${launches} launches` : 'FILLER: no magnet-native moment';
  console.log(`${level.id}: ${sim.run.cleared ? 'cleared' : 'NOT CLEARED'}  ${native}  ${summary}`);
  sim.dispose();
}
