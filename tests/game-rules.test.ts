import { describe, expect, it } from 'vitest';
import { TUNING } from '@/config/tuning';
import { humParams, stemMix, stepSeconds, whistleFrequency, windVoice } from '@/audio/mix';
import { nextPlayableId, resumeLevelId } from '@/game/map-model';
import { SlowMoDirector } from '@/game/slowmo';
import { ALL_LEVELS } from '@/levels';
import { BIOME_STAR_GATES, biomeUnlocked, formatTime, scrapForClear, totalStars } from '@/game/progress';
import { PROFILES, detectTier, stepDown } from '@/render/quality';
import { CANONICAL_SIZES, ResolutionGovernor, cameraDistance, layoutStage } from '@/render/stage';

const save = (stars: Record<string, number> = {}) => ({ stars, bestMs: {}, bestGrade: {} as Record<string, never> });

const run = (director: SlowMoDirector, ms: number) => {
  for (let t = 0; t < ms; t += 10) director.update(10);
};

describe('slow-motion director', () => {
  it('ramps to 0.35 inside 150 ms and holds there', () => {
    const d = new SlowMoDirector();
    expect(d.request(20)).toBe(true);
    run(d, 160);
    expect(d.scale).toBeCloseTo(TUNING.fall.slowMoScale, 2);
    run(d, 1000);
    expect(d.scale).toBeCloseTo(TUNING.fall.slowMoScale, 2);
    expect(d.strength).toBeCloseTo(1, 2);
  });

  it('recovers to normal speed over 450 ms after release', () => {
    const d = new SlowMoDirector();
    d.request(20);
    run(d, 400);
    d.release();
    run(d, 200);
    expect(d.scale).toBeGreaterThan(TUNING.fall.slowMoScale);
    expect(d.scale).toBeLessThan(1);
    run(d, 300);
    expect(d.scale).toBe(1);
    expect(d.active).toBe(false);
  });

  it('allows four per three minutes and refuses a fifth that is not bigger', () => {
    const d = new SlowMoDirector();
    for (const h of [14, 16, 18, 20]) {
      expect(d.request(h)).toBe(true);
      run(d, 300);
      d.release();
      run(d, 600);
    }
    expect(d.request(13)).toBe(false);
  });

  it('lets a taller fall take the slot of the smallest once the budget is spent', () => {
    const d = new SlowMoDirector();
    for (const h of [14, 16, 18, 20]) {
      d.request(h);
      run(d, 300);
      d.release();
      run(d, 600);
    }
    expect(d.request(35)).toBe(true);
  });

  it('refills the budget once the three minute window has passed', () => {
    const d = new SlowMoDirector();
    for (const h of [14, 16, 18, 20]) {
      d.request(h);
      run(d, 300);
      d.release();
      run(d, 600);
    }
    run(d, 181_000);
    expect(d.request(13)).toBe(true);
  });

  it('is fully disabled by reduced motion and never distorts time', () => {
    const d = new SlowMoDirector();
    d.disabled = true;
    expect(d.request(40)).toBe(false);
    run(d, 500);
    expect(d.scale).toBe(1);
  });

  it('eases out immediately if reduced motion is switched on mid-slow-motion', () => {
    const d = new SlowMoDirector();
    d.request(30);
    run(d, 300);
    d.disabled = true;
    run(d, 600);
    expect(d.scale).toBe(1);
  });

  it('gives up by itself if a landing never resolves', () => {
    const d = new SlowMoDirector();
    d.request(30);
    run(d, 9000);
    expect(d.scale).toBe(1);
  });
});

