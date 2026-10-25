import { ALL_LEVELS } from '@/levels';
import { COSMETICS, type Cosmetic } from '@/config/cosmetics';
import { requirementProgress } from '@/game/locker';
import type { SaveData } from '@/platform/storage';
import { scrapForClear } from '@/game/progress';

type Progress = Pick<SaveData, 'stars' | 'bestGrade'>;

/**
 * The progression bot (R-EC-07's replay leg): walks the whole campaign the way
 * the schedule pays it — every level cleared once under a star policy, then
 * replayed — buys the locker in price order with what the run has earned, and
 * reports when every purchasable look is on the shelf. The same replay that
 * stamps the numbers into `docs/ECONOMY.md`, so the doc and the economy cannot
 * tell different stories. Fall grades are the variable leg and stay on the
 * card, not in the bot: no grade is assumed.
 */

export interface ReplayVerdict {
  /** Scrap from clearing every level once under the star policy. */
  firstPass: number;
  /** Scrap one replay of any level pays under the same policy. */
  replay: number;
  /** The whole scrap shelf, seasonal slots excluded. */
  lockerPrice: number;
  /** The seasonal four at their own prices. */
  seasonalPrice: number;
  /** Reward looks the run's own save has earned by the end of the first pass. */
  earnedRewards: number;
  /** Replay rounds (one a level) needed to finish the scrap shelf after the first pass. */
  replayRoundsToFinish: number | 'never';
}

export interface StarPolicy {
  /** Stars taken on each first clear, 1 to 3. */
  stars: number;
  /** Playing without the snap assist earns the 5% bonus. */
  assistOff: boolean;
}

const priceOf = (item: Cosmetic): number =>
  item.acquire.how === 'scrap' || item.acquire.how === 'seasonal' ? item.acquire.price : 0;

/** Replays the campaign and returns the schedule's own arithmetic. */
export function replayEconomy(policy: StarPolicy): ReplayVerdict {
  const stars = Math.max(1, Math.min(3, Math.round(policy.stars)));
  const save: Progress = { stars: {}, bestGrade: {} };

  let firstPass = 0;
  for (const level of ALL_LEVELS) {
    save.stars[level.id] = stars;
    firstPass += scrapForClear(stars, true, policy.assistOff).amount;
  }
  const replay = scrapForClear(stars, false, policy.assistOff).amount;

  let earnedRewards = 0;
  const shelf = COSMETICS.filter((c) => c.acquire.how === 'scrap').map(priceOf).sort((a, b) => a - b);
  const seasonal = COSMETICS.filter((c) => c.acquire.how === 'seasonal').map(priceOf);
  const lockerPrice = shelf.reduce((sum, p) => sum + p, 0);
  const seasonalPrice = seasonal.reduce((sum, p) => sum + p, 0);

  for (const item of COSMETICS) {
    if (item.acquire.how === 'reward' && requirementProgress(save, item.acquire.requirement).met) earnedRewards++;
  }

  // The bot never assumes a grade, so grade-gated rewards sit outside the count.
  // The shelf walk is exact: buy the cheapest look the bank covers, else bank one replay round.
  let bank = firstPass;
  let rounds = 0;
  const queue = [...shelf];
  while (queue.length > 0) {
    if (bank >= queue[0]!) bank -= queue.shift()!;
    else {
      bank += ALL_LEVELS.length * replay;
      if (++rounds > 10_000) return { firstPass, replay, lockerPrice, seasonalPrice, earnedRewards, replayRoundsToFinish: 'never' };
    }
  }

  return { firstPass, replay, lockerPrice, seasonalPrice, earnedRewards, replayRoundsToFinish: rounds };
}
