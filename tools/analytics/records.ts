import { CELL_SIZE, type TelemetryRecord } from '@/platform/telemetry';
import type { Vec2 } from '@/core/mathx';

export type Outcome = 'clear' | 'restart' | 'leave';

export interface FallEvent {
  levelId: string;
  heightM: number;
  at: Vec2;
  grade: string;
}

export interface AttemptEvent {
  levelId: string;
  outcome: Outcome;
  runMs: number;
  stars: number;
  sticks: number;
  flips: number;
  snaps: number;
  falls: number;
  /** The last fall before this attempt ended, which is where a quitting player was last seen failing. */
  lastFall: FallEvent | null;
}

export interface ParsedTelemetry {
  falls: FallEvent[];
  attempts: AttemptEvent[];
  entries: Map<string, number>;
  retryLatenciesMs: Map<string, number[]>;
  sessionSeconds: number[];
}

/** The middle of a 2 m telemetry cell, or null for a malformed cell. */
export function cellCenter(cell: string): Vec2 | null {
  const parts = cell.split(':');
  if (parts.length !== 2) return null;
  const [cx, cy] = parts.map(Number);
  if (!Number.isInteger(cx) || !Number.isInteger(cy)) return null;
  return { x: (cx! + 0.5) * CELL_SIZE, y: (cy! + 0.5) * CELL_SIZE };
}

function fields(action: string): Map<string, string> {
  return new Map(
    action.split(';').flatMap((part) => {
      const at = part.indexOf('=');
      return at > 0 ? [[part.slice(0, at), part.slice(at + 1)] as const] : [];
    }),
  );
}

const number = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Reads the stream the game flushes. Records arrive in the order they happened, so
 * a fall belongs to the attempt record that follows it. Anything unrecognised is skipped:
 * the dashboard also carries the SDK's own events.
 */
export function parseTelemetry(records: readonly TelemetryRecord[]): ParsedTelemetry {
  const parsed: ParsedTelemetry = { falls: [], attempts: [], entries: new Map(), retryLatenciesMs: new Map(), sessionSeconds: [] };
  const lastFall = new Map<string, FallEvent>();

  for (const { category, what, action } of records) {
    if (category === 'level' && action === 'enter') {
      parsed.entries.set(what, (parsed.entries.get(what) ?? 0) + 1);
    } else if (category === 'retry') {
      const list = parsed.retryLatenciesMs.get(what) ?? [];
      list.push(number(action));
      parsed.retryLatenciesMs.set(what, list);
    } else if (category === 'session' && what === 'length') {
      parsed.sessionSeconds.push(number(action));
    } else if (category === 'fall') {
      const f = fields(action);
      const at = cellCenter(f.get('c') ?? '');
      if (!at) continue;
      const fall: FallEvent = { levelId: what, heightM: number(f.get('h')), at, grade: f.get('g') ?? '' };
      parsed.falls.push(fall);
      lastFall.set(what, fall);
    } else if (category === 'attempt') {
      const f = fields(action);
      const outcome = f.get('o');
      if (outcome !== 'clear' && outcome !== 'restart' && outcome !== 'leave') continue;
      const falls = number(f.get('fall'));
      parsed.attempts.push({
        levelId: what,
        outcome,
        runMs: number(f.get('ms')),
        stars: number(f.get('st')),
        sticks: number(f.get('stick')),
        flips: number(f.get('flip')),
        snaps: number(f.get('snap')),
        falls,
        lastFall: falls > 0 ? (lastFall.get(what) ?? null) : null,
      });
      lastFall.delete(what);
    }
  }
  return parsed;
}

/** Accepts the dashboard export: one JSON record per line, or whole batches as arrays. */
export function readJsonLines(text: string): TelemetryRecord[] {
  const out: TelemetryRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch {
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item && typeof item === 'object' && 'category' in item && 'what' in item && 'action' in item) out.push(item as TelemetryRecord);
    }
  }
  return out;
}
