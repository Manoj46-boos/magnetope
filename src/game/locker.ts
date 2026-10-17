import {
  COSMETICS,
  cosmeticById,
  gradeRank,
  seasonOf,
  type Cosmetic,
  type Requirement,
  type Season,
} from '@/config/cosmetics';
import type { SaveData, SaveStore } from '@/platform/storage';

type Progress = Pick<SaveData, 'stars' | 'bestGrade'>;

export interface RequirementProgress {
  requirement: Requirement;
  have: number;
  need: number;
  met: boolean;
}

export type ItemStatus =
  | { state: 'equipped' }
  | { state: 'owned' }
  | { state: 'buyable'; price: number; affordable: boolean }
  | { state: 'earnable'; progress: RequirementProgress }
  | { state: 'offseason'; season: Season };

export type PurchaseResult =
  | { ok: true; id: string; spent: number }
  | { ok: false; reason: 'unknown' | 'owned' | 'funds' | 'unavailable' };

const clearedLevels = (save: Pick<SaveData, 'stars'>): number => Object.values(save.stars).filter((n) => n > 0).length;
const perfectLevels = (save: Pick<SaveData, 'stars'>): number => Object.values(save.stars).filter((n) => n >= 3).length;
const totalOf = (save: Pick<SaveData, 'stars'>): number => Object.values(save.stars).reduce((sum, n) => sum + n, 0);
const bestGradeRank = (save: Pick<SaveData, 'bestGrade'>): number => Math.max(-1, ...Object.values(save.bestGrade).map(gradeRank));

export function requirementProgress(save: Progress, requirement: Requirement): RequirementProgress {
  let have: number;
  let need: number;
  switch (requirement.type) {
    case 'stars':
      have = totalOf(save);
      need = requirement.count;
      break;
    case 'clears':
      have = clearedLevels(save);
      need = requirement.count;
      break;
    case 'perfect':
      have = perfectLevels(save);
      need = requirement.count;
      break;
    case 'grade':
      have = bestGradeRank(save) + 1;
      need = gradeRank(requirement.atLeast) + 1;
      break;
    case 'level':
      have = (save.stars[requirement.id] ?? 0) > 0 ? 1 : 0;
      need = 1;
      break;
  }
  return { requirement, have: Math.min(have, need), need, met: have >= need };
}

export function cosmeticStatus(save: SaveData, item: Cosmetic, today: Date): ItemStatus {
  const equipped = item.kind === 'skin' ? save.equipped.skin : save.equipped.field;
  if (equipped === item.id) return { state: 'equipped' };
  if (save.owned.includes(item.id)) return { state: 'owned' };

  const { acquire } = item;
  switch (acquire.how) {
    case 'default':
      return { state: 'owned' };
    case 'scrap':
      return { state: 'buyable', price: acquire.price, affordable: save.scrap >= acquire.price };
    case 'seasonal': {
      const season = seasonOf(today);
      if (season !== acquire.season) return { state: 'offseason', season: acquire.season };
      return { state: 'buyable', price: acquire.price, affordable: save.scrap >= acquire.price };
    }
    case 'reward':
      return { state: 'earnable', progress: requirementProgress(save, acquire.requirement) };
  }
}

/** Ids of reward-path items whose requirement is now met but are not yet in the locker. */
export function newlyEarned(save: SaveData): string[] {
  return COSMETICS.filter(
    (c) => c.acquire.how === 'reward' && !save.owned.includes(c.id) && requirementProgress(save, c.acquire.requirement).met,
  ).map((c) => c.id);
}

/** Moves every earned reward into the locker and returns what was granted. */
export function claimEarned(store: SaveStore): Cosmetic[] {
  const ids = newlyEarned(store.data);
  if (ids.length === 0) return [];
  store.update((s) => {
    s.owned.push(...ids);
  });
  return ids.map((id) => cosmeticById(id)!);
}

const priceOf = (item: Cosmetic): number => (item.acquire.how === 'scrap' || item.acquire.how === 'seasonal' ? item.acquire.price : 0);

export function purchase(store: SaveStore, id: string, today: Date): PurchaseResult {
  const item = cosmeticById(id);
  if (!item) return { ok: false, reason: 'unknown' };
  const status = cosmeticStatus(store.data, item, today);
  if (status.state === 'equipped' || status.state === 'owned') return { ok: false, reason: 'owned' };
  if (status.state !== 'buyable') return { ok: false, reason: 'unavailable' };
  if (!status.affordable) return { ok: false, reason: 'funds' };
  store.update((s) => {
    s.scrap -= status.price;
    s.owned.push(id);
  });
  return { ok: true, id, spent: status.price };
}

/** Rewarded-video unlock. Free of Scrap, available for anything that could be bought right now. */
export function unlockByReward(store: SaveStore, id: string, today: Date): PurchaseResult {
  const item = cosmeticById(id);
  if (!item) return { ok: false, reason: 'unknown' };
  const status = cosmeticStatus(store.data, item, today);
  if (status.state === 'equipped' || status.state === 'owned') return { ok: false, reason: 'owned' };
  if (status.state !== 'buyable') return { ok: false, reason: 'unavailable' };
  store.update((s) => {
    s.owned.push(id);
  });
  return { ok: true, id, spent: 0 };
}

export const canWatchToUnlock = (save: SaveData, item: Cosmetic, today: Date): boolean =>
  priceOf(item) > 0 && cosmeticStatus(save, item, today).state === 'buyable';

export function equip(store: SaveStore, id: string): boolean {
  const item = cosmeticById(id);
  if (!item || !store.data.owned.includes(id)) return false;
  store.update((s) => {
    s.equipped[item.kind] = id;
  });
  return true;
}
