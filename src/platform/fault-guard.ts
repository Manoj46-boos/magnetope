export type FaultAction = 'continue' | 'restart' | 'fatal';

export interface FaultPolicy {
  /** Consecutive failing frames that stop being a glitch and start being a broken level. */
  streak: number;
  /** A restart that fails again within this window is final. */
  restartWindowMs: number;
}

export const DEFAULT_FAULT_POLICY: FaultPolicy = { streak: 5, restartWindowMs: 10_000 };

/**
 * Decides what a frame that threw should cost. One bad frame is skipped; a streak of them
 * rebuilds the level once; a level that breaks again straight after the rebuild ends in the
 * fatal screen instead of an endless error loop. Each distinct message is reported once, so
 * a fault that repeats sixty times a second still leaves a single line in the console.
 */
export class FaultGuard {
  private streak = 0;
  private lastRestartAt = Number.NEGATIVE_INFINITY;
  private readonly reported = new Set<string>();

  constructor(
    private readonly report: (error: unknown) => void,
    private readonly policy: FaultPolicy = DEFAULT_FAULT_POLICY,
  ) {}

  /** A frame completed; the streak is over. */
  ok(): void {
    this.streak = 0;
  }

  fail(error: unknown, nowMs: number): FaultAction {
    const key = error instanceof Error ? `${error.name}:${error.message}` : String(error);
    if (!this.reported.has(key)) {
      this.reported.add(key);
      this.report(error);
    }
    this.streak += 1;
    if (this.streak < this.policy.streak) return 'continue';
    this.streak = 0;
    if (nowMs - this.lastRestartAt < this.policy.restartWindowMs) return 'fatal';
    this.lastRestartAt = nowMs;
    return 'restart';
  }
}
