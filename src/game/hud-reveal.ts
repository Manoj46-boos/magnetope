import type { SaveData } from '@/platform/storage';
import type { LevelDef } from '@/sim/types';

/** One-time flags kept in the save so a returning player is never re-taught. */
export const FLAG = {
  coach: 'coach',
  charge: 'hud.charge',
  firstCatch: 'opener.first-catch',
  practiceFall: 'fall.practice',
} as const;

const RAIL_GAIN_METERS = 1.5;
const CHARGE_HOLD_MS = 250;

/**
 * Staged HUD (PRD 12.1): nothing is on screen until it matters. The altitude
 * rail waits for the first vertical gain, the charge meter for the first held
 * charge (or the first level that teaches it), and the star tracker for the
 * first clear.
 */
export class HudReveal {
  constructor(
    private readonly seen: Set<string>,
    private readonly persist: (flag: string) => void,
  ) {}

  railVisible(climbedMeters: number): boolean {
    return climbedMeters > RAIL_GAIN_METERS;
  }

  /** `heldMs` is how long the flip has been charging right now. */
  chargeMeterVisible(level: Pick<LevelDef, 'biome' | 'index'>, heldMs: number): boolean {
    if (this.seen.has(FLAG.charge)) return true;
    const taught = level.biome !== 'scrapyard' || level.index >= 3;
    if (!taught && heldMs < CHARGE_HOLD_MS) return false;
    this.seen.add(FLAG.charge);
    this.persist(FLAG.charge);
    return true;
  }

  starTrackerVisible(save: Pick<SaveData, 'stars'>): boolean {
    return Object.values(save.stars).some((n) => n > 0);
  }
}
