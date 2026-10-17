import { describe, expect, it } from 'vitest';
import { cycleState, poseAt, poseVelocity, slideProgress } from '@/sim/motion';
import type { PropCycle, PropMotion, PropPlacement } from '@/sim/types';
import { Driver, createSim, floor, makeLevel } from './helpers/harness';

const at = (motion: PropMotion, x = 0, y = 0): PropPlacement => ({ kind: 'washer-rig', x, y, motion });

describe('slide motion', () => {
  it('rests at both ends of its travel and eases between them', () => {
    const period = 10;
    expect(slideProgress(0, period)).toBe(0);
    expect(slideProgress(1000, period)).toBe(0);
    expect(slideProgress(5000, period)).toBeCloseTo(1, 6);
    expect(slideProgress(6000, period)).toBe(1);
    expect(slideProgress(8000, period)).toBeGreaterThan(0.3);
    expect(slideProgress(8000, period)).toBeLessThan(0.9);
    let last = 0;
    for (let ms = 1400; ms <= 5000; ms += 100) {
      const p = slideProgress(ms, period);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });

  it('repeats exactly every period', () => {
    for (const ms of [0, 1234, 4321, 7777]) {
      expect(slideProgress(ms + 12_000, 12, 0.2)).toBeCloseTo(slideProgress(ms, 12, 0.2), 9);
    }
  });

  it('keeps a counterweight pair in opposition so the elevator always balances', () => {
    const rise: PropMotion = { type: 'slide', dx: 0, dy: 8, period: 10 };
    const fall: PropMotion = { ...rise, phase: 0.5 };
    for (let ms = 0; ms < 20_000; ms += 250) {
      const a = poseAt(at(rise), ms).y;
      const b = poseAt(at(fall, 0, 0), ms).y;
      expect(a + b).toBeCloseTo(8, 6);
    }
  });

  it('moves a prop only along the vector it was given', () => {
    const pose = poseAt(at({ type: 'slide', dx: 3, dy: -2, period: 8 }, 5, 10), 4000);
    expect(pose.x).toBeCloseTo(8, 6);
    expect(pose.y).toBeCloseTo(8, 6);
    expect(pose.rot).toBe(0);
  });

  it('reports velocity matching the position change over a tick', () => {
    const placement = at({ type: 'slide', dx: 0, dy: 6, period: 8 });
    const dtMs = 1000 / 60;
    const { vy } = poseVelocity(placement, 2400, dtMs);
    const dy = poseAt(placement, 2400 + dtMs).y - poseAt(placement, 2400).y;
    expect(vy).toBeCloseTo(dy / (dtMs / 1000), 9);
    expect(vy).toBeGreaterThan(0);
  });
});

describe('swing motion', () => {
  const swing: PropMotion = { type: 'swing', pivot: { x: 0, y: 12 }, arc: 0.6, period: 4 };
  const hook = (): PropPlacement => ({ kind: 'crane-hook', x: 0, y: 6, motion: swing });

  it('keeps the bob at a constant distance from the pivot', () => {
    for (let ms = 0; ms < 8000; ms += 130) {
      const p = poseAt(hook(), ms);
      expect(Math.hypot(p.x, p.y - 12)).toBeCloseTo(6, 6);
    }
  });

  it('reaches the arc at the extremes and hangs straight down at the centre', () => {
    expect(poseAt(hook(), 0).x).toBeCloseTo(0, 6);
    const extreme = poseAt(hook(), 1000);
    expect(extreme.rot).toBeCloseTo(0.6, 6);
    expect(extreme.x).toBeCloseTo(6 * Math.sin(0.6), 6);
  });

  it('turns the bob with the cable', () => {
    expect(poseAt(hook(), 1000).rot).toBeCloseTo(0.6, 6);
    expect(poseAt(hook(), 3000).rot).toBeCloseTo(-0.6, 6);
  });
});

describe('blink cycle', () => {
  const cycle: PropCycle = { period: 6, on: 0.5, warn: 0.8 };

  it('runs solid, then warns, then goes dark', () => {
    expect(cycleState(cycle, 0)).toBe('on');
    expect(cycleState(cycle, 2000)).toBe('on');
    expect(cycleState(cycle, 2300)).toBe('warn');
    expect(cycleState(cycle, 2900)).toBe('warn');
    expect(cycleState(cycle, 3100)).toBe('off');
    expect(cycleState(cycle, 5900)).toBe('off');
    expect(cycleState(cycle, 6100)).toBe('on');
  });

  it('shifts with its phase so neighbouring panels can chase each other', () => {
    const shifted: PropCycle = { ...cycle, phase: 0.5 };
    expect(cycleState(shifted, 0)).toBe('off');
    expect(cycleState(shifted, 3100)).toBe('on');
  });

  it('always gives the player the full warning before a panel vanishes', () => {
    let warnStart = -1;
    for (let ms = 0; ms < 6000; ms += 10) {
      const s = cycleState(cycle, ms);
      if (s === 'warn' && warnStart < 0) warnStart = ms;
      if (s === 'off') {
        expect(ms - warnStart).toBeGreaterThanOrEqual(790);
        return;
      }
    }
    throw new Error('panel never went dark');
  });
});

describe('moving surfaces in the simulation', () => {
  const rise = (dy: number, period: number, dx = 0): PropMotion => ({ type: 'slide', dx, dy, period });

  it('carries MAGNO up with an elevator platform without dropping him', async () => {
    const platform: PropPlacement = { kind: 'washer-rig', x: 0, y: -0.25, motion: rise(8, 12) };
    const sim = await createSim(makeLevel([platform], { spawn: { x: 0, y: 0 } }));
    const d = new Driver(sim).ms(800);
    expect(d.view.state).toBe('attached');
    d.tilt(0.3, 0).ms(40).tilt(0, 0);
    const start = d.view.position.y;
    d.ms(6000);
    expect(d.view.position.y - start).toBeGreaterThan(7);
    expect(sim.run.fallCount).toBe(0);
    expect(d.view.state).toBe('attached');
  });

  it('carries MAGNO sideways on a tracking platform', async () => {
    const platform: PropPlacement = { kind: 'washer-rig', x: 0, y: -0.25, motion: rise(0, 12, 8) };
    const sim = await createSim(makeLevel([platform], { spawn: { x: 0, y: 0 } }));
    const d = new Driver(sim).ms(800).start();
    const startX = d.view.position.x;
    d.ms(6000);
    expect(d.view.position.x - startX).toBeGreaterThan(7);
    expect(sim.run.fallCount).toBe(0);
  });

  it('leaves a flip launched from a rising platform faster than one from still ground', async () => {
    const launch = async (platform: PropPlacement): Promise<number> => {
      const sim = await createSim(makeLevel([platform], { spawn: { x: 0, y: 0 } }));
      const d = new Driver(sim).ms(700).start();
      d.until(() => sim.physics.velocityAt(sim.magno.data.attach?.body ?? -1, d.view.position).y > 0.8, 5000);
      d.press().ms(900).release().tick(2);
      return d.view.velocity.y;
    };
    const still = await launch({ kind: 'washer-rig', x: 0, y: -0.25 });
    const rising = await launch({ kind: 'washer-rig', x: 0, y: -0.25, motion: rise(10, 8) });
    expect(rising).toBeGreaterThan(still + 0.5);
  });

  it('rides a swinging crane hook along its arc', async () => {
    const pivot = { x: 0, y: 14 };
    const hook: PropPlacement = { kind: 'crane-hook', x: 0, y: 6, motion: { type: 'swing', pivot, arc: 0.5, period: 6 } };
    const sim = await createSim(makeLevel([hook], { spawn: { x: 0, y: 6.6 } }));
    const d = new Driver(sim).ms(600).start();
    expect(d.view.state).toBe('attached');
    let maxX = 0;
    for (let i = 0; i < 360; i++) {
      d.tick();
      maxX = Math.max(maxX, Math.abs(d.view.position.x));
      expect(d.view.state).toBe('attached');
    }
    expect(maxX).toBeGreaterThan(2);
    const radius = Math.hypot(d.view.position.x - pivot.x, d.view.position.y - pivot.y);
    expect(radius).toBeGreaterThan(7.0);
    expect(radius).toBeLessThan(7.5);
  });

  it('reproduces the same path after a snapshot is restored', async () => {
    const platform: PropPlacement = { kind: 'washer-rig', x: 0, y: -0.25, motion: rise(8, 12, 4) };
    const sim = await createSim(makeLevel([platform], { spawn: { x: 0, y: 0 } }));
    const d = new Driver(sim).ms(500).start().ms(2000);
    const snap = sim.snapshot();
    const trace = (): number[] => {
      const out: number[] = [];
      for (let i = 0; i < 120; i++) {
        d.tick();
        out.push(d.view.position.x, d.view.position.y);
      }
      return out;
    };
    const first = trace();
    sim.restore(snap);
    const second = trace();
    expect(second).toEqual(first);
  });
});

describe('blinking surfaces in the simulation', () => {
  const panel = (cycle: PropCycle): PropPlacement => ({ kind: 'neon-panel', x: 0, y: -0.275, w: 6, cycle });

  it('holds MAGNO through the warning and drops him when the panel goes dark', async () => {
    const sim = await createSim(makeLevel([panel({ period: 8, on: 0.5, warn: 1 })], { spawn: { x: 0, y: 0 } }));
    const d = new Driver(sim).ms(900).start();
    expect(d.view.state).toBe('attached');
    d.ms(2200);
    expect(d.view.state).toBe('attached');
    d.ms(1900);
    expect(d.view.state).not.toBe('attached');
    d.ms(600);
    expect(d.view.position.y).toBeLessThan(-0.5);
  });

  it('catches a falling MAGNO while it is lit', async () => {
    const sim = await createSim(makeLevel([panel({ period: 8, on: 0.6 })], { spawn: { x: 0, y: 3 } }));
    const d = new Driver(sim).start().ms(1500);
    expect(d.view.state).toBe('attached');
    expect(d.view.position.y).toBeGreaterThan(-0.1);
  });

  it('is not a surface at all while dark: MAGNO falls straight through its footprint', async () => {
    const sim = await createSim(makeLevel([panel({ period: 6, on: 0.4, phase: 0.5, warn: 0.5 }), floor({ y: -30 })], { spawn: { x: 0, y: 4 } }));
    const d = new Driver(sim).start().ms(1000);
    expect(d.view.position.y).toBeLessThan(0);
    expect(d.view.velocity.y).toBeLessThan(-5);
  });
});
