import { describe, expect, it } from 'vitest';
import { TUNING } from '@/config/tuning';
import type { PropPlacement } from '@/sim/types';
import { Driver, createSim, floor, makeLevel, ticks } from './helpers/harness';

const wall = (x: number, y = 8, h = 16): PropPlacement => ({ kind: 'fridge', x, y, w: 0.8, h });

async function setup(props: PropPlacement[] = []) {
  const sim = await createSim(makeLevel([floor(), ...props]));
  const d = new Driver(sim);
  d.ms(700);
  return { sim, d };
}

describe('attach and momentum', () => {
  it('rests attached on a ferromagnetic floor', async () => {
    const { d } = await setup();
    expect(d.view.state).toBe('attached');
    expect(d.view.grounded).toBe(true);
  });

  it('does not stick to non-metal and stays free', async () => {
    const sim = await createSim(makeLevel([floor({ kind: 'slab', w: 16, h: 0.8 })]));
    const d = new Driver(sim).ms(900);
    expect(d.view.state).toBe('airborne');
    expect(d.view.grounded).toBe(true);
  });

  it('keeps tangential speed on arrival and bleeds it through friction instead of zeroing it', async () => {
    const { sim, d } = await setup([wall(4)]);
    const body = sim.physics.magnoBody;
    body.setTranslation({ x: 2.2, y: 6, z: 0 }, true);
    body.setLinvel({ x: 8, y: 6, z: 0 }, true);
    expect(d.until(() => d.view.state === 'attached', 1000)).toBe(true);
    const arrival = d.view.velocity.y;
    const speeds: number[] = [];
    for (let i = 0; i < ticks(400); i++) {
      d.tick();
      speeds.push(d.view.velocity.y);
    }
    expect(arrival).toBeGreaterThan(1.5);
    expect(speeds[ticks(60)]!).toBeGreaterThan(0.1);
    expect(Math.abs(speeds[speeds.length - 1]!)).toBeLessThan(arrival * 0.5);
  });

  it('hangs on a ceiling without falling', async () => {
    const { sim, d } = await setup([{ kind: 'girder', x: 0, y: 6, w: 6, h: 0.5 }]);
    const body = sim.physics.magnoBody;
    body.setTranslation({ x: 0, y: 5.2, z: 0 }, true);
    body.setLinvel({ x: 0, y: 3, z: 0 }, true);
    d.ms(1500);
    expect(d.view.state).toBe('attached');
    expect(d.view.position.y).toBeGreaterThan(5.0);
  });
});

describe('repel', () => {
  it('launches harder for a longer charge', async () => {
    const run = async (holdMs: number) => {
      const { d } = await setup();
      d.press().ms(holdMs).release().tick();
      return Math.hypot(d.view.velocity.x, d.view.velocity.y);
    };
    const tap = await run(40);
    const half = await run(450);
    const full = await run(950);
    expect(tap).toBeCloseTo(TUNING.repel.tapSpeed, 0);
    expect(half).toBeGreaterThan(tap + 1.5);
    expect(full).toBeCloseTo(TUNING.repel.fullSpeed, 0);
  });

  it('adds 30% of the power along the tilt', async () => {
    const { d } = await setup();
    d.press().ms(950).tilt(1, 0).release().tick();
    expect(d.view.velocity.x).toBeCloseTo(TUNING.repel.fullSpeed * TUNING.repel.tiltShare, 0);
  });

  it('fires off a wall along its contact normal', async () => {
    const { sim, d } = await setup([wall(1.5)]);
    const body = sim.physics.magnoBody;
    body.setTranslation({ x: 0.7, y: 5, z: 0 }, true);
    body.setLinvel({ x: 3, y: 0, z: 0 }, true);
    expect(d.until(() => d.view.state === 'attached', 1500)).toBe(true);
    d.press().ms(950).release().tick();
    expect(d.view.velocity.x).toBeLessThan(-10);
  });

  it('does not re-stick to the surface it just left', async () => {
    const { d } = await setup();
    d.press().ms(60).release().ms(TUNING.repel.lockMs / 2);
    expect(d.view.state).toBe('repelled');
    d.ms(300);
    expect(d.view.position.y).toBeGreaterThan(0.6);
  });

  it('reports the 3-level charge meter', async () => {
    const { sim, d } = await setup();
    const levels: number[] = [];
    sim.events.on('chargeLevel', (e) => levels.push(e.level));
    d.press().ms(1000);
    expect(levels).toEqual([1, 2, 3]);
  });
});

