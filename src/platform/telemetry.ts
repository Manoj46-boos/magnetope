import type { Vec2 } from '@/core/mathx';

/**
 * Anonymous gameplay telemetry (PRD 11.3). Events are plain strings in the shape
 * of Poki's `measure(category, what, action)` channel, so nothing identifying and
 * nothing outside the first-party SDK is involved. They are batched in memory and
 * flushed only at natural stops: never mid-run, never during an ad.
 *
 * The channel carries its own law, read straight off the platform's validator:
 * the three arguments may use letters, digits, `_ : . + |` and the space, and
 * together may hold at most two runs of digits. So the grammar below speaks in
 * enumerated words and single numbers — no key=value pairs, no coordinate pairs,
 * one fact per record.
 */
export interface TelemetryRecord {
  category: string;
  what: string;
  action: string;
}

export interface TelemetryOptions {
  send: (batch: TelemetryRecord[]) => void;
  /** False while a run is live or an ad is showing. */
  canFlush: () => boolean;
  now?: () => number;
  maxQueue?: number;
}

/** The queue's own cap: the oldest records drop first, never the newest. */
export const MAX_QUEUE = 200;

export class Telemetry {
  private queue: TelemetryRecord[] = [];
  private readonly now: () => number;
  private readonly maxQueue: number;
  private readonly startedAt: number;

  constructor(private readonly options: TelemetryOptions) {
    this.now = options.now ?? Date.now;
    this.maxQueue = options.maxQueue ?? MAX_QUEUE;
    this.startedAt = this.now();
  }

  get pending(): number {
    return this.queue.length;
  }

  /** The queue's own age: the boot-to-first-touch distance the funnel reads (R-AN-06). */
  get ageMs(): number {
    return this.now() - this.startedAt;
  }

  record(category: string, what: string, action: string): void {
    this.queue.push({ category, what, action });
    if (this.queue.length > this.maxQueue) this.queue.splice(0, this.queue.length - this.maxQueue);
  }

  /** Sends the queue if the game is at a natural stop. Returns whether anything was sent. */
  flush(): boolean {
    if (this.queue.length === 0 || !this.options.canFlush()) return false;
    const batch = [...this.queue, { category: 'session', what: 'length', action: String(Math.round((this.now() - this.startedAt) / 1000)) }];
    this.queue = [];
    try {
      this.options.send(batch);
    } catch {
      /* Telemetry must never disturb play. */
    }
    return true;
  }
}

export type AttemptOutcome = 'clear' | 'restart' | 'leave';

/**
 * Counts what the player did during one attempt at a level and reports it as a
 * few compact records, each one inside the channel's alphabet and its two-number
 * budget: the outcome as a word, the stars and the clear time and the fall count
 * as bare numbers on their own records, each fall as a whole-metre height with
 * its grade.
 */
export class AttemptRecorder {
  private levelId = '';
  private falls = 0;
  private open = false;
  private lastFallAt = -1;
  private retryLatencyMs = -1;

  constructor(
    private readonly telemetry: Telemetry,
    private readonly now: () => number = Date.now,
  ) {}

  begin(levelId: string): void {
    this.levelId = levelId;
    this.falls = 0;
    this.open = true;
    this.retryLatencyMs = this.lastFallAt >= 0 ? this.now() - this.lastFallAt : -1;
    this.lastFallAt = -1;
    this.telemetry.record('level', levelId, 'enter');
    if (this.retryLatencyMs >= 0) this.telemetry.record('retry', levelId, String(Math.round(this.retryLatencyMs)));
  }

  fall(heightMeters: number, _at: Vec2, grade: string): void {
    this.falls++;
    this.lastFallAt = this.now();
    this.telemetry.record('fall', this.levelId, `h-${Math.max(0, Math.round(heightMeters))} g-${grade}`);
  }

  finish(outcome: AttemptOutcome, runTimeMs: number, stars = 0): void {
    if (!this.open) return;
    this.open = false;
    this.telemetry.record('attempt', this.levelId, outcome);
    if (outcome === 'clear') {
      this.telemetry.record('stars', this.levelId, String(stars));
      this.telemetry.record('time', this.levelId, String(Math.round(runTimeMs / 1000)));
    }
    if (this.falls > 0) this.telemetry.record('fallcount', this.levelId, String(this.falls));
  }
}
