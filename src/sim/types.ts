import type { MaterialId } from '@/config/materials';
import type { OnRampBoost } from '@/config/onramp';

export type BiomeId = 'scrapyard' | 'suburbia' | 'metropolis' | 'playground' | 'stratosphere';

/**
 * Scripted motion for a surface. Both forms are pure functions of simulation
 * time, so a moving prop is identical for the player, the bots and every replay.
 */
export type PropMotion =
  /** Ping-pongs by (dx, dy) from the placement, resting `dwell` of each period at both ends. */
  | { type: 'slide'; dx: number; dy: number; period: number; phase?: number; dwell?: number }
  /** Orbits `pivot` through +-`arc` radians, the placement hanging from it like a pendulum bob. */
  | { type: 'swing'; pivot: { x: number; y: number }; arc: number; period: number; phase?: number }
  /**
   * Revolves the placement about `pivot`, one full turn per `period`. A spoke turns with the wheel;
   * an `upright` prop keeps its orientation the whole way round, like a gondola on a ferris wheel.
   */
  | { type: 'spin'; pivot: { x: number; y: number }; period: number; phase?: number; upright?: boolean; reverse?: boolean };

/** A surface that is solid for `on` of every `period` seconds and flickers `warn` seconds before it goes dark. */
export interface PropCycle {
  period: number;
  /** Solid share of the period, 0..1. */
  on: number;
  phase?: number;
  warn?: number;
}

/**
 * A surface that slides out while MAGNO clings to the prop carrying `tag` (or to the
 * follower itself) and slides back `holdMs` after the last touch. The prop that is
 * clung to is the switch, so a filing cabinet can shed its drawer or a call box
 * summon a lift.
 */
export interface PropFollow {
  tag: string;
  dx: number;
  dy: number;
  extendMs: number;
  retractMs: number;
  holdMs: number;
  /** When set, only the tagged switch moves the follower; standing on it does not keep it out. */
  manual?: boolean;
}

export interface PropPlacement {
  kind: string;
  x: number;
  y: number;
  /** Radians, counter-clockwise. */
  rot?: number;
  /** Size overrides: boxes accept w/h, discs accept r. */
  w?: number;
  h?: number;
  r?: number;
  material?: MaterialId;
  /** Highlights the handhold for the gestural tutorial. */
  glow?: boolean;
  /** Visual-only depth offset so props stack into a diorama without affecting physics. */
  depth?: number;
  motion?: PropMotion;
  cycle?: PropCycle;
  /** World-space pivot a dynamic prop hangs from. Gives a free pendulum that MAGNO can swing. */
  hinge?: { x: number; y: number };
  /** Names this prop, so a switch can be answered by followers and a wheel's parts can find the hub they belong to. */
  tag?: string;
  /** Bolts this dynamic prop to the one carrying this tag, keeping the pose it was placed in. */
  weld?: string;
  /** Hangs this dynamic prop from a point on the one carrying `tag`; `at` is the pivot in the starting pose. */
  pin?: { tag: string; at: { x: number; y: number } };
  follow?: PropFollow;
}

export interface WindSpec {
  /** Peak acceleration in m/s^2; positive pushes right. */
  strength: number;
  gustPeriod: number;
  /** Air below this height is sheltered. */
  fromY?: number;
}

export interface LevelDef {
  id: string;
  biome: BiomeId;
  /** 0 is the session-zero micro-climb; 1..14 are the biome's levels. */
  index: number;
  name: string;
  parSeconds: number;
  spawn: { x: number; y: number };
  summit: { x: number; y: number; radius: number };
  checkpoints: ReadonlyArray<{ x: number; y: number }>;
  killY: number;
  bounds: { minX: number; maxX: number };
  /** Target fall-rate band the bots verify against (PRD 5.4). */
  fallRateTarget: number;
  /** The casual on-ramp boosts this level plays with (config/onramp, PRD R-LD-14); absent once the ramp ends. */
  onRamp?: OnRampBoost;
  props: PropPlacement[];
  gravityScale?: number;
  /** Metropolis and above. */
  wind?: WindSpec;
  /** Magnetic beacons drawn in the field around the first surfaces to use: the tutorial's way of saying "stick here" without outlining a handle. */
  guides?: ReadonlyArray<{ x: number; y: number }>;
  /** The last level of the climb: the summit holds MAGNO's power core rather than the usual beacon. */
  finale?: boolean;
}

export interface InputFrame {
  tiltX: number;
  tiltY: number;
  /** Edge flags: true only on the tick the transition happened. */
  flipDown: boolean;
  flipUp: boolean;
  flipHeld: boolean;
}

export const IDLE_INPUT: Readonly<InputFrame> = Object.freeze({
  tiltX: 0,
  tiltY: 0,
  flipDown: false,
  flipUp: false,
  flipHeld: false,
});
