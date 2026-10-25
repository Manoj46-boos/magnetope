import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_LEVELS } from '@/levels';
import { buildAtomTable, levelSkills, type SkillAtom, type SkillId } from '@/levels/skills';
import { CLIMB_LAW, derivePhases, measure, PHASE_BANDS, type Measure, type PhasePlan } from '@/levels/clockwork';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';

/**
 * The level ledger (R-LD-01/07/09/16/17). Replays every stored route and
 * derives each level's skill atoms and clockwork phases from what its own data
 * can prove: teach on first appearance, drill what the route grabs most,
 * examine each atom before its biome closes, and place the beats where the
 * replay actually puts them.
 *
 *   npm run levels                print the audit
 *   npm run levels -- --stamp     freeze atoms + phases onto the route files
 *   npm run levels -- --doc       write docs/LEVELS.md
 *
 * The stamp is the reviewed source of truth; the CI suite re-derives the rows
 * and holds the doc, the routes and the levels to one story.
 */

const here = import.meta.dirname;
const routesDir = resolve(here, '../src/levels/routes');

const STAMP = process.argv.includes('--stamp');
const DOC = process.argv.includes('--doc');

console.log('replaying the routes ...');
const rapier = await loadRapier();
const measures = new Map<string, Measure>();
for (const level of ALL_LEVELS) {
  const sim = new Simulation(rapier, level);
  const player = new ReplayPlayer(decodeRecording(readFileSync(resolve(routesDir, `${level.id}.json`), 'utf8')));
  measures.set(level.id, measure(level, player, sim));
  sim.dispose();
}

console.log('deriving the atoms ...');
const evidence = Object.fromEntries([...measures.values()].map((m) => [m.id, { snaps: m.snaps, launches: m.launches }]));
const atoms = buildAtomTable(ALL_LEVELS, evidence) as Map<string, SkillAtom>;

const carriedBefore = new Map<string, Set<SkillId>>();
ALL_LEVELS.forEach((level, index) => {
  const carried = new Set<SkillId>();
  for (let i = 0; i < index; i++) for (const s of levelSkills(ALL_LEVELS[i]!, evidence[ALL_LEVELS[i]!.id]!)) carried.add(s);
  carriedBefore.set(level.id, carried);
});

const phases = new Map<string, PhasePlan>();
for (const level of ALL_LEVELS) {
  const measure = measures.get(level.id)!;
  const atom = atoms.get(level.id)!;
  const derived = derivePhases(level, measure, atom, carriedBefore.get(level.id)!);
  if (derived.headline && derived.headline !== atom.teaches) atoms.set(level.id, { ...atom, teaches: derived.headline });
  const plan = derived.plan;

  phases.set(level.id, plan);
  const rogers = (v: number, band: readonly [number, number]) => (v >= band[0] && v <= band[1] ? 'ok' : 'OUT');
  const law =
    plan.establish <= CLIMB_LAW.establishMax &&
    plan.escalate >= Math.max(CLIMB_LAW.escalateFloor, plan.establish) &&
    plan.escalate <= plan.resolve + CLIMB_LAW.driftTolerance &&
    plan.resolve >= CLIMB_LAW.resolveMin;
  console.log(
    `${level.id} ${level.name}: teach=${atoms.get(level.id)!.teaches ?? '—'} drill=${atom.practices ?? '—'} exam=${atom.examines ?? '—'} | ` +
      `clock ${plan.establish.toFixed(2)}/${plan.twist.toFixed(2)}/${plan.escalate.toFixed(2)}/${plan.resolve.toFixed(2)} ` +
      `(${rogers(plan.establish, PHASE_BANDS.establish)}/${rogers(plan.twist, PHASE_BANDS.twist)}/${rogers(plan.escalate, PHASE_BANDS.escalate)}/${rogers(plan.resolve, PHASE_BANDS.resolve)}) ` +
      `${law ? 'law' : 'LAW-BROKEN'} | native ${measure.snaps}+${measure.launches} | props ${level.props.length}/260 | ` +
      `par ${level.parSeconds}s route ${measure.clearSeconds.toFixed(1)}s author ${measure.authorSeconds?.toFixed(1) ?? '—'}s`,
  );
}

const rows = [...phases.values()];
for (const name of ['establish', 'twist', 'escalate', 'resolve'] as const) {
  const band = PHASE_BANDS[name];
  const inside = rows.filter((p) => p[name] >= band[0] && p[name] <= band[1]).length;
  console.log(`rogers ${name}: ${inside}/${rows.length} inside [${band[0]}, ${band[1]}]`);
}
const broken = rows.filter(
  (p) => p.establish > CLIMB_LAW.establishMax || p.escalate < CLIMB_LAW.escalateFloor || p.resolve < CLIMB_LAW.resolveMin,
).length;
console.log(`climb law: ${rows.length - broken}/${rows.length} hold`);

if (STAMP) {
  for (const level of ALL_LEVELS) {
    const file = resolve(routesDir, `${level.id}.json`);
    const route = JSON.parse(readFileSync(file, 'utf8'));
    const atom = atoms.get(level.id)!;
    route.skillAtom = { teaches: atom.teaches, practices: atom.practices, examines: atom.examines };
    route.phase = phases.get(level.id)!;
    writeFileSync(file, JSON.stringify(route));
  }
  console.log(`stamped ${ALL_LEVELS.length} routes`);
}

if (DOC) {
  const { renderLedger } = await import('./ledger-doc');
  writeFileSync(resolve(here, '../docs/LEVELS.md'), renderLedger(ALL_LEVELS, atoms, phases, measures));
  console.log('wrote docs/LEVELS.md');
}
