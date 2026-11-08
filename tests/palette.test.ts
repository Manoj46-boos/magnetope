import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { BRAND, BUTTON, FX, STATE, UI, UI_VARS } from '@/config/palette';
import { PALETTES, POLE_NORTH, POLE_SOUTH, POLARITY } from '@/render/palette';

/**
 * The master palette's own laws (visual renewal PRD 15): the contrast table
 * computed, not asserted; the interaction law the chapter's Albers test names,
 * held against the worst band any biome can put behind the chrome; the two
 * sources of the chrome — the module and the stylesheet's :root copy — kept
 * in step; the effect family locked in its authoring space so the tokens and
 * the shipped colours are the same values by construction; and the build
 * audit that makes the lock a gate, proved on a real violation.
 */

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const style = readFileSync(join(root, 'src/ui/style.css'), 'utf8');

/** sRGB hex to linear-light, the WCAG luminance maths. */
const hexToRgb = (hex: string): [number, number, number] => {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const n = Number.parseInt(full.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const linear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/** RGBA-on-hex composite, for the panel the ink actually sits on. */
const composite = (fg: string, bg: string): string => {
  const m = /^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\)$/.exec(fg.replace(/\s/g, ''));
  if (!m) return fg;
  const [, fr, fg2, fb, alpha = '1'] = m;
  const [br, bg2, bb] = hexToRgb(bg).map((v) => Math.round(v * 255)) as [number, number, number];
  const a = Number(alpha);
  const mix = (f: number, b: number): number => Math.round(f * a + b * (1 - a));
  const channel = (v: number): string => v.toString(16).padStart(2, '0');
  return `#${channel(mix(Number(fr), br))}${channel(mix(Number(fg2), bg2))}${channel(mix(Number(fb), bb))}`;
};

const contrast = (fg: string, bg: string): number => {
  const la = luminance(fg);
  const lb = luminance(bg);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** RGB chroma, the saturation the eye actually reads on a bright sky. */
const chroma = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex);
  return Math.max(r, g, b) - Math.min(r, g, b);
};

const hslHex = ({ h, s, l }: { h: number; s: number; l: number }): string => `#${new Color().setHSL(h, s, l).getHexString()}`;

