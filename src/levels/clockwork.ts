import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { kindSkill, propSkills, levelSkills, type SkillAtom, type SkillId } from './skills';
import { decodeGhost } from '@/sim/ghost';
import type { ReplayPlayer } from '@/sim/replay';
import type { Simulation } from '@/sim/simulation';
import type { LevelDef, PropPlacement } from '@/sim/types';

/**
 * The clockwork of a climb (R-LD-07). Rogers' fractions describe encounter
 * levels; a continuous climb runs its own honest clockwork, and this module
 * measures it from the level's own stored route: the settle ends at the first
 * committed launch, the verb shows where the level's atom first answers, the
 * climax centres on the biggest hops, and the resolve holds the final catch
 * before the summit. The phases are stamped on the route as the reviewed plan;
 * the suite re-derives them and holds the plan to what the replay can prove.
 */

/** Rogers' encounter fractions, kept as the audit's soft verdicts. */
export const PHASE_BANDS = {
  establish: [0.02, 0.4] as const,
  twist: [0.25, 0.55] as const,
  escalate: [0.6, 1.05] as const,
  resolve: [0.75, 1.0] as const,
};

/** The climb's hard law: what every level's measured clockwork must hold. */
export const CLIMB_LAW = {
  /** The settle ends inside the quiet opening. */
  establishMax: 0.4,
  /** The climax centre sits past the first quarter. */
  escalateFloor: 0.25,
  /** The last catch keeps its grip on the end of the route. */
  resolveMin: 0.7,
  /** A stamped plan may drift this far from a fresh re-derivation. */
  driftTolerance: 0.15,
} as const;

export interface PhasePlan {
  establish: number;
  twist: number;
  escalate: number;
  resolve: number;
}

export interface Beat {
  /** Share of the route's own clear time. */
  frac: number;
  kind: 'catch' | 'launch';
  snap: boolean;
  /** Seconds spent airborne landing on this catch; the spawn catch carries none. */
  air: number;
  /** The atom the grabbed prop answers to, when the grab shows one. */
  skill: SkillId | null;
}

export interface Measure {
  id: string;
  clearSeconds: number;
  beats: Beat[];
  /** Long flights, as the share of the clear where they land. */
  flights: number[];
  census: Map<string, number>;
  snaps: number;
  launches: number;
  /** The shipped author demo's own length, where one exists. */
  authorSeconds: number | null;
}

/** The nearest placement to MAGNO at the moment of a catch. */
export function attribute(sim: Simulation, level: LevelDef): PropPlacement | null {
  const at = sim.magno.view.position;
  let best: PropPlacement | null = null;
  let bestDistance = Infinity;
  for (const prop of sim.physics.props) {
    const t = sim.physics.world.getRigidBody(prop.bodyHandle).translation();
    const distance = Math.hypot(t.x - at.x, t.y - at.y) - Math.max(prop.width, prop.height) / 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = level.props[prop.index] ?? null;
    }
  }
  return best;
}

/** Replay a stored route and read its beats: catches with their grabs, launches, flights. */
export function measure(level: LevelDef, player: ReplayPlayer, sim: Simulation): Measure {
  const raw: Array<{ t: number; kind: 'catch' | 'launch'; snap: boolean; skill: SkillId | null; air: number }> = [];
  const census = new Map<string, number>();
  let snaps = 0;
  let launches = 0;
  sim.events.on('attach', (ev) => {
    const grabbed = attribute(sim, level);
    const skill = grabbed ? (propSkills(grabbed)[0] ?? kindSkill(grabbed.kind)) : null;
    const last = raw[raw.length - 1];
    raw.push({ t: sim.timeSeconds, kind: 'catch', snap: ev.viaSnap, skill, air: last ? sim.timeSeconds - last.t : 0 });
    if (ev.viaSnap) snaps++;
    if (grabbed) census.set(grabbed.kind, (census.get(grabbed.kind) ?? 0) + 1);
  });
  sim.events.on('repel', () => {
    raw.push({ t: sim.timeSeconds, kind: 'launch', snap: false, skill: 'charge-launch', air: 0 });
    launches++;
  });
  while (!player.done && !sim.run.cleared) sim.step(player.next());
  const clearSeconds = Math.max(sim.run.timeMs / 1000, 0.01);

  const beats: Beat[] = raw.map((b) => ({ frac: b.t / clearSeconds, kind: b.kind, snap: b.snap, air: b.air, skill: b.skill }));
  const flights: number[] = [];
  const catches = beats.filter((b) => b.kind === 'catch');
  for (let i = 1; i < catches.length; i++) {
    const airtime = (catches[i]!.frac - catches[i - 1]!.frac) * clearSeconds;
    if (airtime >= 1.5) flights.push(catches[i]!.frac);
  }
  return { id: level.id, clearSeconds, beats, flights, census, snaps, launches, authorSeconds: authorSeconds(level) };
}

