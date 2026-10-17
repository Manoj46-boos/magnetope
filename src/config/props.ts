import type { MaterialId } from './materials';

/**
 * Prop physics identities. This table is the single source for the runtime and
 * the art kit (PRD 6.4): shape, material and mass live here and nowhere else.
 */
export type PropShape =
  | { type: 'box'; w: number; h: number }
  | { type: 'disc'; r: number };

export type PropDetail =
  | 'rivets'
  | 'handle'
  | 'dents'
  | 'planks'
  | 'tread'
  | 'panes'
  | 'slats'
  | 'dish'
  | 'plain'
  | 'siding'
  | 'shingles'
  | 'shed'
  | 'gutter'
  | 'mailbox'
  | 'post'
  | 'laundry'
  | 'trampoline'
  | 'garage'
  | 'picket'
  | 'swing-plate'
  | 'scaffold'
  | 'louvre'
  | 'billboard'
  | 'neon'
  | 'rig'
  | 'hook'
  | 'weight'
  | 'cab'
  | 'windows'
  | 'cladding'
  | 'slide'
  | 'spoke'
  | 'hub'
  | 'gondola'
  | 'wheel-hub'
  | 'wheel-spoke'
  | 'wheel-cabin'
  | 'swing-frame'
  | 'swing-seat'
  | 'seesaw'
  | 'ballpit'
  | 'bars'
  | 'carousel'
  | 'block'
  | 'giant-ball'
  | 'fuselage'
  | 'wing'
  | 'skin'
  | 'solar'
  | 'satellite'
  | 'radio'
  | 'mast'
  | 'truss'
  | 'debris'
  | 'pod'
  | 'strobe'
  | 'thermal'
  | 'boing-washer'
  | 'grate'
  | 'filing'
  | 'drawer'
  | 'awning'
  | 'call-box'
  | 'lift'
  | 'drawbridge'
  | 'diving-board'
  | 'castle'
  | 'ice';

/**
 * Behaviour a surface performs in answer to MAGNO, beyond being solid.
 * `boing` throws him back off a hard landing and holds him on a soft one;
 * `crumble` gives way under his weight and re-forms once he is gone.
 */
export type PropReaction =
  | {
      type: 'boing';
      /** Approach speed (m/s) from which the surface throws MAGNO back instead of holding him. */
      above: number;
      /** Share of the approach speed returned along the normal. Below 1, so every bounce is lower than the last and MAGNO is eventually caught. */
      gain: number;
      min: number;
      max: number;
      /** How long the surface refuses to catch him after a bounce. */
      lockMs: number;
    }
  | {
      type: 'crumble';
      /** Weight the surface carries before it gives way. */
      holdMs: number;
      /** The shiver that comes before the collapse. */
      warnMs: number;
      /** Time spent gone before it re-forms. */
      restoreMs: number;
    };

export interface PropKind {
  id: string;
  shape: PropShape;
  material: MaterialId;
  /** Present for dynamic bodies. */
  mass?: number;
  /** Live-ferrous props are dragged by MAGNO's field and drag back. */
  live?: boolean;
  /** Share of the wind a dynamic prop catches; 1 moves like MAGNO does. */
  windage?: number;
  /** Grabbable edges and handles are drawn 1.4x for affordance (PRD 6.4). */
  detail?: PropDetail;
  /** Angular damping of a hung prop; the default lets it swing for a long time. */
  swingDamping?: number;
  reaction?: PropReaction;
  /** A hinged prop that tips only so far and eases back to level, like a see-saw on its stops. Stiffness is N*m per radian, damping N*m*s per radian. */
  tilt?: { limit: number; stiffness: number; damping: number };
  /** Friction in the axle of a free-turning prop, in N*m*s per radian: what lets a wheel coast but not spin for ever. */
  bearing?: number;
}

