import { describe, expect, it } from 'vitest';
import { MATERIALS } from '@/config/materials';
import { propKind } from '@/config/props';
import { ALL_LEVELS, levelById } from '@/levels';
import type { PropPlacement } from '@/sim/types';

const magnetic = (p: PropPlacement): boolean => MATERIALS[p.material ?? propKind(p.kind).material].magnetic !== 'inert';

/** Distance from a point to the nearest edge of an axis-aligned prop; zero inside it. */
function distanceTo(p: PropPlacement, x: number, y: number): number {
  const kind = propKind(p.kind);
  const w = kind.shape.type === 'box' ? (p.w ?? kind.shape.w) : (p.r ?? kind.shape.r) * 2;
  const h = kind.shape.type === 'box' ? (p.h ?? kind.shape.h) : w;
  return Math.hypot(Math.max(Math.abs(x - p.x) - w / 2, 0), Math.max(Math.abs(y - p.y) - h / 2, 0));
}

describe('the first level teaches the magnet, not a grip', () => {
  const level = levelById('scrapyard-00');

  it('marks the first places to stick with field beacons, each on real steel', () => {
    expect(level.guides?.length).toBeGreaterThanOrEqual(3);
    for (const guide of level.guides!) {
      const nearest = Math.min(...level.props.filter(magnetic).map((p) => distanceTo(p, guide.x, guide.y)));
      expect(nearest, `guide at (${guide.x}, ${guide.y})`).toBeLessThan(1.2);
    }
  });

  it('outlines no prop as a handle', () => {
    expect(level.props.filter((p) => p.glow)).toEqual([]);
  });

  it('puts no beacon on a wooden or plastic surface, where nothing sticks', () => {
    for (const l of ALL_LEVELS) {
      for (const guide of l.guides ?? []) {
        const nearestInert = Math.min(...l.props.filter((p) => !magnetic(p)).map((p) => distanceTo(p, guide.x, guide.y)));
        const nearestSteel = Math.min(...l.props.filter(magnetic).map((p) => distanceTo(p, guide.x, guide.y)));
        expect(nearestSteel, `${l.id} guide at (${guide.x}, ${guide.y})`).toBeLessThanOrEqual(nearestInert);
      }
    }
  });
});
