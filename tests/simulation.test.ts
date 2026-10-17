import { describe, expect, it } from 'vitest';
import { starsFor, type SimSnapshot } from '@/sim/simulation';
import type { InputFrame } from '@/sim/types';
import { Driver, createSim, floor, makeLevel } from './helpers/harness';

const climbLevel = makeLevel(
  [floor(), { kind: 'beam', x: 3, y: 8, w: 0.8, h: 16 }, { kind: 'girder', x: 0, y: 6, w: 5, h: 0.4 }],
  { summit: { x: 0, y: 5, radius: 1.2 }, checkpoints: [{ x: 0, y: 3 }], parSeconds: 20 },
);

const script = (tick: number): InputFrame => {
  const held = tick % 90 > 40 && tick % 90 < 75;
  const prev = (tick - 1) % 90 > 40 && (tick - 1) % 90 < 75;
  return {
    tiltX: Math.sin(tick / 30),
    tiltY: Math.cos(tick / 45),
    flipHeld: held,
    flipDown: held && !prev,
    flipUp: !held && prev,
  };
};

describe('determinism', () => {
  it('replays identical inputs to bit-identical state', async () => {
    const run = async () => {
      const sim = await createSim(makeLevel([floor(), { kind: 'beam', x: 3, y: 8, w: 0.8, h: 16 }]));
      for (let i = 0; i < 900; i++) sim.step(script(i));
      const t = sim.physics.magnoBody.translation();
      return [t.x, t.y, sim.magno.view.state];
    };
    const a = await run();
    const b = await run();
    expect(a).toEqual(b);
  });

  it('restores a snapshot and then follows the exact same trajectory', async () => {
    const sim = await createSim(makeLevel([floor(), { kind: 'beam', x: 3, y: 8, w: 0.8, h: 16 }]));
    for (let i = 0; i < 300; i++) sim.step(script(i));
    const snap: SimSnapshot = sim.snapshot();
    for (let i = 300; i < 700; i++) sim.step(script(i));
    const first = sim.physics.magnoBody.translation();
    const firstX = first.x;
    const firstY = first.y;
    sim.restore(snap);
    for (let i = 300; i < 700; i++) sim.step(script(i));
    const second = sim.physics.magnoBody.translation();
    expect(second.x).toBe(firstX);
    expect(second.y).toBe(firstY);
  });
});

