import { describe, expect, it } from 'vitest';
import { COSMETICS, DEFAULT_FIELD_ID, type FieldLook } from '@/config/cosmetics';

/**
 * PRD 12.4: polarity is told apart by hue and by shape, and the palette is
 * checked for protanopia and deuteranopia. The shape is a given; this holds the
 * hue half to account for every field-line colour a player can equip, by
 * simulating the way a colour-blind eye sees it (Machado et al., 2009, full
 * severity) and measuring how far apart attract and repel still are.
 */

type Matrix = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];

const SIMULATIONS: Record<string, Matrix> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

type Rgb = readonly [number, number, number];

const parse = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as unknown as Rgb;
const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

const simulate = (rgb: Rgb, m: Matrix): Rgb => {
  const lin = rgb.map(toLinear);
  return m.map((row) => clamp01(row[0] * lin[0]! + row[1] * lin[1]! + row[2] * lin[2]!)) as unknown as Rgb;
};

const toLab = (linear: Rgb): [number, number, number] => {
  const [r, g, b] = linear;
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};

const deltaE = (a: [number, number, number], b: [number, number, number]): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const seen = (hex: string, matrix: Matrix | null): [number, number, number] => {
  const rgb = parse(hex);
  return toLab(matrix ? simulate(rgb, matrix) : (rgb.map(toLinear) as unknown as Rgb));
};

/** CIE76 distance below which two colours stop reading as two colours at a glance on a moving field line. */
const MIN_DISTINCT = 28;

const fields = COSMETICS.filter((c): c is Extract<typeof c, { kind: 'field' }> => c.kind === 'field');

describe('field-line colours for colour-blind players', () => {
  it('covers the default and every cosmetic field in the locker', () => {
    expect(fields.map((f) => f.id)).toContain(DEFAULT_FIELD_ID);
    expect(fields.length).toBeGreaterThan(1);
  });

  describe.each(fields.map((f) => [f.name, f.look] as [string, FieldLook]))('%s', (_name, look) => {
    it('keeps attract and repel distinct for normal colour vision', () => {
      expect(deltaE(seen(look.attract, null), seen(look.repel, null))).toBeGreaterThan(MIN_DISTINCT);
    });

    it.each(Object.entries(SIMULATIONS))('keeps attract and repel distinct under %s', (_kind, matrix) => {
      expect(deltaE(seen(look.attract, matrix), seen(look.repel, matrix))).toBeGreaterThan(MIN_DISTINCT);
    });
  });
});
