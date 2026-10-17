import { describe, expect, it } from 'vitest';
import { PROPS } from '@/config/props';
import { ALL_LEVELS } from '@/levels';
import { PALETTES } from '@/render/palette';
import { buildPropParts, materialColor } from '@/render/prop-mesh';
import { Rng } from '@/core/rng';
import { createSim, makeLevel } from './helpers/harness';

const DEFAULT_PLACEMENTS = Object.values(PROPS).map((kind, i) => ({ kind: kind.id, x: i * 8, y: 2 }));

interface Extent {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function extentOf(...builders: Array<{ positions: number[] }>): Extent {
  const e: Extent = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const b of builders) {
    for (let i = 0; i < b.positions.length; i += 3) {
      e.x0 = Math.min(e.x0, b.positions[i]!);
      e.x1 = Math.max(e.x1, b.positions[i]!);
      e.y0 = Math.min(e.y0, b.positions[i + 1]!);
      e.y1 = Math.max(e.y1, b.positions[i + 1]!);
    }
  }
  return e;
}

describe('prop art kit', () => {
  it('covers every collider so what the player sees is what the player can grab', async () => {
    const sim = await createSim(makeLevel(DEFAULT_PLACEMENTS));
    for (const biome of ['scrapyard', 'suburbia', 'metropolis', 'playground', 'stratosphere'] as const) {
      for (const prop of sim.physics.props) {
        const parts = buildPropParts(prop, PALETTES[biome], 4);
        const e = extentOf(parts.body, parts.glass, parts.glow);
        const slack = 0.16;
        expect(e.x0, `${prop.kind.id} left edge`).toBeLessThanOrEqual(-prop.width / 2 + slack);
        expect(e.x1, `${prop.kind.id} right edge`).toBeGreaterThanOrEqual(prop.width / 2 - slack);
        expect(e.y0, `${prop.kind.id} bottom edge`).toBeLessThanOrEqual(-prop.height / 2 + slack);
        expect(e.y1, `${prop.kind.id} top edge`).toBeGreaterThanOrEqual(prop.height / 2 - slack);
      }
    }
  });

  it('never dresses a prop far beyond its collider, which would show a ledge that is not there', async () => {
    const sim = await createSim(makeLevel(DEFAULT_PLACEMENTS));
    for (const prop of sim.physics.props) {
      const parts = buildPropParts(prop, PALETTES.suburbia, 4);
      const e = extentOf(parts.body, parts.glass, parts.glow);
      const overW = e.x1 - e.x0 - prop.width;
      const overH = e.y1 - e.y0 - prop.height;
      expect(overW, `${prop.kind.id} width`).toBeLessThanOrEqual(Math.max(0.9, prop.width * 0.35));
      expect(overH, `${prop.kind.id} height`).toBeLessThanOrEqual(Math.max(0.9, prop.height * 0.45));
    }
  });

  it('keeps every prop placed in every shipping level inside the 900 triangle budget', async () => {
    for (const level of ALL_LEVELS) {
      const sim = await createSim(level);
      for (const prop of sim.physics.props) {
        const parts = buildPropParts(prop, PALETTES[level.biome], level.index * 31 + level.biome.length);
        const total = parts.body.triangleCount + parts.glass.triangleCount + parts.rim.triangleCount + parts.glow.triangleCount;
        expect(total, `${level.id} ${prop.kind.id}`).toBeLessThanOrEqual(900);
      }
      sim.dispose();
    }
  });

  it('lights signs, windows, beacons and strobes on the glow channel and nothing else', async () => {
    const sim = await createSim(makeLevel(DEFAULT_PLACEMENTS));
    const lit = new Set([
      'billboard',
      'neon-panel',
      'elevator-cab',
      'facade',
      'fuselage',
      'wing',
      'solar-panel',
      'satellite',
      'radio-dish',
      'antenna-mast',
      'strobe-panel',
    ]);
    for (const prop of sim.physics.props) {
      const parts = buildPropParts(prop, PALETTES.metropolis, 9);
      expect(parts.glow.triangleCount > 0, prop.kind.id).toBe(lit.has(prop.kind.id));
    }
  });

  it('keeps glow geometry bright enough to read as light', async () => {
    const sim = await createSim(makeLevel([{ kind: 'neon-panel', x: 0, y: 2 }]));
    const { glow } = buildPropParts(sim.physics.props[0]!, PALETTES.metropolis, 1);
    const brightest = Math.max(...glow.colors);
    expect(brightest).toBeGreaterThan(0.7);
  });

  it('paints the trampoline in the biome accent so it reads as the bounce surface', () => {
    const hueOf = (c: { getHSL(t: { h: number; s: number; l: number }): unknown }): number => {
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      return hsl.h * 360;
    };
    const suburbia = hueOf(materialColor('trampoline', PALETTES.suburbia, new Rng(1)));
    const playground = hueOf(materialColor('trampoline', PALETTES.playground, new Rng(1)));
    expect(Math.abs(suburbia - PALETTES.suburbia.accent.h)).toBeLessThan(3);
    expect(Math.abs(playground - PALETTES.playground.accent.h)).toBeLessThan(3);
  });
});
