import { BufferAttribute, BufferGeometry, Color, Mesh, MeshBasicMaterial } from 'three';
import { Rng } from '@/core/rng';
import { clamp, lerp, smoothstep, type Vec2 } from '@/core/mathx';
import type { BiomeId, LevelDef } from '@/sim/types';
import { PALETTES, mixHsl, toColor } from './palette';

/** Climb order from the foot of the mountain to the peak. */
export const CLIMB_ORDER: readonly BiomeId[] = ['scrapyard', 'suburbia', 'metropolis', 'playground', 'stratosphere'];

const ROW_METERS = 3;
const EDGE_SWING = 0.075;
const EDGE_GRAIN = 0.012;
const SWING_ROWS = 7;
const TERRACE_METERS = 5;
const TERRACE_WIDTH = 0.04;
const BLEND_METERS = 9;
const WIDTH_TO_HEIGHT = 0.62;
/** The cinematic bars cover about a fifth of the height, so the mountain is framed with room above and below. */
const FRAME_MARGIN_Y = 1.4;
const FRAME_MARGIN_X = 1.14;

export interface MountainBand {
  biome: BiomeId;
  bottom: number;
  top: number;
}

export interface MountainRow {
  y: number;
  left: number;
  right: number;
}

export interface MountainLayout {
  bands: MountainBand[];
  baseY: number;
  peakY: number;
  halfWidth: number;
  rows: MountainRow[];
}

/**
 * Stacks the biomes into one mountain. The Stratosphere keeps the coordinates of
 * its own levels, so the climb the player just finished is the top band; the
 * other four sit below it, each as tall as its tallest level.
 */
export function mountainBands(levels: readonly LevelDef[]): MountainBand[] {
  const heights = new Map<BiomeId, number>();
  for (const level of levels) heights.set(level.biome, Math.max(heights.get(level.biome) ?? 0, level.summit.y));
  const finale = levels.find((l) => l.finale);
  if (finale) heights.set(finale.biome, finale.summit.y);
  const bands: MountainBand[] = [];
  let cursor = 0;
  for (const biome of [...CLIMB_ORDER].reverse()) {
    const height = heights.get(biome) ?? 0;
    if (biome === 'stratosphere') {
      bands.push({ biome, bottom: 0, top: height });
      continue;
    }
    bands.push({ biome, bottom: cursor - height, top: cursor });
    cursor -= height;
  }
  return bands.sort((a, b) => a.bottom - b.bottom);
}

export function mountainLayout(levels: readonly LevelDef[], seed = 11): MountainLayout {
  const bands = mountainBands(levels);
  const baseY = bands[0]!.bottom;
  const peakY = bands[bands.length - 1]!.top;
  const height = peakY - baseY;
  const halfWidth = height * WIDTH_TO_HEIGHT;
  const rng = new Rng(seed);
  const edges = bands.slice(1).map((b) => b.bottom);
  const count = Math.ceil(height / ROW_METERS);
  const swing = (): number[] => Array.from({ length: Math.ceil(count / SWING_ROWS) + 2 }, () => rng.next() * 2 - 1);
  const swings = { left: swing(), right: swing() };
  const sway = (knots: number[], i: number): number => {
    const at = i / SWING_ROWS;
    const k = Math.floor(at);
    return lerp(knots[k]!, knots[k + 1]!, smoothstep(0, 1, at - k)) * EDGE_SWING + (rng.next() * 2 - 1) * EDGE_GRAIN;
  };

  const rows: MountainRow[] = [];
  for (let i = 0; i <= count; i++) {
    const y = Math.min(peakY, baseY + i * ROW_METERS);
    const u = (y - baseY) / height;
    const terrace = edges.reduce((sum, edge) => sum + Math.exp(-(((y - edge) / TERRACE_METERS) ** 2)), 0);
    const reach = halfWidth * ((1 - u) ** 0.9 + TERRACE_WIDTH * terrace * (1 - u));
    const atPeak = i === count;
    rows.push({ y, left: atPeak ? 0 : -reach * (1 + sway(swings.left, i)), right: atPeak ? 0 : reach * (1 + sway(swings.right, i)) });
  }
  return { bands, baseY, peakY, halfWidth, rows };
}

