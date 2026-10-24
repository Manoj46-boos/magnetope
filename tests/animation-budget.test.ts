import { describe, expect, it } from 'vitest';
import { SecondOrder } from '@/core/dynamics';
import { Rng } from '@/core/rng';
import { FixedStepper } from '@/core/stepper';
import { HitStop } from '@/game/hit-stop';
import { BUDGET_MS, MID_TIER_SLOWDOWN, POSES, allocationPerCall, rigAllocation, timeAnimation } from '../tools/anim-cost';

/**
 * PRD 7.6, table 7.2: the whole animation layer costs under 1.5 ms of a frame on the mid-tier
 * reference phone, and its spring chains do not allocate. The rig is timed over real routes on
 * this machine and scaled by the slowdown of the mid-tier device used for the load gate.
 */

const BUSY_LEVELS = ['scrapyard-03', 'playground-08', 'stratosphere-14'];
/** What the rig may allocate per frame; it measures 100 to 230 now and was three to four times that before the clean-up. */
const MAX_BYTES_PER_FRAME = 320;

describe('MAGNO animation cost', () => {
  for (const id of BUSY_LEVELS) {
    it(`${id} fits the animation budget on the mid-tier phone, in flight and at rest`, async () => {
      const t = await timeAnimation(id, 8);
      expect(t.p99 * MID_TIER_SLOWDOWN, `p99 ${t.p99.toFixed(3)} ms over ${t.frames} frames`).toBeLessThan(BUDGET_MS);
      expect(t.p50 * MID_TIER_SLOWDOWN).toBeLessThan(BUDGET_MS / 4);
    }, 120_000);
  }

  it('covers enough frames of a real run for the timing to mean something', async () => {
    const t = await timeAnimation('playground-08', 1);
    expect(t.frames).toBeGreaterThan(1500);
  }, 60_000);

  for (const [pose, view] of Object.entries(POSES)) {
    it(`does not churn the heap while MAGNO is ${pose}`, () => {
      expect(rigAllocation(view)).toBeLessThan(MAX_BYTES_PER_FRAME);
    });
  }
});

describe('the hit-stop ledger (R-GF-06)', () => {
  /** Runs the clock in 5 ms slices and reports how long the freeze actually held. */
  const heldFor = (stop: HitStop): number => {
    let held = 0;
    for (let i = 0; i < 30; i++) {
      stop.update(5);
      if (stop.active) held += 5;
    }
    return held;
  };

  it('holds the release freeze inside the 40-80 ms band', () => {
    const stop = new HitStop();
    expect(stop.request()).toBe(true);
    const held = heldFor(stop);
    expect(held).toBeGreaterThanOrEqual(40);
    expect(held).toBeLessThanOrEqual(80);
  });

  it('never stacks a second freeze on a live one', () => {
    const stop = new HitStop();
    expect(stop.request()).toBe(true);
    stop.update(10);
    expect(stop.request()).toBe(false);
    expect(stop.active).toBe(true);
  });

  it('grants at most one freeze per second', () => {
    const stop = new HitStop();
    expect(stop.request()).toBe(true);
    heldFor(stop);
    stop.update(500);
    expect(stop.request()).toBe(false);
    stop.update(1000);
    expect(stop.request()).toBe(true);
  });

  it('respects the reduced-motion switch', () => {
    const stop = new HitStop();
    stop.disabled = true;
    expect(stop.request()).toBe(false);
  });

  it('is presentation only: the freeze holds steps back, it never reorders them', () => {
    // A held frame contributes no accumulator time, so the step sequence after
    // the pause is exactly the sequence an unimpeded run produces four frames
    // later — the trajectory is untouched, only wall clock moved.
    const frozen = new FixedStepper(60, 5);
    const plain = new FixedStepper(60, 5);
    let frozenSteps = 0;
    for (let i = 0; i < 4; i++) frozenSteps += frozen.advance(1 / 60, 0).steps;
    for (let i = 0; i < 60; i++) frozenSteps += frozen.advance(1 / 60, 1).steps;
    let plainSteps = 0;
    for (let i = 0; i < 64; i++) plainSteps += plain.advance(1 / 60, 1).steps;
    expect(frozenSteps).toBe(60);
    expect(plainSteps).toBe(64);
    const tail = frozen.advance(1 / 60, 1);
    const tailControl = plain.advance(1 / 60, 1);
    expect(tail.alpha).toBeCloseTo(tailControl.alpha, 6);
  });
});

