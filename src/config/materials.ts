/**
 * Material families (PRD 4.3). Every surface declares exactly one. The class
 * decides magnetic behaviour; restitution and friction decide how it feels.
 */
export type MagneticClass = 'ferro' | 'weak' | 'inert';

export type MaterialId =
  | 'steel'
  | 'appliance'
  | 'vehicle'
  | 'locker'
  | 'dish'
  | 'sheet'
  | 'can'
  | 'wood'
  | 'rubber'
  | 'mattress'
  | 'glass'
  | 'plastic'
  | 'fabric'
  | 'concrete'
  | 'trampoline'
  | 'ballpit';

export type MaterialVoice = 'body' | 'beam' | 'crumple' | 'wood' | 'rubber' | 'glass' | 'soft' | 'stone' | 'spring';

export interface MaterialDef {
  id: MaterialId;
  magnetic: MagneticClass;
  restitution: number;
  friction: number;
  /** Voice used by the audio engine for attach and impact sounds. */
  voice: MaterialVoice;
  breakable?: boolean;
  /** Swallows a fall: landing here never leaves MAGNO limp and the drop is not scored. */
  cushion?: boolean;
}

/**
 * Magnetic surfaces carry friction 1 because MAGNO's collider uses the Min
 * combine rule: the attach friction ramp (0 -> 0.9) is then the effective value.
 */
const defs: MaterialDef[] = [
  { id: 'steel', magnetic: 'ferro', restitution: 0.15, friction: 1, voice: 'beam' },
  { id: 'appliance', magnetic: 'ferro', restitution: 0.15, friction: 1, voice: 'body' },
  { id: 'vehicle', magnetic: 'ferro', restitution: 0.18, friction: 1, voice: 'body' },
  { id: 'locker', magnetic: 'ferro', restitution: 0.15, friction: 1, voice: 'body' },
  { id: 'dish', magnetic: 'ferro', restitution: 0.2, friction: 1, voice: 'beam' },
  { id: 'sheet', magnetic: 'weak', restitution: 0.2, friction: 1, voice: 'crumple' },
  { id: 'can', magnetic: 'weak', restitution: 0.3, friction: 1, voice: 'crumple' },
  { id: 'wood', magnetic: 'inert', restitution: 0.3, friction: 0.6, voice: 'wood' },
  { id: 'rubber', magnetic: 'inert', restitution: 0.65, friction: 0.9, voice: 'rubber' },
  { id: 'mattress', magnetic: 'inert', restitution: 0.75, friction: 0.7, voice: 'soft' },
  { id: 'glass', magnetic: 'inert', restitution: 0.1, friction: 0.2, voice: 'glass', breakable: true },
  { id: 'plastic', magnetic: 'inert', restitution: 0.4, friction: 0.4, voice: 'rubber' },
  { id: 'fabric', magnetic: 'inert', restitution: 0.2, friction: 0.8, voice: 'soft' },
  { id: 'concrete', magnetic: 'inert', restitution: 0.1, friction: 0.8, voice: 'stone' },
  { id: 'trampoline', magnetic: 'inert', restitution: 0.92, friction: 0.5, voice: 'spring' },
  { id: 'ballpit', magnetic: 'inert', restitution: 0.08, friction: 0.9, voice: 'soft', cushion: true },
];

export const MATERIALS: Readonly<Record<MaterialId, MaterialDef>> = Object.fromEntries(
  defs.map((d) => [d.id, d]),
) as Record<MaterialId, MaterialDef>;

export const isMagnetic = (m: MaterialDef): boolean => m.magnetic !== 'inert';
