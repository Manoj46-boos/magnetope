import { describe, expect, it } from 'vitest';
import { MERCY_ASSIST_CAP, MERCY_CATCH_CAP, mercyBoost, withMercy } from '@/config/mercy';
import { levelById } from '@/levels';
import { onRampFor } from '@/config/onramp';

/**
 * The on-ramp's adaptive mercy (rebuild PRD Volume VI, P-LD-05): the caps,
 * the taper-back, the on-ramp-only boundary. The laws here are the spec's own
 * numbers — a tenth a step on the window capped three tenths past the ramp, a
 * tenth compounding on the assist capped at 2.6 — and the boundary: nothing
 * past level ten is ever widened, because the climb past the ramp is the
 * player's own.
 */
describe('the mercy arithmetic (P-LD-05)', () => {
  it('spends nothing on a level being learned: one fall is a first attempt, not a fight', () => {
    expect(mercyBoost(0)).toEqual({ catchWindow: 0, assist: 1 });
    expect(mercyBoost(1)).toEqual({ catchWindow: 0, assist: 1 });
  });

  it('steps on the second consecutive fail and compounds from there', () => {
    expect(mercyBoost(2)).toEqual({ catchWindow: 0.1, assist: 1.1 });
    expect(mercyBoost(3).catchWindow).toBeCloseTo(0.2, 5);
    expect(mercyBoost(3).assist).toBeCloseTo(1.21, 5);
    expect(mercyBoost(4).catchWindow).toBeCloseTo(MERCY_CATCH_CAP, 5);
    expect(mercyBoost(5).catchWindow).toBe(MERCY_CATCH_CAP);
    expect(mercyBoost(50).catchWindow).toBe(MERCY_CATCH_CAP);
    // The multiplier compounds unbounded by design: the cap is spent by
    // withMercy on the widened value, as an absolute strength.
    expect(mercyBoost(50).assist).toBeGreaterThan(MERCY_ASSIST_CAP);
  });

  it('never widens a level past the ramp', () => {
    const past = levelById('scrapyard-11');
    expect(past.onRamp).toBeUndefined();
    expect(withMercy(past, 9)).toBe(past);
  });

  it('never widens an on-ramp level whose streak has not earned it', () => {
    for (const id of ['scrapyard-00', 'scrapyard-04', 'scrapyard-09']) {
      const level = levelById(id);
      expect(withMercy(level, 0)).toBe(level);
      expect(withMercy(level, 1)).toBe(level);
    }
  });

  it('widens the ramp\'s own values, so the mercy rides the on-ramp it found', () => {
    const level = levelById('scrapyard-02');
    const widened = withMercy(level, 2)!;
    expect(widened.onRamp!.catchWindow).toBeCloseTo(level.onRamp!.catchWindow + 0.1, 5);
    expect(widened.onRamp!.assist).toBeCloseTo(level.onRamp!.assist * 1.1, 5);
    const more = withMercy(level, 6)!;
    expect(more.onRamp!.catchWindow).toBeCloseTo(level.onRamp!.catchWindow + MERCY_CATCH_CAP, 5);
    expect(more.onRamp!.assist).toBeCloseTo(Math.min(level.onRamp!.assist * 1.1 ** 5, MERCY_ASSIST_CAP), 5);
  });

  it('caps the assist at 2.6 whatever the ramp started from', () => {
    // The held-hand levels start at 2.2 (onramp.ts): the cap leaves one tenth
    // of headroom, so the worst streak tops out just above the hand-held ramp.
    const held = levelById('scrapyard-01');
    const at = withMercy(held, 30)!;
    expect(at.onRamp!.assist).toBeCloseTo(MERCY_ASSIST_CAP, 5);
    expect(at.onRamp!.assist).toBeLessThan(MERCY_ASSIST_CAP + 1e-9);
  });

  it('keeps the shipped level untouched — the widening is a copy, never a mutation', () => {
    const level = levelById('scrapyard-02');
    const before = level.onRamp!.catchWindow;
    withMercy(level, 4);
    expect(level.onRamp!.catchWindow).toBe(before);
  });
});

describe('the mercy boundary against the ramp it rides', () => {
  it('every level mercy can touch is an on-ramp level, and every on-ramp level is inside ten', () => {
    for (let n = 1; n <= 10; n++) {
      const ramp = onRampFor(n);
      expect(ramp.catchWindow).toBeGreaterThan(0);
    }
    // scrapyard-00..09 are campaign levels 1..10; ten itself is the last the ramp touches.
    for (const id of ['scrapyard-00', 'scrapyard-09']) {
      const level = levelById(id);
      expect(level.onRamp).toBeDefined();
    }
    expect(levelById('scrapyard-10').onRamp).toBeUndefined();
  });
});

describe('the mercy the player meets (P-LD-05, end to end)', () => {
  it('widens the real snap ball on the third attempt, and tapers back on the clear', async () => {
    const { loadRapier } = await import('@/sim/rapier');
    const { Simulation } = await import('@/sim/simulation');
    const rapier = await loadRapier();
    const shipped = levelById('scrapyard-02');
    const first = new Simulation(rapier, withMercy(shipped, 1));
    const third = new Simulation(rapier, withMercy(shipped, 3));
    // The real graph reads the widened window: the third attempt's snap ball
    // carries the level's own window plus two tenths, and the first attempt's
    // is exactly the shipped level's — the ramp the player actually met.
    const TUNING = (await import('@/config/tuning')).TUNING;
    expect(third.physics.snapRadius).toBeCloseTo((shipped.onRamp!.catchWindow + 0.2) * TUNING.snap.radius, 6);
    expect(first.physics.snapRadius).toBeCloseTo(shipped.onRamp!.catchWindow * TUNING.snap.radius, 6);
    // The clear tapers the whole way back: the sim a cleared player meets next
    // is the shipped level again, whatever the streak was.
    const cleared = withMercy(shipped, 0);
    expect(cleared).toBe(shipped);
    first.dispose();
    third.dispose();
  });

  it('a level past the ramp meets the shipped difficulty, however it fights them', async () => {
    const { loadRapier } = await import('@/sim/rapier');
    const { Simulation } = await import('@/sim/simulation');
    const rapier = await loadRapier();
    const shipped = levelById('scrapyard-11');
    const fought = new Simulation(rapier, withMercy(shipped, 30));
    // No on-ramp, no widening: the climb past ten is the player's own.
    expect(fought.physics.snapRadius).toBeCloseTo((await import('@/config/tuning')).TUNING.snap.radius, 6);
    fought.dispose();
  });
});
