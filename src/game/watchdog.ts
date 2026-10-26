import { stepDown, type QualityTier } from '@/render/quality';

/** A tier's frame budget in milliseconds: 60 fps where the target is 60, half-speed at the floor. */
const SLOW_FRAME_MS: Record<QualityTier, number> = { high: 34, mid: 34, low: Infinity };

/** How long the average frame must stay over budget before a step down may fire. */
export const PATIENCE_S = 4;

/** How much of the average one new frame is: a half-second of 60 fps evidence. */
const EMA_ALPHA = 1 / 32;

/** Settled frame time the exponential average starts from, so the first frames cannot cry wolf. */
const FRESH_MS = 1000 / 60;

export interface WatchdogOptions {
  tier: () => QualityTier;
  /** `from` is the tier being left, `to` the one entered, with the frame rate that decided it. */
  onDowngrade: (from: QualityTier, to: QualityTier, fpsAtDecision: number) => void;
}

/**
 * The frame-time watchdog (R-PE-08). An exponential average of the real frame
 * clock watches the tier's frame budget, and when it has been over budget for
 * a full patience window the step down is armed — but it may only fire at a
 * state boundary, the moment MAGNO is perched and quiet, never in flight and
 * never mid-charge, because a resolution change under an active player is its
 * own stutter. The average recovering stands the armed step down back down.
 */
export class FrameWatchdog {
  private emaMs = FRESH_MS;
  private overMs = 0;
  private armed = false;

  constructor(private readonly options: WatchdogOptions) {}

  /** The smoothed frame rate, for the session's own perf record (R-PE-11). */
  get fps(): number {
    return 1000 / this.emaMs;
  }

  frame(realDtMs: number, atBoundary: boolean): void {
    this.emaMs += (realDtMs - this.emaMs) * EMA_ALPHA;
    const budget = SLOW_FRAME_MS[this.options.tier()];
    if (this.emaMs > budget) {
      this.overMs += realDtMs;
      if (this.overMs >= PATIENCE_S * 1000) this.armed = true;
    } else {
      this.overMs = 0;
      this.armed = false;
    }
    if (!this.armed || !atBoundary) return;
    const from = this.options.tier();
    if (from === 'low') return;
    this.armed = false;
    this.overMs = 0;
    this.options.onDowngrade(from, stepDown(from), Math.round(this.fps));
  }
}
