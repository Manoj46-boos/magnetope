import type { LevelDef, PropPlacement } from '@/sim/types';

/**
 * The skill-atom vocabulary (R-LD-01/09). An atom is one mechanic a level can
 * teach, practice or examine: the machine derives each level's atoms from its
 * own props, flags and route evidence, so the table in docs/LEVELS.md and the
 * metadata stamped on the stored routes can never drift from the levels that
 * actually ship. Cook's law is checked against this table: nothing is examined
 * before the level that teaches it, and every atom taught inside a biome is
 * examined before that biome closes.
 */

export type SkillId =
  | 'appliance-climb'
  | 'charge-launch'
  | 'snap-catch'
  | 'loose-junk'
  | 'weak-metal'
  | 'bounce'
  | 'hinged-ride'
  | 'moving-surface'
  | 'elevator-ride'
  | 'glass-hop'
  | 'timed-sign'
  | 'wind-ride'
  | 'hook-swing'
  | 'wheel-ride'
  | 'swing-ride'
  | 'seesaw-ride'
  | 'slide-ride'
  | 'soft-landing'
  | 'bars-climb'
  | 'float-flight'
  | 'satellite-junk';

/** Kinds whose whole identity is the mechanic, whatever way they are placed. */
const KIND_SKILLS: Readonly<Record<string, SkillId>> = {
  fridge: 'appliance-climb',
  washer: 'appliance-climb',
  locker: 'appliance-climb',
  cabinet: 'appliance-climb',
  'filing-cabinet': 'appliance-climb',
  'file-drawer': 'appliance-climb',
  'loose-girder': 'loose-junk',
  barrel: 'loose-junk',
  'loose-crate': 'loose-junk',
  'drawer-cabinet': 'loose-junk',
  sheet: 'weak-metal',
  'rust-grate': 'weak-metal',
  trampoline: 'bounce',
  'boing-washer': 'bounce',
  awning: 'bounce',
  'bouncy-castle': 'bounce',
  pane: 'glass-hop',
  gutter: 'hinged-ride',
  'swing-plate': 'hinged-ride',
  drawbridge: 'hinged-ride',
  seesaw: 'seesaw-ride',
  'swing-seat': 'swing-ride',
  'crane-hook': 'hook-swing',
  'slide-ramp': 'slide-ride',
  'ball-pit': 'soft-landing',
  'giant-ball': 'soft-landing',
  'monkey-bars': 'bars-climb',
  counterweight: 'elevator-ride',
  'elevator-cab': 'elevator-ride',
  'service-lift': 'elevator-ride',
  fuselage: 'satellite-junk',
  'fuselage-skin': 'satellite-junk',
  'radio-dish': 'satellite-junk',
  satellite: 'satellite-junk',
  'antenna-mast': 'satellite-junk',
  wing: 'satellite-junk',
  'solar-panel': 'satellite-junk',
  'thermal-wall': 'satellite-junk',
  debris: 'satellite-junk',
  truss: 'satellite-junk',
};

/** The teaching order the headline pick follows when a level introduces more than one atom. */
const CURRICULUM: readonly SkillId[] = [
  'snap-catch',
  'charge-launch',
  'appliance-climb',
  'loose-junk',
  'weak-metal',
  'bounce',
  'hinged-ride',
  'moving-surface',
  'elevator-ride',
  'glass-hop',
  'timed-sign',
  'wind-ride',
  'hook-swing',
  'wheel-ride',
  'swing-ride',
  'seesaw-ride',
  'slide-ride',
  'soft-landing',
  'bars-climb',
  'float-flight',
  'satellite-junk',
];

/** What one placement teaches, beyond its kind: the scripted verbs. */
function placementSkills(prop: PropPlacement): SkillId[] {
  const skills: SkillId[] = [];
  if (prop.cycle !== undefined) skills.push('timed-sign');
  // Kinds whose hinge is their whole identity (the swing, the see-saw) carry their
  // own atom; a bare hinge a level bolts onto something else rides as hinged-ride.
  if (prop.hinge && !KIND_SKILLS[prop.kind]) skills.push('hinged-ride');
  if (prop.motion?.type === 'spin') skills.push('wheel-ride');
  if (prop.motion?.type === 'swing' && prop.kind !== 'crane-hook') skills.push('swing-ride');
  if (prop.motion && prop.kind !== 'crane-hook' && prop.kind !== 'slide-ramp' && prop.motion.type !== 'spin' && prop.motion.type !== 'swing') {
    skills.push('moving-surface');
  }
  return skills;
}

