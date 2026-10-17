import { TUNING } from '@/config/tuning';
import { DEG, hypot2, type Vec2 } from '@/core/mathx';
import type { MagnoView } from '@/sim/magno';
import type { SnapCandidate } from '@/sim/world';

/**
 * Where MAGNO's hands are headed before a contact (PRD 7.4). Two anticipations:
 *
 *   brace     - 150 ms before a predicted landing the hands come up to take it
 *   grab-seek - on the approach to a steel face inside a 30 degree cone, the hands reach for it
 *
 * Both read the physics world, so the pose is decided by what is really ahead, and both are pure
 * functions of the view and a terrain query so they can be tested without a renderer.
 */

export const BRACE_LEAD_S = 0.15;
export const GRAB_CONE_DEG = 30;
/** Hands only reach for a face this close; further out the head's gaze does the leading. */
export const GRAB_REACH_M = 1.9;

const MIN_BRACE_SPEED = 4;
const MIN_GRAB_SPEED = 1.5;
const BRACE_RANGE_PAD = 0.05;

export interface Terrain {
  castDistance(from: Vec2, dir: Vec2, maxDist: number): number;
  snapCandidates(center: Vec2, exclude: ReadonlySet<number>): SnapCandidate[];
}

const NO_EXCLUDED: ReadonlySet<number> = new Set();

/** 1 while a surface lies within `BRACE_LEAD_S` of travel ahead of a falling body, otherwise 0. */
export function braceAmount(view: MagnoView, terrain: Terrain): number {
  if (view.attachNormal || view.limp || view.velocity.y > -MIN_BRACE_SPEED) return 0;
  const speed = hypot2(view.velocity.x, view.velocity.y);
  const reach = TUNING.body.radius + speed * BRACE_LEAD_S + BRACE_RANGE_PAD;
  return Number.isFinite(terrain.castDistance(view.position, view.velocity, reach)) ? 1 : 0;
}

/**
 * The point on a steel face the hands should reach for, or null. The face has to lie within
 * `GRAB_CONE_DEG` of the direction of travel and within `GRAB_REACH_M`; the closest such point wins.
 */
export function grabPoint(view: MagnoView, terrain: Terrain, out: Vec2): Vec2 | null {
  if (view.attachNormal || view.limp || view.polarity !== 'attract' || view.state !== 'airborne') return null;
  const speed = hypot2(view.velocity.x, view.velocity.y);
  if (speed < MIN_GRAB_SPEED) return null;
  const heading = { x: view.velocity.x / speed, y: view.velocity.y / speed };
  const cosCone = Math.cos(GRAB_CONE_DEG * DEG);

  let best = Infinity;
  for (const c of terrain.snapCandidates(view.position, NO_EXCLUDED)) {
    if (c.distance > GRAB_REACH_M || c.distance < 1e-3) continue;
    const toward = ((c.point.x - view.position.x) * heading.x + (c.point.y - view.position.y) * heading.y) / c.distance;
    if (toward < cosCone || c.distance >= best) continue;
    best = c.distance;
    out.x = c.point.x;
    out.y = c.point.y;
  }
  return Number.isFinite(best) ? out : null;
}