describe('snap', () => {
  it('pulls MAGNO to a surface inside the snap radius and catches it', async () => {
    const { sim, d } = await setup([{ kind: 'girder', x: 3, y: 6, w: 4, h: 0.4 }]);
    d.tilt(0, 1).press().ms(900).release().tick();
    expect(d.until(() => d.view.position.y > 3.5, 2000)).toBe(true);
    const events: string[] = [];
    sim.events.on('snapEngage', () => events.push('engage'));
    sim.events.on('attach', (e) => events.push(e.viaSnap ? 'snap-catch' : 'attach'));
    d.tilt(0.6, 0.8).press().ms(80).release();
    expect(d.until(() => d.view.state === 'attached', 1500)).toBe(true);
    expect(events).toContain('engage');
    expect(events).toContain('snap-catch');
  });

  it('whiffs when nothing magnetic is in range', async () => {
    const { sim, d } = await setup([{ kind: 'slab', x: 4, y: 6, w: 3, h: 0.5 }]);
    d.press().ms(900).release().ms(300);
    let whiffs = 0;
    sim.events.on('snapWhiff', () => whiffs++);
    d.press().ms(60).release().tick(3);
    expect(whiffs).toBe(1);
    expect(d.view.snapEngaged).toBe(false);
  });

  it('arms with no target when the only surface is beyond 4.5 m', async () => {
    const { d } = await setup([{ kind: 'girder', x: 14, y: 6, w: 3, h: 0.4 }]);
    d.press().ms(900).release().ms(250).press().tick(2);
    expect(d.view.snapArmed).toBe(true);
    expect(d.view.snapTarget).toBeNull();
  });

  it('does not target a surface hidden behind another', async () => {
    const { d } = await setup([
      { kind: 'slab', x: 2, y: 4, w: 0.5, h: 6 },
      { kind: 'beam', x: 4, y: 4, w: 0.5, h: 5 },
    ]);
    d.press().ms(900).release().ms(300).tilt(1, 0).press().tick(2);
    expect(d.view.snapTarget === null || d.view.snapTarget.x < 3).toBe(true);
  });
});

describe('forgiveness windows', () => {
  async function leaveCeiling() {
    const { sim, d } = await setup([{ kind: 'girder', x: 0, y: 6, w: 6, h: 0.5 }]);
    const body = sim.physics.magnoBody;
    body.setTranslation({ x: 0, y: 5.3, z: 0 }, true);
    body.setLinvel({ x: 0, y: 2, z: 0 }, true);
    expect(d.until(() => d.view.state === 'attached', 1000)).toBe(true);
    body.setTranslation({ x: 0, y: 4.0, z: 0 }, true);
    expect(d.until(() => d.view.state === 'airborne', 500)).toBe(true);
    return { sim, d };
  }

  it('registers a late flip inside the coyote window as a launch', async () => {
    const { d } = await leaveCeiling();
    d.press().tick(3).release().tick();
    expect(d.view.state).toBe('repelled');
  });

  it('degrades a flip outside the coyote window into a snap arm', async () => {
    const { d } = await leaveCeiling();
    d.ms(TUNING.windows.coyoteMs + 150).press().tick(2);
    expect(d.view.state).not.toBe('charging');
    expect(d.view.snapArmed).toBe(true);
  });
});

describe('weak metal', () => {
  async function grabSheet() {
    const { sim, d } = await setup([{ kind: 'sheet', x: 0, y: 4, w: 4, h: 0.22 }]);
    const body = sim.physics.magnoBody;
    body.setTranslation({ x: 0, y: 3.3, z: 0 }, true);
    body.setLinvel({ x: 0, y: 4, z: 0 }, true);
    expect(d.until(() => sim.magno.data.attach?.weak === true, 1000)).toBe(true);
    return { sim, d };
  }

  it('holds for about 1.2 s then lets go', async () => {
    const { sim, d } = await grabSheet();
    const start = sim.tick;
    let crumbled = false;
    sim.events.on('weakCrumble', () => (crumbled = true));
    expect(d.until(() => d.view.state !== 'attached', 3000)).toBe(true);
    const heldMs = ((sim.tick - start) * 1000) / 60;
    expect(crumbled).toBe(true);
    expect(heldMs).toBeGreaterThan(TUNING.weakMetal.holdMs - 200);
    expect(heldMs).toBeLessThan(TUNING.weakMetal.holdMs + 200);
  });

  it('refuses to re-grab the sheet during the lockout', async () => {
    const { d } = await grabSheet();
    d.until(() => d.view.state !== 'attached', 3000);
    d.ms(250);
    expect(d.view.state).not.toBe('attached');
  });
});

describe('crawling', () => {
  it('moves along a wall under tilt and holds still without it', async () => {
    const { sim, d } = await setup([wall(1.5)]);
    const body = sim.physics.magnoBody;
    body.setTranslation({ x: 0.7, y: 3, z: 0 }, true);
    body.setLinvel({ x: 3, y: 0, z: 0 }, true);
    expect(d.until(() => d.view.state === 'attached', 1500)).toBe(true);
    d.ms(500);
    const rest = d.view.position.y;
    expect(Math.abs(d.view.velocity.y)).toBeLessThan(0.3);
    d.tilt(0, 1).ms(1200);
    expect(d.view.position.y).toBeGreaterThan(rest + 0.8);
    d.tilt(0, 0).ms(900);
    const stopped = d.view.position.y;
    d.ms(600);
    expect(Math.abs(d.view.position.y - stopped)).toBeLessThan(0.15);
  });
});
