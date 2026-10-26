import { describe, expect, it } from 'vitest';
import { COSMETICS, spotlightOf } from '@/config/cosmetics';
import { claimSpotlight, cosmeticStatus, nextDangle } from '@/game/locker';
import { GhostDirector } from '@/game/ghost-director';
import { SessionLog } from '@/game/session-log';
import { encodeGhost, GhostRecorder, timeAtPoint } from '@/sim/ghost';
import { MemoryBackend, SaveStore, freshSave } from '@/platform/storage';
import type { FallHighlight } from '@/game/highlights';
import { LOCALES, setLocale, t, tn } from '@/locale';
import { TABLES } from '@/locale/strings';
import type { LocaleId, StringKey } from '@/locale';

/**
 * The retention surfaces (premium PRD W10): the flip the clear card reads
 * against the player's own ghost, the session's own tally, the dangle that
 * keeps the next unlock one ordinary session away, the locale's own numbers,
 * and the line the game never crosses — no streaks, no countdowns, no guilt.
 */

const store = () => new SaveStore(new MemoryBackend());
const SUMMER = new Date(2026, 6, 15);

const fall = (score: number): FallHighlight => ({
  levelId: 'scrapyard-03',
  levelName: 'Crusher Row',
  biome: 'scrapyard',
  heightMeters: 12,
  bounces: 2,
  junk: 1,
  grade: 'A',
  score,
});

describe('the flip delta (R-RT-07)', () => {
  const track = (() => {
    const recorder = new GhostRecorder();
    // A straight climb, one meter a sample up the y axis: the recorder keeps
    // every third push, so each meter is pushed three times over.
    for (let i = 0; i < 60; i++) for (let k = 0; k < 3; k++) recorder.push({ x: 0, y: i });
    return recorder.finish('scrapyard-03', 3_000, { x: 0, y: 60 });
  })();

  it('reads when the ghost first stood at a point, off its own samples', () => {
    // The default radius reads the first sample inside two meters; a tight
    // radius reads the nearest sample to a point between two samples.
    expect(timeAtPoint(track, { x: 0, y: 10 })).toBe(400);
    expect(timeAtPoint(track, { x: 0, y: 10.4 }, 0.5)).toBe(500);
    expect(timeAtPoint(track, { x: 90, y: 90 })).toBeNull();
  });

  it('says how the run stood against the stored personal ghost at the flip', () => {
    const director = new GhostDirector(async () => null);
    director.begin('scrapyard-03', encodeGhost(track));
    // The ghost reached this flip at 400 ms; a run that flipped at 200 ms was 0.2 s ahead.
    expect(director.deltaAtFlip({ point: { x: 0, y: 10 }, timeMs: 200 })).toBe(200);
    // A run that flipped there at 800 ms was 0.4 s behind its own ghost.
    expect(director.deltaAtFlip({ point: { x: 0, y: 10 }, timeMs: 800 })).toBe(-400);
    expect(director.deltaAtFlip({ point: { x: 90, y: 90 }, timeMs: 100 })).toBeNull();
  });

  it('stays silent when there is no personal ghost to race', () => {
    const director = new GhostDirector(async () => null);
    director.begin('scrapyard-03', undefined);
    expect(director.deltaAtFlip({ point: { x: 0, y: 0 }, timeMs: 0 })).toBeNull();
  });
});

describe('the session log (R-RT-04)', () => {
  it('counts the clears and stars and keeps the best fall by its own score', () => {
    const log = new SessionLog();
    expect(log.summary.clears).toBe(0);
    log.recordClear(3);
    log.recordFall(fall(20));
    log.recordClear(2);
    log.recordFall(fall(40));
    log.recordFall(fall(30));
    const summary = log.summary;
    expect(summary.clears).toBe(2);
    expect(summary.stars).toBe(5);
    expect(summary.bestFall?.score).toBe(40);
  });

  it('keeps the three latest flip deltas, newest last', () => {
    const log = new SessionLog();
    for (const stars of [1, 2, 3, 4]) log.recordDelta({ levelName: `Level ${stars}`, aheadMs: stars * 100 });
    expect(log.summary.deltas.map((d) => d.levelName)).toEqual(['Level 2', 'Level 3', 'Level 4']);
  });

  it('exposes the clear count the dangle rotates by', () => {
    const log = new SessionLog();
    expect(log.clearCount).toBe(0);
    log.recordClear(1);
    log.recordClear(1);
    expect(log.clearCount).toBe(2);
  });
});

