/**
 * The casual on-ramp (PRD 14.3, R-LD-14): the first five levels hold the
 * player's hand — a catch window a sloppy flip still sticks in, a fall assist
 * that takes over harder — and levels six to ten let go in half steps, so by
 * the time the curve reaches its promised difficulty the training wheels are
 * already gone. From level eleven on, TUNING alone decides.
 */

export interface OnRampBoost {
  /** Multiplier on the snap capture radius: the window a charged flip catches in. */
  catchWindow: number;
  /** Multiplier on the fall assist strength: how far aim stops deciding the catch. */
  assist: number;
}

export const ON_RAMP = {
  /** The last level that keeps every boost at full strength. */
  fullThrough: 5,
  /** The last level that keeps half of each boost. */
  taperThrough: 10,
  /** The charge window, widened (R-LD-14: +25%). */
  catchWindow: 1.25,
  /** The fall assist, strengthened (R-LD-14: +50%). */
  assist: 1.5,
} as const;

const FULL: OnRampBoost = { catchWindow: ON_RAMP.catchWindow, assist: ON_RAMP.assist };
const HALF: OnRampBoost = {
  catchWindow: 1 + (ON_RAMP.catchWindow - 1) / 2,
  assist: 1 + (ON_RAMP.assist - 1) / 2,
};
const NONE: OnRampBoost = { catchWindow: 1, assist: 1 };

/** The boosts the level at this progression position plays with (1-based). */
export function onRampFor(levelNumber: number): OnRampBoost {
  if (levelNumber <= ON_RAMP.fullThrough) return FULL;
  if (levelNumber <= ON_RAMP.taperThrough) return HALF;
  return NONE;
}
