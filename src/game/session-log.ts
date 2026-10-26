import type { FallHighlight } from './highlights';

/** One clear card's ghost verdict, kept for the summary (R-RT-07). */
export interface GhostDelta {
  levelName: string;
  /** Positive when the player reached the flip before their own ghost. */
  aheadMs: number;
}

export interface SessionSummary {
  /** Levels cleared since the game booted. */
  clears: number;
  stars: number;
  bestFall: FallHighlight | null;
  /** The latest flip deltas, newest last, three kept at most. */
  deltas: readonly GhostDelta[];
}

/**
 * The session's own tally (R-RT-04): what this visit added up to, read back on
 * the map at the natural break. Kept in memory like the highlight strip — a
 * session is a visit, not a record, so absence still costs nothing (R-RT-08).
 */
export class SessionLog {
  private clears = 0;
  private starCount = 0;
  private bestFall: FallHighlight | null = null;
  private readonly deltas: GhostDelta[] = [];

  recordClear(stars: number): void {
    this.clears++;
    this.starCount += stars;
  }

  /** The rotation seed the clear card's dangle reads (R-EC-04). */
  get clearCount(): number {
    return this.clears;
  }

  recordFall(fall: FallHighlight): void {
    if (!this.bestFall || fall.score > this.bestFall.score) this.bestFall = fall;
  }

  recordDelta(delta: GhostDelta): void {
    this.deltas.push(delta);
    if (this.deltas.length > 3) this.deltas.shift();
  }

  get summary(): SessionSummary {
    return { clears: this.clears, stars: this.starCount, bestFall: this.bestFall, deltas: [...this.deltas] };
  }
}
