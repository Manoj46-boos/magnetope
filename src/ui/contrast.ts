import type { Hsl } from '@/render/palette';

/** A colour as the audit speaks it: 0-255 sRGB channels. */
export type Rgb = readonly [number, number, number];

/** #rgb, #rrggbb and rgb()/rgba() strings as the style sheets write them. */
export function parseColor(css: string): Rgb {
  const text = css.trim();
  if (text.startsWith('#')) {
    const hex = text.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as unknown as Rgb;
  }
  const parts = text.match(/rgba?\(([^)]+)\)/)?.[1]!.split(/[,\s/]+/).filter(Boolean) ?? [];
  // rgb() channels are 0-255 already; only the alpha rides 0-1.
  return [0, 1, 2].map((i) => Math.round(Number(parts[i]))) as unknown as Rgb;
}

/** hsl as the biome palettes carry it, to the same 0-255 channels. */
export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => Math.round(255 * (light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [channel(0), channel(8), channel(4)];
}

/** Composites a translucent foreground over a backdrop, the way the browser paints it. */
export function blend(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [0, 1, 2].map((i) => Math.round(fg[i]! * alpha + bg[i]! * (1 - alpha))) as unknown as Rgb;
}

const toLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export function luminance(rgb: Rgb): number {
  return 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
}

/** The WCAG contrast ratio between two colours: 1 (same) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface ContrastRow {
  /** What is being measured, in the surface's own words. */
  label: string;
  ratio: number;
  /** The floor this row must clear: 4.5 for text, 3 for icons and graphics (R-AC-05). */
  floor: number;
}

/**
 * The contrast audit's arithmetic (R-AC-05): text clears 4.5:1 and HUD
 * graphics 3:1 against the worst case that can sit behind them. The worst case
 * for the interface is the brightest band of any biome — sky top, horizon or
 * fog, whichever the level can put there; a translucent panel, pill or chip
 * composites over that band first, exactly as the browser paints it, and a
 * graphic is measured against the colour adjacent to it (its own backing, then
 * the backing against the sky). The a11y suite feeds this the real tokens and
 * palettes and holds every row above its floor.
 */
export function auditRows(input: {
  ink: string;
  inkDim: string;
  amber: string;
  cyan: string;
  panel: string;
  pill: string;
  chip: string;
  button: string;
  /** The bands every biome can put behind the interface, as parsed colours. */
  bands: readonly { biome: string; color: Rgb }[];
}): ContrastRow[] {
  const ink = parseColor(input.ink);
  const amber = parseColor(input.amber);
  const cyan = parseColor(input.cyan);
  const rgba = (css: string): [Rgb, number] => {
    const n = css.match(/[\d.]+/g)!.map(Number);
    return [[n[0]!, n[1]!, n[2]!], n[3] ?? 1];
  };
  const over = (css: string, band: Rgb): Rgb => {
    const [color, alpha] = rgba(css);
    return blend(color, alpha, band);
  };
  const [inkDimColor, inkDimAlpha] = rgba(input.inkDim);

  const worst = input.bands.reduce((a, b) => (luminance(b.color) > luminance(a.color) ? b : a));
  const band = worst.color;
  const panelOver = over(input.panel, band);
  const pillOver = over(input.pill, band);
  const chipOver = over(input.chip, band);
  const buttonOver = over(input.button, band);
  const dimOverPanel = blend(inkDimColor, inkDimAlpha, panelOver);
  const dimOverPill = blend(inkDimColor, inkDimAlpha, pillOver);

  return [
    { label: `body text on the panel over ${worst.biome}`, ratio: contrastRatio(ink, panelOver), floor: 4.5 },
    { label: `dimmed text on the panel over ${worst.biome}`, ratio: contrastRatio(dimOverPanel, panelOver), floor: 4.5 },
    { label: `timer text on its pill over ${worst.biome}`, ratio: contrastRatio(ink, pillOver), floor: 4.5 },
    { label: `the timer's dimmed half over ${worst.biome}`, ratio: contrastRatio(dimOverPill, pillOver), floor: 4.5 },
    { label: `the summit star's amber on its chip over ${worst.biome}`, ratio: contrastRatio(amber, chipOver), floor: 3 },
    { label: `the star's chip against ${worst.biome}`, ratio: contrastRatio(chipOver, band), floor: 3 },
    { label: `the marker's cyan against its dark ring over ${worst.biome}`, ratio: contrastRatio(cyan, chipOver), floor: 3 },
    { label: `the marker's ring against ${worst.biome}`, ratio: contrastRatio(chipOver, band), floor: 3 },
    { label: `the pause icon on its own button over ${worst.biome}`, ratio: contrastRatio(ink, buttonOver), floor: 3 },
  ];
}
