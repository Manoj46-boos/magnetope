import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { ALL_LEVELS, levelById } from '@/levels';
import { Driver, createSim } from './helpers/harness';

const MB = 1024 * 1024;

/** Heap still in use after a full collection: what the game would be holding on to. */
const retainedHeap = (): number => {
  const collect = (globalThis as { gc?: () => void }).gc;
  if (!collect) throw new Error('The soak tests need node --expose-gc (set in vite.config.ts)');
  collect();
  return process.memoryUsage().heapUsed;
};

describe('soak (PRD 14.3 performance protocol, scaled to a unit run)', () => {
  it('lets go of everything a level held when it is left, over and over, across the whole game', async () => {
    const loadAll = async () => {
      for (const level of ALL_LEVELS) {
        const sim = await createSim(level);
        new Driver(sim).ms(100);
        sim.dispose();
      }
    };
    await loadAll();
    const afterWarmUp = retainedHeap();
    for (let round = 0; round < 4; round++) await loadAll();
    expect((retainedHeap() - afterWarmUp) / MB).toBeLessThan(25);
  }, 240_000);

  it('plays ten minutes on the busiest level without growing, drifting or producing a NaN', async () => {
    const level = levelById('playground-08');
    const sim = await createSim(level);
    const driver = new Driver(sim);
    const rng = new Rng(20261009);
    const sample: number[] = [];

    for (let minute = 0; minute < 10; minute++) {
      for (let i = 0; i < 60 * 60; i++) {
        if (i % 45 === 0) {
          driver.tilt(rng.next() * 2 - 1, rng.next() * 2 - 1);
          if (rng.next() < 0.5) driver.press();
          else driver.release();
        }
        driver.tick();
        const { x, y } = driver.view.position;
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`MAGNO position went non-finite at minute ${minute}`);
      }
      sample.push(retainedHeap());
    }

    for (const prop of sim.physics.props) {
      const t = sim.physics.world.getRigidBody(prop.bodyHandle).translation();
      expect(Number.isFinite(t.x) && Number.isFinite(t.y), `${prop.kind.id} #${prop.index}`).toBe(true);
    }
    expect((sample[9]! - sample[2]!) / MB).toBeLessThan(15);
    sim.dispose();
  }, 300_000);
});
