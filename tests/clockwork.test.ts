import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ALL_LEVELS } from '@/levels';
import { buildAtomTable, levelSkills, type SkillId } from '@/levels/skills';
import { CLIMB_LAW, derivePhases, measure, type Measure } from '@/levels/clockwork';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';

/**
 * The clockwork suite (R-LD-07/10): the phases stamped on the routes are the
 * reviewed plan, and this suite replays every route to hold the plan to what
 * the replay can prove. The climb's own law — the settle ends inside the quiet
 * opening, the climax centre sits past the first quarter and inside the
 * resolve's reach, and the last catch keeps its grip on the end — must hold on
 * every level, and the stamped plan may not drift from a fresh derivation.
 * The same replay counts the magnet-native moments: a level whose route never
 * snaps or launches is filler and fails here.
 */

const routesDir = resolve(__dirname, '../src/levels/routes');
const rapier = await loadRapier();

const measures = new Map<string, Measure>();
beforeAll(async () => {
  for (const level of ALL_LEVELS) {
    const sim = new Simulation(rapier, level);
    const player = new ReplayPlayer(decodeRecording(readFileSync(resolve(routesDir, `${level.id}.json`), 'utf8')));
    measures.set(level.id, measure(level, player, sim));
    sim.dispose();
  }
});

const evidenceOf = () => Object.fromEntries([...measures.values()].map((m) => [m.id, { snaps: m.snaps, launches: m.launches }]));

describe('the clockwork of a climb (R-LD-07)', () => {
  it('holds the hard law on every level: settle, climax, resolve in order', () => {
    for (const level of ALL_LEVELS) {
      const plan = (JSON.parse(readFileSync(resolve(routesDir, `${level.id}.json`), 'utf8')) as { phase: Record<string, number> }).phase;
      expect(plan.establish!, `${level.id}: the settle ends inside the quiet opening`).toBeLessThanOrEqual(CLIMB_LAW.establishMax);
      expect(plan.escalate!, `${level.id}: the climax centre sits past the first quarter and after the settle`).toBeGreaterThanOrEqual(
        Math.max(CLIMB_LAW.escalateFloor, plan.establish!),
      );
      expect(plan.resolve!, `${level.id}: the last catch keeps its grip on the end`).toBeGreaterThanOrEqual(CLIMB_LAW.resolveMin);
      expect(plan.escalate!, `${level.id}: the climax stays inside the resolve's reach`).toBeLessThanOrEqual(plan.resolve! + CLIMB_LAW.driftTolerance);
    }
  });

  it('keeps the stamped plans within a fresh re-derivation of the same routes', () => {
    const evidence = evidenceOf();
    const atoms = buildAtomTable(ALL_LEVELS, evidence);
    ALL_LEVELS.forEach((level, index) => {
      const carried = new Set<SkillId>();
      for (let i = 0; i < index; i++) for (const skill of levelSkills(ALL_LEVELS[i]!, evidence[ALL_LEVELS[i]!.id]!)) carried.add(skill);
      const { plan } = derivePhases(level, measures.get(level.id)!, atoms.get(level.id)!, carried);
      const stamped = (JSON.parse(readFileSync(resolve(routesDir, `${level.id}.json`), 'utf8')) as { phase: Record<string, number> }).phase;
      for (const key of ['establish', 'twist', 'escalate', 'resolve'] as const) {
        expect(Math.abs(stamped[key]! - plan[key]), `${level.id}: ${key} drifted from the replay`).toBeLessThanOrEqual(CLIMB_LAW.driftTolerance);
      }
    });
  });
});

describe('magnet-native moments (R-LD-10)', () => {
  it('spends at least one snap or launch on every level: no filler', () => {
    for (const level of ALL_LEVELS) {
      const run = measures.get(level.id)!;
      expect(run.snaps + run.launches, `${level.id}: the route never uses its own verb`).toBeGreaterThan(0);
    }
  });
});
