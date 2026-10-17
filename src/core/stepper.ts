export interface StepResult {
  steps: number;
  /** Fraction of the next step already elapsed; drives render interpolation. */
  alpha: number;
}

/**
 * Fixed-timestep accumulator. Simulation time advances only in whole steps, so
 * identical inputs always produce identical state regardless of frame rate.
 * `timeScale` stretches how much real time one step consumes (slow motion).
 */
export class FixedStepper {
  readonly stepSeconds: number;
  private accumulator = 0;

  constructor(
    hz: number,
    private readonly maxStepsPerFrame: number,
  ) {
    this.stepSeconds = 1 / hz;
  }

  advance(frameSeconds: number, timeScale = 1): StepResult {
    const clamped = Math.min(frameSeconds, this.stepSeconds * this.maxStepsPerFrame);
    this.accumulator += clamped * timeScale;
    let steps = 0;
    while (this.accumulator >= this.stepSeconds && steps < this.maxStepsPerFrame) {
      this.accumulator -= this.stepSeconds;
      steps++;
    }
    if (steps === this.maxStepsPerFrame) this.accumulator = Math.min(this.accumulator, this.stepSeconds);
    return { steps, alpha: this.accumulator / this.stepSeconds };
  }

  reset(): void {
    this.accumulator = 0;
  }
}