describe('progression', () => {
  it('opens each biome at the design star gates: 15, 34, 57 and 80 of the 210 stars', () => {
    expect([...BIOME_STAR_GATES]).toEqual([0, 15, 34, 57, 80]);
    expect(biomeUnlocked('scrapyard', 0)).toBe(true);
    expect(biomeUnlocked('suburbia', 14)).toBe(false);
    expect(biomeUnlocked('suburbia', 15)).toBe(true);
    expect(biomeUnlocked('stratosphere', 79)).toBe(false);
    expect(biomeUnlocked('stratosphere', 80)).toBe(true);
  });

  it('pays first clears between 10 and 50 Scrap and replays between 2 and 8', () => {
    for (const stars of [1, 2, 3]) {
      const first = scrapForClear(stars, true, false).amount;
      const replay = scrapForClear(stars, false, false).amount;
      expect(first).toBeGreaterThanOrEqual(10);
      expect(first).toBeLessThanOrEqual(50);
      expect(replay).toBeGreaterThanOrEqual(2);
      expect(replay).toBeLessThanOrEqual(8);
    }
    expect(scrapForClear(3, true, false).amount).toBeGreaterThan(scrapForClear(1, true, false).amount);
  });

  it('adds the 5% bonus only when snap assist is off', () => {
    const on = scrapForClear(3, true, false).amount;
    const off = scrapForClear(3, true, true).amount;
    expect(off).toBeGreaterThan(on);
    expect(off / on).toBeCloseTo(1.05, 1);
  });

  it('totals stars across levels', () => {
    expect(totalStars({ stars: { a: 3, b: 2, c: 0 } })).toBe(5);
  });

  it('drops new players into the tutorial and returns players to their frontier', () => {
    expect(resumeLevelId(ALL_LEVELS, save())).toBe('scrapyard-00');
    expect(resumeLevelId(ALL_LEVELS, save({ 'scrapyard-00': 3, 'scrapyard-01': 1 }))).toBe('scrapyard-02');
  });

  it('never resumes on a level behind a locked star gate', () => {
    const scrapyard = Object.fromEntries(ALL_LEVELS.filter((l) => l.biome === 'scrapyard').map((l) => [l.id, 1]));
    expect(totalStars({ stars: scrapyard })).toBeLessThan(15);
    expect(resumeLevelId(ALL_LEVELS, save(scrapyard))).toBe('scrapyard-13');
    expect(resumeLevelId(ALL_LEVELS, save({ ...scrapyard, extra: 1 }))).toBe('suburbia-01');
  });

  it('offers a next level only when it is unlocked', () => {
    const scrapyard = Object.fromEntries(ALL_LEVELS.filter((l) => l.biome === 'scrapyard').map((l) => [l.id, 1]));
    expect(nextPlayableId(ALL_LEVELS, save({ 'scrapyard-00': 1 }), 'scrapyard-00')).toBe('scrapyard-01');
    expect(nextPlayableId(ALL_LEVELS, save({ 'scrapyard-00': 1 }), 'scrapyard-01')).toBeNull();
    expect(nextPlayableId(ALL_LEVELS, save(scrapyard), 'scrapyard-13')).toBeNull();
    expect(nextPlayableId(ALL_LEVELS, save({ ...scrapyard, extra: 1 }), 'scrapyard-13')).toBe('suburbia-01');
  });

  it('stops at the last level and ignores a level it does not know', () => {
    const everything = Object.fromEntries(ALL_LEVELS.map((l) => [l.id, 3]));
    expect(nextPlayableId(ALL_LEVELS, save(everything), 'stratosphere-14')).toBeNull();
    expect(nextPlayableId(ALL_LEVELS, save(everything), 'nowhere')).toBeNull();
    expect(resumeLevelId(ALL_LEVELS, save(everything))).toBe('stratosphere-14');
  });

  it('formats times for the clear card', () => {
    expect(formatTime(0)).toBe('0.00');
    expect(formatTime(12_340)).toBe('12.34');
    expect(formatTime(75_050)).toBe('1:15.05');
  });
});