describe('the dangle (R-EC-04)', () => {
  it('names the nearest unowned look and rotates inside the nearest few', () => {
    const s = store();
    const seeds = [0, 1, 2, 3].map((seed) => nextDangle(s.data, SUMMER, seed)!.id);
    expect(new Set(seeds).size, 'the rotation must actually rotate').toBeGreaterThan(1);
    // The week’s spotlight leads at zero cost while it is unowned.
    expect(nextDangle(s.data, SUMMER, 0)!.scrapToGo).toBe(0);
    // Once claimed, the nearest Scrap the player still owes is the cheapest look.
    s.update((draft) => void draft.owned.push(spotlightOf(SUMMER).id));
    const nearest = Math.min(
      ...COSMETICS.filter((c): c is (typeof COSMETICS)[number] & { acquire: { how: 'scrap'; price: number } } => c.acquire.how === 'scrap').map(
        (c) => c.acquire.price,
      ),
    );
    expect(nextDangle(s.data, SUMMER, 0)!.scrapToGo).toBe(nearest);
  });

  it('reads a covered look as ready, at zero Scrap to go', () => {
    const s = store();
    s.update((draft) => {
      draft.scrap = 400;
    });
    expect(nextDangle(s.data, SUMMER, 0)!.scrapToGo).toBe(0);
  });

  it('carries the spotlight look at zero cost in its week, out of season or not', () => {
    const s = store();
    const spotlight = spotlightOf(SUMMER);
    const dangle = nextDangle(s.data, SUMMER, 0)!;
    expect(dangle.id).toBe(spotlight.id);
    expect(dangle.scrapToGo).toBe(0);
  });

  it('says nothing once the whole shelf is owned', () => {
    const s = store();
    s.update((draft) => {
      draft.owned.push(
        ...COSMETICS.filter((c) => c.acquire.how === 'scrap' || c.acquire.how === 'seasonal').map((c) => c.id),
      );
    });
    expect(nextDangle(s.data, SUMMER, 0)).toBeNull();
  });
});

describe('the week clock (R-RT-05)', () => {
  it('hands the seasonal four the spotlight one week at a time', () => {
    const mondays = [0, 1, 2, 3, 4].map((week) => new Date(Date.UTC(2026, 0, 5) + week * 7 * 86_400_000));
    const ids = mondays.map((date) => spotlightOf(date).id);
    expect(new Set(ids).size).toBe(4);
    expect(ids[0]).toBe(ids[4]);
  });

  it('holds the same look across a whole week and only changes at the boundary', () => {
    // The week clock is the client’s own, counted from the epoch’s Thursday.
    const thursday = new Date(Date.UTC(2026, 9, 22));
    const wednesday = new Date(thursday.getTime() + 6 * 86_400_000);
    const nextThursday = new Date(thursday.getTime() + 7 * 86_400_000);
    expect(spotlightOf(thursday).id).toBe(spotlightOf(wednesday).id);
    expect(spotlightOf(nextThursday).id).not.toBe(spotlightOf(thursday).id);
  });
});

describe('the spotlight claim (R-RT-05)', () => {
  it('claims the week’s look free, once, and refuses any other id', () => {
    const s = store();
    const week = spotlightOf(SUMMER);
    const other = COSMETICS.find((c) => c.acquire.how === 'seasonal' && c.id !== week.id)!;
    expect(claimSpotlight(s, other.id, SUMMER).ok).toBe(false);
    const result = claimSpotlight(s, week.id, SUMMER);
    expect(result.ok).toBe(true);
    expect(result.ok && result.spent).toBe(0);
    expect(s.data.scrap).toBe(0);
    expect(s.data.owned).toContain(week.id);
    expect(claimSpotlight(s, week.id, SUMMER).ok).toBe(false);
  });

  it('reads as this week’s free claim on the locker’s own status, even out of season', () => {
    const s = store();
    const read = { ...freshSave(), owned: [...s.data.owned] };
    const spotlight = COSMETICS.find((c) => c.id === spotlightOf(SUMMER).id)!;
    expect(cosmeticStatus(read, spotlight, SUMMER).state).toBe('spotlight');
  });
});

describe('locale-neutral numbers (R-EC-12)', () => {
  it('groups 20 000 Scrap the way each locale reads counts, with no currency sign anywhere', () => {
    try {
      for (const locale of LOCALES) {
        setLocale(locale);
        const text = tn(20_000);
        expect(text, locale).toMatch(/[.,\u00a0\u202f' ]/);
        expect(text, locale).not.toMatch(/[$€£¥]/);
      }
      setLocale('en');
      expect(tn(20_000)).toBe('20,000');
      setLocale('de');
      expect(tn(20_000)).toBe('20.000');
    } finally {
      setLocale('en');
    }
  });
});

describe('no guilt, no debt (R-RT-08)', () => {
  const BANNED: Readonly<Record<LocaleId, readonly string[]>> = {
    en: ['streak', 'missed you', 'come back', 'last chance', 'hurry', 'daily reward', 'expires'],
    de: ['streak', 'vermisst', 'komm zurück', 'letzte chance', 'läuft ab', 'täglich'],
    es: ['racha', 'te echamos de menos', 'última oportunidad', 'caduca', 'recompensa diaria'],
    fr: ['série', 'manqué', 'dernière chance', 'expire', 'récompense quotidienne'],
    it: ['striscia', 'ti siamo mancati', 'ultima occasione', 'scade', 'ricompensa quotidiana'],
    pt: ['sequência', 'sentimos sua falta', 'última chance', 'expira', 'recompensa diária'],
    tr: ['seri', 'özledik', 'son şans', 'günlük ödül', 'sona er'],
  };

  it('carries none of the streak-and-countdown vocabulary in any language', () => {
    try {
      for (const locale of LOCALES) {
        setLocale(locale);
        for (const key of Object.keys(TABLES[locale])) {
          const text = t(key as StringKey).toLowerCase();
          for (const word of BANNED[locale]) {
            expect(text.includes(word), `${locale} "${key}" says "${text}"`).toBe(false);
          }
        }
      }
    } finally {
      setLocale('en');
    }
  });
});
