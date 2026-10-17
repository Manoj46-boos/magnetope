import { MATERIALS } from '@/config/materials';
import { propKind } from '@/config/props';
import type { Vec2 } from '@/core/mathx';
import type { LevelDef } from '@/sim/types';
import type { Cluster } from './cluster';

const MARGIN_M = 3;
const SCALE = 14;
const CELL = 2;

const FILL = { ferro: '#7d8a98', weak: '#a38d74', inert: '#bdb6a8' } as const;

interface HeatmapInput {
  level: LevelDef;
  falls: readonly Vec2[];
  hotspots: readonly Cluster[];
  quitPoints?: readonly Cluster[];
}

const fixed = (n: number): string => n.toFixed(1);

/** Side-on layout of a level with fall density painted over it, as a standalone SVG. */
export function renderHeatmap({ level, falls, hotspots, quitPoints = [] }: HeatmapInput): string {
  const shapes = level.props.map((placement) => {
    const kind = propKind(placement.kind);
    const disc = kind.shape.type === 'disc' && placement.w === undefined;
    const w = placement.w ?? (kind.shape.type === 'box' ? kind.shape.w : kind.shape.r * 2);
    const h = placement.h ?? (kind.shape.type === 'box' ? kind.shape.h : kind.shape.r * 2);
    const radius = placement.r ?? (kind.shape.type === 'disc' ? kind.shape.r : 0);
    const material = placement.material ?? kind.material;
    const tone = FILL[MATERIALS[material].magnetic];
    return { placement, disc, w, h, radius, tone };
  });

  const minX = Math.min(level.bounds.minX, ...shapes.map((s) => s.placement.x - s.w / 2)) - MARGIN_M;
  const maxX = Math.max(level.bounds.maxX, ...shapes.map((s) => s.placement.x + s.w / 2)) + MARGIN_M;
  const minY = Math.min(level.spawn.y, ...falls.map((f) => f.y), ...shapes.map((s) => s.placement.y - s.h / 2)) - MARGIN_M;
  const maxY = Math.max(level.summit.y + level.summit.radius, ...shapes.map((s) => s.placement.y + s.h / 2)) + MARGIN_M;
  const tx = (x: number): number => (x - minX) * SCALE;
  const ty = (y: number): number => (maxY - y) * SCALE;
  const width = (maxX - minX) * SCALE;
  const height = (maxY - minY) * SCALE;

  const density = new Map<string, number>();
  for (const fall of falls) {
    const key = `${Math.floor(fall.x / CELL)}:${Math.floor(fall.y / CELL)}`;
    density.set(key, (density.get(key) ?? 0) + 1);
  }
  const peak = Math.max(1, ...density.values());

  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" width="${width.toFixed(0)}" height="${height.toFixed(0)}" role="img" aria-label="Fall heatmap for ${level.name}">`,
    '<rect width="100%" height="100%" fill="#151a22"/>',
  ];

  for (const { placement, disc, w, h, radius, tone } of shapes) {
    const at = `translate(${fixed(tx(placement.x))} ${fixed(ty(placement.y))}) rotate(${fixed((-(placement.rot ?? 0) * 180) / Math.PI)})`;
    out.push(
      disc
        ? `<circle transform="${at}" r="${fixed(radius * SCALE)}" fill="${tone}" opacity="0.55"/>`
        : `<rect transform="${at}" x="${fixed(-(w * SCALE) / 2)}" y="${fixed(-(h * SCALE) / 2)}" width="${fixed(w * SCALE)}" height="${fixed(h * SCALE)}" fill="${tone}" opacity="0.55"/>`,
    );
  }

  for (const [key, count] of density) {
    const [cx, cy] = key.split(':').map(Number) as [number, number];
    const heat = count / peak;
    out.push(
      `<rect x="${fixed(tx(cx * CELL))}" y="${fixed(ty((cy + 1) * CELL))}" width="${CELL * SCALE}" height="${CELL * SCALE}" fill="hsl(${(8 + (1 - heat) * 40).toFixed(0)} 95% 55%)" opacity="${(0.25 + heat * 0.6).toFixed(2)}"/>`,
    );
  }

  out.push(`<circle cx="${fixed(tx(level.spawn.x))}" cy="${fixed(ty(level.spawn.y))}" r="6" fill="#5fd4ff"/>`);
  out.push(`<circle cx="${fixed(tx(level.summit.x))}" cy="${fixed(ty(level.summit.y))}" r="${fixed(level.summit.radius * SCALE)}" fill="none" stroke="#ffd25a" stroke-width="3"/>`);
  for (const c of level.checkpoints) out.push(`<path d="M${fixed(tx(c.x))} ${fixed(ty(c.y))}v-18l12 5-12 5" fill="none" stroke="#8fe388" stroke-width="2"/>`);

  hotspots.forEach((spot, index) => {
    const r = Math.max(10, spot.spread * SCALE + 8);
    const x = fixed(tx(spot.center.x));
    out.push(
      `<g data-hotspot="${index + 1}"><circle cx="${x}" cy="${fixed(ty(spot.center.y))}" r="${fixed(r)}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="5 4"/>` +
        `<text x="${x}" y="${fixed(ty(spot.center.y) - r - 4)}" fill="#fff" font-size="13" font-family="sans-serif" text-anchor="middle">${(spot.share * 100).toFixed(0)}%</text></g>`,
    );
  });
  quitPoints.forEach((spot, index) => {
    const x = tx(spot.center.x);
    const y = ty(spot.center.y);
    out.push(`<path data-quit="${index + 1}" d="M${fixed(x - 7)} ${fixed(y - 7)}l14 14m0-14l-14 14" stroke="#ff6b5e" stroke-width="3"/>`);
  });
  out.push('</svg>');
  return out.join('\n');
}
