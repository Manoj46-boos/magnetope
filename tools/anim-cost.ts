import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { ALL_LEVELS } from '../src/levels';
import { MagnoRig } from '../src/render/magno-rig';
import { loadRapier } from '../src/sim/rapier';
import { ReplayPlayer, decodeRecording } from '../src/sim/replay';
import type { MagnoView } from '../src/sim/magno';
import { Simulation } from '../src/sim/simulation';
import { IDLE_INPUT } from '../src/sim/types';

/**
 * Times MAGNO's procedural animation (PRD 7.6, table 7.2: all of it under 1.5 ms of a 16.6 ms frame
 * on the mid-tier reference phone) and counts what it allocates per frame (the lag chains are meant
 * to be allocation-free). The rig runs frame by frame over a level's stored route, fed by the same
 * simulation events the renderer wires to it, then idles so the settled pose is timed too.
 * Headless: nothing is drawn.
 *
 *   node --expose-gc --import tsx tools/anim-cost.ts
 *   node --expose-gc --import tsx tools/anim-cost.ts --only=playground-08
 */

/** The PRD's budget for the whole animation layer on the reference phone. */
export const BUDGET_MS = 1.5;
/** How much slower the reference phone runs this code than the development machine (the mid device of `tools/cold-load.ts`). */
export const MID_TIER_SLOWDOWN = 4;

const IDLE_FRAMES = 600;
const WARM_UP_FRAMES = 120;
const MAX_FRAMES = 12000;
const FRAME_DT = 1 / 60;

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

export interface AnimationTiming {
  id: string;
  frames: number;
  p50: number;
  p99: number;
  max: number;
}

const percentile = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;

const collect = (): void => (globalThis as { gc?: () => void }).gc?.();
const heapUsed = (): number => process.memoryUsage().heapUsed;

/** Plays a level's stored route, then idles, handing every frame to `onFrame` after the rig has the simulation's events. */
async function playRoute(id: string, onFrame: (rig: MagnoRig, view: MagnoView, frame: number) => void): Promise<void> {
  const level = ALL_LEVELS.find((l) => l.id === id)!;
  const sim = new Simulation(await loadRapier(), level);
  const rig = new MagnoRig();
  sim.events.on('attach', (e) => rig.onAttach(e.normal));
  sim.events.on('repel', (e) => rig.onRepel(e.direction, e.power));
  sim.events.on('impact', (e) => rig.onImpact(e.normal, e.speed));
  sim.events.on('summit', () => rig.onClear());

  const player = new ReplayPlayer(decodeRecording(readFileSync(fileURLToPath(new URL(`../src/levels/routes/${id}.json`, import.meta.url)), 'utf8')));
  for (let frame = 0; frame < MAX_FRAMES && (!player.done || frame < WARM_UP_FRAMES + IDLE_FRAMES); frame++) {
    sim.step(player.done ? IDLE_INPUT : player.next());
    onFrame(rig, sim.magno.view, frame);
  }
  sim.dispose();
  rig.dispose();
}

async function timeUpdates(id: string): Promise<number[]> {
  const samples: number[] = [];
  await playRoute(id, (rig, view, frame) => {
    const start = performance.now();
    rig.update(view, view.position, FRAME_DT, false);
    const elapsed = performance.now() - start;
    if (frame >= WARM_UP_FRAMES) samples.push(elapsed);
  });
  return samples.sort((a, b) => a - b);
}

const POSE: MagnoView = {
  position: { x: 0, y: 3 },
  velocity: { x: 3, y: -5 },
  angle: 0.3,
  visualAngle: 0.3,
  state: 'airborne',
  polarity: 'attract',
  charge01: 0,
  chargeLevel: 0,
  snapArmed: false,
  snapEngaged: false,
  snapTarget: null,
  attachNormal: null,
  limp: false,
  scramble: false,
  recoverPhase: 0,
  grounded: false,
  chaining: false,
  dropMeters: 0,
};