const kinds: PropKind[] = [
  // Scrapyard
  { id: 'girder', shape: { type: 'box', w: 5, h: 0.45 }, material: 'steel', detail: 'rivets' },
  { id: 'beam', shape: { type: 'box', w: 0.5, h: 4 }, material: 'steel', detail: 'rivets' },
  { id: 'plate', shape: { type: 'box', w: 8, h: 0.8 }, material: 'steel', detail: 'rivets' },
  { id: 'fridge', shape: { type: 'box', w: 1.8, h: 3.7 }, material: 'appliance', detail: 'handle' },
  { id: 'washer', shape: { type: 'box', w: 2.1, h: 2.3 }, material: 'appliance', detail: 'handle' },
  { id: 'car', shape: { type: 'box', w: 4.6, h: 1.6 }, material: 'vehicle', detail: 'dents' },
  { id: 'locker', shape: { type: 'box', w: 1.3, h: 3.2 }, material: 'locker', detail: 'slats' },
  { id: 'cabinet', shape: { type: 'box', w: 1.6, h: 2.4 }, material: 'locker', detail: 'handle' },
  { id: 'dish', shape: { type: 'disc', r: 1.5 }, material: 'dish', detail: 'dish' },
  { id: 'sheet', shape: { type: 'box', w: 3.2, h: 0.22 }, material: 'sheet', detail: 'dents' },
  { id: 'can', shape: { type: 'disc', r: 0.6 }, material: 'can', detail: 'dents' },
  { id: 'crate', shape: { type: 'box', w: 2, h: 2 }, material: 'wood', detail: 'planks' },
  { id: 'plank', shape: { type: 'box', w: 4, h: 0.3 }, material: 'wood', detail: 'planks' },
  { id: 'tire', shape: { type: 'disc', r: 0.95 }, material: 'rubber', detail: 'tread' },
  { id: 'mattress', shape: { type: 'box', w: 3.2, h: 0.55 }, material: 'mattress', detail: 'plain' },
  { id: 'pane', shape: { type: 'box', w: 2.6, h: 0.18 }, material: 'glass', detail: 'panes' },
  { id: 'slab', shape: { type: 'box', w: 12, h: 1.2 }, material: 'concrete', detail: 'plain' },
  { id: 'loose-girder', shape: { type: 'box', w: 4, h: 0.4 }, material: 'steel', mass: 70, live: true, detail: 'rivets' },
  { id: 'barrel', shape: { type: 'disc', r: 0.7 }, material: 'steel', mass: 35, live: true, detail: 'rivets' },
  { id: 'loose-crate', shape: { type: 'box', w: 1.4, h: 1.4 }, material: 'wood', mass: 25, detail: 'planks' },
  { id: 'drawer-cabinet', shape: { type: 'box', w: 1.4, h: 1.8 }, material: 'locker', mass: 55, detail: 'handle' },
  {
    id: 'boing-washer',
    shape: { type: 'box', w: 2.1, h: 2.3 },
    material: 'appliance',
    detail: 'boing-washer',
    reaction: { type: 'boing', above: 5.5, gain: 0.8, min: 5, max: 17, lockMs: 450 },
  },
  {
    id: 'rust-grate',
    shape: { type: 'box', w: 3.6, h: 0.28 },
    material: 'steel',
    detail: 'grate',
    reaction: { type: 'crumble', holdMs: 1100, warnMs: 650, restoreMs: 4500 },
  },
  { id: 'filing-cabinet', shape: { type: 'box', w: 1.5, h: 2.7 }, material: 'locker', detail: 'filing' },
  { id: 'file-drawer', shape: { type: 'box', w: 1.5, h: 0.5 }, material: 'locker', detail: 'drawer' },

  // Suburbia
  { id: 'siding', shape: { type: 'box', w: 2.4, h: 4 }, material: 'wood', detail: 'siding' },
  { id: 'roof', shape: { type: 'box', w: 6, h: 0.5 }, material: 'concrete', detail: 'shingles' },
  { id: 'shed', shape: { type: 'box', w: 3.4, h: 2.6 }, material: 'locker', detail: 'shed' },
  { id: 'gutter', shape: { type: 'box', w: 4.2, h: 0.3 }, material: 'sheet', detail: 'gutter' },
  { id: 'mailbox', shape: { type: 'box', w: 1.1, h: 0.9 }, material: 'appliance', detail: 'mailbox' },
  { id: 'post', shape: { type: 'box', w: 0.3, h: 3 }, material: 'wood', detail: 'post' },
  { id: 'laundry', shape: { type: 'box', w: 2.6, h: 1 }, material: 'fabric', detail: 'laundry' },
  { id: 'trampoline', shape: { type: 'box', w: 3.6, h: 0.5 }, material: 'trampoline', detail: 'trampoline' },
  { id: 'garage-door', shape: { type: 'box', w: 3.6, h: 3 }, material: 'appliance', detail: 'garage' },
  { id: 'picket', shape: { type: 'box', w: 4, h: 1.5 }, material: 'wood', detail: 'picket' },
  {
    id: 'awning',
    shape: { type: 'box', w: 3.8, h: 0.3 },
    material: 'fabric',
    detail: 'awning',
    reaction: { type: 'boing', above: 4, gain: 0.85, min: 3.5, max: 13, lockMs: 380 },
  },
  { id: 'swing-plate', shape: { type: 'box', w: 2.6, h: 0.45 }, material: 'steel', mass: 45, windage: 0.5, detail: 'swing-plate' },

  // Metropolis
  { id: 'scaffold-deck', shape: { type: 'box', w: 4.4, h: 0.35 }, material: 'steel', detail: 'scaffold' },
  { id: 'scaffold-pole', shape: { type: 'box', w: 0.34, h: 4.4 }, material: 'steel', detail: 'scaffold' },
  { id: 'ac-unit', shape: { type: 'box', w: 2.2, h: 1.5 }, material: 'appliance', detail: 'louvre' },
  { id: 'billboard', shape: { type: 'box', w: 6, h: 3.2 }, material: 'plastic', detail: 'billboard' },
  { id: 'neon-panel', shape: { type: 'box', w: 3, h: 0.55 }, material: 'steel', detail: 'neon' },
  { id: 'washer-rig', shape: { type: 'box', w: 3.6, h: 0.5 }, material: 'steel', detail: 'rig' },
  { id: 'crane-hook', shape: { type: 'box', w: 1.4, h: 1.2 }, material: 'steel', detail: 'hook' },
  { id: 'counterweight', shape: { type: 'box', w: 1.8, h: 1.8 }, material: 'steel', detail: 'weight' },
  { id: 'elevator-cab', shape: { type: 'box', w: 3.2, h: 0.4 }, material: 'steel', detail: 'cab' },
  { id: 'facade', shape: { type: 'box', w: 6, h: 8 }, material: 'concrete', detail: 'windows' },
  { id: 'call-box', shape: { type: 'box', w: 0.9, h: 1.2 }, material: 'steel', detail: 'call-box' },
  { id: 'service-lift', shape: { type: 'box', w: 3.2, h: 0.4 }, material: 'steel', detail: 'lift' },
  {
    id: 'drawbridge',
    shape: { type: 'box', w: 6.2, h: 0.5 },
    material: 'steel',
    mass: 90,
    tilt: { limit: 0.55, stiffness: 9000, damping: 700 },
    detail: 'drawbridge',
  },
  { id: 'cladding', shape: { type: 'box', w: 0.35, h: 4 }, material: 'sheet', detail: 'cladding' },

  // Playground of Giants
  { id: 'slide-ramp', shape: { type: 'box', w: 8, h: 0.5 }, material: 'steel', detail: 'slide' },
  { id: 'ferris-spoke', shape: { type: 'box', w: 6.4, h: 0.36 }, material: 'steel', detail: 'spoke' },
  { id: 'gondola', shape: { type: 'box', w: 2.2, h: 0.4 }, material: 'steel', detail: 'gondola' },
  // The field-driven wheel: a hub on a bearing, spokes bolted to it, cabins hung from the spoke tips.
  { id: 'wheel-hub', shape: { type: 'disc', r: 0.9 }, material: 'steel', mass: 600, swingDamping: 0.35, bearing: 800, detail: 'hub' },
  { id: 'wheel-spoke', shape: { type: 'box', w: 4.6, h: 0.36 }, material: 'steel', mass: 24, swingDamping: 0.05, detail: 'spoke' },
  { id: 'wheel-cabin', shape: { type: 'box', w: 2.2, h: 0.4 }, material: 'steel', mass: 50, swingDamping: 1.6, detail: 'gondola' },
  { id: 'swing-beam', shape: { type: 'box', w: 6, h: 0.4 }, material: 'steel', detail: 'swing-frame' },
  { id: 'swing-seat', shape: { type: 'box', w: 1.9, h: 0.3 }, material: 'steel', mass: 55, windage: 0.6, swingDamping: 0.6, detail: 'swing-seat' },
  { id: 'seesaw', shape: { type: 'box', w: 5.4, h: 0.36 }, material: 'steel', mass: 60, tilt: { limit: 0.4, stiffness: 420, damping: 160 }, detail: 'seesaw' },
  {
    id: 'diving-board',
    shape: { type: 'box', w: 4.6, h: 0.3 },
    material: 'steel',
    mass: 32,
    tilt: { limit: 0.5, stiffness: 4200, damping: 240 },
    detail: 'diving-board',
  },
  {
    id: 'bouncy-castle',
    shape: { type: 'box', w: 4.4, h: 1.8 },
    material: 'plastic',
    detail: 'castle',
    reaction: { type: 'boing', above: 3.5, gain: 0.85, min: 3, max: 15, lockMs: 420 },
  },
  { id: 'ball-pit', shape: { type: 'box', w: 5, h: 1.2 }, material: 'ballpit', detail: 'ballpit' },
  { id: 'monkey-bars', shape: { type: 'box', w: 5.6, h: 0.5 }, material: 'steel', detail: 'bars' },
  { id: 'carousel', shape: { type: 'disc', r: 2 }, material: 'steel', detail: 'carousel' },
  { id: 'toy-block', shape: { type: 'box', w: 2.4, h: 2.4 }, material: 'wood', detail: 'block' },
  { id: 'giant-ball', shape: { type: 'disc', r: 1.5 }, material: 'rubber', detail: 'giant-ball' },

  // Stratosphere
  { id: 'fuselage', shape: { type: 'box', w: 8, h: 2.6 }, material: 'vehicle', detail: 'fuselage' },
  { id: 'wing', shape: { type: 'box', w: 7, h: 0.5 }, material: 'steel', detail: 'wing' },
  { id: 'fuselage-skin', shape: { type: 'box', w: 0.35, h: 4 }, material: 'sheet', detail: 'skin' },
  { id: 'solar-panel', shape: { type: 'box', w: 5.4, h: 0.3 }, material: 'steel', detail: 'solar' },
  { id: 'satellite', shape: { type: 'box', w: 2.4, h: 2.4 }, material: 'fabric', detail: 'satellite' },
  { id: 'radio-dish', shape: { type: 'disc', r: 2.2 }, material: 'dish', detail: 'radio' },
  { id: 'antenna-mast', shape: { type: 'box', w: 0.3, h: 6 }, material: 'steel', detail: 'mast' },
  { id: 'truss', shape: { type: 'box', w: 6, h: 0.7 }, material: 'steel', detail: 'truss' },
  { id: 'debris', shape: { type: 'box', w: 2.6, h: 0.9 }, material: 'locker', detail: 'debris' },
  { id: 'cargo-pod', shape: { type: 'box', w: 2.6, h: 2 }, material: 'locker', detail: 'pod' },
  { id: 'strobe-panel', shape: { type: 'box', w: 3, h: 0.55 }, material: 'steel', detail: 'strobe' },
  {
    id: 'frost-truss',
    shape: { type: 'box', w: 4.2, h: 0.5 },
    material: 'steel',
    detail: 'ice',
    reaction: { type: 'crumble', holdMs: 1700, warnMs: 800, restoreMs: 5200 },
  },
  { id: 'thermal-wall', shape: { type: 'box', w: 3, h: 8 }, material: 'fabric', detail: 'thermal' },
];

export const PROPS: Readonly<Record<string, PropKind>> = Object.fromEntries(kinds.map((k) => [k.id, k]));

export const propKind = (id: string): PropKind => {
  const kind = PROPS[id];
  if (!kind) throw new Error(`Unknown prop kind "${id}"`);
  return kind;
};
