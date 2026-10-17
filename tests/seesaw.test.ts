import { describe, expect, it } from 'vitest';
import { propKind } from '@/config/props';
import type { PropPlacement } from '@/sim/types';
import { Driver, createSim, makeLevel } from './helpers/harness';

const PLANK: PropPlacement = { kind: 'seesaw', x: 0, y: 8, hinge: { x: 0, y: 8 } };
const LIMIT = propKind('seesaw').tilt!.limit;

async function seesaw(spawnX: number) {
  const sim = await createSim(makeLevel([PLANK], { spawn: { x: spawnX, y: 8.2 }, bounds: { minX: -30, maxX: 30 }, killY: -600 }));
  const prop = sim.physics.props[0]!;
  const body = sim.physics.world.getRigidBody(prop.bodyHandle);
  const angle = (): number => 2 * Math.atan2(body.rotation().z, body.rotation().w);
  return { sim, driver: new Driver(sim), angle };
}

describe('see-saw', () => {
  it('sits level when nothing is on it', async () => {
    const { driver, angle } = await seesaw(40);
    driver.ms(2000);
    expect(Math.abs(angle())).toBeLessThan(0.02);
  });

  it('dips under the end MAGNO lands on', async () => {
    const right = await seesaw(2);
    right.driver.ms(2500);
    expect(right.angle()).toBeLessThan(-0.2);
    const left = await seesaw(-2);
    left.driver.ms(2500);
    expect(left.angle()).toBeGreaterThan(0.2);
  });

  it('stops at its limit instead of turning over, however long he hangs there', async () => {
    const { driver, angle } = await seesaw(2.4);
    let worst = 0;
    for (let i = 0; i < 60 * 8; i++) {
      driver.tick();
      worst = Math.max(worst, Math.abs(angle()));
    }
    expect(worst).toBeLessThan(LIMIT + 0.08);
    expect(worst).toBeGreaterThan(LIMIT - 0.12);
  });

  it('keeps him attached to the end while it tips', async () => {
    const { sim, driver } = await seesaw(2);
    driver.ms(3000);
    expect(driver.view.state).toBe('attached');
    expect(sim.run.fallCount).toBe(0);
  });

  it('eases back to level once he lets go', async () => {
    const { driver, angle } = await seesaw(2);
    driver.ms(2500);
    expect(Math.abs(angle())).toBeGreaterThan(0.25);
    driver.tilt(1, 1).press().ms(900).release().ms(2500).tilt(0, 0);
    expect(driver.view.position.x).toBeGreaterThan(5);
    driver.ms(5000);
    expect(Math.abs(angle())).toBeLessThan(0.1);
  });

  it('pushes back on MAGNO when he flips off the low end, which is what makes it a launcher', async () => {
    const { driver } = await seesaw(2);
    driver.ms(2500);
    const before = driver.view.position.y;
    driver.press().ms(900).release().ms(500);
    expect(driver.view.position.y).toBeGreaterThan(before + 1.5);
  });
});