describe('the score\u2019s stems and tiers (R-AU-02)', () => {
  const base = { running: true, heightFrac: 0.1, chaining: false, timeScale: 1, intensity: 0 };

  it('rests with the motif line and the air alone, and breathes further back on the cards', () => {
    expect(stemMix(base).tier).toBe('rest');
    expect(stemMix(base).bass).toBe(0);
    expect(stemMix(base).perc).toBe(0);
    expect(stemMix(base).mel).toBeGreaterThan(0);
    expect(stemMix({ ...base, running: false }).mel).toBeLessThan(stemMix(base).mel);
  });

  it('walks the bass and taps the junk through play, opening everything for flight', () => {
    const play = stemMix({ ...base, intensity: 0.3 });
    expect(play.tier).toBe('play');
    expect(play.bass).toBeGreaterThan(0);
    expect(play.perc).toBeGreaterThan(0);
    const flight = stemMix({ ...base, chaining: true, intensity: 0.9 });
    expect(flight.tier).toBe('flight');
    expect(flight.perc).toBe(1);
    expect(flight.perc).toBeGreaterThan(play.perc);
  });

  it('keeps the melody a floor at altitude, whatever the tier', () => {
    const low = stemMix({ ...base, intensity: 0, heightFrac: 0.44 });
    expect(low.mel).toBeLessThanOrEqual(0.35);
    const vista = stemMix({ ...base, intensity: 0, heightFrac: 0.7 });
    expect(vista.tier).toBe('rest');
    expect(vista.mel).toBeGreaterThanOrEqual(0.8);
  });

  it('darkens and stretches with the time scale in slow motion', () => {
    const slow = stemMix({ ...base, timeScale: 0.35 });
    const normal = stemMix(base);
    expect(slow.cutoffHz).toBeLessThan(normal.cutoffHz / 5);
    expect(slow.tempo).toBeCloseTo(0.35, 2);
    expect(stepSeconds(92, slow.tempo)).toBeGreaterThan(stepSeconds(92, 1) * 2.5);
  });
});

describe('magnet hum and fall whistle', () => {
  it('swells with proximity to ferromagnetic mass in attract mode', () => {
    const far = humParams({ polarity: 'attract', charge01: 0, proximity: 0.05, attached: false });
    const near = humParams({ polarity: 'attract', charge01: 0, proximity: 0.95, attached: false });
    expect(near.attractGain).toBeGreaterThan(far.attractGain * 2);
    expect(near.repelGain).toBe(0);
  });

  it('crossfades to a brighter shimmer as charge builds', () => {
    const low = humParams({ polarity: 'repel', charge01: 0.1, proximity: 0, attached: true });
    const high = humParams({ polarity: 'repel', charge01: 0.9, proximity: 0, attached: true });
    expect(high.repelCutoffHz).toBeGreaterThan(low.repelCutoffHz * 3);
    expect(high.repelGain).toBeGreaterThan(low.repelGain);
    expect(high.attractGain).toBe(0);
  });

  it('adds the 16 Hz tremolo only at full charge', () => {
    expect(humParams({ polarity: 'repel', charge01: 0.9, proximity: 0, attached: true }).tremoloDepth).toBe(0);
    expect(humParams({ polarity: 'repel', charge01: 1, proximity: 0, attached: true }).tremoloDepth).toBeGreaterThan(0);
  });

  it('glides the whistle from 1200 Hz down toward 300 Hz and drops with the time scale', () => {
    expect(whistleFrequency(4, 1)).toBeCloseTo(1200, 0);
    expect(whistleFrequency(40, 1)).toBeCloseTo(300, 0);
    expect(whistleFrequency(20, 0.35)).toBeLessThan(whistleFrequency(20, 1));
  });

  it('thins the stratosphere wind to silence at the summit', () => {
    expect(windVoice('stratosphere', 1, 0).gain).toBe(0);
    expect(windVoice('stratosphere', 0.2, 0).gain).toBeGreaterThan(0);
    expect(windVoice('scrapyard', 0.5, 1).gain).toBeGreaterThan(windVoice('scrapyard', 0.5, 0).gain);
  });
});

