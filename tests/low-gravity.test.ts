import { describe, expect, it } from 'vitest';
import { TUNING } from '@/config/tuning';
import { ALL_LEVELS } from '@/levels';
import { Driver, createSim, floor, makeLevel } from './helpers/harness';

/** Seconds MAGNO takes to fall `drop` metres from rest under a level's own gravity. */
async function fallTime(gravityScale: number, drop: number): Promise<number> {
  const sim = await createSim(makeLevel([floor({ y: -40, w: 40 })], { gravityScale, spawn: { x: 0, y: 0 }, killY: -100 }));
  sim.physics.magnoBody.setTranslation({ x: 0, y: 60, z: 0 }, true);
  const driver = new Driver(sim);
  let ticks = 0;
  while (driver.view.position.y > 60 - drop && ticks < 60 * 40) {
    driver.tick();
    ticks++;
  }
  return ticks / 60;
}

/** How much velocity half a second of free fall gains while the stick is held, sideways and up. */
async function steeredFall(gravityScale: number, tiltX: number, tiltY: number): Promise<{ dx: number; dy: number }> {
  const sim = await createSim(makeLevel([floor()], { gravityScale, killY: -400, bounds: { minX: -60, maxX: 60 } }));
  sim.physics.magnoBody.setTranslation({ x: 0, y: 120, z: 0 }, true);
  const driver = new Driver(sim).tick(2);
  const before = { ...driver.view.velocity };
  driver.tilt(tiltX, tiltY).ms(500);
  return { dx: driver.view.velocity.x - before.x, dy: driver.view.velocity.y - before.y };
}

/** Highest point of one full-charge flip off the floor. */
async function flipApex(gravityScale: number): Promise<number> {
  const sim = await createSim(makeLevel([floor()], { gravityScale, bounds: { minX: -30, maxX: 30 } }));
  const driver = new Driver(sim).ms(700);
  driver.press().ms(950).tilt(0, 1).release().tick().tilt(0, 0);
  let apex = 0;
  for (let i = 0; i < 60 * 30 && !(driver.view.velocity.y < -1 && apex > 3); i++) {
    driver.tick();
    apex = Math.max(apex, driver.view.position.y);
  }
  return apex;
}

describe('low gravity', () => {
  it('stretches a fall in proportion to the square root of the gravity, so lighter air feels floaty', async () => {
    const heavy = await fallTime(1, 20);
    const light = await fallTime(0.25, 20);
    expect(light / heavy).toBeGreaterThan(1.8);
    expect(light / heavy).toBeLessThan(2.2);
  });

  it('carries a full flip roughly twice as high at half the gravity', async () => {
    const normal = await flipApex(1);
    const light = await flipApex(0.5);
    expect(normal).toBeGreaterThan(12);
    expect(light / normal).toBeGreaterThan(1.7);
    expect(light / normal).toBeLessThan(2.2);
  });

  it('keeps sideways steering at full strength however light the air, so a gust can always be fought', async () => {
    const heavy = await steeredFall(1, 1, 0);
    const light = await steeredFall(0.5, 1, 0);
    expect(heavy.dx).toBeCloseTo(TUNING.air.tiltAccel * 0.5, 0);
    expect(light.dx).toBeCloseTo(heavy.dx, 1);
  });

  it('holds upward steering to the same share of gravity at every weight, so lighter air never turns steering into flying', async () => {
    const share = async (scale: number): Promise<number> => {
      const free = await steeredFall(scale, 0, 0);
      const held = await steeredFall(scale, 0, 1);
      return held.dy / free.dy;
    };
    const heavy = await share(1);
    const light = await share(0.5);
    expect(heavy).toBeGreaterThan(0.7);
    expect(heavy).toBeLessThan(0.8);
    expect(light).toBeCloseTo(heavy, 1);
  });

  it('never lets a held stick cancel gravity, even at the lightest level', async () => {
    const lightest = Math.min(...ALL_LEVELS.map((l) => l.gravityScale ?? 1));
    const held = await steeredFall(lightest, 0, 1);
    expect(held.dy).toBeLessThan(-0.5);
  });

  it('keeps the air-steering promise in every shipping level', () => {
    for (const level of ALL_LEVELS) {
      const gravity = TUNING.sim.gravity * (level.gravityScale ?? 1);
      expect(TUNING.air.tiltAccel, level.id).toBeLessThan(gravity);
    }
  });

  it('pulls a snap onto a ledge overhead without lifting him past it', async () => {
    const ledge = { kind: 'girder', x: 0, y: 6, w: 6, h: 0.4 };
    const sim = await createSim(makeLevel([floor(), ledge], { gravityScale: 0.42 }));
    const driver = new Driver(sim).ms(700);
    sim.physics.magnoBody.setTranslation({ x: 0, y: 3, z: 0 }, true);
    sim.physics.magnoBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    driver.tick(2).tilt(0, 1).press().ms(80).release();
    let highest = 0;
    for (let i = 0; i < 60 * 3 && driver.view.state !== 'attached'; i++) {
      driver.tick();
      highest = Math.max(highest, driver.view.position.y);
    }
    expect(driver.view.state).toBe('attached');
    expect(highest).toBeLessThan(ledge.y);
  });
});
