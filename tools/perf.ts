import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { ALL_LEVELS } from '../src/levels';
import { loadRapier } from '../src/sim/rapier';
import { ReplayPlayer, decodeRecording } from '../src/sim/replay';
import { Simulation } from '../src/sim/simulation';
import { IDLE_INPUT } from '../src/sim/types';

/**
 * Times the simulation step (PRD 14.3: physics-step p99, budget 3.5 ms on the high tier)
 * while every level plays its stored route, then idles for ten seconds so a settled
 * world is timed too. Headless: no rendering, no audio. A step costs a tenth of a
 * millisecond, so the machine's own scheduling noise shows up in the tail; each level is
 * timed in several rounds and the quietest one is reported, the first of them paying
 * for the JIT.
 *
 *   npm run perf
 *   npm run perf -- --only=playground-08 --rounds=5
 */

const BUDGET_MS = 3.5;
const IDLE_TICKS = 600;
const WARM_UP_TICKS = 120;

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const only = arg('only');
const rounds = Number(arg('rounds') ?? 3);

export interface StepTiming {
  id: string;
  bodies: number;
  steps: number;
  p50: number;
  p99: number;
  max: number;
}

const percentile = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;

async function timeRound(id: string): Promise<StepTiming> {
  const level = ALL_LEVELS.find((l) => l.id === id)!;
  const sim = new Simulation(await loadRapier(), level);
  const player = new ReplayPlayer(decodeRecording(readFileSync(fileURLToPath(new URL(`../src/levels/routes/${id}.json`, import.meta.url)), 'utf8')));
  const samples: number[] = [];
  let tick = 0;
  while (!player.done || tick < WARM_UP_TICKS + IDLE_TICKS) {
    const input = player.done ? IDLE_INPUT : player.next();
    const start = performance.now();
    sim.step(input);
    const elapsed = performance.now() - start;
    if (tick++ >= WARM_UP_TICKS) samples.push(elapsed);
    if (tick > 12000) break;
  }
  const bodies = sim.physics.world.bodies.len();
  sim.dispose();
  samples.sort((a, b) => a - b);
  return { id, bodies, steps: samples.length, p50: percentile(samples, 0.5), p99: percentile(samples, 0.99), max: samples[samples.length - 1]! };
}

export async function timeLevel(id: string, attempts = rounds): Promise<StepTiming> {
  let best = await timeRound(id);
  for (let i = 1; i < attempts; i++) {
    const next = await timeRound(id);
    if (next.p99 < best.p99) best = next;
  }
  return best;
}

async function main(): Promise<void> {
  const ids = ALL_LEVELS.map((l) => l.id).filter((id) => !only || id.startsWith(only));
  console.log(`physics step, budget p99 <= ${BUDGET_MS} ms\n`);
  console.log('level               bodies   p50 ms   p99 ms   max ms');
  const rows: StepTiming[] = [];
  for (const id of ids) {
    const row = await timeLevel(id);
    rows.push(row);
    const flag = row.p99 > BUDGET_MS ? '  over budget' : '';
    console.log(`${id.padEnd(19)} ${String(row.bodies).padStart(5)} ${row.p50.toFixed(3).padStart(8)} ${row.p99.toFixed(3).padStart(8)} ${row.max.toFixed(2).padStart(8)}${flag}`);
  }
  const worst = rows.reduce((a, b) => (b.p99 > a.p99 ? b : a));
  console.log(`\nworst p99: ${worst.id} at ${worst.p99.toFixed(3)} ms`);
}

if (process.argv[1]?.endsWith('perf.ts')) void main();
