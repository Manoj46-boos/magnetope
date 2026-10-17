import { describe, expect, it } from 'vitest';
import type { PropPlacement } from '@/sim/types';
import { Driver, createSim, makeLevel } from './helpers/harness';

/**
 * PRD 4.5: during the last 300 ms of a fall a soft auto-align turns the snap towards the nearest
 * safe hold instead of the surface MAGNO is about to hit. Here MAGNO drops past two steel faces:
 * a ledge on the floor to one side, which is nearer and below him, and a tall wall on the other,
 * level with him. With the assist on and the floor close, the snap should pick the wall.
 */

const floorSlab: PropPlacement = { kind: 'slab', x: 0, y: -0.6, w: 300, h: 1.2 };
const ledge: PropPlacement = { kind: 'plate', x: 4.5, y: 0.4, w: 4, h: 0.8 };
const wall: PropPlacement = { kind: 'plate', x: -3.4, y: 5, w: 0.8, h: 10 };

async function fallPastBoth(options: { assist: boolean; height: number }) {
  const sim = await createSim(makeLevel([floorSlab, ledge, wall], { spawn: { x: 0, y: 14 }, summit: { x: 0, y: 400, radius: 1 } }));
  sim.magno.setAssist(options.assist);
  const d = new Driver(sim);
  const body = sim.physics.magnoBody;
  body.setTranslation({ x: 0, y: options.height, z: 0 }, true);
  body.setLinvel({ x: 0, y: -10, z: 0 }, true);
  return d;
}

/** The side of the room the armed snap points at: negative is the wall, positive is the ledge. */
const snapSide = (d: Driver): number => {
  d.press().tick(2);
  const target = d.view.snapTarget;
  expect(target, 'a snap target while falling past both faces').not.toBeNull();
  return Math.sign(target!.x);
};

describe('auto-align assist on the way down', () => {
  it('turns the snap from the ledge MAGNO is about to land on to the wall beside him', async () => {
    expect(snapSide(await fallPastBoth({ assist: true, height: 2.4 }))).toBe(-1);
  });

  it('leaves the snap on the nearest face when the player has switched the assist off', async () => {
    expect(snapSide(await fallPastBoth({ assist: false, height: 2.4 }))).toBe(1);
  });

  it('waits for the final stretch of the fall: high above the floor it makes no difference', async () => {
    expect(snapSide(await fallPastBoth({ assist: true, height: 9 }))).toBe(snapSide(await fallPastBoth({ assist: false, height: 9 })));
  });
});
