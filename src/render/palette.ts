import { AdditiveBlending, Color, LinearSRGBColorSpace, NormalBlending } from 'three';
import type { FieldLook } from '@/config/cosmetics';
import type { BiomeId } from '@/sim/types';

/** HSL as degrees / percent, matching the palette contract in the art bible. */
export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface BiomePalette {
  /** Dominant family used for ground-level props. */
  dominant: Hsl;
  accent: Hsl;
  skyTop: Hsl;
  skyHorizon: Hsl;
  fog: Hsl;
  fogDensity: number;
  sunColor: Hsl;
  sunIntensity: number;
  /** Sun elevation above the horizon, degrees. */
  sunElevation: number;
  hemiSky: Hsl;
  hemiGround: Hsl;
  hemiIntensity: number;
}

const hsl = (h: number, s: number, l: number): Hsl => ({ h, s, l });

export const PALETTES: Readonly<Record<BiomeId, BiomePalette>> = {
  // Scrapyard — warm wedge (yellow-orange to red-orange), 20% of the wheel. Burnt orange
  // sky reads as a committed dusk. Cold blue steel is the complement on every magnetic
  // surface so MAGNO's red+blue poles stay the only red-and-blue pair on screen.
  scrapyard: {
    dominant: hsl(18, 78, 46),
    accent: hsl(140, 55, 36),
    skyTop: hsl(14, 70, 38),
    skyHorizon: hsl(28, 88, 62),
    fog: hsl(22, 60, 48),
    fogDensity: 0.18,
    sunColor: hsl(32, 96, 70),
    sunIntensity: 2.8,
    sunElevation: 18,
    hemiSky: hsl(20, 55, 50),
    hemiGround: hsl(200, 30, 22),
    hemiIntensity: 0.25,
  },
  // Suburbia — cool wedge (yellow-green to blue-green), 25% of the wheel. Saturated lawn
  // green is the dominant; terracotta roofs are the warm accent. The contrast with the
  // Scrapyard's burnt orange is total, so the player feels the biome shift in their bones.
  suburbia: {
    dominant: hsl(105, 48, 48),
    accent: hsl(14, 70, 50),
    skyTop: hsl(200, 65, 62),
    skyHorizon: hsl(140, 45, 82),
    fog: hsl(140, 35, 86),
    fogDensity: 0.12,
    sunColor: hsl(48, 88, 88),
    sunIntensity: 3.0,
    sunElevation: 48,
    hemiSky: hsl(195, 55, 78),
    hemiGround: hsl(105, 30, 42),
    hemiIntensity: 0.45,
  },
  // Metropolis — complementary pair (deep blue-violet + neon yellow-orange), 30% of the
  // wheel. Deep blue-violet facade is the committed night; neon yellow-orange is the only
  // saturated accent, on signs, lit windows, and wet-asphalt reflections. No red — MAGNO's
  // red north pole stays the only red on screen.
  metropolis: {
    dominant: hsl(256, 60, 28),
    accent: hsl(42, 100, 55),
    skyTop: hsl(244, 55, 14),
    skyHorizon: hsl(256, 50, 28),
    fog: hsl(248, 50, 18),
    fogDensity: 0.22,
    sunColor: hsl(42, 100, 58),
    sunIntensity: 1.8,
    sunElevation: 6,
    hemiSky: hsl(250, 45, 36),
    hemiGround: hsl(260, 40, 14),
    hemiIntensity: 0.3,
  },
  // Playground — high-saturation triangle (cyan, magenta, yellow), 40% of the wheel.
  // Warm grey asphalt is the neutral dominant so the three accents read at full saturation.
  // This is the most saturated biome; the climb has earned the colour by the time the
  // player arrives here.
  playground: {
    dominant: hsl(35, 8, 58),
    accent: hsl(320, 85, 56),
    skyTop: hsl(200, 60, 62),
    skyHorizon: hsl(190, 50, 78),
    fog: hsl(190, 30, 72),
    fogDensity: 0.10,
    sunColor: hsl(50, 35, 96),
    sunIntensity: 2.6,
    sunElevation: 65,
    hemiSky: hsl(195, 40, 82),
    hemiGround: hsl(35, 12, 48),
    hemiIntensity: 0.4,
  },
  // Stratosphere — near-monochrome dawn blue, 15% of the wheel, with a single warm accent
  // (sunrise gold) at less than 3% screen area. The narrowest gamut in the game: by the time
  // the player reaches the summit, the world has quieted to almost one colour, and MAGNO's
  // red+blue poles are the brightest things in the frame.
  stratosphere: {
    dominant: hsl(202, 70, 42),
    accent: hsl(42, 90, 62),
    skyTop: hsl(210, 75, 18),
    skyHorizon: hsl(40, 90, 60),
    fog: hsl(205, 60, 22),
    fogDensity: 0.05,
    sunColor: hsl(40, 90, 70),
    sunIntensity: 1.2,
    sunElevation: 10,
    hemiSky: hsl(205, 65, 36),
    hemiGround: hsl(210, 55, 12),
    hemiIntensity: 0.3,
  },
};

