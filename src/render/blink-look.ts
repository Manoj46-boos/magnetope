import type { CycleState } from '@/sim/motion';

/** Below the three-flashes-a-second photosensitivity line. */
export const WARN_FLICKER_HZ = 2.5;

const REDUCED_WARN_LEVEL = 0.55;
const DARK_BODY = 0.14;
const DARK_RIM = 0.3;
const RIM_LEVEL = 0.85;

export interface BlinkLook {
  body: number;
  glow: number;
  rim: number;
}

/**
 * How a flickering sign should be drawn: solid, flickering in warning, or a faint
 * ghost while dark. Reduced motion swaps the flicker for a steady dim, so the
 * warning is still readable without anything flashing.
 */
export function blinkLook(state: CycleState, clockMs: number, reducedMotion: boolean): BlinkLook {
  if (state === 'on') return { body: 1, glow: 1, rim: RIM_LEVEL };
  if (state === 'warn') {
    const flicker = reducedMotion ? REDUCED_WARN_LEVEL : Math.floor((clockMs / 1000) * WARN_FLICKER_HZ * 2) % 2 === 0 ? 1 : 0.25;
    return { body: 0.55 + 0.45 * flicker, glow: flicker, rim: RIM_LEVEL * flicker };
  }
  return { body: DARK_BODY, glow: 0.12 + 0.05 * Math.sin(clockMs / 260), rim: DARK_RIM };
}
