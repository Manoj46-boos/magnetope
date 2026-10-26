import { Rng } from '@/core/rng';
import { InputRecorder, ReplayPlayer, type Recording } from '@/sim/replay';
import { loadRapier } from '@/sim/rapier';
import { Simulation, type SimSnapshot } from '@/sim/simulation';
import type { InputFrame, LevelDef } from '@/sim/types';
import { Pilot, buildMacros, execute, idle, ticksOf, type Macro, type MacroSpace, type Noise } from './pilot';

/**
 * Development-only playtest bot. It searches macro actions (charge, tilt, snap
 * timing, crawl) on the real simulation, using snapshots to branch, and emits a
 * deterministic recording of the first route that reaches the summit.
 *
 * This is the completability gate from PRD 11.2. It is a search planner rather
 * than the PPO agent the PRD ultimately calls for, but it answers the same
 * question: can this level be cleared, and how robust is the route.
 */

interface Node {
  snapshot: SimSnapshot;
  frames: InputFrame[];
  x: number;
  y: number;
  ticks: number;
  score: number;
  parent: number;
  macro: Macro | null;
}

export interface SolveResult {
  solved: boolean;
  recording: Recording | null;
  expansions: number;
  evaluated: number;
  seconds: number;
  route: Macro[];
  /** Planned starting state and macro for every hop, used by the reliability estimate. */
  chain: Array<{ snapshot: SimSnapshot; macro: Macro }>;
  clearTimeMs: number;
  /** Highest altitude any explored node reached; shows how far an unsolved level got. */
  reached: number;
}

export interface PlannerOptions extends MacroSpace {
  maxExpansions: number;
  /** Noisy trials a hop must survive before the planner builds on it; 0 accepts any hop that works once. */
  robustTrials?: number;
  /** Fraction of those trials that must succeed. */
  robustShare?: number;
  /** Plays every macro the button layout's single thumb must (R-AC-03): no steering on any tick the flip button is touched. */
  oneThumb?: boolean;
}

export async function solveLevel(level: LevelDef, options: PlannerOptions): Promise<SolveResult> {
  const started = performance.now();
  const rapier = await loadRapier();
  const sim = new Simulation(rapier, level);
  const macros = buildMacros(options);
  const trials = options.robustTrials ?? 0;
  const needed = Math.ceil(trials * (options.robustShare ?? 0.75));
  const noise: Noise = { rng: new Rng(777), timingTicks: 2, tilt: 0.1 };

  /** Replays a hop with sloppy human timing and aim; fragile hops are rejected. */
  const survivesNoise = (node: Node, macro: Macro): boolean => {
    let passed = 0;
    for (let i = 0; i < trials; i++) {
      sim.restore(node.snapshot);
      const pilot = new Pilot(sim, []);
      pilot.resume(false);
      if (execute(pilot, macro, noise, options.oneThumb)) passed++;
      if (passed >= needed) return true;
      if (i + 1 - passed > trials - needed) return false;
    }
    return passed >= needed;
  };

  // Settle on the base, then start the clock with a harmless nudge.
  const root = new Pilot(sim, []);
  root.step(ticksOf(700));
  root.tilt = [0.25, 0];
  root.step(2);
  root.tilt = [0, 0];

  const nodes: Node[] = [
    {
      snapshot: sim.snapshot(),
      frames: root.frames.slice(),
      x: sim.magno.view.position.x,
      y: sim.magno.view.position.y,
      ticks: root.frames.length,
      score: 0,
      parent: -1,
      macro: null,
    },
  ];
  const open: number[] = [0];
  const seen = new Set<string>();
  let expansions = 0;
  let evaluated = 0;
  let reached = 0;

  const scoreOf = (x: number, y: number, ticks: number): number =>
    Math.hypot(x - level.summit.x, y - level.summit.y) + 0.004 * ticks;
  const keyOf = (x: number, y: number): string => `${Math.round(x * 1.6)}:${Math.round(y * 1.6)}`;
  seen.add(keyOf(nodes[0]!.x, nodes[0]!.y));

  while (open.length > 0 && expansions < options.maxExpansions) {
    open.sort((a, b) => nodes[a]!.score - nodes[b]!.score);
    const index = open.shift()!;
    const node = nodes[index]!;
    expansions++;

    for (const macro of macros) {
      evaluated++;
      sim.restore(node.snapshot);
      const pilot = new Pilot(sim, node.frames.slice());
      pilot.resume(false);
      const ok = execute(pilot, macro, undefined, options.oneThumb);
      if (!ok) continue;

      if (trials > 0) {
        if (!survivesNoise(node, macro)) continue;
        sim.restore(node.snapshot);
        pilot.frames.length = node.frames.length;
        pilot.resume(false);
        execute(pilot, macro, undefined, options.oneThumb);
      }

      if (sim.run.cleared) {
        const recorder = new InputRecorder();
        pilot.frames.forEach((f) => recorder.push(f));
        return {
          solved: true,
          recording: recorder.finish(level.id),
          expansions,
          evaluated,
          seconds: (performance.now() - started) / 1000,
          route: routeOf(nodes, index, macro),
          chain: chainOf(nodes, index, macro),
          clearTimeMs: sim.run.timeMs,
          reached: level.summit.y,
        };
      }

      const view = sim.magno.view;
      reached = Math.max(reached, view.position.y);
      const key = keyOf(view.position.x, view.position.y);
      if (seen.has(key)) continue;
      seen.add(key);
      nodes.push({
        snapshot: sim.snapshot(),
        frames: pilot.frames,
        x: view.position.x,
        y: view.position.y,
        ticks: pilot.frames.length,
        score: scoreOf(view.position.x, view.position.y, pilot.frames.length),
        parent: index,
        macro,
      });
      open.push(nodes.length - 1);
    }
  }

  sim.dispose();
  return { solved: false, recording: null, expansions, evaluated, seconds: (performance.now() - started) / 1000, route: [], chain: [], clearTimeMs: 0, reached };
}

