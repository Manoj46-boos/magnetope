/**
 * The full-charge vibration cue (rebuild PRD Volume III, P-GF-02): the moment
 * the meter tops out, a ten-millisecond tap on the hand through
 * `navigator.vibrate` — Android Chrome honours it, everywhere else it is a
 * silent no-op. A third sense on touch only, never a replacement for the sight
 * and sound the rest of the table carries.
 */

/** The cue's own duration: long enough to feel, short enough never to buzz. */
export const CHARGE_VIBRATE_MS = 10;

/** The host's vibrate entry point as the game calls it: a pattern in, a boolean back. */
export type VibrateFn = (pattern: number | number[]) => boolean;

/** True when the host can vibrate at all, so the suite can pin the no-op path. */
export const vibrateSupported = (vibrate: VibrateFn | null | undefined): boolean => typeof vibrate === 'function';

/**
 * Fires the cue. Returns whether a vibration was actually issued, so the caller
 * never spends a second call on a host that just ignored the first.
 */
export function vibrateCharge(vibrate: VibrateFn | null | undefined): boolean {
  if (!vibrateSupported(vibrate)) return false;
  try {
    return vibrate!(CHARGE_VIBRATE_MS);
  } catch {
    // A host that throws on vibrate is treated the same as one without it.
    return false;
  }
}
