import type { LevelDef } from '@/sim/types';
import { ON_RAMP, onRampFor } from '@/config/onramp';
import { METROPOLIS_LEVELS } from './metropolis';
import { PLAYGROUND_LEVELS } from './playground';
import { SCRAPYARD_LEVELS } from './scrapyard';
import { STRATOSPHERE_LEVELS } from './stratosphere';
import { SUBURBIA_LEVELS } from './suburbia';

/** Progression order is this list's order; the on-ramp owns its first ten entries. */
export const ALL_LEVELS: readonly LevelDef[] = [
  ...SCRAPYARD_LEVELS,
  ...SUBURBIA_LEVELS,
  ...METROPOLIS_LEVELS,
  ...PLAYGROUND_LEVELS,
  ...STRATOSPHERE_LEVELS,
].map((level, i) => (i < ON_RAMP.taperThrough ? { ...level, onRamp: onRampFor(i + 1) } : level));

export const levelById = (id: string): LevelDef => {
  const level = ALL_LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level "${id}"`);
  return level;
};
