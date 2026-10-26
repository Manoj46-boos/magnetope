import { describe, expect, it } from 'vitest';
import { COSMETICS, DEFAULT_FIELD_ID, DEFAULT_SKIN_ID, seasonOf, spotlightOf, type FieldCosmetic } from '@/config/cosmetics';
import { canWatchToUnlock, claimEarned, claimSpotlight, completesSet, cosmeticStatus, equip, purchase, setProgress, unlockByReward } from '@/game/locker';
import { MemoryBackend, SaveStore, freshSave, sanitizeSave } from '@/platform/storage';
import { cosmeticById } from '@/config/cosmetics';

const store = (mutate?: (s: ReturnType<typeof sanitizeSave>) => void) => {
  const backend = new MemoryBackend();
  const s = new SaveStore(backend);
  if (mutate) s.update(mutate);
  return { s, backend };
};

const SUMMER = new Date(2026, 6, 15);
const WINTER = new Date(2026, 0, 15);

const hue = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

describe('launch catalogue', () => {
  const real = COSMETICS.filter((c) => c.acquire.how !== 'default');

  it('ships 24 cosmetics split 12 Scrap, 8 earned and 4 seasonal', () => {
    expect(real).toHaveLength(24);
    expect(real.filter((c) => c.acquire.how === 'scrap')).toHaveLength(12);
    expect(real.filter((c) => c.acquire.how === 'reward')).toHaveLength(8);
    expect(real.filter((c) => c.acquire.how === 'seasonal')).toHaveLength(4);
  });

  it('prices every purchasable item between 150 and 400 Scrap', () => {
    for (const c of real) {
      if (c.acquire.how === 'scrap' || c.acquire.how === 'seasonal') {
        expect(c.acquire.price).toBeGreaterThanOrEqual(150);
        expect(c.acquire.price).toBeLessThanOrEqual(400);
      }
    }
  });

  it('keeps polarity readable: attract and repel hues are far apart in every field set', () => {
    for (const c of COSMETICS.filter((x): x is FieldCosmetic => x.kind === 'field')) {
      const gap = Math.abs(hue(c.look.attract) - hue(c.look.repel));
      expect(Math.min(gap, 360 - gap), c.id).toBeGreaterThanOrEqual(80);
    }
  });

  it('gives one seasonal item to each season', () => {
    const seasons = real.flatMap((c) => (c.acquire.how === 'seasonal' ? [c.acquire.season] : []));
    expect(new Set(seasons).size).toBe(4);
    expect(seasonOf(WINTER)).toBe('winter');
    expect(seasonOf(SUMMER)).toBe('summer');
  });
});

