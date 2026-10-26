import type { StringKey } from '@/locale';
import type { SaveData } from '@/platform/storage';
import type { BiomeId } from '@/sim/types';

export const BIOME_ORDER: readonly BiomeId[] = ['scrapyard', 'suburbia', 'metropolis', 'playground', 'stratosphere'];

export const LEVELS_PER_BIOME = 14;

/** Stars that open each biome (PRD 5.5), out of the 210 on offer. */
export const BIOME_STAR_GATES: readonly number[] = [0, 15, 34, 57, 80];

export const BIOME_NAMES: Readonly<Record<BiomeId, string>> = {
  scrapyard: 'Scrapyard',
  suburbia: 'Suburbia',
  metropolis: 'Metropolis',
  playground: 'Playground of Giants',
  stratosphere: 'Stratosphere',
};

/** One-line promise of each biome that has a title card. The Scrapyard opens the game and needs none. */
export const BIOME_TAGLINES: Readonly<Partial<Record<BiomeId, StringKey>>> = {
  suburbia: 'suburbiaTagline',
  metropolis: 'metropolisTagline',
  playground: 'playgroundTagline',
  stratosphere: 'stratosphereTagline',
};

export interface BiomeAnnouncement {
  name: string;
  tagline: StringKey;
}

/** The title card owed when `biome` begins after `previous`, or null when the player is still in the same biome. */
export function biomeAnnouncement(previous: BiomeId | null, biome: BiomeId): BiomeAnnouncement | null {
  const tagline = BIOME_TAGLINES[biome];
  if (previous === biome || !tagline) return null;
  return { name: BIOME_NAMES[biome], tagline };
}

export const TOTAL_STARS = BIOME_ORDER.length * LEVELS_PER_BIOME * 3;

export const totalStars = (save: Pick<SaveData, 'stars'>): number =>
  Object.values(save.stars).reduce((sum, n) => sum + n, 0);

export const biomeUnlocked = (biome: BiomeId, stars: number): boolean =>
  stars >= (BIOME_STAR_GATES[BIOME_ORDER.indexOf(biome)] ?? Infinity);

export interface ScrapAward {
  amount: number;
  firstClear: boolean;
}

/**
 * Scrap is the single meta currency. A first clear pays 10-50 by performance,
 * a replay 2-8; Scrap only ever buys cosmetics, so it never gates content.
 * Playing without snap assist earns a 5% bonus (PRD 12.4). Replays of the
 * same level decay to half pay once three clears of it are already on today's
 * clock, so the honest path stays the attractive one (R-EC-10).
 */
export function scrapForClear(stars: number, firstClear: boolean, assistOff: boolean, sameDayClears = 0): ScrapAward {
  const s = Math.max(1, Math.min(3, stars));
  let base = firstClear ? 10 + 13 * s : 2 + 2 * s;
  if (!firstClear && sameDayClears >= 3) base *= 0.5;
  const amount = Math.round(base * (assistOff ? 1.05 : 1));
  return { amount, firstClear };
}

export const formatTime = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 10));
  const centis = total % 100;
  const seconds = Math.floor(total / 100) % 60;
  const minutes = Math.floor(total / 6000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return minutes > 0 ? `${minutes}:${pad(seconds)}.${pad(centis)}` : `${seconds}.${pad(centis)}`;
};
