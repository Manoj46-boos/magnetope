import { TAU, smoothstep } from '@/core/mathx';
import type { PropCycle, PropMotion, PropPlacement } from './types';

export interface Pose {
  x: number;
  y: number;
  rot: number;
}

export type CycleState = 'on' | 'warn' | 'off';

const DEFAULT_DWELL = 0.14;
const DEFAULT_WARN_S = 0.7;

/** `point` expressed in the frame of a body sitting at `pose`. */
export function toBodyFrame(pose: Pose, point: { x: number; y: number }): { x: number; y: number } {
  const dx = point.x - pose.x;
  const dy = point.y - pose.y;
  const cos = Math.cos(-pose.rot);
  const sin = Math.sin(-pose.rot);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

const wrap01 = (v: number): number => v - Math.floor(v);

/** Position along a slide, 0 at the placement and 1 at the far end, with a rest at both ends. */
export function slideProgress(timeMs: number, period: number, phase = 0, dwell = DEFAULT_DWELL): number {
  const u = wrap01(timeMs / 1000 / period + phase);
  const travel = 0.5 - dwell;
  if (u < dwell) return 0;
  if (u < 0.5) return smoothstep(0, 1, (u - dwell) / travel);
  if (u < 0.5 + dwell) return 1;
  return 1 - smoothstep(0, 1, (u - 0.5 - dwell) / travel);
}

export const swingAngle = (motion: Extract<PropMotion, { type: 'swing' }>, timeMs: number): number =>
  motion.arc * Math.sin(TAU * (timeMs / 1000 / motion.period + (motion.phase ?? 0)));

/** Total angle a spinning prop has turned through, positive counter-clockwise. */
export const spinAngle = (motion: Extract<PropMotion, { type: 'spin' }>, timeMs: number): number =>
  (motion.reverse ? -TAU : TAU) * (timeMs / 1000 / motion.period + (motion.phase ?? 0));

export const isScripted = (placement: PropPlacement): boolean => placement.motion !== undefined;

/** Where a scripted prop sits at `timeMs`. Props without motion stay on their placement. */
export function poseAt(placement: PropPlacement, timeMs: number): Pose {
  const rot = placement.rot ?? 0;
  const motion = placement.motion;
  if (!motion) return { x: placement.x, y: placement.y, rot };

  if (motion.type === 'slide') {
    const s = slideProgress(timeMs, motion.period, motion.phase, motion.dwell);
    return { x: placement.x + motion.dx * s, y: placement.y + motion.dy * s, rot };
  }

  const angle = motion.type === 'swing' ? swingAngle(motion, timeMs) : spinAngle(motion, timeMs);
  const ox = placement.x - motion.pivot.x;
  const oy = placement.y - motion.pivot.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: motion.pivot.x + ox * cos - oy * sin,
    y: motion.pivot.y + ox * sin + oy * cos,
    rot: motion.type === 'spin' && motion.upright ? rot : rot + angle,
  };
}

/** Linear and angular velocity of a scripted prop over the tick that starts at `timeMs`. */
export function poseVelocity(placement: PropPlacement, timeMs: number, dtMs: number): { vx: number; vy: number; w: number } {
  const a = poseAt(placement, timeMs);
  const b = poseAt(placement, timeMs + dtMs);
  const dt = dtMs / 1000;
  return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt, w: (b.rot - a.rot) / dt };
}

/** Whether a cycling surface is solid, about to vanish, or gone. */
export function cycleState(cycle: PropCycle, timeMs: number): CycleState {
  const u = wrap01(timeMs / 1000 / cycle.period + (cycle.phase ?? 0));
  if (u >= cycle.on) return 'off';
  const warnShare = (cycle.warn ?? DEFAULT_WARN_S) / cycle.period;
  return u >= cycle.on - warnShare ? 'warn' : 'on';
}