function chainOf(nodes: Node[], last: number, final: Macro): Array<{ snapshot: SimSnapshot; macro: Macro }> {
  const chain = [{ snapshot: nodes[last]!.snapshot, macro: final }];
  for (let i = last; i > 0; i = nodes[i]!.parent) {
    const parent = nodes[nodes[i]!.parent]!;
    chain.unshift({ snapshot: parent.snapshot, macro: nodes[i]!.macro! });
  }
  return chain;
}

function routeOf(nodes: Node[], last: number, final: Macro): Macro[] {
  const route: Macro[] = [final];
  for (let i = last; i > 0; i = nodes[i]!.parent) route.unshift(nodes[i]!.macro!);
  return route;
}

export interface ReplayOutcome {
  cleared: boolean;
  falls: number;
  timeMs: number;
  ticks: number;
}

/** Replays a recording against a level, optionally jittering timing and aim like a sloppy human. */
export async function replay(
  level: LevelDef,
  recording: Recording,
  jitter?: { seed: number; timingTicks: number; tilt: number; extraTicks?: number },
): Promise<ReplayOutcome> {
  const rapier = await loadRapier();
  const sim = new Simulation(rapier, level);
  const frames = jitter ? jittered(recording, jitter) : null;
  const player = frames ? null : new ReplayPlayer(recording);
  const total = recording.totalTicks + (jitter?.extraTicks ?? 120);

  let tick = 0;
  let previousHeld = false;
  while (tick < total && !sim.run.cleared) {
    let frame: InputFrame;
    if (player && !player.done) frame = player.next();
    else if (frames && tick < frames.length) {
      const f = frames[tick]!;
      frame = { ...f, flipDown: f.flipHeld && !previousHeld, flipUp: !f.flipHeld && previousHeld };
    } else frame = idle(false, [0, 0]);
    previousHeld = frame.flipHeld;
    sim.step(frame);
    tick++;
  }
  const outcome = { cleared: sim.run.cleared, falls: sim.run.fallCount, timeMs: sim.run.timeMs, ticks: tick };
  sim.dispose();
  return outcome;
}

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
  for (let t = 0; t < frames.length; t++) {
    while (c < shifted.length && shifted[c]!.tick <= t) {
      const s = shifted[c]!;
      cur = { tx: s.tx, ty: s.ty, held: s.held };
      c++;
    }
    frames[t] = idle(cur.held, [Math.max(-1, Math.min(1, cur.tx)), Math.max(-1, Math.min(1, cur.ty))]);
  }
  return frames;
}

export interface Reliability {
  perHop: number[];
  /** Probability a sloppy run of the planned route reaches the summit with no slip. */
  clearProbability: number;
  /** One minus the clear probability: the planner's stand-in for the per-attempt fall rate. */
  failRate: number;
}

/**
 * Executes every hop of the planned route repeatedly from its planned start with
 * human-like timing and aim noise. The product of hop success rates is a
 * conservative difficulty estimate; real players re-plan between hops.
 */
export async function measureReliability(
  level: LevelDef,
  chain: SolveResult['chain'],
  trials: number,
  timingTicks = 2,
  tilt = 0.1,
): Promise<Reliability> {
  const rapier = await loadRapier();
  const sim = new Simulation(rapier, level);
  const rng = new Rng(4242);
  const perHop: number[] = [];
  for (const hop of chain) {
    let ok = 0;
    for (let i = 0; i < trials; i++) {
      sim.restore(hop.snapshot);
      const pilot = new Pilot(sim, []);
      pilot.resume(false);
      if (execute(pilot, hop.macro, { rng, timingTicks, tilt })) ok++;
    }
    perHop.push(ok / trials);
  }
  sim.dispose();
  const clearProbability = perHop.reduce((a, b) => a * b, 1);
  return { perHop, clearProbability, failRate: 1 - clearProbability };
}
