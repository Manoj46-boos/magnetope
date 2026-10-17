import { describe, expect, it } from 'vitest';
import { MATERIALS } from '@/config/materials';
import type { PropPlacement } from '@/sim/types';
import { Driver, createSim, makeLevel } from './helpers/harness';

const surface = (kind: string, w: number, h: number): PropPlacement => ({ kind, x: 0, y: -h / 2, w, h });

async function drop(prop: PropPlacement, height: number) {
  const sim = await createSim(makeLevel([prop], { spawn: { x: 0, y: height }, bounds: { minX: -30, maxX: 30 } }));
  const driver = new Driver(sim);
  let wentLimp = false;
  let attached = false;
  sim.events.on('limp', () => (wentLimp = true));
  sim.events.on('attach', () => (attached = true));
  let peakBounce = 0;
  let landed = false;
  sim.events.on('impact', () => (landed = true));
  for (let i = 0; i < 60 * 4; i++) {
    driver.tick();
    if (landed) peakBounce = Math.max(peakBounce, driver.view.position.y);
  }
  return { sim, driver, wentLimp, attached, peakBounce };
}

describe('ball pit', () => {
  it('is a cushion, not a magnet', () => {
    expect(MATERIALS.ballpit.cushion).toBe(true);
    expect(MATERIALS.ballpit.magnetic).toBe('inert');
  });

  it('swallows a long fall without leaving MAGNO limp or costing a fall', async () => {
    const { sim, wentLimp } = await drop(surface('ball-pit', 5, 1.2), 14);
    expect(wentLimp).toBe(false);
    expect(sim.run.fallCount).toBe(0);
  });

  it('knocks him limp on a hard floor from the same height', async () => {
    const { wentLimp } = await drop(surface('slab', 12, 1.2), 14);
    expect(wentLimp).toBe(true);
  });

  it('does not throw him back up the way a trampoline does', async () => {
    const pit = await drop(surface('ball-pit', 5, 1.2), 8);
    const trampoline = await drop(surface('trampoline', 5, 0.5), 8);
    expect(trampoline.peakBounce).toBeGreaterThan(pit.peakBounce + 3);
  });

  it('never lets him stick, so he has to climb out under his own power', async () => {
    const { attached } = await drop(surface('ball-pit', 5, 1.2), 6);
    expect(attached).toBe(false);
  });

  it('lets him stand and steer once he has landed', async () => {
    const { driver } = await drop(surface('ball-pit', 8, 1.2), 6);
    const x0 = driver.view.position.x;
    driver.tilt(1, 0).ms(1200);
    expect(driver.view.position.x).toBeGreaterThan(x0 + 0.5);
  });
});
