/**
 * The score's event-density envelope (R-LD-08). The adaptive music follows the
 * level's own event sequence: every catch and launch raises the envelope and
 * the quiet between beats lets it sink, so the score rises into a level's
 * escalation and breathes through its establish. Purely arithmetic on the
 * events it is fed — no clock but the deltas it is given.
 */

const RISE = 0.45;
/** Seconds for the envelope to fall to roughly a third of its height. */
const SETTLING_S = 3.2;
const FLOOR = 0.001;

export const EVENT_WEIGHTS = {
  /** A snap catch is the level's own verb, and the score knows it. */
  snap: 1,
  /** Riding a surface off a plain catch keeps a smaller voice. */
  catch: 0.5,
  /** A charged launch is a beat, just shy of the snap. */
  launch: 0.8,
} as const;

export class EventEnvelope {
  private value = 0;

  /** A spent event raises the envelope, never past its ceiling. */
  event(weight: number): void {
    this.value = Math.min(1, this.value + weight * RISE);
  }

  /** The quiet between beats, by however long this frame lasted. */
  update(dt: number): void {
    this.value *= Math.exp(-dt / SETTLING_S);
    if (this.value < FLOOR) this.value = 0;
  }

  /** The envelope's height, 0..1 — the intensity the score mixes to. */
  get intensity(): number {
    return this.value;
  }

  reset(): void {
    this.value = 0;
  }
}