describe('spending Scrap', () => {
  it('refuses a purchase the player cannot afford and charges nothing', () => {
    const { s } = store((d) => void (d.scrap = 100));
    expect(purchase(s, 'skin.rust', SUMMER)).toEqual({ ok: false, reason: 'funds' });
    expect(s.data.scrap).toBe(100);
    expect(s.data.owned).not.toContain('skin.rust');
  });

  it('deducts the price and adds the item once affordable', () => {
    const { s } = store((d) => void (d.scrap = 400));
    expect(purchase(s, 'skin.rust', SUMMER)).toEqual({ ok: true, id: 'skin.rust', spent: 150 });
    expect(s.data.scrap).toBe(250);
    expect(s.data.owned).toContain('skin.rust');
  });

  it('never charges twice for the same item', () => {
    const { s } = store((d) => void (d.scrap = 1000));
    purchase(s, 'skin.rust', SUMMER);
    expect(purchase(s, 'skin.rust', SUMMER)).toEqual({ ok: false, reason: 'owned' });
    expect(s.data.scrap).toBe(850);
  });

  it('keeps seasonal items off the shelf out of season, sells them in season, and gives the spotlight’s week away free', () => {
    const { s } = store((d) => void (d.scrap = 1000));
    // Out of season the shelf stays shut, whatever the calendar is doing.
    expect(purchase(s, 'skin.frost', SUMMER)).toEqual({ ok: false, reason: 'unavailable' });
    // In season, on a week that is not its spotlight, the shelf sells it.
    const january = new Date(Date.UTC(2026, 0, 8));
    const inSeason = [...Array(6)].map((_, week) => new Date(january.getTime() + week * 7 * 86_400_000)).find((date) => seasonOf(date) === 'winter' && spotlightOf(date).id !== 'skin.frost')!;
    expect(purchase(s, 'skin.frost', inSeason).ok).toBe(true);
    // In its own spotlight week nobody pays for a free thing: the claim is the only door.
    const spotlightWeek = [...Array(8)].map((_, week) => new Date(january.getTime() + week * 7 * 86_400_000)).find((date) => spotlightOf(date).id === 'skin.frost')!;
    const fresh = store((d) => void (d.scrap = 1000)).s;
    expect(purchase(fresh, 'skin.frost', spotlightWeek)).toEqual({ ok: false, reason: 'unavailable' });
    expect(claimSpotlight(fresh, 'skin.frost', spotlightWeek).ok).toBe(true);
    expect(fresh.data.scrap).toBe(1000);
  });

  it('survives a reload: ownership and balance persist', () => {
    const { s, backend } = store((d) => void (d.scrap = 500));
    purchase(s, 'field.rose', SUMMER);
    equip(s, 'field.rose');
    const reopened = new SaveStore(backend);
    expect(reopened.data.owned).toContain('field.rose');
    expect(reopened.data.equipped.field).toBe('field.rose');
    expect(reopened.data.scrap).toBe(350);
  });
});

