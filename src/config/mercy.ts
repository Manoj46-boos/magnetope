/**
 * The on-ramp's adaptive mercy (rebuild PRD Volume VI, P-LD-05; Hunicke's
 * case for dynamic difficulty, adopted in the narrowest form the PRD allows):
 * inside the on-ramp only — levels 1 to 10, where the game is still teaching —
 * a second consecutive failed attempt widens the catch window by a tenth and
 * strengthens the fall assist by a tenth, and neither ever past its cap. The
 * widening tapers back the moment the level clears, so mercy never becomes the
 * norm: past level ten difficulty is fixed and par-honest, and the game
 * respects the player who chose to climb.
 *
 * Every step is spent from the game layer, applied to the level the sim is
 * built from, and rides the run clock through the telemetry, because a level
 * where mercy fires constantly is a mis-authored level: the Friday report
 * reads the steps and sends that level to the retune queue.
 */

import type { LevelDef } from '@/sim/types';

/** The catch-window widening each step adds, on top of the on-ramp's own value. */
export const MERCY_CATCH_STEP = 0.1;
/** The most the window may ever be widened past the on-ramp's own value. */
export const MERCY_CATCH_CAP = 0.3;
/** The assist strengthening each step multiplies in: one tenth, compounding. */
export const MERCY_ASSIST_STEP = 1.1;
/** The most the assist may ever reach, whatever the on-ramp started from. */
export const MERCY_ASSIST_CAP = 2.6;
/** The last level mercy can ever touch; eleven on means the climb is the player's own. */
export const MERCY_LAST_LEVEL = 10;

export interface MercyState {
  /** Consecutive failed attempts at this level; a clear zeroes it, a leave or a level change does not. */
  consecutiveFails: number;
}

/**
 * The mercy spent on one attempt, derived from the streak: step one on the
 * second consecutive fail, two on the third, three from the fourth on — the
 * caps decide the rest. Zero when the streak is under two, which is a level
 * being learned, not a level fighting the player.
 */
export interface MercyBoost {
  catchWindow: number;
  assist: number;
}

export function mercyBoost(streak: number): MercyBoost {
  if (streak < 2) return { catchWindow: 0, assist: 1 };
  const steps = streak - 1;
  return {
    catchWindow: Math.min(steps * MERCY_CATCH_STEP, MERCY_CATCH_CAP),
    // The assist's cap is spent by withMercy, on the widened value: the cap is
    // an absolute strength (2.6, a little past the held hand's 2.2), not a
    // multiplier, so the boost itself compounds without one of its own.
    assist: MERCY_ASSIST_STEP ** steps,
  };
}

/**
 * The level one attempt plays with: the shipped level, its on-ramp widened by
 * the streak's mercy, only inside the on-ramp and only while an on-ramp boost
 * exists to widen. A level past ten, or a level with no on-ramp, comes back
 * untouched — the law is mercy inside the ramp, fixed difficulty past it.
 */
export function withMercy(level: LevelDef, streak: number): LevelDef {
  if (!level.onRamp) return level;
  if (campaignNumber(level) > MERCY_LAST_LEVEL) return level;
  const boost = mercyBoost(streak);
  if (boost.catchWindow === 0 && boost.assist === 1) return level;
  return {
    ...level,
    onRamp: {
      ...level.onRamp,
      catchWindow: level.onRamp.catchWindow + boost.catchWindow,
      // The cap is an absolute strength: whatever the ramp started from, the
      // widened assist never passes 2.6 — a little past the held hand's own 2.2.
      assist: Math.min(level.onRamp.assist * boost.assist, MERCY_ASSIST_CAP),
    },
  };
}

/**
 * The campaign position as the player counts it: the Scrapyard's tutorial is
 * level one and its climbs count up through fourteen, every other biome opens
 * at fifteen. The on-ramp's own stamping follows this order, so mercy does too.
 */
function campaignNumber(level: LevelDef): number {
  return level.biome === 'scrapyard' ? level.index + 1 : 14 + level.index;
}