/** The atom a grabbed kind carries, when its identity alone decides it. */
export function kindSkill(kind: string): SkillId | null {
  return KIND_SKILLS[kind] ?? null;
}

/** Every atom a single placement carries, kind first, scripted verbs folded in. */
export function propSkills(prop: PropPlacement): SkillId[] {
  const skills: SkillId[] = [];
  const byKind = kindSkill(prop.kind);
  if (byKind) skills.push(byKind);
  for (const skill of placementSkills(prop)) if (!skills.includes(skill)) skills.push(skill);
  return skills;
}

export interface RouteEvidence {
  /** Snap catches the stored route performed. */
  snaps: number;
  /** Polarity launches the stored route performed. */
  launches: number;
}

/** Every atom a level carries, deduplicated, in curriculum order. */
export function levelSkills(level: LevelDef, evidence: RouteEvidence): SkillId[] {
  const found = new Set<SkillId>();
  for (const prop of level.props) {
    const byKind = KIND_SKILLS[prop.kind];
    if (byKind) found.add(byKind);
    for (const skill of placementSkills(prop)) found.add(skill);
  }
  if (level.wind) found.add('wind-ride');
  if (level.gravityScale !== undefined && level.gravityScale < 1) found.add('float-flight');
  if (evidence.snaps > 0) found.add('snap-catch');
  if (evidence.launches > 0) found.add('charge-launch');
  return CURRICULUM.filter((s) => found.has(s));
}

export interface SkillAtom {
  /** The atom this level introduces; null when the level only reuses taught ones. */
  teaches: SkillId | null;
  /** A taught atom this level reuses on the way up. */
  practices: SkillId | null;
  /** The atom this level puts on the exam bench; null except exam levels. */
  examines: SkillId | null;
}

/**
 * One row per level: teach on first appearance, practice the strongest carried
 * atom, and examine each atom at its last load-bearing appearance inside the
 * biome that taught it, so no biome closes with an unexamined skill.
 */
export function buildAtomTable(levels: readonly LevelDef[], evidence: Readonly<Record<string, RouteEvidence>>): Map<string, SkillAtom> {
  const skillsByLevel = levels.map((level) => ({ level, skills: levelSkills(level, evidence[level.id] ?? { snaps: 0, launches: 0 }) }));
  const firstSeen = new Map<SkillId, number>();
  const teachingBiome = new Map<SkillId, string>();
  skillsByLevel.forEach(({ level, skills }, index) => {
    for (const skill of skills) {
      if (!firstSeen.has(skill)) {
        firstSeen.set(skill, index);
        teachingBiome.set(skill, level.biome);
      }
    }
  });

  // The exam bench: one atom per level, walking back from each atom's last
  // carrier inside its teaching biome until a level with a free bench is found,
  // so a biome can close with every taught atom examined.
  const bench = new Map<string, SkillId | null>();
  for (const level of levels) bench.set(level.id, null);
  for (const skill of CURRICULUM) {
    const teach = firstSeen.get(skill);
    if (teach === undefined) continue;
    const home = teachingBiome.get(skill)!;
    const carriers = skillsByLevel
      .filter(({ level, skills }) => level.biome === home && skills.includes(skill))
      .map(({ level }) => level.id);
    for (const id of [...carriers].reverse()) {
      if (bench.get(id) === null) {
        bench.set(id, skill);
        break;
      }
    }
  }

  const rows = new Map<string, SkillAtom>();
  skillsByLevel.forEach(({ level, skills }, index) => {
    const fresh = skills.filter((s) => firstSeen.get(s) === index);
    const carried = skills.filter((s) => firstSeen.get(s)! < index);
    rows.set(level.id, { teaches: fresh[0] ?? null, practices: carried[0] ?? fresh[0] ?? null, examines: bench.get(level.id) ?? null });
  });
  return rows;
}
