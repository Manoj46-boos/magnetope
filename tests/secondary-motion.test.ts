import { describe, expect, it } from 'vitest';
import { SecondOrder, frequencyForLag } from '@/core/dynamics';
import { TUNING } from '@/config/tuning';
import { MagnoRig } from '@/render/magno-rig';
import type { MagnoView } from '@/sim/magno';
import { POSES } from '../tools/anim-cost';

/**
 * PRD 7.4 / R-CH-05: the hands follow targets that lag the body ("the entire
 * secret of weight") and the head runs a smaller chain of its own. Both
 * constants live in the tuning table now, so what is measured here is the
 * tuning the doc quotes — move the number and the measurement follows. The
 * lag of a spring is the time it takes, on average, to arrive: the area
 * between a step and the response to it.
 */

const STEP_S = 0.001;

/** Mean delay in milliseconds of a response to a unit step, read off a recorded trace. */
const meanDelayMs = (trace: number[], from: number, to: number): number => {
  const span = to - from;
  return trace.reduce((area, value) => area + (1 - (value - from) / span) * STEP_S * 1000, 0);
};

const settle = (rig: MagnoRig, view: MagnoView, seconds: number): void => {
  for (let i = 0; i < seconds / STEP_S; i++) rig.update(view, view.position, STEP_S, false);
};

describe('a spring built from a lag', () => {
  it.each([
    [0.08, 0.55],
    [0.03, 0.6],
    [0.12, 0.8],
  ])('trails a step by %f s at damping %f', (lag, damping) => {
    const spring = new SecondOrder(frequencyForLag(lag, damping), damping, 0);
    const trace: number[] = [];
    for (let i = 0; i < 4000; i++) {
      spring.update(1, STEP_S);
      trace.push(spring.value);
    }
    expect(meanDelayMs(trace, 0, 1)).toBeCloseTo(lag * 1000, -0.5);
  });
});

describe('MAGNO secondary motion', () => {
  it('lets the head lag the body by its tuned constant', () => {
    const rig = new MagnoRig();
    const head = (rig as unknown as { headPivot: { rotation: { z: number } } }).headPivot;
    const still: MagnoView = { ...POSES.airborne!, velocity: { x: 0, y: 0 } };
    settle(rig, still, 2);
    const from = head.rotation.z;

    const pushed: MagnoView = { ...still, velocity: { x: -10, y: 0 } };
    const trace: number[] = [];
    for (let i = 0; i < 2000; i++) {
      rig.update(pushed, pushed.position, STEP_S, false);
      trace.push(head.rotation.z);
    }
    const to = trace[trace.length - 1]!;
    expect(Math.abs(to - from)).toBeGreaterThan(0.1);
    expect(meanDelayMs(trace, from, to)).toBeCloseTo(TUNING.character.headLagMs, -0.5);
    rig.dispose();
  });

  it('lets a hand follow its target by its tuned lag', () => {
    const rig = new MagnoRig();
    const hand = (rig as unknown as { arms: Array<{ target: { x: { value: number } } }> }).arms[0]!.target.x;
    const view = (phase: number): MagnoView => ({ ...POSES.recovering!, recoverPhase: phase });
    settle(rig, view(0), 2);
    const from = hand.value;

    const next = view(0.25);
    const trace: number[] = [];
    for (let i = 0; i < 2000; i++) {
      rig.update(next, next.position, STEP_S, false);
      trace.push(hand.value);
    }
    const to = trace[trace.length - 1]!;
    expect(Math.abs(to - from)).toBeGreaterThan(0.03);
    expect(meanDelayMs(trace, from, to)).toBeCloseTo(TUNING.character.handLagMs, -0.5);
    rig.dispose();
  });

  it('overshoots when a hand stops, which is what makes the body feel heavy', () => {
    const rig = new MagnoRig();
    const hand = (rig as unknown as { arms: Array<{ target: { x: { value: number } } }> }).arms[0]!.target.x;
    const view = (phase: number): MagnoView => ({ ...POSES.recovering!, recoverPhase: phase });
    settle(rig, view(0), 2);
    const next = view(0.25);
    let peak = hand.value;
    for (let i = 0; i < 1500; i++) {
      rig.update(next, next.position, STEP_S, false);
      peak = Math.max(peak, hand.value);
    }
    expect(peak).toBeGreaterThan(hand.value + 0.001);
    rig.dispose();
  });

  it('counter-bounces the head against the body a catch squashes (R-CH-05)', () => {
    // The volume law: when the body squashes along its axis, the horseshoe head
    // swells against it, so total volume reads as preserved across the beat.
    const rig = new MagnoRig();
    const head = (rig as unknown as { headPivot: { scale: { y: number } } }).headPivot;
    const body = (rig as unknown as { root: { children: Array<{ scale: { y: number } }> } }).root.children[0]!;
    const v: MagnoView = { ...POSES.attached!, velocity: { x: 0, y: 0 } };
    settle(rig, v, 1);
    rig.onAttach({ x: 0, y: 1 });
    let headPeak = 1;
    let bodyLow = 1;
    for (let i = 0; i < 30; i++) {
      rig.update(v, v.position, STEP_S, false);
      headPeak = Math.max(headPeak, head.scale.y);
      bodyLow = Math.min(bodyLow, body.scale.y);
    }
    expect(bodyLow).toBeLessThan(0.9);
    expect(headPeak).toBeGreaterThan(1.05);
    settle(rig, v, 1);
    expect(head.scale.y).toBeCloseTo(1, 2);
    rig.dispose();
  });
});
