import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_LEVELS } from '../src/levels';
import { loadRapier } from '../src/sim/rapier';
import { ReplayPlayer, decodeRecording } from '../src/sim/replay';
import { Simulation } from '../src/sim/simulation';
import { IDLE_INPUT } from '../src/sim/types';

/**
 * What one simulation step allocates (R-PE-09). The physics step itself is
 * allocation-free by construction — the tick goes straight to the engine's
 * pipeline, because the compat wrapper rebuilds its handle maps after every
 * step, which costs around 20 KB a tick once the world is awake. What remains
 * is the contact probe: the engine hands out a fresh wrapper and a projection
 * for every collider the capsule's three spheres touch, and MAGNO's own
 * contact records are built fresh each tick because the fall and grounding
 * state keeps references to them.
 *
 * Each level is measured twice on its own world: in flight, partway up the
 * stored route with the machinery turning, and at rest, perched where the
 * route ends. The quietest of three rounds is reported.
 *
 *   npm run alloc -- --only=playground-08
 */

export interface StepAllocation {
  id: string;
  /** Bytes per step while the level is being played. */
  play: number;
  /** Bytes per step resting where the route ends. */
  rest: number;
}

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const collect = (): void => (globalThis as { gc?: () => void }).gc?.();
const heapUsed = (): number => process.memoryUsage().heapUsed;

/** The regression gate (R-PE-09): the busiest level measures 15-21 KB today, and
 * reintroducing the compat wrapper's per-step handle-map rebuild adds ~20 KB on
 * top once the world is awake, which is the storm this ceiling exists to catch. */
export const STEP_ALLOC_CEILING_BYTES = 24_000;

const ROUNDS = 3;
const CALLS = 400;
/** Halfway up the route, where the level is busiest. */
const PLAY_AT_STEP = 300;

async function measureRound(rapier: Awaited<ReturnType<typeof loadRapier>>, id: string, atPlay: boolean): Promise<number> {
  const level = ALL_LEVELS.find((l) => l.id === id)!;
  const sim = new Simulation(rapier, level);
  const player = new ReplayPlayer(decodeRecording(readFileSync(fileURLToPath(new URL(`../src/levels/routes/${id}.json`, import.meta.url)), 'utf8')));
  if (atPlay) {
    for (let i = 0; i < PLAY_AT_STEP && !player.done; i++) sim.step(player.next());
  } else {
    while (!player.done) sim.step(player.next());
  }
  collect();
  const before = heapUsed();
  for (let i = 0; i < CALLS; i++) sim.step(player.done ? IDLE_INPUT : player.next());
  const bytes = (heapUsed() - before) / CALLS;
  sim.dispose();
  return bytes;
}

export async function stepAllocation(id: string): Promise<StepAllocation> {
  const rapier = await loadRapier();
  const quietest = async (atPlay: boolean): Promise<number> => {
    let smallest = Infinity;
    for (let round = 0; round < ROUNDS; round++) smallest = Math.min(smallest, await measureRound(rapier, id, atPlay));
    return smallest;
  };
  return { id, play: await quietest(true), rest: await quietest(false) };
}

if (process.argv[1]?.endsWith('alloc-probe.ts')) {
  const ids = arg('only') ? [arg('only')!] : ['playground-08', 'stratosphere-14', 'scrapyard-13'];
  console.log('bytes per step, quietest of three rounds');
  console.log('level               in play      at rest');
  for (const id of ids) {
    const row = await stepAllocation(id);
    console.log(`${row.id.padEnd(18)} ${row.play.toFixed(0).padStart(8)} ${row.rest.toFixed(0).padStart(11)}`);
  }
}