/** Colour of the mountain at a height: each band takes its biome's hue, darker toward the foot and lit from the peak. */
export function mountainColor(layout: MountainLayout, y: number, haze: number, out = new Color()): Color {
  const night = toColor(PALETTES.stratosphere.skyHorizon);
  const bandAt = (height: number): MountainBand => layout.bands.find((b) => height < b.top) ?? layout.bands[layout.bands.length - 1]!;
  const tint = (band: MountainBand, height: number): Color => {
    const p = PALETTES[band.biome];
    const local = clamp((height - band.bottom) / Math.max(1, band.top - band.bottom), 0, 1);
    const overall = clamp((height - layout.baseY) / Math.max(1, layout.peakY - layout.baseY), 0, 1);
    const base = mixHsl(p.dominant, p.fog, 0.3);
    const lightness = clamp(base.l * lerp(0.34, 0.5, local) * lerp(0.7, 1.15, overall), 12, 52);
    return toColor({ h: base.h, s: base.s * 0.72, l: lightness }).lerp(night, haze);
  };

  const band = bandAt(y);
  const colour = tint(band, y);
  const below = layout.bands[layout.bands.indexOf(band) - 1];
  if (below) {
    const mix = 1 - smoothstep(band.bottom, band.bottom + BLEND_METERS, y);
    if (mix > 0) colour.lerp(tint(below, y), mix * 0.5);
  }
  return out.copy(colour);
}

/** A flat, faceted slab of the mountain in the XY plane, vertex-coloured by band. */
export function mountainGeometry(layout: MountainLayout, haze: number, scale = 1): BufferGeometry {
  const { rows } = layout;
  const positions = new Float32Array(rows.length * 2 * 3);
  const colors = new Float32Array(rows.length * 2 * 3);
  const tmp = new Color();
  rows.forEach((row, i) => {
    mountainColor(layout, row.y, haze, tmp);
    for (let side = 0; side < 2; side++) {
      const at = (i * 2 + side) * 3;
      positions[at] = (side === 0 ? row.left : row.right) * scale;
      positions[at + 1] = row.y;
      positions[at + 2] = 0;
      colors[at] = tmp.r;
      colors[at + 1] = tmp.g;
      colors[at + 2] = tmp.b;
    }
  });
  const index: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setIndex(index);
  return geometry;
}

export interface Framing {
  center: Vec2;
  visibleHeight: number;
  /** Camera roll in degrees; the follow shot never rolls, a poster may. */
  rollDeg?: number;
}

/**
 * Where the camera looks as the film pulls back. `pull` 0 is the follow shot on
 * MAGNO; at 1 the whole mountain, with a margin, sits inside the frame at any aspect ratio.
 */
export function pullbackFraming(pull: number, from: Vec2, fromVisibleHeight: number, layout: MountainLayout, aspect: number): Framing {
  const height = layout.peakY - layout.baseY;
  const fit = Math.max(height * FRAME_MARGIN_Y, (layout.halfWidth * 2 * FRAME_MARGIN_X) / Math.max(0.1, aspect));
  const end: Vec2 = { x: 0, y: layout.baseY + height * 0.52 };
  const zoom = clamp(pull, 0, 1);
  const travel = zoom ** 3;
  return {
    center: { x: lerp(from.x, end.x, travel), y: lerp(from.y, end.y, travel) },
    visibleHeight: fromVisibleHeight * (fit / fromVisibleHeight) ** zoom,
  };
}

/** The mountain as scenery: a pale far ridge behind a darker near one, both drawn without fog. */
export class MountainSilhouette {
  readonly layers: Mesh[];
  private readonly materials: MeshBasicMaterial[];

  constructor(readonly layout: MountainLayout, depth: number) {
    const specs = [
      { haze: 0.55, scale: 1.16, z: depth - 26, lift: 0.04 },
      { haze: 0.2, scale: 1, z: depth, lift: 0 },
    ];
    this.materials = specs.map(() => new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.layers = specs.map((spec, i) => {
      const mesh = new Mesh(mountainGeometry(layout, spec.haze, spec.scale), this.materials[i]);
      mesh.position.set(0, spec.lift * (layout.peakY - layout.baseY), spec.z);
      mesh.renderOrder = -6 + i;
      mesh.frustumCulled = false;
      mesh.visible = false;
      return mesh;
    });
  }

  setOpacity(amount: number): void {
    const opacity = clamp(amount, 0, 1);
    this.materials.forEach((m, i) => (m.opacity = opacity * (i === 0 ? 0.85 : 1)));
    for (const layer of this.layers) layer.visible = opacity > 0.001;
  }

  dispose(): void {
    for (const layer of this.layers) layer.geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
