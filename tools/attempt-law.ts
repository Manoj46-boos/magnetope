import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rng } from '@/core/rng';
import { ALL_LEVELS, levelById } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { decodeRecording, type Recording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';
import type { InputFrame } from '@/sim/types';

/**
 * The three-attempt law's own read (rebuild PRD Volume VI, P-LD-01). Two
 * measurements, both from the levels' own recorded routes, both reported:
 *
 * 1. Whole-run, par grade — a par-skill player plays the route with one tick
 *    and six hundredths of tilt jittered, the whole run open-loop. This is the
 *    pessimistic floor: it answers whether the *route as authored* survives a
 *    par player who does not re-aim mid-flight. On the shipping campaign it
 *    reads 0 everywhere except the exact replay, which is itself the finding
 *    on record: the routes clear exactly, and their slack lives in the hops a
 *    player re-plans, which is what the per-hop product measures instead.
 *
 * 2. Per-hop product, sloppy grade — the planner's own hop reliability at two
 *    ticks and a tenth of tilt, straight off report.json, the worst-case
 *    player. The law's verdict comes from here: P must clear within three
 *    attempts, 1 - (1 - P)^3 >= 0.9, so P >= 0.53 at the loosest.
 *
 *   tsx tools/attempt-law.ts                  # every level, both reads
 *   tsx tools/attempt-law.ts --only a,b       # a few levels
 */

const here = fileURLToPath(new URL('.', import.meta.url));
const routesDir = resolve(here, '..', 'src', 'levels', 'routes');

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1]!.split(',') : null;

const PAR = { timingTicks: 1, tilt: 0.06 };
const TRIALS = 6;
const LAW_P = 0.53;

/** The planner's own idle frame, inlined so the tool carries no tool-side imports. */
const idle = (held: boolean, tilt: [number, number]): InputFrame => ({ tiltX: tilt[0], tiltY: tilt[1], flipHeld: held, flipDown: false, flipUp: false });

/** Whole-run replay with jitter, the planner's own trick, edges derived the way ReplayPlayer does. */
function jittered(recording: Recording, j: { seed: number; timingTicks: number; tilt: number }): InputFrame[] {
  const rng = new Rng(j.seed);
  const frames: InputFrame[] = new Array(recording.totalTicks + 1);
  const shifted = recording.changes.map(([tick, tx, ty, held]) => {
    const offset = Math.round(rng.range(-j.timingTicks, j.timingTicks));
    return { tick: Math.max(0, tick + offset), tx: tx / 100 + rng.range(-j.tilt, j.tilt), ty: ty / 100 + rng.range(-j.tilt, j.tilt), held: held === 1 };
  });
  shifted.sort((a, b) => a.tick - b.tick);
  let c = 0;
  let cur = { tx: 0, ty: 0, held: false };
  let wasHeld = false;
  for (let t = 0; t < frames.length; t++) {
    while (c < shifted.length && shifted[c]!.tick <= t) {
      const s = shifted[c]!;
      cur = { tx: s.tx, ty: s.ty, held: s.held };
      c++;
    }
    frames[t] = { ...idle(cur.held, [Math.max(-1, Math.min(1, cur.tx)), Math.max(-1, Math.min(1, cur.ty))]), flipDown: cur.held && !wasHeld, flipUp: !cur.held && wasHeld };
    wasHeld = cur.held;
  }
  return frames;
}

interface ReportRow {
  slipRate: number;
  perHop?: number[];
}

const report: Record<string, ReportRow> = JSON.parse(readFileSync(resolve(routesDir, 'report.json'), 'utf8'));

const rapier = await loadRapier();
const ids = only ?? ALL_LEVELS.map((l) => l.id);
const rows: Array<{ id: string; parWhole: number; sloppyHop: number; within3: number }> = [];

for (const id of ids) {
  const level = levelById(id);
  const recording = decodeRecording(readFileSync(resolve(routesDir, `${id}.json`), 'utf8'));

  // Whole-run, par grade, open-loop.
  let clears = 0;
  for (let seed = 1; seed <= TRIALS; seed++) {
    const sim = new Simulation(rapier, level);
    const frames = jittered(recording, { seed: seed * 1000 + 7, ...PAR });
    for (let tick = 0; tick < frames.length && !sim.run.cleared; tick++) sim.step(frames[tick]!);
    if (sim.run.cleared) clears++;
    sim.dispose();
  }
  const parWhole = clears / TRIALS;

  // Per-hop product, sloppy grade, off the solve report.
  const row = report[id];
  const perHop = row?.perHop ?? [];
  const p1 = perHop.reduce((a, b) => a * b, 1);
  const within3 = 1 - (1 - p1) ** 3;
  rows.push({ id, parWhole, sloppyHop: p1, within3 });
  console.log(`${id.padEnd(16)} par-open-loop ${parWhole.toFixed(2)}  per-hop ${p1.toFixed(2)}  within3 ${within3.toFixed(2)}  ${within3 >= 0.9 ? 'ok' : 'FAIL'}`);
}

const fails = rows.filter((r) => r.within3 < 0.9);
console.log(`\n${fails.length} of ${rows.length} levels fail the three-attempt law (per-hop product at the sloppy grade, P >= ${LAW_P})`);
for (const r of fails) console.log(` - ${r.id}: per-hop ${r.sloppyHop.toFixed(2)}, within three ${r.within3.toFixed(2)}`);
