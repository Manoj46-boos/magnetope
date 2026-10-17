import { GHOST_HZ, type GhostTrack } from './ghost';
import type { LevelDef } from './types';

const UNITS_PER_METER = 50;

/** A fall at terminal speed covers about 3.5 m per sample; anything beyond this is a jump cut, not motion. */
const MAX_STEP_METERS = 4.5;
const MAX_CLIMB_SPEED = 30;
const START_TOLERANCE = 3;
const SUMMIT_TOLERANCE = 1.2;
const BOUNDS_MARGIN = 6;
/** A recording ends on a sample boundary or one closing sample after it. */
const DURATION_SLACK_MS = (4 / GHOST_HZ) * 1000;

export type VetFailure = 'level' | 'start' | 'summit' | 'jump' | 'bounds' | 'duration';

export type VetResult = { ok: true } | { ok: false; reason: VetFailure };

/**
 * Decides whether a ghost received from outside could be a real clear of `level`.
 * A ghost carries positions, not inputs, so it cannot be re-simulated; the check
 * instead rules out everything a run cannot be: another level, a start away from
 * the base, an end short of the summit, a teleport between samples, a trip
 * outside the level, or a climb faster than a flip chain allows.
 */
export function vetGhost(track: GhostTrack, level: LevelDef): VetResult {
  if (track.levelId !== level.id) return { ok: false, reason: 'level' };
  const count = track.x.length;
  const at = (i: number) => ({ x: track.x[i]! / UNITS_PER_METER, y: track.y[i]! / UNITS_PER_METER });

  const first = at(0);
  if (Math.hypot(first.x - level.spawn.x, first.y - level.spawn.y) > START_TOLERANCE) return { ok: false, reason: 'start' };
  const last = at(count - 1);
  if (Math.hypot(last.x - level.summit.x, last.y - level.summit.y) > level.summit.radius + SUMMIT_TOLERANCE) {
    return { ok: false, reason: 'summit' };
  }

  const expectedMs = ((count - 1) / GHOST_HZ) * 1000;
  if (Math.abs(track.durationMs - expectedMs) > DURATION_SLACK_MS) return { ok: false, reason: 'duration' };
  const climb = Math.max(0, level.summit.y - level.spawn.y);
  if (track.durationMs / 1000 < climb / MAX_CLIMB_SPEED) return { ok: false, reason: 'duration' };

  for (let i = 0; i < count; i++) {
    const p = at(i);
    if (p.x < level.bounds.minX - BOUNDS_MARGIN || p.x > level.bounds.maxX + BOUNDS_MARGIN) return { ok: false, reason: 'bounds' };
    if (p.y < level.killY || p.y > level.summit.y + BOUNDS_MARGIN * 2) return { ok: false, reason: 'bounds' };
    if (i > 0) {
      const q = at(i - 1);
      if (Math.hypot(p.x - q.x, p.y - q.y) > MAX_STEP_METERS) return { ok: false, reason: 'jump' };
    }
  }
  return { ok: true };
}
