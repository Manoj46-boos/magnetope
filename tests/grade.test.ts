import { describe, expect, it } from 'vitest';
import { CARD_GRADE, GRADES, LUT_SIZE, LUT_WIDTH, NEUTRAL_GRADE, applyGrade, buildGradeLut, sampleGradeLut } from '@/render/grade';
import { PROFILES } from '@/render/quality';

const SWATCHES: Array<[number, number, number]> = [
  [0, 0, 0],
  [1, 1, 1],
  [0.5, 0.5, 0.5],
  [0.82, 0.31, 0.12],
  [0.18, 0.44, 0.71],
  [0.93, 0.88, 0.62],
  [0.07, 0.05, 0.22],
];

const biomes = Object.keys(GRADES) as Array<keyof typeof GRADES>;

describe('colour grading tables', () => {
  it('lays out 32 blue slices of 32 x 32 texels in a 1024 x 32 strip', () => {
    expect(LUT_WIDTH).toBe(1024);
    expect(LUT_SIZE).toBe(32);
    expect(buildGradeLut(NEUTRAL_GRADE)).toHaveLength(1024 * 32 * 4);
  });

  it('leaves every colour alone when the grade is neutral', () => {
    const lut = buildGradeLut(NEUTRAL_GRADE);
    for (const swatch of SWATCHES) {
      const out = sampleGradeLut(lut, swatch);
      swatch.forEach((value, i) => expect(Math.abs(out[i]! - value)).toBeLessThan(1.5 / 255));
    }
  });

  it.each(biomes)('reproduces the %s grade through the lookup to within four levels of 255', (biome) => {
    const lut = buildGradeLut(GRADES[biome]);
    for (const swatch of SWATCHES) {
      const direct = applyGrade(GRADES[biome], swatch);
      const looked = sampleGradeLut(lut, swatch);
      direct.forEach((value, i) => expect(Math.abs(looked[i]! - value)).toBeLessThan(4 / 255));
    }
  });

  it('keeps black and white inside the display range, with no channel escaping', () => {
    for (const biome of biomes) {
      for (const swatch of SWATCHES) {
        for (const channel of applyGrade(GRADES[biome], swatch)) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('follows the temperature journey: warm highlights at the bottom, cool at the top', () => {
    const highlight: [number, number, number] = [0.85, 0.85, 0.85];
    const warmth = (biome: keyof typeof GRADES): number => {
      const [r, , b] = applyGrade(GRADES[biome], highlight);
      return r - b;
    };
    expect(warmth('scrapyard')).toBeGreaterThan(warmth('suburbia'));
    expect(warmth('stratosphere')).toBeLessThan(0);
    expect(warmth('scrapyard')).toBeGreaterThan(0.03);
  });

  it('carries the §4.1 saturation retune: loud where the biome is loud, silent at the top (P-AR-01)', () => {
    // The panel's "color muting" finding was a flat grade; the retune gives
    // each biome its own committed loudness, and the ordering is the law.
    expect(GRADES.scrapyard.saturation).toBe(1.3);
    expect(GRADES.suburbia.saturation).toBe(1.28);
    expect(GRADES.metropolis.saturation).toBe(1.4);
    expect(GRADES.playground.saturation).toBe(1.38);
    // The Stratosphere's silence is desaturation: the only biome below neutral.
    expect(GRADES.stratosphere.saturation).toBe(0.9);
    expect(GRADES.stratosphere.saturation).toBeLessThan(1);
    // The loudest three, in the PRD's own order (+15 < +20 < +25).
    expect(GRADES.scrapyard.saturation).toBeLessThan(GRADES.playground.saturation);
    expect(GRADES.playground.saturation).toBeLessThan(GRADES.metropolis.saturation);
    for (const biome of biomes) if (biome !== 'stratosphere') expect(GRADES[biome].saturation).toBeGreaterThan(1.2);
  });

  it('steers each biome\'s highlights toward its signature warm pole and its shadow toward the deep one', () => {
    // §4.1's hue pairs, read as the grade's own tint: the highlight of every
    // warm biome sits warm of neutral, the Stratosphere's sits cool, and the
    // metropolis sky (its shadow) carries the neon night's blue.
    const highlight: [number, number, number] = [0.85, 0.85, 0.85];
    const shadow: [number, number, number] = [0.12, 0.12, 0.12];
    const warmthAt = (biome: keyof typeof GRADES, at: [number, number, number]): number => {
      const [r, , b] = applyGrade(GRADES[biome], at);
      return r - b;
    };
    for (const biome of ['scrapyard', 'suburbia', 'metropolis', 'playground'] as const) {
      expect(warmthAt(biome, highlight)).toBeGreaterThan(0.02);
    }
    expect(warmthAt('metropolis', shadow)).toBeLessThan(0);
    expect(warmthAt('stratosphere', highlight)).toBeLessThan(0);
  });

  it('keeps the card above every biome in contrast and saturation, as its own law demands', () => {
    for (const biome of biomes) {
      expect(CARD_GRADE.contrast).toBeGreaterThan(GRADES[biome].contrast);
      expect(CARD_GRADE.saturation).toBeGreaterThan(GRADES[biome].saturation);
    }
  });

  it('pushes contrast where the biome asks for it', () => {
    const dark = applyGrade(GRADES.metropolis, [0.25, 0.25, 0.25]);
    const light = applyGrade(GRADES.metropolis, [0.75, 0.75, 0.75]);
    expect(dark[1]).toBeLessThan(0.25);
    expect(light[1]).toBeGreaterThan(0.75 - 0.001);
  });

  it('keeps bloom to the PRD strength and lets bright biomes carry less', () => {
    expect(NEUTRAL_GRADE.bloom).toBe(0.4);
    expect(GRADES.suburbia.bloom).toBeLessThan(GRADES.stratosphere.bloom);
    for (const biome of biomes) expect(GRADES[biome].bloom).toBeLessThanOrEqual(0.5);
  });
});

describe('quality tiers and the post stack', () => {
  it('drops bloom resolution from desktop to phone, and off for the weakest devices', () => {
    expect(PROFILES.high.bloomDivisor).toBe(2);
    expect(PROFILES.mid.bloomDivisor).toBe(4);
    expect(PROFILES.low.bloomDivisor).toBe(0);
  });

  it('turns multisampling down with the tier and leaves the lowest unsampled', () => {
    expect(PROFILES.high.msaa).toBeGreaterThan(PROFILES.mid.msaa);
    expect(PROFILES.low.msaa).toBe(0);
  });

  it('replaces the shader vignette with the baked overlay only on the lowest tier', () => {
    expect(PROFILES.high.shaderVignette).toBe(true);
    expect(PROFILES.mid.shaderVignette).toBe(true);
    expect(PROFILES.low.shaderVignette).toBe(false);
  });
});
