/**
 * Second-order dynamics (frequency, damping, response) for secondary motion.
 * Underdamped settings overshoot slightly, which is what makes arms feel massy.
 * Stepping is allocation-free and stable for any frame time.
 */
/** Natural frequency (Hz) at which a spring of the given damping trails a step by `lagSeconds` on average. */
export const frequencyForLag = (lagSeconds: number, damping: number): number => damping / (Math.PI * lagSeconds);

const VALUE = 0;
const VELOCITY = 1;
const PREVIOUS_TARGET = 2;

export class SecondOrder {
  private readonly k1: number;
  private readonly k2: number;
  private readonly k3: number;
  /** Typed-array slots are written in place; a double stored in an object field is boxed afresh on every write. */
  private readonly state = new Float64Array(3);

  constructor(frequency: number, damping: number, response: number, initial = 0) {
    this.k1 = damping / (Math.PI * frequency);
    this.k2 = 1 / (2 * Math.PI * frequency) ** 2;
    this.k3 = (response * damping) / (2 * Math.PI * frequency);
    this.snap(initial);
  }

  get value(): number {
    return this.state[VALUE]!;
  }

  /** Steps towards `target`; read the result from `value`. */
  update(target: number, dt: number): void {
    if (dt <= 0) return;
    const s = this.state;
    const targetVelocity = (target - s[PREVIOUS_TARGET]!) / dt;
    s[PREVIOUS_TARGET] = target;
    const stableK2 = Math.max(this.k2, (dt * dt) / 2 + (dt * this.k1) / 2, dt * this.k1);
    s[VALUE]! += dt * s[VELOCITY]!;
    s[VELOCITY]! += (dt * (target + this.k3 * targetVelocity - s[VALUE]! - this.k1 * s[VELOCITY]!)) / stableK2;
  }

  snap(value: number): void {
    this.state[VALUE] = value;
    this.state[PREVIOUS_TARGET] = value;
    this.state[VELOCITY] = 0;
  }
}

export class SecondOrder2 {
  readonly x: SecondOrder;
  readonly y: SecondOrder;

  constructor(frequency: number, damping: number, response: number, ix = 0, iy = 0) {
    this.x = new SecondOrder(frequency, damping, response, ix);
    this.y = new SecondOrder(frequency, damping, response, iy);
  }

  update(tx: number, ty: number, dt: number): void {
    this.x.update(tx, dt);
    this.y.update(ty, dt);
  }

  snap(x: number, y: number): void {
    this.x.snap(x);
    this.y.snap(y);
  }
}

/** Smooth deterministic noise in [-1, 1] for idle drift and float orbits. */
export function noise1(t: number, seed = 0): number {
  return (
    Math.sin(t * 1.7 + seed * 12.9898) * 0.5 +
    Math.sin(t * 2.9 + seed * 78.233 + 1.3) * 0.3 +
    Math.sin(t * 4.3 + seed * 37.719 + 2.1) * 0.2
  );
}
