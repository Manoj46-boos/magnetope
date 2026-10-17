import { readFileSync } from 'node:fs';
import { levelById } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';

const id = process.argv[2] ?? 'scrapyard-00';
const level = levelById(id);
const rec = decodeRecording(readFileSync(`src/levels/routes/${id}.json`, 'utf8'));
const sim = new Simulation(await loadRapier(), level);
const player = new ReplayPlayer(rec);

/** Name of the prop whose body is nearest to a point, so a trace reads in terms of the level rather than coordinates. */
function nearestProp(x: number, y: number): string {
  let best = '';
  let bestDistance = Infinity;
  for (const prop of sim.physics.props) {
    const t = sim.physics.world.getRigidBody(prop.bodyHandle).translation();
    const d = Math.hypot(t.x - x, t.y - y) - Math.max(prop.width, prop.height) / 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = prop.kind.id;
    }
  }
  return best;
}

for (const name of ['attach', 'repel', 'snapEngage', 'fall', 'summit'] as const) {
  sim.events.on(name, () => {
    const v = sim.magno.view;
    const on = name === 'attach' ? ` on ${nearestProp(v.position.x, v.position.y)}` : '';
    console.log(`t=${(sim.tick / 60).toFixed(2)}s ${name.padEnd(10)} pos=(${v.position.x.toFixed(1)}, ${v.position.y.toFixed(1)})${on}`);
  });
}
while (!player.done && !sim.run.cleared) sim.step(player.next());
console.log('cleared', sim.run.cleared, 'time', (sim.run.timeMs / 1000).toFixed(1));
