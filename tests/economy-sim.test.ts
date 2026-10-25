import { describe, expect, it } from 'vitest';
import { ALL_LEVELS } from '@/levels';
import { COSMETICS, GRADE_ORDER, seasonOf, type Cosmetic, type GradeName } from '@/config/cosmetics';
import { BIOME_ORDER, BIOME_STAR_GATES, scrapForClear } from '@/game/progress';
import { cosmeticStatus, requirementProgress } from '@/game/locker';
import { replayEconomy } from '@/game/economy-replay';
import { buildMap } from '@/game/map-model';
import { freshSave } from '@/platform/storage';

/**
 * The economy sim (R-EC-07): the progression bot replays the schedule the doc
 * publishes. The laws under test: the Scrap arithmetic is the formula's own,
 * the whole shelf is reachable by playing (never by waiting, never by paying),
 * the seasonal four open in their season and only then, the reward paths trip
 * on saves a real run can produce, and the campaign itself never asks for Scrap.
 */

const save = (stars: number) => ({ stars: Object.fromEntries(ALL_LEVELS.map((l) => [l.id, stars])), bestMs: {}, bestGrade: {} as Record<string, never> });
const midJuly = new Date(2026, 6, 14);
const byHow = <H extends Cosmetic['acquire']['how']>(how: H): Array<Cosmetic & { acquire: { how: H } }> =>
  COSMETICS.filter((c): c is Cosmetic & { acquire: { how: H } } => c.acquire.how === how);

describe('the schedule\u2019s arithmetic', () => {
  for (const stars of [1, 2, 3]) {
    it(`pays what the formula says on a ${stars}-star campaign, first pass and replay`, () => {
      const verdict = replayEconomy({ stars, assistOff: false });
      const firstPass = ALL_LEVELS.reduce((sum) => sum + scrapForClear(stars, true, false).amount, 0);
      expect(verdict.firstPass).toBe(firstPass);
      expect(verdict.replay).toBe(scrapForClear(stars, false, false).amount);
      expect(verdict.lockerPrice).toBe(byHow('scrap').reduce((sum, c) => sum + c.acquire.price, 0));
    });
  }

  it('pays the assist-off bonus as a whole-Scrap round-up, never a fraction', () => {
    for (const stars of [1, 2, 3]) {
      const on = scrapForClear(stars, true, false).amount;
      const off = scrapForClear(stars, true, true).amount;
      expect(off).toBe(Math.round(on * 1.05));
      expect(off % 1).toBe(0);
    }
  });
});

describe('the shelf', () => {
  it('finishes for a player who clears everything at three stars', () => {
    const verdict = replayEconomy({ stars: 3, assistOff: false });
    expect(verdict.firstPass).toBeGreaterThanOrEqual(verdict.lockerPrice);
    expect(verdict.replayRoundsToFinish).toBe(0);
  });

  it('needs a bounded number of replay rounds for slower campaigns', () => {
    const twoStar = replayEconomy({ stars: 2, assistOff: false });
    const oneStar = replayEconomy({ stars: 1, assistOff: false });
    expect(typeof twoStar.replayRoundsToFinish).toBe('number');
    expect(twoStar.replayRoundsToFinish).toBeGreaterThan(0);
    expect(twoStar.replayRoundsToFinish).toBeLessThanOrEqual(3);
    expect(oneStar.replayRoundsToFinish, 'one star needs more rounds than two').toBeGreaterThan(twoStar.replayRoundsToFinish as number);
  });

  it('never prices a look above what one full campaign pays at any star count', () => {
    const cheapestPass = replayEconomy({ stars: 1, assistOff: false }).firstPass;
    for (const item of byHow('scrap')) {
      expect(item.acquire.price).toBeLessThanOrEqual(cheapestPass);
    }
  });
});

describe('the reward paths', () => {
  it('trips on saves a real three-star run produces', () => {
    const played = save(3);
    for (const item of byHow('reward')) {
      const progress = requirementProgress(played, item.acquire.requirement);
      if (item.acquire.requirement.type === 'grade') {
        // The bot assumes no grade; the path must still name a grade that exists.
        expect(GRADE_ORDER).toContain(item.acquire.requirement.atLeast as GradeName);
      } else {
        expect(progress.met, `${item.id} should be earned by a full three-star run`).toBe(true);
      }
    }
  });

  it('names the level gates as levels that exist', () => {
    for (const item of byHow('reward')) {
      const requirement = item.acquire.requirement;
      if (requirement.type === 'level') expect(ALL_LEVELS.some((l) => l.id === requirement.id)).toBe(true);
    }
  });
});

describe('the seasonal slots', () => {
  it('opens in its season and only in its season', () => {
    const owned = { ...freshSave(), scrap: 10_000 };
    owned.stars = save(3).stars;
    for (const item of byHow('seasonal')) {
      const inSeason = cosmeticStatus(owned, item, midJuly).state;
      if (item.acquire.season === seasonOf(midJuly)) expect(inSeason).toBe('buyable');
      else expect(inSeason).toBe('offseason');
    }
  });
});

describe('the one-currency law', () => {
  it('opens the campaign on stars alone, at every gate', () => {
    for (const [i, biome] of BIOME_ORDER.entries()) {
      const gate = BIOME_STAR_GATES[i]!;
      const at = buildMap(ALL_LEVELS, { ...save(1), stars: { x: gate } });
      expect(at[i]!.unlocked, `${biome} opens at ${gate}`).toBe(true);
      if (i > 0) {
        const justUnder = buildMap(ALL_LEVELS, { ...save(1), stars: { x: gate - 1 } });
        expect(justUnder[i]!.unlocked, `${biome} stays shut below ${gate}`).toBe(false);
      }
    }
    expect(buildMap(ALL_LEVELS, freshSave())[0]!.unlocked, 'the Scrapyard is free').toBe(true);
  });
});
