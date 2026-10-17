import { describe, expect, it } from 'vitest';
import { poseAt, poseVelocity } from '@/sim/motion';
import type { PropMotion, PropPlacement } from '@/sim/types';
import { Driver, createSim, makeLevel } from './helpers/harness';

const HUB = { x: 0, y: 10 };
const PERIOD = 12;

const spoke = (overrides: Partial<PropMotion> = {}): PropPlacement => ({
  kind: 'ferris-spoke',
  x: 3.2,
  y: HUB.y,
  w: 6.4,
  motion: { type: 'spin', pivot: HUB, period: PERIOD, ...overrides } as PropMotion,
});

const polar = (p: { x: number; y: number }): { radius: number; angle: number } => ({
  radius: Math.hypot(p.x - HUB.x, p.y - HUB.y),
  angle: Math.atan2(p.y - HUB.y, p.x - HUB.x),
});

describe('spinning props', () => {
  it('start where they are placed and come back after exactly one period', () => {
    const placement = spoke();
    const start = poseAt(placement, 0);
    const lap = poseAt(placement, PERIOD * 1000);
    expect(start).toEqual({ x: 3.2, y: 10, rot: 0 });
    expect(lap.x).toBeCloseTo(start.x, 6);
    expect(lap.y).toBeCloseTo(start.y, 6);
  });

  it('sit on the far side of the hub half a period in, turned to face the other way', () => {
    const half = poseAt(spoke(), (PERIOD * 1000) / 2);
    expect(half.x).toBeCloseTo(-3.2, 6);
    expect(half.y).toBeCloseTo(10, 6);
    expect(Math.abs(half.rot)).toBeCloseTo(Math.PI, 6);
  });

  it('keep their distance from the hub the whole way round', () => {
    const placement = spoke();
    for (let t = 0; t <= PERIOD * 1000; t += 250) {
      expect(polar(poseAt(placement, t)).radius).toBeCloseTo(3.2, 6);
    }
  });

  it('turn the other way when reversed', () => {
    const forward = poseAt(spoke(), 1000);
    const backward = poseAt(spoke({ reverse: true }), 1000);
    expect(forward.y).toBeGreaterThan(HUB.y);
    expect(backward.y).toBeLessThan(HUB.y);
    expect(backward.x).toBeCloseTo(forward.x, 6);
  });

  it('move at the speed of a wheel of that size, 2 pi r over the period', () => {
    const { vx, vy, w } = poseVelocity(spoke(), 4000, 1000 / 60);
    expect(Math.hypot(vx, vy)).toBeCloseTo((2 * Math.PI * 3.2) / PERIOD, 1);
    expect(w).toBeCloseTo((2 * Math.PI) / PERIOD, 2);
  });

  it('can start part-way round the circle', () => {
    const quarter = poseAt(spoke({ phase: 0.25 }), 0);
    expect(quarter.x).toBeCloseTo(0, 6);
    expect(quarter.y).toBeCloseTo(HUB.y + 3.2, 6);
  });

  it('keeps an upright prop level while it travels the same circle, like a gondola', () => {
    const gondola: PropPlacement = {
      kind: 'gondola',
      x: 4.9,
      y: HUB.y,
      motion: { type: 'spin', pivot: HUB, period: PERIOD, upright: true },
    };
    for (let t = 0; t <= PERIOD * 1000; t += 500) {
      const pose = poseAt(gondola, t);
      expect(pose.rot).toBe(0);
      expect(polar(pose).radius).toBeCloseTo(4.9, 6);
    }
    expect(poseAt(gondola, 3000).y).toBeCloseTo(HUB.y + 4.9, 6);
  });
});

describe('riding a spinning spoke', () => {
  async function rider() {
    const sim = await createSim(makeLevel([spoke()], { spawn: { x: 5, y: 10.2 }, bounds: { minX: -30, maxX: 30 } }));
    const driver = new Driver(sim);
    driver.until(() => driver.view.state === 'attached', 2000);
    return { sim, driver };
  }

  it('catches MAGNO on the arm as it comes round', async () => {
    const { driver } = await rider();
    expect(driver.view.state).toBe('attached');
  });

  it('carries him round the hub rather than letting him slide off', async () => {
    const { driver } = await rider();
    driver.start();
    const before = polar(driver.view.position);
    driver.ms(3000);
    const after = polar(driver.view.position);
    expect(driver.view.state).toBe('attached');
    expect(Math.abs(after.radius - before.radius)).toBeLessThan(1);
    expect(after.angle - before.angle).toBeGreaterThan(0.9);
  });

  it('swings him up and over the top so a flip from there carries further than one from the ground', async () => {
    const { sim, driver } = await rider();
    driver.start().ms(PERIOD * 250);
    const top = driver.view.position.y;
    expect(top).toBeGreaterThan(HUB.y + 3);
    expect(sim.run.fallCount).toBe(0);
  });
});