/** One pose for every branch of the arm, eye and aura logic. */
export const POSES: Record<string, MagnoView> = {
  airborne: POSE,
  attached: { ...POSE, state: 'attached', attachNormal: { x: 0, y: 1 } },
  charging: { ...POSE, state: 'charging', polarity: 'repel', attachNormal: { x: 1, y: 0 }, charge01: 0.6, chargeLevel: 2 },
  snapping: { ...POSE, snapArmed: true, snapEngaged: true, snapTarget: { x: 4, y: 8 } },
  falling: { ...POSE, velocity: { x: 0, y: -14 }, dropMeters: 12 },
  limp: { ...POSE, limp: true },
  recovering: { ...POSE, state: 'recovering', recoverPhase: 0.5 },
};

const WARM_UP_CALLS = 30000;
const ALLOCATION_CALLS = 10000;
const ALLOCATION_BLOCKS = 4;

/**
 * Heap bytes one call of `step` allocates. V8 boxes numbers until a function is optimised, so it is
 * warmed up first; the cost is then read off long blocks, because the heap counter moves in coarse
 * steps and a single call cannot resolve it. Real allocation shows in every block and noise does
 * not, so the smallest block is the reading.
 */
export function allocationPerCall(step: () => void): number {
  for (let i = 0; i < WARM_UP_CALLS; i++) step();
  let smallest = Infinity;
  for (let block = 0; block < ALLOCATION_BLOCKS; block++) {
    collect();
    const before = heapUsed();
    for (let i = 0; i < ALLOCATION_CALLS; i++) step();
    smallest = Math.min(smallest, (heapUsed() - before) / ALLOCATION_CALLS);
  }
  return Math.max(0, smallest);
}

/** Heap bytes one rig update allocates in a given pose. */
export function rigAllocation(pose: MagnoView): number {
  const rig = new MagnoRig();
  const bytes = allocationPerCall(() => rig.update(pose, pose.position, FRAME_DT, false));
  rig.dispose();
  return bytes;
}

async function timeRound(id: string): Promise<AnimationTiming> {
  const samples = await timeUpdates(id);
  return {
    id,
    frames: samples.length,
    p50: percentile(samples, 0.5),
    p99: percentile(samples, 0.99),
    max: samples[samples.length - 1]!,
  };
}

/** Timed in several rounds; the quietest wins, because machine noise dominates a sub-millisecond cost. */
export async function timeAnimation(id: string, rounds = 3): Promise<AnimationTiming> {
  let best = await timeRound(id);
  for (let i = 1; i < rounds; i++) {
    const next = await timeRound(id);
    if (next.p99 < best.p99) best = next;
  }
  return best;
}

async function main(): Promise<void> {
  const only = arg('only');
  const rounds = Number(arg('rounds') ?? 3);
  const ids = ALL_LEVELS.map((l) => l.id).filter((id) => !only || id.startsWith(only));
  const ceiling = BUDGET_MS / MID_TIER_SLOWDOWN;
  console.log(`rig update, budget ${BUDGET_MS} ms on the mid tier = ${ceiling.toFixed(3)} ms here (x${MID_TIER_SLOWDOWN})\n`);
  console.log('level               frames   p50 ms   p99 ms   max ms');
  if (ids[0]) await timeRound(ids[0]);
  let worst: AnimationTiming | null = null;
  for (const id of ids) {
    const row = await timeAnimation(id, rounds);
    if (!worst || row.p99 > worst.p99) worst = row;
    const flag = row.p99 > ceiling ? '  over budget' : '';
    console.log(`${id.padEnd(19)} ${String(row.frames).padStart(6)} ${row.p50.toFixed(4).padStart(8)} ${row.p99.toFixed(4).padStart(8)} ${row.max.toFixed(3).padStart(8)}${flag}`);
  }
  if (worst) console.log(`\nworst p99: ${worst.id} at ${worst.p99.toFixed(4)} ms`);

  console.log('\nallocation per rig update (bytes)');
  for (const [name, pose] of Object.entries(POSES)) console.log(`${name.padEnd(11)} ${rigAllocation(pose).toFixed(0).padStart(6)}`);
}

if (process.argv[1]?.endsWith('anim-cost.ts')) void main();
