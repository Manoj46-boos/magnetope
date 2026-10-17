import { describe, expect, it } from 'vitest';
import { TUNING } from '@/config/tuning';
import type { PropPlacement } from '@/sim/types';
import { Driver, createSim, makeLevel } from './helpers/harness';

/**
 * PRD 7.3: a hard contact is a hit of chaos. Control authority dips to 40% for 400 ms, the wobble
 * that reads as being rattled, and then returns. A drop tall enough to count as a fall goes limp
 * instead, and a soft landing costs nothing.
 */

const slabFloor: PropPlacement = { kind: 'slab', x: 0, y: -0.6, w: 300, h: 1.2 };

async function dropFrom(height: number) {
  const sim = await createSim(makeLevel([slabFloor], { spawn: { x: -8, y: 0 } }));
  const d = new Driver(sim);
  d.ms(400);
  const body = sim.physics.magnoBody;
  body.setTranslation({ x: 0, y: height + 0.3, z: 0 }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  return { sim, d };
}

/** Runs until the hard landing registers. */
function untilRattled(d: Driver): void {
  for (let i = 0; i < 300 && !d.view.scramble; i++) d.tick();
}

/** Runs until MAGNO has settled on the floor after a landing that does not rattle him. */
function untilSettled(d: Driver): void {
  for (let i = 0; i < 300 && !d.view.grounded; i++) d.tick();
  d.ms(300);
}

describe('landing hard without falling', () => {
  it('rattles MAGNO for 400 ms and then gives control back', async () => {
    const { d } = await dropFrom(3);
    untilRattled(d);
    expect(d.view.scramble).toBe(true);
    expect(d.view.limp).toBe(false);

    d.ms(TUNING.recover.scrambleMs - 60);
    expect(d.view.scramble).toBe(true);
    d.ms(160);
    expect(d.view.scramble).toBe(false);
  });

  it('cuts steering to the scramble share while it lasts', async () => {
    /** Speed gained from a 120 ms push to the right after the same hard landing, during or after the rattle. */
    const gainFromPush = async (afterRecovery: boolean): Promise<number> => {
      const { d } = await dropFrom(3);
      untilRattled(d);
      if (afterRecovery) d.ms(TUNING.recover.scrambleMs + 150);
      const before = d.view.velocity.x;
      d.tilt(1, 0).ms(120);
      return d.view.velocity.x - before;
    };

    const rattled = await gainFromPush(false);
    const recovered = await gainFromPush(true);
    expect(recovered).toBeGreaterThan(0.15);
    expect(rattled).toBeLessThan(recovered * (TUNING.recover.scrambleAuthority + 0.25));
  });

  it('is skipped by a soft landing', async () => {
    const { d } = await dropFrom(0.4);
    untilSettled(d);
    expect(d.view.scramble).toBe(false);
  });

  it('gives way to a full limp once the drop is tall enough to count as a fall', async () => {
    const { d } = await dropFrom(TUNING.fall.minFallHeight + 3);
    let limp = false;
    d.sim.events.on('limp', () => (limp = true));
    d.ms(1500);
    expect(limp).toBe(true);
  });
});
