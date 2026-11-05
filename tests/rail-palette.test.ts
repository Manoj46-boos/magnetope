import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hslToRgb, type Rgb } from '@/ui/contrast';
import { PALETTES } from '@/render/palette';
import { railGradient, lifted } from '@/ui/rail-palette';

/**
 * The altitude rail's own laws (visual renewal PRD 14.9): the climb's palette
 * rides the screen edge, dressed per biome, and every colour it puts there
 * answers the same contrast floor the rest of the HUD's graphics answer. The
 * marker is the horseshoe — the game's signature shape, on the chip treatment
 * the summit star already rides — and the rewarded asks wear the magnet too
 * (14.3), so the ad surfaces speak the game's own identity instead of a
 * borrowed video-camera glyph.
 */

const read = (name: string): string => readFileSync(resolve(__dirname, `../src/ui/${name}`), 'utf8');

const RING: [number, number, number] = [13, 17, 25];
const RING_ALPHA = 0.66;

const blend = (fg: readonly number[], alpha: number, bg: readonly number[]): [number, number, number] =>
  [0, 1, 2].map((i) => Math.round(fg[i]! * alpha + bg[i]! * (1 - alpha))) as unknown as [number, number, number];

const toLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (rgb: readonly number[]): number =>
  0.2126 * toLinear(rgb[0]!) + 0.7152 * toLinear(rgb[1]!) + 0.0722 * toLinear(rgb[2]!);

const contrastRatio = (a: readonly number[], b: readonly number[]): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const parseHsl = (css: string): Rgb => {
  const [h, s, l] = css.match(/hsl\((\d+) (\d+)% (\d+)%\)/)!.slice(1).map(Number) as [number, number, number];
  return hslToRgb({ h, s, l });
};

/** The chip backing the audit itself reads: the ring composited over the brightest band any biome has. */
function ringOverWorstBand(): [number, number, number] {
  let worst: readonly number[] = [0, 0, 0];
  for (const p of Object.values(PALETTES)) {
    for (const band of [p.skyTop, p.skyHorizon, p.fog]) {
      const rgb = hslToRgb(band);
      if (luminance(rgb) > luminance(worst)) worst = rgb;
    }
  }
  return blend(RING, RING_ALPHA, worst);
}

