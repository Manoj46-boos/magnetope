/**
 * The eye's law for the flash ident (R-AC-09): no sequence may beat more than
 * three times in any rolling second, counted in real time — the clock the eye
 * lives on, not the simulation's. A beat that arrives inside a spent window is
 * dropped and the running decay continues, so a suppressed catch reads as a
 * steady glow rather than a strobe.
 */
export class FlashGuard {
  private beats: number[] = [];

  constructor(readonly maxPerSecond = 3) {}

  /** Offers a beat at the given real timestamp; false means the law says no. */
  permits(nowMs: number): boolean {
    this.beats = this.beats.filter((t) => nowMs - t < 1000);
    if (this.beats.length >= this.maxPerSecond) return false;
    this.beats.push(nowMs);
    return true;
  }
}
