import type { TelemetryRecord } from '@/platform/telemetry';

/**
 * Reads the stream the game flushes. The channel's own law — letters, digits,
 * `_ : . + |` and spaces, at most two runs of digits across a record — means
 * every payload is an enumerated word or one bare number, never a key=value
 * pair and never a coordinate. Records arrive in the order they happened, so
 * the stars, time and fall-count records belong to the attempt record that
 * opened their level. Anything unrecognised is skipped: the dashboard also
 * carries the SDK's own events.
 */

export type Outcome = 'clear' | 'restart' | 'leave';

/** One fall, the way the channel can carry it: a whole-metre height and its grade. */
export interface FallEvent {
  levelId: string;
  heightM: number;
  grade: string;
}

export interface AttemptEvent {
  levelId: string;
  outcome: Outcome;
  /** The clear time in seconds, when the attempt cleared; null otherwise. */
  runSeconds: number | null;
  stars: number;
  falls: number;
}

export interface ParsedTelemetry {
  falls: FallEvent[];
  attempts: AttemptEvent[];
  entries: Map<string, number>;
  retryLatenciesMs: Map<string, number[]>;
  sessionSeconds: number[];
}

const number = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isOutcome = (action: string): action is Outcome => action === 'clear' || action === 'restart' || action === 'leave';

export function parseTelemetry(records: readonly TelemetryRecord[]): ParsedTelemetry {
  const parsed: ParsedTelemetry = { falls: [], attempts: [], entries: new Map(), retryLatenciesMs: new Map(), sessionSeconds: [] };
  let open: AttemptEvent | null = null;

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
      const height = /^h-(\d+) g-([A-Z]+)$/.exec(action);
      if (!height) continue;
      parsed.falls.push({ levelId: what, heightM: Number(height[1]), grade: height[2]! });
    } else if (category === 'attempt') {
      if (!isOutcome(action)) continue;
      open = { levelId: what, outcome: action, runSeconds: null, stars: 0, falls: 0 };
      parsed.attempts.push(open);
    } else if (open && open.levelId === what) {
      if (category === 'stars') open.stars = number(action);
      else if (category === 'time') open.runSeconds = number(action);
      else if (category === 'fallcount') open.falls = number(action);
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