describe('run rules', () => {
  it('does not start the clock until the first input', async () => {
    const sim = await createSim(climbLevel);
    const d = new Driver(sim);
    d.ms(1000);
    expect(sim.run.started).toBe(false);
    expect(sim.run.timeMs).toBe(0);
    d.press().tick(2);
    expect(sim.run.started).toBe(true);
  });

  it('starts the clock on a tilt as well as a flip', async () => {
    const sim = await createSim(climbLevel);
    const d = new Driver(sim);
    d.tilt(0.8, 0).tick(2);
    expect(sim.run.started).toBe(true);
  });

  it('clears when MAGNO reaches the summit beacon and awards stars', async () => {
    const sim = await createSim(climbLevel);
    const d = new Driver(sim);
    let summit: { stars: number; noFall: boolean; underPar: boolean } | null = null;
    sim.events.on('summit', (s) => (summit = s));
    d.ms(500);
    d.tilt(0, 1).tick(2);
    sim.physics.magnoBody.setTranslation({ x: 0, y: 4.6, z: 0 }, true);
    d.ms(400);
    expect(summit).not.toBeNull();
    expect(summit!.noFall).toBe(true);
    expect(summit!.underPar).toBe(true);
    expect(summit!.stars).toBe(3);
  });

  it('freezes the timer after a clear', async () => {
    const sim = await createSim(climbLevel);
    const d = new Driver(sim);
    d.ms(300);
    d.tilt(0, 1).tick(2);
    sim.physics.magnoBody.setTranslation({ x: 0, y: 4.6, z: 0 }, true);
    d.ms(300);
    const frozen = sim.run.timeMs;
    expect(sim.run.cleared).toBe(true);
    d.ms(600);
    expect(sim.run.timeMs).toBe(frozen);
  });

  it('records checkpoints once and never goes backwards', async () => {
    const sim = await createSim(climbLevel);
    const seen: number[] = [];
    sim.events.on('checkpoint', (c) => seen.push(c.index));
    const d = new Driver(sim);
    d.ms(300);
    sim.physics.magnoBody.setTranslation({ x: 0, y: 3.4, z: 0 }, true);
    d.ms(200);
    sim.physics.magnoBody.setTranslation({ x: 0, y: 0.5, z: 0 }, true);
    d.ms(500);
    expect(seen).toEqual([0]);
    expect(sim.run.checkpoint).toBe(0);
  });

  it('respawns from the void at the last checkpoint', async () => {
    const sim = await createSim(climbLevel);
    const d = new Driver(sim);
    d.ms(300);
    sim.physics.magnoBody.setTranslation({ x: 0, y: 3.4, z: 0 }, true);
    d.ms(100);
    sim.physics.magnoBody.setTranslation({ x: 20, y: -80, z: 0 }, true);
    d.ms(100);
    expect(d.view.position.y).toBeGreaterThan(2);
    expect(Math.abs(d.view.position.x)).toBeLessThan(1);
    expect(sim.run.fallCount).toBe(1);
  });

  it('computes stars from clear, no-fall and par', () => {
    expect(starsFor(false, true, true)).toBe(0);
    expect(starsFor(true, false, false)).toBe(1);
    expect(starsFor(true, true, false)).toBe(2);
    expect(starsFor(true, false, true)).toBe(2);
    expect(starsFor(true, true, true)).toBe(3);
  });
});

describe('dynamic props', () => {
  it('rolls a live barrel toward MAGNO through the field', async () => {
    const sim = await createSim(
      makeLevel([floor(), { kind: 'barrel', x: 1.3, y: 0.7, r: 0.7 }], { spawn: { x: -2, y: 0 } }),
    );
    const d = new Driver(sim);
    d.ms(600);
    const prop = sim.physics.world.getRigidBody(sim.physics.props.find((p) => p.dynamic)!.bodyHandle);
    const before = prop.translation().x;
    d.ms(1500);
    expect(prop.translation().x).toBeLessThan(before - 0.2);
  });

  it('leaves non-live props untouched by the field', async () => {
    const sim = await createSim(
      makeLevel([floor(), { kind: 'loose-crate', x: 0, y: 0.7 }], { spawn: { x: -2, y: 0 } }),
    );
    const d = new Driver(sim);
    d.ms(600);
    const prop = sim.physics.world.getRigidBody(sim.physics.props.find((p) => p.dynamic)!.bodyHandle);
    const before = prop.translation().x;
    d.ms(1500);
    expect(Math.abs(prop.translation().x - before)).toBeLessThan(0.05);
  });

  it('breaks glass on a hard hit and removes its collider', async () => {
    const sim = await createSim(
      makeLevel([floor({ kind: 'slab' }), { kind: 'pane', x: 0, y: 6, w: 3, h: 0.2 }], { spawn: { x: 6, y: 0 } }),
    );
    const d = new Driver(sim);
    let broken = 0;
    sim.events.on('glassBreak', () => broken++);
    d.ms(400);
    const body = sim.physics.magnoBody;
    body.setTranslation({ x: 0, y: 8, z: 0 }, true);
    body.setLinvel({ x: 0, y: -14, z: 0 }, true);
    d.ms(1500);
    expect(broken).toBe(1);
    expect(d.view.position.y).toBeLessThan(5);
  });
});

describe('retry', () => {
  it('rebuilds a fresh simulation in well under 400 ms', async () => {
    const t0 = performance.now();
    const sim = await createSim(climbLevel);
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(400);
    sim.dispose();
  });
});
