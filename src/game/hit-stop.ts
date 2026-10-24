/**
 * The release hit-stop (R-GF-01): a full-power launch freezes the world for a
 * few frames so the release frame reads as an event, Nijman's first feedback in
 * the stack. The freeze is presentation only — it scales the fixed stepper, so
 * the simulation timeline is held, never bent, and the input layer keeps
 * latching presses through it. The ledger keeps the effect honest: never
 * stacked on itself, never twice inside a second (R-GF-06).
 */

/** Inside the 40–80 ms band: long enough to land as impact, short enough to never read as stutter. */
const HOLD_MS = 60;
/** Two freezes inside one second read as frame drops, not drama. */
const MIN_GAP_MS = 1000;

export class HitStop {
  private heldMs = -1;
  private lastAtMs = Number.NEGATIVE_INFINITY;
  private clockMs = 0;

  /** Reduced motion trades the freeze for a clean cut straight to the flight. */
  disabled = false;

  get active(): boolean {
    return this.heldMs >= 0;
  }

  /** Asks for a release freeze. Returns whether it was granted. */
  request(): boolean {
    if (this.disabled || this.active || this.clockMs - this.lastAtMs < MIN_GAP_MS) return false;
    this.heldMs = 0;
    this.lastAtMs = this.clockMs;
    return true;
  }

  /** Advance by real (unscaled) milliseconds. */
  update(realMs: number): void {
    this.clockMs += realMs;
    if (this.heldMs < 0) return;
    this.heldMs += realMs;
    if (this.heldMs >= HOLD_MS) this.heldMs = -1;
  }

  reset(): void {
    this.heldMs = -1;
  }
}