/** The two-note effect palette: cyan family for attract, amber family for repel. */
export const POLARITY = {
  attract: new Color().setHSL(0.54, 0.95, 0.68),
  attractCore: new Color().setHSL(0.52, 0.9, 0.92),
  repel: new Color().setHSL(0.09, 1, 0.58),
  repelCore: new Color().setHSL(0.12, 0.95, 0.85),
  rim: new Color().setHSL(0.52, 0.8, 0.55),
} as const;

/**
 * The magnet-pole brand colours. MAGNO's horseshoe head reads as a magnet,
 * not a padlock, because the two tips carry distinct saturated hues: red for
 * north, blue for south. They are the only colours that may appear on every
 * screen regardless of biome, because magnetism is the game's identity.
 */
export const POLE_NORTH = new Color().setStyle('#e53935');
export const POLE_SOUTH = new Color().setStyle('#1e88e5');

/** Deeper, more saturated variants so effects stay legible against bright biomes. */
const POLARITY_BRIGHT = {
  attract: new Color().setHSL(0.55, 0.95, 0.46),
  attractCore: new Color().setHSL(0.52, 0.95, 0.8),
  repel: new Color().setHSL(0.07, 1, 0.5),
  repelCore: new Color().setHSL(0.11, 1, 0.78),
} as const;

interface FieldSet {
  attract: Color;
  attractCore: Color;
  repel: Color;
  repelCore: Color;
}

/** Field-line colours are authored as on-screen values, so they bypass colour-space conversion like the built-in set. */
const raw = (hex: string): Color => new Color().setStyle(hex, LinearSRGBColorSpace);

/** Darker, denser twin of a colour for bright skies; `lift` scales lightness. */
function deepen(color: Color, lift: number): Color {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl, LinearSRGBColorSpace);
  return new Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.05), hsl.l * lift, LinearSRGBColorSpace);
}

function fieldSet(look: FieldLook): { normal: FieldSet; bright: FieldSet } {
  const normal = { attract: raw(look.attract), attractCore: raw(look.attractCore), repel: raw(look.repel), repelCore: raw(look.repelCore) };
  return {
    normal,
    bright: {
      attract: deepen(normal.attract, 0.72),
      attractCore: deepen(normal.attractCore, 0.9),
      repel: deepen(normal.repel, 0.72),
      repelCore: deepen(normal.repelCore, 0.9),
    },
  };
}

/**
 * Effect colours and blending follow the biome: bright skies cannot take
 * additive light, so they get deeper colours with normal blending. An equipped
 * field-line colour replaces both sets.
 */
export class FxTheme {
  bright = false;
  private custom: { normal: FieldSet; bright: FieldSet } | null = null;

  /** Equips a field-line colour; `null` restores the classic cyan and amber. */
  setField(look: FieldLook | null): void {
    this.custom = look ? fieldSet(look) : null;
  }

  private pick(key: keyof FieldSet): Color {
    if (this.custom) return (this.bright ? this.custom.bright : this.custom.normal)[key];
    return this.bright ? POLARITY_BRIGHT[key] : POLARITY[key];
  }

  get attract(): Color {
    return this.pick('attract');
  }

  get attractCore(): Color {
    return this.pick('attractCore');
  }

  get repel(): Color {
    return this.pick('repel');
  }

  get repelCore(): Color {
    return this.pick('repelCore');
  }

  get blending(): typeof AdditiveBlending | typeof NormalBlending {
    return this.bright ? NormalBlending : AdditiveBlending;
  }
}

export const fxTheme = new FxTheme();

export function toColor(c: Hsl, out = new Color()): Color {
  return out.setHSL(c.h / 360, c.s / 100, c.l / 100);
}

export function mixHsl(a: Hsl, b: Hsl, t: number): Hsl {
  let dh = b.h - a.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return { h: (a.h + dh * t + 360) % 360, s: a.s + (b.s - a.s) * t, l: a.l + (b.l - a.l) * t };
}
