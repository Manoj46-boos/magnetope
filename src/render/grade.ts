import type { BiomeId } from '@/sim/types';

/** A display-referred colour grade: applied after tone mapping, baked into a small 3D lookup table. */
export interface BiomeGrade {
  contrast: number;
  saturation: number;
  /** Added to the shadows, as display-space RGB offsets. */
  shadow: readonly [number, number, number];
  /** Added to the highlights. */
  highlight: readonly [number, number, number];
  /** Bloom strength for this biome; bright skies carry less so only light sources glow. */
  bloom: number;
}

export const NEUTRAL_GRADE: BiomeGrade = { contrast: 1, saturation: 1, shadow: [0, 0, 0], highlight: [0, 0, 0], bloom: 0.4 };

/**
 * One grade per biome, following the temperature journey of the art bible:
 * rust and teal at the bottom, cool silence at the top.
 */
export const GRADES: Readonly<Record<BiomeId, BiomeGrade>> = {
  scrapyard: { contrast: 1.15, saturation: 1.15, shadow: [-0.02, 0.008, 0.025], highlight: [0.035, 0.015, -0.025], bloom: 0.42 },
  suburbia: { contrast: 1.08, saturation: 1.18, shadow: [0.006, 0.016, 0.022], highlight: [0.015, 0.015, -0.005], bloom: 0.32 },
  metropolis: { contrast: 1.18, saturation: 1.15, shadow: [-0.015, -0.015, 0.035], highlight: [0.032, -0.012, 0.03], bloom: 0.46 },
  playground: { contrast: 1.15, saturation: 1.18, shadow: [0.016, 0.008, 0.018], highlight: [0.018, 0.012, -0.012], bloom: 0.30 },
  stratosphere: { contrast: 1.18, saturation: 1.15, shadow: [-0.015, 0.006, 0.038], highlight: [-0.018, 0.02, 0.035], bloom: 0.48 },
};

export const LUT_SIZE = 16;
export const LUT_WIDTH = LUT_SIZE * LUT_SIZE;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const luma = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** The grade as a plain function of a display colour, the reference the lookup table is baked from. */
export function applyGrade(grade: BiomeGrade, rgb: readonly [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb;
  const y = luma(r, g, b);
  const lowWeight = 1 - smoothstep(0, 0.6, y);
  const highWeight = smoothstep(0.4, 1, y);
  const channel = (value: number, index: number): number => {
    let v = y + (value - y) * grade.saturation;
    v = 0.5 + (v - 0.5) * grade.contrast;
    v += grade.shadow[index]! * lowWeight + grade.highlight[index]! * highWeight;
    return clamp01(v);
  };
  return [channel(r, 0), channel(g, 1), channel(b, 2)];
}

/**
 * Bakes a grade into a 256 x 16 strip of 16 blue slices, the layout the final
 * pass samples with two fetches: x = blue * 16 + red, y = green. RGBA8.
 */
export function buildGradeLut(grade: BiomeGrade): Uint8Array {
  const data = new Uint8Array(LUT_WIDTH * LUT_SIZE * 4);
  const top = LUT_SIZE - 1;
  for (let g = 0; g < LUT_SIZE; g++) {
    for (let b = 0; b < LUT_SIZE; b++) {
      for (let r = 0; r < LUT_SIZE; r++) {
        const graded = applyGrade(grade, [r / top, g / top, b / top]);
        const at = (g * LUT_WIDTH + b * LUT_SIZE + r) * 4;
        data[at] = Math.round(graded[0] * 255);
        data[at + 1] = Math.round(graded[1] * 255);
        data[at + 2] = Math.round(graded[2] * 255);
        data[at + 3] = 255;
      }
    }
  }
  return data;
}

/** CPU twin of the shader lookup: trilinear between blue slices, bilinear inside a slice. */
export function sampleGradeLut(lut: Uint8Array, rgb: readonly [number, number, number]): [number, number, number] {
  const top = LUT_SIZE - 1;
  const texel = (r: number, g: number, b: number, channel: number): number => lut[(g * LUT_WIDTH + b * LUT_SIZE + r) * 4 + channel]! / 255;
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const r = clamp01(rgb[0]) * top;
  const g = clamp01(rgb[1]) * top;
  const b = clamp01(rgb[2]) * top;
  const [r0, g0, b0] = [Math.floor(r), Math.floor(g), Math.floor(b)];
  const [r1, g1, b1] = [Math.min(top, r0 + 1), Math.min(top, g0 + 1), Math.min(top, b0 + 1)];
  const [fr, fg, fb] = [r - r0, g - g0, b - b0];
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const plane = (bi: number): number =>
      lerp(lerp(texel(r0, g0, bi, c), texel(r1, g0, bi, c), fr), lerp(texel(r0, g1, bi, c), texel(r1, g1, bi, c), fr), fg);
    out[c] = lerp(plane(b0), plane(b1), fb);
  }
  return out;
}
