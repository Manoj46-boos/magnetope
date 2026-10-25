import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_LEVELS } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';

/**
 * The pacing audit (R-LD-07). Replays every stored route and prints where each
 * level's events land as a share of par: the clockwork reads establish (a quiet
 * 0-25%), twist (~40%), escalation combo (75-90%) and resolve. The same replay
 * counts the magnet-native moments — snap catches and repel launches — because
 * a level whose route never uses its own verb is filler (R-LD-10).
 *
 *   npm run clockwork [--only=scrapyard-01,playground-08]
 */

const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]?.split(',').filter(Boolean);
const routesDir = resolve(import.meta.dirname, '../src/levels/routes');

interface Beat {
  /** Fraction of par, 0..~1+. */
  frac: number;
  kind: 'catch' | 'launch' | 'summit';
  snap: boolean;
}

for (const level of ALL_LEVELS.filter((l) => !only || only.includes(l.id))) {
  const file = resolve(routesDir, `${level.id}.json`);
  if (!existsSync(file)) {
    console.log(`${level.id}: no stored route`);
    continue;
  }
  const sim = new Simulation(await loadRapier(), level);
  const player = new ReplayPlayer(decodeRecording(readFileSync(file, 'utf8')));
  const beats: Beat[] = [];
  const par = level.parSeconds;
  sim.events.on('attach', (ev) => beats.push({ frac: sim.timeSeconds / par, kind: 'catch', snap: ev.viaSnap }));
  sim.events.on('repel', () => beats.push({ frac: sim.timeSeconds / par, kind: 'launch', snap: false }));
  while (!player.done && !sim.run.cleared) sim.step(player.next());
  if (sim.run.cleared) beats.push({ frac: sim.timeSeconds / par, kind: 'summit', snap: false });
  sim.dispose();

  const catches = beats.filter((b) => b.kind === 'catch');
  const snaps = catches.filter((b) => b.snap).length;
  const launches = beats.filter((b) => b.kind === 'launch').length;
  const stamp = beats.map((b) => `${b.kind === 'launch' ? 'L' : b.snap ? 'S' : 'C'}${b.frac.toFixed(2)}`).join(' ');
  console.log(
    `${level.id} par=${par}s clear=${(par * beats[beats.length - 1]!.frac).toFixed(1)}s ` +
      `catches=${catches.length} snaps=${snaps} launches=${launches} native=${snaps + launches > 0 ? 'yes' : 'NO'} | ${stamp}`,
  );
}
