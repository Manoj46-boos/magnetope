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
  scrapyard: {
    dominant: hsl(22, 55, 52),
    accent: hsl(188, 62, 46),
    skyTop: hsl(205, 38, 52),
    skyHorizon: hsl(32, 78, 76),
    fog: hsl(28, 52, 70),
    fogDensity: 0.15,
    sunColor: hsl(34, 100, 74),
    sunIntensity: 2.1,
    sunElevation: 25,
    hemiSky: hsl(200, 40, 70),
    hemiGround: hsl(188, 34, 26),
    hemiIntensity: 0.62,
  },
  suburbia: {
    dominant: hsl(140, 30, 75),
    accent: hsl(12, 78, 66),
    skyTop: hsl(205, 70, 70),
    skyHorizon: hsl(150, 40, 90),
    fog: hsl(150, 30, 92),
    fogDensity: 0.08,
    sunColor: hsl(48, 90, 92),
    sunIntensity: 2.4,
    sunElevation: 55,
    hemiSky: hsl(200, 60, 84),
    hemiGround: hsl(140, 22, 52),
    hemiIntensity: 1.2,
  },
  metropolis: {
    dominant: hsl(215, 35, 52),
    accent: hsl(315, 90, 62),
    skyTop: hsl(236, 50, 24),
    skyHorizon: hsl(330, 56, 46),
    fog: hsl(222, 52, 28),
    fogDensity: 0.18,
    sunColor: hsl(24, 100, 62),
    sunIntensity: 1.6,
    sunElevation: 10,
    hemiSky: hsl(226, 50, 54),
    hemiGround: hsl(240, 40, 20),
    hemiIntensity: 0.9,
  },
  playground: {
    dominant: hsl(345, 40, 72),
    accent: hsl(48, 92, 62),
    skyTop: hsl(212, 28, 68),
    skyHorizon: hsl(46, 42, 82),
    fog: hsl(44, 24, 80),
    fogDensity: 0.07,
    sunColor: hsl(50, 30, 98),
    sunIntensity: 1.9,
    sunElevation: 70,
    hemiSky: hsl(210, 20, 90),
    hemiGround: hsl(345, 24, 58),
    hemiIntensity: 1.12,
  },
  stratosphere: {
    dominant: hsl(245, 45, 42),
    accent: hsl(180, 80, 56),
    skyTop: hsl(252, 60, 8),
    skyHorizon: hsl(222, 62, 26),
    fog: hsl(240, 55, 10),
    fogDensity: 0.02,
    sunColor: hsl(220, 60, 80),
    sunIntensity: 0.7,
    sunElevation: 40,
    hemiSky: hsl(240, 50, 40),
    hemiGround: hsl(250, 45, 14),
    hemiIntensity: 0.8,
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
