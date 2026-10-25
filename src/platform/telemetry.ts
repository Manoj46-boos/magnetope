import type { Vec2 } from '@/core/mathx';

/**
 * Anonymous gameplay telemetry (PRD 11.3). Events are plain strings in the shape
 * of Poki's `measure(category, what, action)` channel, so nothing identifying and
 * nothing outside the first-party SDK is involved. They are batched in memory and
 * flushed only at natural stops: never mid-run, never during an ad.
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

/** Positions are bucketed into 2 m cells so heatmaps stay coarse and the payload small. */
export const CELL_SIZE = 2;
export const cellOf = (p: Vec2): string => `${Math.floor(p.x / CELL_SIZE)}:${Math.floor(p.y / CELL_SIZE)}`;

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

interface Hotspot {
  cell: string;
  count: number;
}

const topCells = (cells: Map<string, number>, limit: number): Hotspot[] =>
  [...cells.entries()]
    .map(([cell, count]) => ({ cell, count }))
    .sort((a, b) => b.count - a.count || a.cell.localeCompare(b.cell))
    .slice(0, limit);

/** Counts what the player did during one attempt at a level and reports it as a few compact records. */
export class AttemptRecorder {
  private levelId = '';
  private sticks = 0;
  private flips = 0;
  private snaps = 0;
  private falls = 0;
  private flipCells = new Map<string, number>();
  private open = false;
  private lastFallAt = -1;
  private retryLatencyMs = -1;

  constructor(
    private readonly telemetry: Telemetry,
    private readonly now: () => number = Date.now,
  ) {}

  begin(levelId: string): void {
    this.levelId = levelId;
    this.sticks = this.flips = this.snaps = this.falls = 0;
    this.flipCells = new Map();
    this.open = true;
    this.retryLatencyMs = this.lastFallAt >= 0 ? this.now() - this.lastFallAt : -1;
    this.lastFallAt = -1;
    this.telemetry.record('level', levelId, 'enter');
    if (this.retryLatencyMs >= 0) this.telemetry.record('retry', levelId, String(Math.round(this.retryLatencyMs)));
  }

  stick(): void {
    this.sticks++;
  }

  flip(at: Vec2): void {
    this.flips++;
    const cell = cellOf(at);
    this.flipCells.set(cell, (this.flipCells.get(cell) ?? 0) + 1);
  }

  snap(): void {
    this.snaps++;
  }

  fall(heightMeters: number, at: Vec2, grade: string): void {
    this.falls++;
    this.lastFallAt = this.now();
    this.telemetry.record('fall', this.levelId, `h=${heightMeters.toFixed(1)};c=${cellOf(at)};g=${grade}`);
  }

  finish(outcome: AttemptOutcome, runTimeMs: number, stars = 0): void {
    if (!this.open) return;
    this.open = false;
    const hot = topCells(this.flipCells, 3)
      .map((h) => `${h.cell}x${h.count}`)
      .join(',');
    this.telemetry.record(
      'attempt',
      this.levelId,
      `o=${outcome};ms=${Math.round(runTimeMs)};st=${stars};stick=${this.sticks};flip=${this.flips};snap=${this.snaps};fall=${this.falls};hot=${hot}`,
    );
  }
}
