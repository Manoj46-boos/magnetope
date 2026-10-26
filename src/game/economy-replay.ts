import { ALL_LEVELS } from '@/levels';
import { COSMETICS, type Cosmetic } from '@/config/cosmetics';
import { requirementProgress } from '@/game/locker';
import type { SaveData } from '@/platform/storage';
import { scrapForClear } from '@/game/progress';
import { Rng } from '@/core/rng';

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

export interface PopulationVerdict {
  players: number;
  /** Median playtime to the first look beyond the defaults, in seconds (R-EC-04). */
  medianFirstItemSeconds: number;
  /** Median playtime to the second look, in seconds. */
  medianSecondItemSeconds: number;
  /** The slowest honest player's play hours to the content itself — every level cleared, ads never required (R-EC-11, the R-CL-10 tie). */
  hoursForContent: number;
  /** The slowest honest player's play hours to the whole Scrap shelf on top of that — the collector's run, never a gate. */
  hoursForTheShelf: number;
  /** Share of players whose unspent Scrap passed 1.5 times the priciest look while some look stayed unowned. */
  overAccumulationShare: number;
  /** Players who could not reach the whole shelf by honest play — always zero, or the law is broken. */
  deadEnds: number;
}

const medianOf = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/**
 * The reward looks a star policy earns and the first-pass level they trip at.
 * Grades are never assumed, so the two grade-gated looks stay outside the
 * count, exactly as they sit outside the bot's.
 */
function rewardTrips(stars: number): Map<number, number> {
  const trips = new Map<number, number>();
  for (const item of COSMETICS) {
    if (item.acquire.how !== 'reward') continue;
    const requirement = item.acquire.requirement;
    let at = ALL_LEVELS.length;
    switch (requirement.type) {
      case 'stars':
        at = Math.ceil(requirement.count / stars) - 1;
        break;
      case 'clears':
        at = requirement.count - 1;
        break;
      case 'perfect':
        at = stars >= 3 ? requirement.count - 1 : ALL_LEVELS.length;
        break;
      case 'level':
        at = ALL_LEVELS.findIndex((l) => l.id === requirement.id);
        break;
      case 'grade':
        at = ALL_LEVELS.length;
        break;
    }
    if (at >= 0 && at < ALL_LEVELS.length) trips.set(at, (trips.get(at) ?? 0) + 1);
  }
  return trips;
}

/**
 * R-EC-11: the thousand-player sim. Each player walks the campaign in level
 * order under their own star policy and pace, picks up every reward look the
 * policy earns, buys the shelf in price order with what the run has earned,
 * and the population is held to the economy's own laws: no dead ends, no
 * hoarding, the first look free inside three minutes, the second inside a
 * quarter hour, and the whole shelf reachable by honest play with zero ads.
 * Replay rounds spread the campaign thin rather than farming one level, which
 * is the honest path the same-day decay protects (R-EC-10).
 */
export function simulatePopulation(count: number, seed: number): PopulationVerdict {
  const rng = new Rng(seed);
  const shelf = COSMETICS.filter((c) => c.acquire.how === 'scrap').map(priceOf).sort((a, b) => a - b);
  const priciest = shelf[shelf.length - 1] ?? 0;
  const firstTimes: number[] = [];
  const secondTimes: number[] = [];
  const contentHours: number[] = [];
  const shelfHours: number[] = [];
  let overAccumulated = 0;
  let deadEnds = 0;

  for (let p = 0; p < count; p++) {
    const roll = rng.next();
    const stars = roll < 0.2 ? 3 : roll < 0.7 ? 2 : 1;
    // The playtime curve: a three-star run rides par's own cushion, a one-star run takes half again as long.
    const pace = 1.6 - 0.3 * stars + rng.range(0, 0.25);
    const trips = rewardTrips(stars);
    const firstPay = scrapForClear(stars, true, false).amount;
    const replayPay = scrapForClear(stars, false, false).amount;

    let owned = 2;
    let scrap = 0;
    let seconds = 0;
    const queue = [...shelf];
    let first: number | null = null;
    let second: number | null = null;
    let over = false;

    const note = () => {
      if (owned > 2 && first === null) first = seconds;
      if (owned > 3 && second === null) second = seconds;
    };
    const buy = () => {
      while (queue.length > 0 && scrap >= queue[0]!) {
        scrap -= queue.shift()!;
        owned++;
        note();
      }
      if (scrap > priciest * 1.5 && queue.length > 0) over = true;
    };

    for (const [index, level] of ALL_LEVELS.entries()) {
      seconds += level.parSeconds * pace;
      scrap += firstPay;
      const tripped = trips.get(index);
      if (tripped !== undefined) {
        owned += tripped;
        note();
      }
      buy();
    }
    // The campaign itself is done here: no Scrap gate ever held a level back.
    contentHours.push(seconds / 3600);

    let rounds = 0;
    while (queue.length > 0 && rounds < 100) {
      seconds += ALL_LEVELS.reduce((sum, l) => sum + l.parSeconds * pace, 0);
      scrap += ALL_LEVELS.length * replayPay;
      buy();
      rounds++;
    }

    if (queue.length > 0) deadEnds++;
    if (over) overAccumulated++;
    firstTimes.push(first ?? seconds);
    secondTimes.push(second ?? seconds);
    shelfHours.push(seconds / 3600);
  }

  const round1 = (values: number[]): number => Math.round(Math.max(...values) * 10) / 10;
  return {
    players: count,
    medianFirstItemSeconds: Math.round(medianOf(firstTimes)),
    medianSecondItemSeconds: Math.round(medianOf(secondTimes)),
    hoursForContent: round1(contentHours),
    hoursForTheShelf: round1(shelfHours),
    overAccumulationShare: overAccumulated / count,
    deadEnds,
  };
}
