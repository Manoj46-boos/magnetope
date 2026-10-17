import { describe, expect, it } from 'vitest';
import { MagnoRig } from '@/render/magno-rig';
import { BRACE_LEAD_S, GRAB_CONE_DEG, GRAB_REACH_M, braceAmount, grabPoint } from '@/render/hand-reach';
import type { MagnoView } from '@/sim/magno';
import type { PropPlacement } from '@/sim/types';
import { Driver, TICK_MS, createSim, makeLevel } from './helpers/harness';

/**
 * PRD 7.4: the hands brace 150 ms before a predicted landing, and reach for a steel face that
 * lies inside a 30 degree cone of travel. Both are decided by what the physics world has ahead.
 */

const slabFloor: PropPlacement = { kind: 'slab', x: 0, y: -0.6, w: 300, h: 1.2 };
const GRAVITY_TICKS_TO_IGNORE = 1;

async function dropOnto(height: number) {
  const sim = await createSim(makeLevel([slabFloor], { spawn: { x: -8, y: 0 } }));
  const d = new Driver(sim);
  d.ms(400);
  const body = sim.physics.magnoBody;
  body.setTranslation({ x: 0, y: height + 0.3, z: 0 }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  return { sim, d };
}

describe('brace before a landing', () => {
  it.each([3, 6, 12, 25])('comes up about 150 ms before the floor of a %i m drop is hit', async (height) => {
    const { sim, d } = await dropOnto(height);
    let impactTick = -1;
    let braceTick = -1;
    sim.events.on('impact', () => {
      if (impactTick < 0) impactTick = sim.tick;
    });
    for (let i = 0; i < 600 && impactTick < 0; i++) {
      d.tick();
      if (braceTick < 0 && braceAmount(d.view, sim.physics) === 1) braceTick = sim.tick;
    }
    expect(braceTick, 'brace never came up').toBeGreaterThan(0);
    expect(impactTick, 'never landed').toBeGreaterThan(0);
    const leadMs = (impactTick - braceTick) * TICK_MS;
    expect(leadMs).toBeGreaterThan(BRACE_LEAD_S * 1000 - 60);
    expect(leadMs).toBeLessThan(BRACE_LEAD_S * 1000 + 60);
  });

  it('stays down through a long fall into open air', async () => {
    const sim = await createSim(makeLevel([], { spawn: { x: 0, y: 0 } }));
    const d = new Driver(sim);
    sim.physics.magnoBody.setTranslation({ x: 0, y: 40, z: 0 }, true);
    for (let i = 0; i < 180; i++) {
      d.tick();
      expect(braceAmount(d.view, sim.physics), `tick ${i}`).toBe(0);
    }
    expect(d.view.velocity.y).toBeLessThan(-14);
  });

  it('does not brace while rising or while stuck to a wall', async () => {
    const { sim, d } = await dropOnto(3);
    expect(braceAmount({ ...d.view, velocity: { x: 0, y: 6 } }, sim.physics)).toBe(0);
    expect(braceAmount({ ...d.view, attachNormal: { x: 1, y: 0 }, velocity: { x: 0, y: -8 } }, sim.physics)).toBe(0);
    expect(braceAmount({ ...d.view, limp: true, velocity: { x: 0, y: -8 } }, sim.physics)).toBe(0);
  });
});

describe('grabbing for a steel face', () => {
  const BEAM_HALF_WIDTH = 0.25;
  /** A steel beam whose near face is `face` metres ahead of MAGNO's start. */
  const wall = (face: number): PropPlacement => ({ kind: 'beam', x: face + BEAM_HALF_WIDTH, y: 20, h: 8 });
  const woodWall = (face: number): PropPlacement => ({ kind: 'toy-block', x: face + 1.2, y: 20 });

  /** MAGNO coasting along +x at 6 m/s in open air, one tick after release. */
  async function approach(props: PropPlacement[]) {
    const sim = await createSim(makeLevel(props, { spawn: { x: -20, y: 0 } }));
    const d = new Driver(sim);
    const body = sim.physics.magnoBody;
    body.setTranslation({ x: 0, y: 20, z: 0 }, true);
    body.setLinvel({ x: 6, y: 0, z: 0 }, true);
    d.tick(GRAVITY_TICKS_TO_IGNORE);
    return { sim, d };
  }

  const reach = (view: MagnoView, sim: { physics: Parameters<typeof grabPoint>[1] }) => grabPoint(view, sim.physics, { x: 0, y: 0 });

  it('reaches for a steel face ahead once it is within reach, at the point of the face', async () => {
    const { sim, d } = await approach([wall(1.5)]);
    const target = reach(d.view, sim);
    expect(target).not.toBeNull();
    expect(Math.abs(target!.y - d.view.position.y)).toBeLessThan(0.3);
    expect(target!.x - d.view.position.x).toBeCloseTo(1.5, 0);
  });

  it('keeps its hands to itself while the face is still far off', async () => {
    const { sim, d } = await approach([wall(GRAB_REACH_M + 1.5)]);
    expect(reach(d.view, sim)).toBeNull();
  });

  it('does not reach for wood, which cannot hold him', async () => {
    const { sim, d } = await approach([woodWall(1)]);
    expect(reach(d.view, sim)).toBeNull();
  });

  it(`reaches for a face up to ${GRAB_CONE_DEG} degrees off his heading but not beyond it`, async () => {
    const aside = (deg: number): PropPlacement => {
      const r = 1.4;
      const a = (deg * Math.PI) / 180;
      return { kind: 'beam', x: r * Math.cos(a) + 0.18, y: 20 + r * Math.sin(a), h: 0.9 };
    };
    const inside = await approach([aside(GRAB_CONE_DEG - 12)]);
    expect(reach(inside.d.view, inside.sim)).not.toBeNull();
    const outside = await approach([aside(GRAB_CONE_DEG + 25)]);
    expect(reach(outside.d.view, outside.sim)).toBeNull();
  });

  it('does not reach while charging a flip or lying limp', async () => {
    const { sim, d } = await approach([wall(1.5)]);
    expect(reach({ ...d.view, limp: true }, sim)).toBeNull();
    expect(reach({ ...d.view, polarity: 'repel' }, sim)).toBeNull();
    expect(reach({ ...d.view, attachNormal: { x: -1, y: 0 } }, sim)).toBeNull();
  });
});

describe('the rig follows the anticipation', () => {
  const fallingView = (extra: Partial<MagnoView> = {}): MagnoView =>
    ({
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: -10 },
      angle: 0,
      visualAngle: 0,
      state: 'airborne',
      polarity: 'attract',
      charge01: 0,
      chargeLevel: 0,
      snapArmed: false,
      snapEngaged: false,
      snapTarget: null,
      attachNormal: null,
      limp: false,
      scramble: false,
      recoverPhase: 0,
      grounded: false,
      chaining: false,
      dropMeters: 3,
      ...extra,
    }) as MagnoView;

  const settle = (rig: MagnoRig, view: MagnoView): void => {
    for (let i = 0; i < 90; i++) rig.update(view, view.position, 1 / 120, false);
  };
  const hand = (rig: MagnoRig, side: -1 | 1) => rig.handLocal(side, { x: 0, y: 0 });

  it('lifts both hands when bracing, above where they hang in a plain fall', () => {
    const plain = new MagnoRig();
    settle(plain, fallingView());
    const braced = new MagnoRig();
    braced.setBrace(1);
    settle(braced, fallingView());
    for (const side of [-1, 1] as const) expect(hand(braced, side).y).toBeGreaterThan(hand(plain, side).y + 0.08);
  });

  it('points both hands toward the face it is grabbing for', () => {
    const right = new MagnoRig();
    right.setGrab({ x: 1.4, y: 0 });
    settle(right, fallingView({ velocity: { x: 6, y: 0 } }));
    const left = new MagnoRig();
    left.setGrab({ x: -1.4, y: 0 });
    settle(left, fallingView({ velocity: { x: -6, y: 0 } }));
    // The far hand is held back by its reach; the near one extends past the body's midline.
    expect(hand(right, -1).x).toBeGreaterThan(0.05);
    expect(hand(right, 1).x).toBeGreaterThan(0.3);
    expect(hand(left, 1).x).toBeLessThan(-0.05);
    expect(hand(left, -1).x).toBeLessThan(-0.3);
  });

  it('lets go of the reach once there is nothing to grab', () => {
    const rig = new MagnoRig();
    rig.setGrab({ x: 1.4, y: 0 });
    settle(rig, fallingView({ velocity: { x: 6, y: 0 } }));
    const reaching = hand(rig, 1).x;
    rig.setGrab(null);
    settle(rig, fallingView({ velocity: { x: 6, y: 0 } }));
    expect(hand(rig, 1).x).toBeLessThan(reaching - 0.05);
  });
});
