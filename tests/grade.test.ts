import { describe, expect, it } from 'vitest';
import { GRADES, LUT_SIZE, LUT_WIDTH, NEUTRAL_GRADE, applyGrade, buildGradeLut, sampleGradeLut } from '@/render/grade';
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
  it('lays out 16 blue slices of 16 x 16 texels in a 256 x 16 strip', () => {
    expect(LUT_WIDTH).toBe(256);
    expect(LUT_SIZE).toBe(16);
    expect(buildGradeLut(NEUTRAL_GRADE)).toHaveLength(256 * 16 * 4);
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
