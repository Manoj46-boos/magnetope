import { smoothstep } from '@/core/mathx';
import type { LevelDef } from './types';

/** How far above `fromY` the wind takes to reach full strength, so crossing the shelter line is not a cliff. */
const SHELTER_BLEND_M = 3;

/** Notice the ear gets before a gust arrives (PRD 9.5). */
export const GUST_LEAD_MS = 450;

/**
 * Wind is a pure function of simulation time so the physical push, the audio
 * gust and any replay all agree on the same value.
 */
export function windAcceleration(level: LevelDef, timeMs: number, altitude = Infinity): number {
  const wind = level.wind;
  if (!wind) return 0;
  const phase = (timeMs / 1000 / wind.gustPeriod) * Math.PI * 2;
  const gust = Math.max(0, Math.sin(phase)) ** 2;
  const exposure = wind.fromY === undefined ? 1 : smoothstep(wind.fromY, wind.fromY + SHELTER_BLEND_M, altitude);
  return wind.strength * gust * exposure;
}

/** Gust share, 0..1, as it will be `GUST_LEAD_MS` from now. Audio follows this, physics follows the present. */
export function gustForecast(level: LevelDef, timeMs: number, altitude = Infinity): number {
  const wind = level.wind;
  if (!wind || wind.strength === 0) return 0;
  return Math.abs(windAcceleration(level, timeMs + GUST_LEAD_MS, altitude)) / Math.abs(wind.strength);
}
