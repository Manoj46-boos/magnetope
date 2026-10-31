/**
 * The casual on-ramp (PRD 14.3, R-LD-14; rebuild PRD Volume II, P-FT-03): the
 * first three levels hold the player's hand widest — a catch window a sloppy
 * flip still sticks in, a fall assist that takes over harder, and a launch
 * magnetism that bends the first two throws toward whatever steel they already
 * point at. Level four steps halfway down, five settles at the strength the
 * first ten levels have always kept, six to ten let go in half steps, and from
 * level eleven on, TUNING alone decides.
 */

export interface OnRampBoost {
  /** Multiplier on the snap capture radius: the window a charged flip catches in. */
  catchWindow: number;
  /** Multiplier on the fall assist strength: how far aim stops deciding the catch. */
  assist: number;
  /** The launch magnetism of the first two hops (P-FT-05): the level carries it or it is off. */
  launchAim: boolean;
}

export const ON_RAMP = {
  /** The last level that keeps every boost at its full new strength. */
  fullThrough: 3,
  /** The last level that keeps half of the settled strength. */
  taperThrough: 10,
  /** The charge window on the held-hand levels (P-FT-03: a sloppy flip must still stick). */
  catchWindow: 1.6,
  /** The fall assist on the held-hand levels (P-FT-03: aim stops deciding the catch). */
  assist: 2.2,
  /** Where each boost has settled by level five: the strength the first ten levels always kept. */
  settledCatchWindow: 1.25,
  settledAssist: 1.5,
} as const;

const FULL: OnRampBoost = { catchWindow: ON_RAMP.catchWindow, assist: ON_RAMP.assist, launchAim: true };
const SETTLED: OnRampBoost = { catchWindow: ON_RAMP.settledCatchWindow, assist: ON_RAMP.settledAssist, launchAim: false };
const HALF: OnRampBoost = {
  catchWindow: 1 + (ON_RAMP.settledCatchWindow - 1) / 2,
  assist: 1 + (ON_RAMP.settledAssist - 1) / 2,
  launchAim: false,
};
const NONE: OnRampBoost = { catchWindow: 1, assist: 1, launchAim: false };

/** The boosts the level at this progression position plays with (1-based). */
export function onRampFor(levelNumber: number): OnRampBoost {
  if (levelNumber <= ON_RAMP.fullThrough) return FULL;
  if (levelNumber === ON_RAMP.fullThrough + 1) {
    return {
      catchWindow: (ON_RAMP.catchWindow + ON_RAMP.settledCatchWindow) / 2,
      assist: (ON_RAMP.assist + ON_RAMP.settledAssist) / 2,
      launchAim: false,
    };
  }
  if (levelNumber <= 5) return SETTLED;
  if (levelNumber <= ON_RAMP.taperThrough) return HALF;
  return NONE;
}