describe('the contrast table, computed (PRD 15.2)', () => {
  it('holds WCAG AA for the ink on the panel the chrome really paints', () => {
    // The panel is translucent over the page base, and the dim ink is itself
    // translucent over the panel: both composites before the ratio, because
    // that is the colour the screen shows.
    const panel = composite(UI.panel, UI.bg);
    expect(contrast(UI.ink, panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(composite(UI.inkDim, panel), panel)).toBeGreaterThanOrEqual(4.5);
  });

  it('holds WCAG AA for the primary action, large text', () => {
    expect(contrast(BUTTON.ink, BUTTON.top)).toBeGreaterThanOrEqual(3);
  });

  it('holds WCAG AA for the chip inks on their own bright fills', () => {
    expect(contrast(STATE.goldInk, UI.amber)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(STATE.cyanInk, UI.cyan)).toBeGreaterThanOrEqual(4.5);
  });

  it('holds WCAG AA for the ink on the panel over every biome\u2019s brightest sky', () => {
    // The HUD never floats its ink on bare sky: the panel is translucent, so
    // the ink's real worst case is the panel composited on the brightest band
    // the biome can put behind it. That is the backing the badge reads on.
    for (const palette of Object.values(PALETTES)) {
      const worst = [palette.skyTop, palette.skyHorizon, palette.fog].reduce((a, b) => (luminance(hslHex(b)) > luminance(hslHex(a)) ? b : a));
      const backing = composite(UI.panel, hslHex(worst));
      expect(contrast(UI.ink, backing), `${palette.biome} panel on its brightest band`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('the interaction law (PRD 15.3, the Albers test the chapter names)', () => {
  it('keeps the pole pair the brightest saturated pair in every biome', () => {
    // The law the colour script states: MAGNO's red and blue are the only
    // red-and-blue pair on screen. In the palette's terms, no biome's own
    // families may sit closer to the pole hues than the poles themselves sit
    // to pure saturation.
    // The strong form: the poles carry more saturation than any biome family
    // that shares their hue neighbourhood, so the pair always reads first.
    const north = { h: 4, s: 90, l: 55 };
    for (const palette of Object.values(PALETTES)) {
      for (const family of [palette.dominant, palette.accent]) {
        let dh = Math.abs(family.h - north.h);
        if (dh > 180) dh = 360 - dh;
        if (dh < 30) expect(family.s, `${palette.biome} near the north hue`).toBeLessThan(north.s);
      }
    }
  });

  it('keeps the effect family legible against the worst band it can cross', () => {
    // Bright skies take the deepened bright variant under normal blending, so
    // that is the line the law measures. Over a pale band the line reads by
    // chroma, not luminance — a saturated cyan on a washed-out sky — so the
    // Albers law holds the separation on either axis: the line must never
    // read as the same colour as the sky behind it.
    const bright = `#${new Color().setHSL(FX.attract.h, Math.min(1, FX.attract.s * 1.05), FX.attract.l * 0.72).getHexString()}`;
    for (const palette of Object.values(PALETTES)) {
      const worst = [palette.skyTop, palette.skyHorizon, palette.fog].reduce((a, b) => (luminance(hslHex(b)) > luminance(hslHex(a)) ? b : a));
      const band = hslHex(worst);
      const separates = chroma(bright) - chroma(band) >= 0.4 || contrast(bright, band) >= 1.5;
      expect(separates, `${palette.biome}: the line and its brightest band read as one colour`).toBe(true);
    }
  });
});

describe('the two sources of the chrome, held in step', () => {
  it('the stylesheet :root carries exactly the module\u2019s custom properties', () => {
    const declared = new Map<string, string>();
    for (const line of style.split('\n')) {
      const m = /^\s*(--[a-z0-9-]+):\s*([^;]+);\s*$/.exec(line);
      if (m && !declared.has(m[1]!)) declared.set(m[1]!, m[2]!.trim());
    }
    for (const [name, value] of Object.entries(UI_VARS)) {
      expect(declared.get(name), `:root is missing ${name}`).toBe(value);
    }
    // And nothing extra hides in the block that the module does not own.
    const rootBlock = style.slice(style.indexOf(':root'), style.indexOf('}', style.indexOf(':root')));
    for (const [name] of declared) {
      if (rootBlock.includes(name) && !name.startsWith('--t-') && !name.startsWith('--d-') && !name.startsWith('--safe-') && name !== '--font' && name !== '--radius') {
        expect(UI_VARS, `:root declares ${name} outside the master palette`).toHaveProperty(name);
      }
    }
  });

  it('the brand pair rides the palette the rig paints with', () => {
    expect(POLE_NORTH.getHexString()).toBe(BRAND.poleNorth.slice(1).toLowerCase());
    expect(POLE_SOUTH.getHexString()).toBe(BRAND.poleSouth.slice(1).toLowerCase());
  });
});

describe('the effect family, locked in its authoring space (PRD 15.1)', () => {
  it('the shipped colours are the locked HSL, component for component', () => {
    for (const [name, token] of Object.entries(FX)) {
      const shipped = (POLARITY as unknown as Record<string, Color>)[name]!;
      const hsl = { h: 0, s: 0, l: 0 };
      shipped.getHSL(hsl);
      expect(hsl.h, `${name} hue`).toBeCloseTo(token.h, 5);
      expect(hsl.s, `${name} saturation`).toBeCloseTo(token.s, 5);
      expect(hsl.l, `${name} lightness`).toBeCloseTo(token.l, 5);
    }
  });
});

describe('the build audit that makes the lock a gate (PRD 15.5)', () => {
  it('passes the shipped tree and names a planted violation by file and line', () => {
    const run = (tree: string): string[] => {
      const out = execFileSync('node', ['-e', `import('./scripts/check-budget.mjs').then(m => console.log(JSON.stringify(m.auditPalette(${JSON.stringify(tree)}))))`], { cwd: root, encoding: 'utf8' });
      return JSON.parse(out.trim().split('\n').pop()!);
    };
    expect(run(root)).toEqual([]);
    const probe = join(root, 'src/ui/__palette_probe.ts');
    writeFileSync(probe, 'export const probe = "#deadbeff";');
    try {
      const violations = run(root);
      expect(violations.some((v) => v.includes('__palette_probe.ts') && v.includes('#deadbeff'))).toBe(true);
    } finally {
      rmSync(probe);
    }
  });
});
