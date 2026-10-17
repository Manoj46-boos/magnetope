import { Color } from 'three';
import type { Rng } from '@/core/rng';
import { GeometryBuilder } from './geometry';
import type { BiomePalette } from './palette';

/** Visual depth of every prop along Z; physics colliders are thicker than this. */
export const PROP_DEPTH = 1.4;
export const HALF_D = PROP_DEPTH / 2;

export interface PropParts {
  body: GeometryBuilder;
  /** Translucent geometry such as glass panes. */
  glass: GeometryBuilder;
  /** Cyan edge strips that mark grabbable metal. */
  rim: GeometryBuilder;
  /** Self-lit geometry: neon tubes and lit windows. Drawn unshaded so it reads at night. */
  glow: GeometryBuilder;
}

export const newParts = (): PropParts => ({
  body: new GeometryBuilder(),
  glass: new GeometryBuilder(),
  rim: new GeometryBuilder(),
  glow: new GeometryBuilder(),
});

/** Everything a kit builder needs to dress one prop. Builders draw in local space, centred on the body origin. */
export interface KitArgs {
  parts: PropParts;
  w: number;
  h: number;
  base: Color;
  rng: Rng;
  palette: BiomePalette;
}

export type KitBuilder = (args: KitArgs) => void;

/** A row of round bolt heads along a seam, from `x0` to `x1` at height `y` on the face at depth `z`. */
export function boltRow(b: GeometryBuilder, x0: number, x1: number, y: number, z: number, color: Color, spacing = 0.6, radius = 0.045): void {
  const head = [color.r, color.g, color.b] as const;
  for (let x = x0; x <= x1 + 1e-6; x += spacing) b.disc(x, y, z, radius, 0.03, 6, head);
}

export const hsl = (h: number, s: number, l: number): Color => new Color().setHSL((((h % 360) + 360) % 360) / 360, s, l);
export const darker = (c: Color, k: number): Color => c.clone().multiplyScalar(k);
export const lighter = (c: Color, k: number): Color => c.clone().lerp(new Color(1, 1, 1), k);
