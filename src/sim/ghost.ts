import { clamp, lerp, type Vec2 } from '@/core/mathx';

/** Ghosts are sampled at 20 Hz and quantised to 2 cm, which keeps a full run under a few kilobytes. */
export const GHOST_HZ = 20;
export const GHOST_TICKS_PER_SAMPLE = 3;
const UNITS_PER_METER = 50;
export const MAX_GHOST_SAMPLES = GHOST_HZ * 600;
const SAMPLE_MS = 1000 / GHOST_HZ;

export interface GhostTrack {
  version: 1;
  levelId: string;
  durationMs: number;
  /** Quantised positions, 1/50 m. */
  x: number[];
  y: number[];
}

export type GhostKind = 'par' | 'personal';

/** Collects MAGNO's position once per sample interval while a run is live. */
export class GhostRecorder {
  private readonly x: number[] = [];
  private readonly y: number[] = [];
  private ticks = 0;

  get sampleCount(): number {
    return this.x.length;
  }

  push(position: Vec2): void {
    if (this.ticks % GHOST_TICKS_PER_SAMPLE === 0 && this.x.length < MAX_GHOST_SAMPLES) {
      this.x.push(Math.round(position.x * UNITS_PER_METER));
      this.y.push(Math.round(position.y * UNITS_PER_METER));
    }
    this.ticks++;
  }

  finish(levelId: string, durationMs: number, final: Vec2): GhostTrack {
    const x = [...this.x];
    const y = [...this.y];
    const lastSampleMs = (x.length - 1) * SAMPLE_MS;
    if (durationMs > lastSampleMs + 1) {
      x.push(Math.round(final.x * UNITS_PER_METER));
      y.push(Math.round(final.y * UNITS_PER_METER));
    }
    return { version: 1, levelId, durationMs: Math.round(durationMs), x, y };
  }
}

export interface GhostPose {
  x: number;
  y: number;
  /** True once the ghost has reached the end of its recording. */
  finished: boolean;
}

/** Position of the ghost `timeMs` after the run began, linearly interpolated between samples. */
export function sampleGhost(track: GhostTrack, timeMs: number): GhostPose {
  const last = track.x.length - 1;
  if (last < 0) return { x: 0, y: 0, finished: true };
  const at = clamp(timeMs, 0, Number.MAX_SAFE_INTEGER) / SAMPLE_MS;
  if (at >= last) return { x: track.x[last]! / UNITS_PER_METER, y: track.y[last]! / UNITS_PER_METER, finished: true };
  const i = Math.floor(at);
  const f = at - i;
  return {
    x: lerp(track.x[i]!, track.x[i + 1]!, f) / UNITS_PER_METER,
    y: lerp(track.y[i]!, track.y[i + 1]!, f) / UNITS_PER_METER,
    finished: false,
  };
}

const deltas = (values: number[]): number[] => values.map((v, i) => (i === 0 ? v : v - values[i - 1]!));
const integrate = (values: number[]): number[] => {
  let acc = 0;
  return values.map((d) => (acc += d));
};

export function encodeGhost(track: GhostTrack): string {
  return JSON.stringify({ v: track.version, l: track.levelId, d: track.durationMs, x: deltas(track.x), y: deltas(track.y) });
}

const isIntArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length <= MAX_GHOST_SAMPLES && value.every((n) => Number.isInteger(n) && Math.abs(n as number) < 100_000);

/** Parses a stored ghost. Anything malformed or for a different level is rejected rather than trusted. */
export function decodeGhost(json: string, levelId?: string): GhostTrack | null {
  try {
    const raw = JSON.parse(json) as { v?: unknown; l?: unknown; d?: unknown; x?: unknown; y?: unknown };
    if (raw.v !== 1 || typeof raw.l !== 'string' || typeof raw.d !== 'number' || !Number.isFinite(raw.d)) return null;
    if (levelId !== undefined && raw.l !== levelId) return null;
    if (!isIntArray(raw.x) || !isIntArray(raw.y) || raw.x.length !== raw.y.length || raw.x.length < 2) return null;
    if (raw.d < 0 || raw.d > 3_600_000) return null;
    return { version: 1, levelId: raw.l, durationMs: raw.d, x: integrate(raw.x), y: integrate(raw.y) };
  } catch {
    return null;
  }
}

/**
 * Direction of travel the ghost takes from wherever `from` is on its route: the
 * next point on the track that lies at least `minDistance` away from the
 * nearest sample. The tutorial hand follows it to show the first hop.
 */
export function guideDirection(track: GhostTrack, from: Vec2, minDistance = 2.5): Vec2 | null {
  let nearest = -1;
  let best = Infinity;
  for (let i = 0; i < track.x.length; i++) {
    const d = Math.hypot(track.x[i]! / UNITS_PER_METER - from.x, track.y[i]! / UNITS_PER_METER - from.y);
    if (d < best) {
      best = d;
      nearest = i;
    }
  }
  if (nearest < 0) return null;
  for (let j = nearest; j < track.x.length; j++) {
    const dx = track.x[j]! / UNITS_PER_METER - from.x;
    const dy = track.y[j]! / UNITS_PER_METER - from.y;
    const d = Math.hypot(dx, dy);
    if (d >= minDistance) return { x: dx / d, y: dy / d };
  }
  return null;
}
