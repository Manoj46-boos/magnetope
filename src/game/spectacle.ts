/**
 * Spectacle spacing (R-SM-06): no two signature beats inside twenty seconds.
 * Scripted beats — the biome establishing shot, the one-time first catch, the
 * ending film — are authored, so they are recorded rather than gated. The
 * dynamic beat, the big-fall slow motion, is the one that yields: a fall right
 * after a staged moment stays at full speed, because two spectacles back to
 * back read as noise. The clear card between levels is the breathing space the
 * rule banks on: it spends real wall-clock time between one level's beats and
 * the next level's shot.
 */

export const SPECTACLE_SPACING_MS = 20_000;

export type BeatKind = 'establish' | 'first-catch' | 'slow-mo' | 'practice-fall' | 'ending';

export class SpectacleLedger {
  private clockMs = 0;
  private lastAtMs = Number.NEGATIVE_INFINITY;
  private last: BeatKind | null = null;

  /** Advance by real (unscaled) milliseconds. */
  update(realMs: number): void {
    this.clockMs += realMs;
  }

  /** Whether enough room has passed since the last beat for a new one. */
  get clear(): boolean {
    return this.clockMs - this.lastAtMs >= SPECTACLE_SPACING_MS;
  }

  get msSinceLast(): number {
    return this.clockMs - this.lastAtMs;
  }

  get lastBeat(): BeatKind | null {
    return this.last;
  }

  mark(kind: BeatKind): void {
    this.last = kind;
    this.lastAtMs = this.clockMs;
  }
}
