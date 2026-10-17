import { describe, expect, it } from 'vitest';
import type { PropPlacement } from '@/sim/types';
import { Driver, createSim, floor, makeLevel } from './helpers/harness';

const PIVOT = { x: 0, y: 10 };
const plate = (): PropPlacement => ({ kind: 'swing-plate', x: 0, y: 6, hinge: PIVOT });

/** A plate hung four metres below its pivot, with a floor underneath it. */
async function hungPlate() {
  const sim = await createSim(makeLevel([floor(), plate()]));
  const prop = sim.physics.props[1]!;
  const body = sim.physics.world.getRigidBody(prop.bodyHandle);
  const shove = (impulse: number): void => sim.physics.applyImpulseAt(prop.bodyHandle, { x: impulse, y: 0 }, { x: 0, y: 6 });
  return { sim, body, shove, driver: new Driver(sim) };
}

/** MAGNO standing on a hung plate, nothing else in the world. */
async function riderOnPlate() {
  const sim = await createSim(makeLevel([plate()], { spawn: { x: 0, y: 6.225 } }));
  const prop = sim.physics.props[0]!;
  const body = sim.physics.world.getRigidBody(prop.bodyHandle);
  return { sim, body, prop, driver: new Driver(sim) };
}

describe('hinged props', () => {
  it('hangs motionless straight below its pivot', async () => {
    const { body, driver } = await hungPlate();
    driver.ms(2500);
    expect(Math.abs(body.translation().x)).toBeLessThan(0.05);
    expect(body.translation().y).toBeCloseTo(6, 1);
  });

  it('keeps its distance from the pivot however hard it is shoved', async () => {
    const { body, shove, driver } = await hungPlate();
    driver.ms(300);
    shove(420);
    let worst = 0;
    for (let i = 0; i < 600; i++) {
      driver.tick();
      const t = body.translation();
      worst = Math.max(worst, Math.abs(Math.hypot(t.x - PIVOT.x, t.y - PIVOT.y) - 4));
    }
    expect(worst).toBeLessThan(0.08);
  });

  it('swings with the period of a real pendulum of that length', async () => {
    const { body, shove, driver } = await hungPlate();
    driver.ms(300);
    shove(200);
    const xs: number[] = [];
    for (let i = 0; i < 60 * 14; i++) {
      driver.tick();
      xs.push(body.translation().x);
    }
    const peaks: number[] = [];
    for (let i = 1; i < xs.length - 1; i++) {
      if (xs[i]! > xs[i - 1]! && xs[i]! >= xs[i + 1]! && xs[i]! > 0.2) peaks.push(i / 60);
    }
    expect(peaks.length).toBeGreaterThanOrEqual(2);
    const period = peaks[1]! - peaks[0]!;
    expect(period).toBeGreaterThan(3.7);
    expect(period).toBeLessThan(4.5);
  });

  it('keeps swinging long enough to be read as a timing puzzle', async () => {
    const { body, shove, driver } = await hungPlate();
    driver.ms(300);
    shove(300);
    const amplitude = (ms: number): number => {
      let peak = 0;
      for (let i = 0; i < (ms / 1000) * 60; i++) {
        driver.tick();
        peak = Math.max(peak, Math.abs(body.translation().x));
      }
      return peak;
    };
    const early = amplitude(4500);
    driver.ms(5000);
    const late = amplitude(4500);
    expect(early).toBeGreaterThan(1);
    expect(late).toBeGreaterThan(early * 0.4);
  });

  it('carries MAGNO along its arc without letting go', async () => {
    const { prop, sim, driver } = await riderOnPlate();
    driver.ms(1000);
    expect(driver.view.state).toBe('attached');
    sim.physics.applyImpulseAt(prop.bodyHandle, { x: 280, y: 0 }, { x: 0, y: 6 });
    let minX = 0;
    let maxX = 0;
    for (let i = 0; i < 60 * 6; i++) {
      driver.tick();
      minX = Math.min(minX, driver.view.position.x);
      maxX = Math.max(maxX, driver.view.position.x);
      expect(driver.view.state).toBe('attached');
    }
    expect(maxX).toBeGreaterThan(1);
    expect(minX).toBeLessThan(-1);
  });

  it('recoils from MAGNO: a full-charge flip off the plate sets it moving', async () => {
    const { body, driver } = await riderOnPlate();
    driver.ms(1000);
    expect(Math.hypot(body.linvel().x, body.linvel().y)).toBeLessThan(0.1);
    driver.tilt(1, 0).press().ms(900).release().tick(3);
    expect(Math.hypot(body.linvel().x, body.linvel().y)).toBeGreaterThan(0.15);
  });

  it('refuses a hinge on a prop with no mass to swing', async () => {
    await expect(createSim(makeLevel([{ kind: 'girder', x: 0, y: 6, hinge: PIVOT }]))).rejects.toThrow(/needs a mass/);
  });

  it('refuses a prop that is both scripted and dynamic', async () => {
    const both: PropPlacement = { kind: 'swing-plate', x: 0, y: 6, motion: { type: 'slide', dx: 1, dy: 0, period: 4 } };
    await expect(createSim(makeLevel([both]))).rejects.toThrow(/both dynamic and scripted/);
  });
});
