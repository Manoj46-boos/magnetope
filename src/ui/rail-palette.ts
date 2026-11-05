import { PALETTES, mixHsl, type Hsl } from '@/render/palette';
import type { BiomeId } from '@/sim/types';

/**
 * The altitude rail's own colours (visual renewal PRD 14.9): the one HUD element
 * allowed to wear the world at full saturation, so the climb's palette rides the
 * screen edge all game long — the yard's burnt orange into its dusk horizon, the
 * thin air's dawn blue into its sunrise gold. The endpoints are derived, not
 * hand-picked, so a biome retune (session 40's §4.1 law) re-dresses the rail with
 * it and the derivation stays honest: the ground end takes the biome's dominant
 * family and the summit end its horizon family, each lifted to the lightness the
 * contrast law demands against the marker's own dark ring — the same backing the
 * summit star rides — so the fill clears 3:1 the way every other HUD graphic must
 * (R-AC-05), whichever biome puts the brightest band behind it.
 */

/** The ring is the rail's own worst-case backing, the value `.rail .marker` and `.rail .summit svg` paint. */
const RING: Rgb = [13, 17, 25];
const RING_ALPHA = 0.66;

/** The brightest sky band any biome can put behind the rail: the audit's own worst case (R-AC-05). */
function worstBand(): Rgb {
  let worst: Rgb = [0, 0, 0];
  for (const p of Object.values(PALETTES)) {
    for (const band of [p.skyTop, p.skyHorizon, p.fog]) {
      if (luminance(hslToRgb(band)) > luminance(worst)) worst = hslToRgb(band);
    }
  }
  return worst;
}

const srgb = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

function luminance(rgb: Rgb): number {
  return 0.2126 * srgb(rgb[0]) + 0.7152 * srgb(rgb[1]) + 0.0722 * srgb(rgb[2]);
}

type Rgb = readonly [number, number, number];

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number): number => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number): number => Math.round(255 * (light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [channel(0), channel(8), channel(4)];
}

const blend = (fg: Rgb, alpha: number, bg: Rgb): Rgb =>
  [0, 1, 2].map((i) => Math.round(fg[i]! * alpha + bg[i]! * (1 - alpha))) as unknown as Rgb;

const contrast = (a: Rgb, b: Rgb): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** The ring as the browser paints it over the worst band — the floor every endpoint must clear. */
function ringOverWorstBand(): Rgb {
  return blend(RING, RING_ALPHA, worstBand());
}

/**
 * Lifts a colour's lightness until it clears 3:1 over the ring, the same floor
 * the marker's cyan and the summit star's amber already answer (R-AC-05). A
 * violet night sky cannot get there by hue alone, so the climb is by lightness
 * in whole steps from the family's own anchor — the colour arrives at the first
 * rung that passes, never a hand-picked number.
 */
export function lifted(c: Hsl, floor = 3): Hsl {
  const backing = ringOverWorstBand();
  for (let l = Math.max(c.l, 46); l <= 96; l += 2) {
    const step: Hsl = { h: c.h, s: c.s, l };
    if (contrast(hslToRgb(step), backing) >= floor) return step;
  }
  return { h: c.h, s: c.s, l: 96 };
}

/** The rail's two stops for a biome: its ground and its summit, as CSS colours. */
export function railGradient(biome: BiomeId): { ground: string; summit: string } {
  const p = PALETTES[biome];
  // The ground keeps a touch of the horizon in it so the two stops never read as
  // strangers: the gradient is one family easing into the sky it climbs toward.
  const ground = lifted(mixHsl(p.dominant, p.skyHorizon, 0.18));
  const summit = lifted({ h: p.skyHorizon.h, s: p.skyHorizon.s, l: p.skyHorizon.l });
  const css = (c: Hsl): string => `hsl(${Math.round(c.h)} ${Math.round(c.s)}% ${Math.round(c.l)}%)`;
  return { ground: css(ground), summit: css(summit) };
}