/** The shipped par ghost's own length in seconds, where one exists. */
export function authorSeconds(level: LevelDef): number | null {
  const file = resolve(process.cwd(), 'src/levels/ghosts', `${level.id}.json`);
  if (!existsSync(file)) return null;
  const track = decodeGhost(readFileSync(file, 'utf8'), level.id);
  return track ? track.durationMs / 1000 : null;
}

/** The first beat an atom answers to: a committed grab first, then any grab at all. */
export function beatFor(beats: Beat[], flights: number[], skill: SkillId): number | null {
  if (skill === 'charge-launch') return beats.find((b) => b.kind === 'launch')?.frac ?? null;
  if (skill === 'snap-catch') return beats.find((b) => b.kind === 'catch' && b.snap)?.frac ?? null;
  const airs = beats.filter((b) => b.kind === 'catch').map((b) => b.air).sort((a, b) => a - b);
  const committed = airs.length ? airs[Math.floor(airs.length / 2)]! : 0;
  const grabs = beats.filter((b) => b.kind === 'catch' && b.skill === skill);
  const serious = grabs.find((b) => b.air >= committed);
  if (serious) return serious.frac;
  // Wind and thin air are read in the air: the first long flight is their beat.
  if (skill === 'wind-ride' || skill === 'float-flight') return flights[0] ?? null;
  return grabs[0]?.frac ?? null;
}

/** Where the route's biggest hops land: the climax a player climbs into. */
export function escalateBeat(beats: Beat[]): number {
  const catches = beats.filter((b) => b.kind === 'catch' && b.air > 0);
  if (catches.length === 0) return 0.85;
  const airs = catches.map((b) => b.air).sort((a, b) => a - b);
  const bar = Math.max(airs[Math.floor(airs.length * 0.75)]!, 1);
  const big = catches.filter((b) => b.air >= bar);
  const chosen = big.length ? big : catches.slice(-1);
  return chosen.reduce((sum, b) => sum + b.frac, 0) / chosen.length;
}

/** Where the opening settle ends: the fraction of the route where MAGNO first commits to a launch. */
export function establishBeat(beats: Beat[]): number {
  return beats.find((b) => b.kind === 'launch')?.frac ?? 0.1;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * The level's phase plan from its measure: the headline verb's beat for the
 * twist (teach first, then the bench, then the drill), the big-hop centre for
 * the escalate, the first launch for the establish and the last catch for the
 * resolve. A breather with nothing new still snaps its way up.
 *
 * Returns the plan plus the fresh atom whose in-band beat became the twist —
 * the level's headline teach — so the stamp can name it.
 */
export function derivePhases(level: LevelDef, measure: Measure, atom: SkillAtom, earlierSkills: ReadonlySet<SkillId>): { plan: PhasePlan; headline: SkillId | null } {
  const fresh = levelSkills(level, { snaps: measure.snaps, launches: measure.launches }).filter((s) => !earlierSkills.has(s));
  let twist: number | null = null;
  let headline: SkillId | null = null;
  for (const skill of fresh) {
    const beat = beatFor(measure.beats, measure.flights, skill);
    if (beat !== null && beat >= PHASE_BANDS.twist[0] && beat <= PHASE_BANDS.twist[1]) {
      twist = beat;
      headline = skill;
      break;
    }
  }
  if (twist === null && fresh[0]) twist = beatFor(measure.beats, measure.flights, fresh[0]!);
  if (twist === null && atom.examines) twist = beatFor(measure.beats, measure.flights, atom.examines);
  if (twist === null && atom.practices) twist = beatFor(measure.beats, measure.flights, atom.practices);
  if (twist === null) {
    const headlineKind = [...measure.census.entries()].sort((a, b) => b[1] - a[1]).map(([kind]) => kindSkill(kind)).find(Boolean);
    if (headlineKind) twist = beatFor(measure.beats, measure.flights, headlineKind);
  }
  if (twist === null) twist = measure.beats.find((b) => b.kind === 'catch' && b.snap)?.frac ?? 0.4;
  const lastCatch = [...measure.beats].reverse().find((b) => b.kind === 'catch');
  return {
    plan: {
      establish: round2(establishBeat(measure.beats)),
      twist: round2(twist),
      escalate: round2(escalateBeat(measure.beats)),
      resolve: round2(lastCatch?.frac ?? 1),
    },
    headline,
  };
}