describe('the altitude rail dresses itself in the biome (visual renewal 14.9)', () => {
  it('carries every biome, and no two biomes share a gradient', () => {
    const gradients = Object.keys(PALETTES).map((biome) => JSON.stringify(railGradient(biome as keyof typeof PALETTES)));
    expect(gradients).toHaveLength(5);
    expect(new Set(gradients).size).toBe(5);
  });

  it.each(Object.keys(PALETTES))('speaks %s own families: the ground from its dominant and horizon, the summit from its horizon', (id) => {
    const p = PALETTES[id as keyof typeof PALETTES];
    const { ground, summit } = railGradient(p.biome);
    // Hue families survive the lift, so the yard reads burnt orange into dusk
    // and the thin air reads dawn blue into gold — never a stranger's palette.
    // The ground carries a touch of the horizon in it by design, so it answers
    // to either parent family.
    const groundHue = Number(ground.match(/hsl\((\d+)/)![1]);
    const summitHue = Number(summit.match(/hsl\((\d+)/)![1]);
    const hueDistance = (a: number, b: number): number => {
      const d = Math.abs(a - b);
      return Math.min(d, 360 - d);
    };
    const groundParent = Math.min(hueDistance(groundHue, p.dominant.h), hueDistance(groundHue, p.skyHorizon.h));
    expect(groundParent).toBeLessThanOrEqual(30);
    expect(hueDistance(summitHue, p.skyHorizon.h)).toBeLessThanOrEqual(8);
  });

  it.each(Object.keys(PALETTES))('clears 3:1 against the ring over the worst band for %s', (id) => {
    const { ground, summit } = railGradient(id as keyof typeof PALETTES);
    const backing = ringOverWorstBand();
    // The fill is a graphic on its own dark backing, the same floor the marker
    // and the summit star already answer (R-AC-05) — measured, not asserted.
    expect(contrastRatio(parseHsl(ground), backing), `${ground} on the ring`).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(parseHsl(summit), backing), `${summit} on the ring`).toBeGreaterThanOrEqual(3);
  });

  it('lifts a violet night as far as it must and no further than the law needs', () => {
    const violet = { h: 256, s: 60, l: 28 };
    const up = lifted(violet);
    expect(up.l).toBeGreaterThan(violet.l);
    expect(up.h).toBe(violet.h);
    expect(up.s).toBe(violet.s);
    const backing = ringOverWorstBand();
    expect(contrastRatio(hslToRgb(up), backing)).toBeGreaterThanOrEqual(3);
    // And the rung below would have failed: the lift stops at the first passing step.
    const below = { ...up, l: up.l - 2 };
    expect(contrastRatio(hslToRgb(below), backing)).toBeLessThan(3);
  });
});

describe('the rail\'s markup and the magnet icon (visual renewal 14.3, 14.9)', () => {
  const uiSource = read('ui.ts');
  const iconsSource = read('icons.ts');
  const css = read('style.css');

  it('marks the climb with the horseshoe, pole tips and all', () => {
    // The marker is the lockup's own construction: the horseshoe arc with both
    // pole blocks, riding the dark chip treatment the summit star wears.
    const marker = uiSource.match(/const RAIL_MARKER = `([^`]+)`/)![1]!;
    expect(marker).toContain('A18 18 0 0 0 50 34 V20');
    expect(marker).toContain('${LOCKUP.poleNorth}');
    expect(marker).toContain('${LOCKUP.poleSouth}');
    // And the rail's markup mounts it as the marker.
    expect(uiSource).toContain(`<span class="marker">\${RAIL_MARKER}</span>`);
  });

  it('rides the chip, not a cyan rim, so the glyph answers the contrast law where it sits', () => {
    expect(css).toMatch(/\.rail \.marker \{[^}]*background:\s*rgba\(13, 17, 25, 0\.66\)/s);
    expect(css).not.toMatch(/\.rail \.marker \{[^}]*border:\s*3px solid var\(--cyan\)/s);
  });

  it('carries the biome it is dressed in, so a test can read the state off the DOM', () => {
    expect(uiSource).toMatch(/setRailBiome\(biome: BiomeId\)/);
    expect(uiSource).toMatch(/this\.rail\.dataset\.biome = biome/);
  });

  it('wears the game\'s own width: eight pixels, the grid\'s own step', () => {
    expect(css).toMatch(/\.rail \{[^}]*width:\s*8px/s);
  });

  it('lays its gradient on the chip treatment, so the fill reads where the contrast law measures it', () => {
    // The track is the fill's true backing — the same dark chip the marker and
    // the summit star ride — so a low climb's gradient reads against the sky,
    // not against the sky-tinted translucency the old track painted.
    expect(css).toMatch(/\.rail \{[^}]*background:\s*rgba\(13, 17, 25, 0\.66\)/s);
  });

  it('gives the rewarded asks the horseshoe magnet, never a borrowed camera', () => {
    const magnet = iconsSource.match(/magnet:\s*svg\('([^']+)'\)/)![1]!;
    // The horseshoe: a down-leg, the arc, the up-leg, and the tip bar joining the poles.
    expect(magnet).toContain('M7 5v7a5 5 0 0 0 10 0V5');
    expect(magnet).toContain('M7 5h3.5M13.5 5H17');
    // Every rewarded surface in the shell speaks it: the doubler, the second
    // wind and the locker's watch button.
    expect(uiSource).toContain(`'doubleScrap', 'magnet'`);
    expect(uiSource).toContain(`'secondWind', 'magnet'`);
    expect(read('locker-screen.ts')).toContain('ICONS.magnet');
    expect(read('locker-screen.ts')).not.toContain('ICONS.video');
  });
});