describe('the allocation meter', () => {
  /** Closure state lives in a typed array: a captured `let` holding a double would be boxed on every write and pollute the reading. */
  const counter = (): Float64Array => new Float64Array(1);

  it('reads close to nothing for code that does not allocate', () => {
    const n = counter();
    expect(
      allocationPerCall(() => {
        n[0]! += Math.sqrt(n[0]! + 2);
      }),
    ).toBeLessThan(16);
  });

  it('sees a regression that allocates a small object every frame', () => {
    const n = counter();
    const sink: Array<{ x: number; y: number; z: number }> = [{ x: 0, y: 0, z: 0 }];
    expect(
      allocationPerCall(() => {
        sink[0] = { x: n[0]!++, y: n[0]!, z: n[0]! };
      }),
    ).toBeGreaterThan(24);
  });

  it('sees the allocation Math.hypot makes, which is why per-frame code avoids it', () => {
    const n = counter();
    const out = counter();
    expect(
      allocationPerCall(() => {
        for (let i = 0; i < 8; i++) out[0] = Math.hypot(n[0]!++, 3);
      }),
    ).toBeGreaterThan(100);
  });
});

/** The spring as first written, with plain fields: the reference the allocation-free version must match. */
class ReferenceSpring {
  value: number;
  private previousTarget: number;
  private velocity = 0;
  private readonly k1: number;
  private readonly k2: number;
  private readonly k3: number;

  constructor(frequency: number, damping: number, response: number, initial = 0) {
    this.k1 = damping / (Math.PI * frequency);
    this.k2 = 1 / (2 * Math.PI * frequency) ** 2;
    this.k3 = (response * damping) / (2 * Math.PI * frequency);
    this.value = initial;
    this.previousTarget = initial;
  }

  update(target: number, dt: number): void {
    if (dt <= 0) return;
    const targetVelocity = (target - this.previousTarget) / dt;
    this.previousTarget = target;
    const stableK2 = Math.max(this.k2, (dt * dt) / 2 + (dt * this.k1) / 2, dt * this.k1);
    this.value += dt * this.velocity;
    this.velocity += (dt * (target + this.k3 * targetVelocity - this.value - this.k1 * this.velocity)) / stableK2;
  }
}

describe('the spring chains behind the arms, head and eye', () => {
  it('follow exactly the motion they always did, to the last bit', () => {
    const rng = new Rng(7);
    const spring = new SecondOrder(2.0, 0.55, 0.3, 0.4);
    const reference = new ReferenceSpring(2.0, 0.55, 0.3, 0.4);
    for (let i = 0; i < 4000; i++) {
      const target = rng.range(-1, 1) * (i % 300 < 150 ? 1 : 0.1);
      const dt = rng.range(0.004, 0.05);
      spring.update(target, dt);
      reference.update(target, dt);
      expect(spring.value).toBe(reference.value);
    }
  });

  it('settle on the target and overshoot it first when underdamped', () => {
    const spring = new SecondOrder(3, 0.4, 0);
    let peak = 0;
    for (let i = 0; i < 600; i++) {
      spring.update(1, 1 / 60);
      peak = Math.max(peak, spring.value);
    }
    expect(peak).toBeGreaterThan(1.05);
    expect(spring.value).toBeCloseTo(1, 3);
  });

  it('jump to a value on snap and stay there until the target moves', () => {
    const spring = new SecondOrder(4, 0.7, 0);
    spring.update(2, 1 / 60);
    spring.snap(5);
    for (let i = 0; i < 30; i++) spring.update(5, 1 / 60);
    expect(spring.value).toBe(5);
  });

  it('ignore a frame that has no duration', () => {
    const spring = new SecondOrder(4, 0.7, 0, 1);
    spring.update(9, 0);
    expect(spring.value).toBe(1);
  });

  it('store their state without allocating', () => {
    const spring = new SecondOrder(4.5, 0.6, 0);
    const t = new Float64Array(1);
    const perBlock = allocationPerCall(() => {
      for (let i = 0; i < 100; i++) spring.update(Math.sin((t[0]! += 0.01)), 1 / 60);
    });
    expect(perBlock / 100).toBeLessThan(4);
  });
});
