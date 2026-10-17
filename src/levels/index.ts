import type { LevelDef } from '@/sim/types';
import { METROPOLIS_LEVELS } from './metropolis';
import { PLAYGROUND_LEVELS } from './playground';
import { SCRAPYARD_LEVELS } from './scrapyard';
import { STRATOSPHERE_LEVELS } from './stratosphere';
import { SUBURBIA_LEVELS } from './suburbia';

export const ALL_LEVELS: readonly LevelDef[] = [
  ...SCRAPYARD_LEVELS,
  ...SUBURBIA_LEVELS,
  ...METROPOLIS_LEVELS,
  ...PLAYGROUND_LEVELS,
  ...STRATOSPHERE_LEVELS,
];

export const levelById = (id: string): LevelDef => {
  const level = ALL_LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level "${id}"`);
  return level;
};