describe('rewarded unlocks', () => {
  it('unlocks a purchasable item for free and leaves Scrap untouched', () => {
    const { s } = store((d) => void (d.scrap = 10));
    const item = cosmeticById('skin.cobalt')!;
    expect(canWatchToUnlock(s.data, item, SUMMER)).toBe(true);
    expect(unlockByReward(s, 'skin.cobalt', SUMMER).ok).toBe(true);
    expect(s.data.scrap).toBe(10);
    expect(s.data.owned).toContain('skin.cobalt');
  });

  it('does not let a video buy an earn-by-playing item or an off-season one', () => {
    const { s } = store();
    expect(unlockByReward(s, 'skin.flag', SUMMER)).toEqual({ ok: false, reason: 'unavailable' });
    expect(unlockByReward(s, 'skin.frost', SUMMER)).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('earning cosmetics by playing', () => {
  it('hands out the first skin free after the first clear', () => {
    const { s } = store((d) => void (d.stars['scrapyard-00'] = 3));
    expect(claimEarned(s).map((c) => c.id)).toContain('skin.sunny');
    expect(s.data.owned).toContain('skin.sunny');
  });

  it('grants nothing early and nothing twice', () => {
    const { s } = store((d) => void (d.stars['scrapyard-00'] = 1));
    expect(claimEarned(s)).toEqual([]);
    s.update((d) => void (d.stars['scrapyard-00'] = 3));
    claimEarned(s);
    expect(claimEarned(s)).toEqual([]);
  });

  it('unlocks the antenna on clearing level 3 and a grade skin on a big enough fall', () => {
    const { s } = store((d) => {
      d.stars['scrapyard-03'] = 1;
      d.bestGrade['scrapyard-01'] = 'S';
    });
    const ids = claimEarned(s).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['skin.antenna', 'skin.sticker', 'field.sparks']));
  });

  it('reports progress toward a locked reward', () => {
    const { s } = store((d) => void (d.stars['scrapyard-00'] = 2));
    const status = cosmeticStatus(s.data, cosmeticById('skin.flag')!, SUMMER);
    expect(status).toMatchObject({ state: 'earnable', progress: { have: 2, need: 15, met: false } });
  });
});

describe('equipping', () => {
  it('only equips what the player owns', () => {
    const { s } = store();
    expect(equip(s, 'skin.gold')).toBe(false);
    expect(s.data.equipped.skin).toBe(DEFAULT_SKIN_ID);
  });

  it('keeps one skin and one field colour equipped independently', () => {
    const { s } = store((d) => void d.owned.push('skin.rust', 'field.ice'));
    equip(s, 'skin.rust');
    equip(s, 'field.ice');
    expect(s.data.equipped).toEqual({ skin: 'skin.rust', field: 'field.ice' });
    equip(s, DEFAULT_FIELD_ID);
    expect(s.data.equipped.skin).toBe('skin.rust');
  });

  it('drops unknown cosmetic ids from a tampered save', () => {
    const repaired = sanitizeSave({ owned: ['skin.rust', 'skin.fake'], equipped: { skin: 'skin.fake', field: DEFAULT_FIELD_ID } });
    expect(repaired.owned).toContain('skin.rust');
    expect(repaired.owned).not.toContain('skin.fake');
    expect(repaired.equipped.skin).toBe(DEFAULT_SKIN_ID);
  });
});

describe('the collection sets (R-EC-05)', () => {
  it('reads a real save’s set progress piece by piece', () => {
    const { s } = store();
    expect(setProgress(s.data).every((row) => row.have === 0)).toBe(true);
    s.update((d) => void d.owned.push('skin.sunny'));
    const playground = setProgress(s.data).find((row) => row.set.biome === 'playground')!;
    expect(playground.have).toBe(1);
    expect(playground.complete).toBe(false);
    s.update((d) => void d.owned.push(...playground.set.pieces.filter((p) => p.id !== 'skin.sunny').map((p) => p.id)));
    const complete = setProgress(s.data).find((row) => row.set.biome === 'playground')!;
    expect(complete.have).toBe(complete.need);
    expect(complete.complete).toBe(true);
  });

  it('names the completion the moment the last piece lands', () => {
    const { s } = store();
    const pieces = setProgress(s.data).find((row) => row.set.biome === 'metropolis')!.set.pieces;
    const last = pieces[pieces.length - 1]!;
    s.update((d) => void d.owned.push(...pieces.filter((p) => p.id !== last.id).map((p) => p.id)));
    expect(completesSet(s.data, last)).toBe(true);
    expect(completesSet(s.data, pieces[0]!)).toBe(false);
  });
});

describe('the weekly spotlight (R-RT-05)', () => {
  it('marks the week’s look on the locker’s own status, in season or out', () => {
    const { s } = store((d) => void (d.scrap = 10_000));
    const spotlight = spotlightOf(SUMMER);
    expect(cosmeticStatus(s.data, spotlight, SUMMER).state).toBe('spotlight');
  });

  it('claims the week’s look free, once, and refuses any other id', () => {
    const { s } = store((d) => void (d.scrap = 500));
    const week = spotlightOf(SUMMER);
    const other = COSMETICS.find((c) => c.acquire.how === 'seasonal' && c.id !== week.id)!;
    expect(claimSpotlight(s, other.id, SUMMER).ok).toBe(false);
    const result = claimSpotlight(s, week.id, SUMMER);
    expect(result).toMatchObject({ ok: true, id: week.id, spent: 0 });
    expect(s.data.scrap).toBe(500);
    expect(s.data.owned).toContain(week.id);
    expect(claimSpotlight(s, week.id, SUMMER).ok).toBe(false);
  });

  it('keeps the spotlight free of ads: the watch button stays off it', () => {
    const read = { ...freshSave(), scrap: 10_000 };
    expect(canWatchToUnlock(read, spotlightOf(SUMMER), SUMMER)).toBe(false);
  });

  it('sanitises the clear tally on a tampered save', () => {
    const repaired = sanitizeSave({
      clearTally: {
        'scrapyard-00': { day: '2026-10-26', clears: 4 },
        'scrapyard-01': { day: 'way too long to count', clears: -3 },
        'scrapyard-02': 'junk',
      } as unknown as Parameters<typeof sanitizeSave>[0],
    });
    expect(repaired.clearTally['scrapyard-00']).toEqual({ day: '2026-10-26', clears: 4 });
    expect(repaired.clearTally['scrapyard-01']).toEqual({ day: 'way too lo', clears: 0 });
    expect(repaired.clearTally['scrapyard-02']).toBeUndefined();
  });
});