describe('stage layout', () => {
  it('chooses the largest canonical size that fits', () => {
    expect(layoutStage(500, 300).canonical).toEqual(CANONICAL_SIZES[0]);
    expect(layoutStage(900, 520).canonical).toEqual(CANONICAL_SIZES[1]);
    expect(layoutStage(1920, 1080).canonical).toEqual(CANONICAL_SIZES[2]);
  });

  it('never leaves bars: the canvas always covers the whole viewport', () => {
    for (const [w, h] of [[1920, 1080], [820, 1180], [390, 844], [2560, 1080]] as const) {
      const layout = layoutStage(w, h);
      expect(layout.cssWidth).toBe(w);
      expect(layout.cssHeight).toBe(h);
    }
  });

  it('keeps the guaranteed play frame in view in landscape and portrait', () => {
    for (const [w, h] of [[1280, 720], [1024, 768], [390, 844], [820, 1180]] as const) {
      const layout = layoutStage(w, h);
      const distance = cameraDistance(layout, 24);
      const visibleHeight = 2 * distance * Math.tan((24 * Math.PI) / 360);
      const visibleWidth = visibleHeight * (w / h);
      expect(visibleHeight).toBeGreaterThanOrEqual(layout.minVisibleHeight - 1e-6);
      expect(visibleWidth).toBeGreaterThanOrEqual(layout.minVisibleWidth - 1e-6);
    }
  });

  it('flags portrait layouts so the Gamebar-eligible framing is used', () => {
    expect(layoutStage(390, 844).portrait).toBe(true);
    expect(layoutStage(1280, 720).portrait).toBe(false);
  });
});

describe('quality tiers', () => {
  it('enforces the particle ceilings of the design', () => {
    expect(PROFILES.high.particleCeiling).toBe(900);
    expect(PROFILES.mid.particleCeiling).toBe(500);
    expect(PROFILES.low.particleCeiling).toBe(260);
    expect(PROFILES.low.fieldLineSegments).toBe(12);
    expect(PROFILES.low.dustScale).toBe(0.35);
  });

  // R-PE-08: the first-frame probe matrix, the same rows the roadmap publishes.
  it('classifies devices into tiers', () => {
    const desktop = { hardwareConcurrency: 12, deviceMemory: 8, devicePixelRatio: 1, coarsePointer: false, maxTextureSize: 16384, rendererName: 'NVIDIA RTX' };
    expect(detectTier(desktop)).toBe('high');
    expect(detectTier({ ...desktop, coarsePointer: true, hardwareConcurrency: 8 })).toBe('mid');
    expect(detectTier({ ...desktop, hardwareConcurrency: 2 })).toBe('low');
    expect(detectTier({ ...desktop, rendererName: 'Mali-T720' })).toBe('low');
    // The 2021 budget Android the PRD makes tier-low's floor (Mali-G52 class)...
    expect(detectTier({ ...desktop, rendererName: 'Mali-G52 MC1' })).toBe('low');
    expect(detectTier({ ...desktop, rendererName: 'Mali-G57 MC2' })).toBe('low');
    // ...and the flagship phone tier-high is promised to hold.
    expect(detectTier({ hardwareConcurrency: 8, deviceMemory: 8, devicePixelRatio: 3, coarsePointer: true, maxTextureSize: 8192, rendererName: 'Adreno (TM) 740' })).toBe('high');
    // A sharp display on a middling phone is not a flagship: fill rate still caps it.
    expect(detectTier({ ...desktop, hardwareConcurrency: 6, deviceMemory: 4, devicePixelRatio: 3, coarsePointer: true, maxTextureSize: 8192, rendererName: 'Adreno (TM) 640' })).toBe('mid');
  });

  it('steps down one tier at a time and stops at low', () => {
    expect(stepDown('high')).toBe('mid');
    expect(stepDown('mid')).toBe('low');
    expect(stepDown('low')).toBe('low');
  });
});

describe('dynamic resolution', () => {
  it('lowers the scale after sustained slow frames and never below the tier floor', () => {
    const governor = new ResolutionGovernor(0.55);
    for (let i = 0; i < 600; i++) governor.push(40);
    expect(governor.scale).toBeCloseTo(0.55, 5);
  });

  it('recovers toward full resolution when frames are fast again', () => {
    const governor = new ResolutionGovernor(0.55);
    for (let i = 0; i < 300; i++) governor.push(40);
    for (let i = 0; i < 900; i++) governor.push(8);
    expect(governor.scale).toBe(1);
  });

  it('holds steady for frames near the target', () => {
    const governor = new ResolutionGovernor(0.55);
    for (let i = 0; i < 300; i++) governor.push(17);
    expect(governor.scale).toBe(1);
  });
});
