import { describe, expect, it } from 'vitest';
import { ALL_LEVELS } from '@/levels';
import {
  CLIMB_ORDER,
  mountainBands,
  mountainColor,
  mountainGeometry,
  mountainLayout,
  pullbackFraming,
} from '@/render/mountain';
import type { BiomeId } from '@/sim/types';

const layout = mountainLayout(ALL_LEVELS);
const tallest = (biome: BiomeId): number => Math.max(...ALL_LEVELS.filter((l) => l.biome === biome).map((l) => l.summit.y));
const gap = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
const lightness = (c: { getHSL(target: { h: number; s: number; l: number }): { l: number } }): number => c.getHSL({ h: 0, s: 0, l: 0 }).l;

describe('mountain bands', () => {
  const bands = mountainBands(ALL_LEVELS);

  it('stacks the five biomes in climb order from the foot to the peak', () => {
    expect(bands.map((b) => b.biome)).toEqual([...CLIMB_ORDER]);
  });

  it('is as tall as the tallest level of every biome', () => {
    for (const band of bands) expect(band.top - band.bottom).toBeCloseTo(tallest(band.biome), 6);
  });

  it('has no gaps or overlaps between bands', () => {
    bands.slice(1).forEach((band, i) => expect(band.bottom).toBeCloseTo(bands[i]!.top, 6));
  });

  it('keeps the Stratosphere in its own level coordinates so the finished climb is the top of the mountain', () => {
    const top = bands.at(-1)!;
    const finale = ALL_LEVELS.find((l) => l.finale)!;
    expect(top.biome).toBe('stratosphere');
    expect(top.bottom).toBe(0);
    expect(top.top).toBe(finale.summit.y);
  });
});

describe('mountain silhouette', () => {
  it('rises from a wide foot to a single point over the finale summit', () => {
    const peak = layout.rows.at(-1)!;
    expect(peak.y).toBeCloseTo(ALL_LEVELS.find((l) => l.finale)!.summit.y, 6);
    expect(peak.left).toBe(0);
    expect(peak.right).toBe(0);
    const width = (row: { left: number; right: number }): number => row.right - row.left;
    const at = (fraction: number) => layout.rows[Math.round((layout.rows.length - 1) * fraction)]!;
    expect(width(at(0))).toBeGreaterThan(width(at(0.25)));
    expect(width(at(0.25))).toBeGreaterThan(width(at(0.5)));
    expect(width(at(0.5))).toBeGreaterThan(width(at(0.75)));
    expect(width(at(0.75))).toBeGreaterThan(width(at(0.95)));
  });

  it('keeps both edges on their own side of the axis at every row below the peak', () => {
    for (const row of layout.rows.slice(0, -1)) {
      expect(row.left).toBeLessThan(0);
      expect(row.right).toBeGreaterThan(0);
    }
  });

  it('climbs in even steps and never doubles back', () => {
    layout.rows.slice(1).forEach((row, i) => expect(row.y).toBeGreaterThan(layout.rows[i]!.y));
  });

  it('is not a perfect triangle: the two flanks differ', () => {
    const asymmetric = layout.rows.slice(1, -1).some((r) => Math.abs(r.right + r.left) > 0.5);
    expect(asymmetric).toBe(true);
  });

  it('draws the same mountain every time and a different one for another seed', () => {
    expect(mountainLayout(ALL_LEVELS).rows).toEqual(layout.rows);
    expect(mountainLayout(ALL_LEVELS, 99).rows).not.toEqual(layout.rows);
  });

  it('gives every biome its own colour, with the foot darker than the lit peak', () => {
    const mid = (b: { bottom: number; top: number }): number => (b.bottom + b.top) / 2;
    const colours = layout.bands.map((b) => mountainColor(layout, mid(b), 0).getHexString());
    expect(new Set(colours).size).toBe(layout.bands.length);
    const foot = mountainColor(layout, layout.baseY + 2, 0);
    const high = mountainColor(layout, layout.peakY - 2, 0);
    expect(lightness(high)).toBeGreaterThan(lightness(foot));
  });

  it('pushes the far ridge toward the night haze', () => {
    const y = layout.bands[2]!.bottom + 20;
    const near = mountainColor(layout, y, 0.1);
    const far = mountainColor(layout, y, 0.6);
    const night = mountainColor(layout, y, 1);
    expect(gap(far, night)).toBeLessThan(gap(near, night));
  });

  it('builds a clean indexed mesh with in-range colours', () => {
    const geometry = mountainGeometry(layout, 0.2);
    const positions = geometry.getAttribute('position');
    const colors = geometry.getAttribute('color');
    expect(positions.count).toBe(layout.rows.length * 2);
    expect(geometry.index!.count).toBe((layout.rows.length - 1) * 6);
    for (const v of positions.array) expect(Number.isFinite(v)).toBe(true);
    for (const v of colors.array) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...geometry.index!.array)).toBeLessThan(positions.count);
  });

  it('scales the far ridge outward without moving it up or down', () => {
    const near = mountainGeometry(layout, 0.2, 1).getAttribute('position');
    const far = mountainGeometry(layout, 0.2, 1.2).getAttribute('position');
    expect(far.getX(0)).toBeCloseTo(near.getX(0) * 1.2, 3);
    expect(far.getY(0)).toBe(near.getY(0));
  });
});

describe('pull-back framing', () => {
  const from = { x: 0.3, y: 104.5 };
  const base = 8.1;
  const aspects = [16 / 9, 4 / 3, 1, 9 / 16];

  it('starts exactly on the follow shot', () => {
    const f = pullbackFraming(0, from, base, layout, 16 / 9);
    expect(f.center).toEqual(from);
    expect(f.visibleHeight).toBeCloseTo(base, 9);
  });

  it.each(aspects)('ends with the whole mountain inside the frame at aspect %f', (aspect) => {
    const f = pullbackFraming(1, from, base, layout, aspect);
    const height = layout.peakY - layout.baseY;
    expect(f.visibleHeight).toBeGreaterThan(height * 1.3);
    expect(f.visibleHeight * aspect).toBeGreaterThan(layout.halfWidth * 2);
    expect(f.center.y - f.visibleHeight / 2).toBeLessThan(layout.baseY);
    expect(f.center.y + f.visibleHeight / 2).toBeGreaterThan(layout.peakY);
  });

  it('widens the view smoothly and never narrows it', () => {
    let last = 0;
    for (let p = 0; p <= 1; p += 0.05) {
      const { visibleHeight } = pullbackFraming(p, from, base, layout, 16 / 9);
      expect(visibleHeight).toBeGreaterThanOrEqual(last);
      last = visibleHeight;
    }
  });

  it('keeps MAGNO, and the star at his chest, inside the frame for the whole pull-back', () => {
    for (let p = 0; p <= 1; p += 0.05) {
      const f = pullbackFraming(p, from, base, layout, 16 / 9);
      expect(Math.abs(f.center.y - from.y), `pull ${p.toFixed(2)}`).toBeLessThan(f.visibleHeight * 0.4);
    }
  });

  it('ends on the same framing however far the camera started', () => {
    const near = pullbackFraming(1, from, 8, layout, 16 / 9).visibleHeight;
    const far = pullbackFraming(1, from, 16, layout, 16 / 9).visibleHeight;
    expect(far).toBeCloseTo(near, 6);
  });
});
