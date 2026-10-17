import { describe, expect, it } from 'vitest';
import { prop } from '@/levels/author';
import type { PropPlacement } from '@/sim/types';
import { Driver, createSim, makeLevel } from './helpers/harness';

const HUB = { x: 0, y: 10 };
const REACH = 4.6;
const CABIN_DROP = 1.7;

const wheel = (): PropPlacement[] => prop.drivenWheel(HUB.x, HUB.y, 'w', REACH);

/** A wheel in empty sky with MAGNO placed at (x, y), so only the wheel and his own moves are in play. */
async function rig(spawn: { x: number; y: number }, parts: PropPlacement[] = wheel()) {
  const sim = await createSim(makeLevel(parts, { spawn, killY: -600, bounds: { minX: -60, maxX: 60 } }));
  const bodyOf = (index: number) => sim.physics.world.getRigidBody(sim.physics.props[index]!.bodyHandle);
  const hub = bodyOf(0);
  const spoke = (i: number) => bodyOf(1 + i * 2);
  const cabin = (i: number) => bodyOf(2 + i * 2);
  const angleOf = (body: ReturnType<typeof bodyOf>): number => 2 * Math.atan2(body.rotation().z, body.rotation().w);
  const tipOf = (i: number) => {
    const body = spoke(i);
    const a = angleOf(body);
    const half = (REACH - 0.9) / 2;
    return { x: body.translation().x + half * Math.cos(a), y: body.translation().y + half * Math.sin(a) };
  };
  return { sim, driver: new Driver(sim), hub, spoke, cabin, angleOf, tipOf };
}

const farAway = { x: 40, y: 60 };
const rightCabin = { x: HUB.x + REACH, y: HUB.y - CABIN_DROP + 0.2 };

describe('field-driven wheel', () => {
  it('stands exactly where it was built when nobody touches it', async () => {
    const { driver, hub, spoke, cabin, tipOf } = await rig(farAway);
    driver.ms(5000);
    expect(Math.abs(hub.angvel().z)).toBeLessThan(1e-3);
    for (let i = 0; i < 6; i++) {
      const tip = tipOf(i);
      expect(Math.hypot(tip.x - HUB.x, tip.y - HUB.y)).toBeCloseTo(REACH, 1);
      expect(cabin(i).translation().y).toBeCloseTo(tip.y - CABIN_DROP, 1);
      expect(spoke(i).translation().z).toBeCloseTo(0, 3);
    }
  });

  it('turns under the weight of MAGNO on a rim cabin and carries him down with it', async () => {
    const { sim, driver, hub, angleOf } = await rig(rightCabin);
    driver.ms(3000);
    expect(driver.view.state).toBe('attached');
    expect(angleOf(hub)).toBeLessThan(-0.6);
    expect(driver.view.position.y).toBeLessThan(HUB.y - 2);
    expect(sim.run.fallCount).toBe(0);
  });

  it('swings back up the far side like a loaded pendulum, not around and around', async () => {
    const { driver, hub, angleOf } = await rig(rightCabin);
    let lowest = 0;
    let turnedBack = false;
    for (let i = 0; i < 60 * 14; i++) {
      driver.tick();
      lowest = Math.min(lowest, angleOf(hub));
      if (hub.angvel().z > 0.05) turnedBack = true;
    }
    expect(lowest).toBeLessThan(-1.8);
    expect(lowest).toBeGreaterThan(-Math.PI * 1.5);
    expect(turnedBack).toBe(true);
  });

  it('keeps its spokes straight and its cabins on their hangers while it swings', async () => {
    const { driver, tipOf, cabin } = await rig(rightCabin);
    let worstReach = 0;
    let worstHanger = 0;
    for (let t = 0; t < 60 * 10; t++) {
      driver.tick();
      for (let i = 0; i < 6; i++) {
        const tip = tipOf(i);
        worstReach = Math.max(worstReach, Math.abs(Math.hypot(tip.x - HUB.x, tip.y - HUB.y) - REACH));
        const c = cabin(i).translation();
        worstHanger = Math.max(worstHanger, Math.abs(Math.hypot(c.x - tip.x, c.y - tip.y) - CABIN_DROP));
      }
    }
    expect(worstReach).toBeLessThan(0.12);
    expect(worstHanger).toBeLessThan(0.12);
  });

  it('keeps every cabin hanging level to the ground as the wheel goes round', async () => {
    const { driver, cabin, angleOf } = await rig(rightCabin);
    let worstTilt = 0;
    for (let t = 0; t < 60 * 8; t++) {
      driver.tick();
      for (let i = 1; i < 6; i++) worstTilt = Math.max(worstTilt, Math.abs(angleOf(cabin(i))));
    }
    expect(worstTilt).toBeLessThan(0.35);
  });

  it('gives back what a flip off the rim puts in: the wheel kicks the other way', async () => {
    const { driver, hub } = await rig(rightCabin);
    driver.ms(1200);
    const before = hub.angvel().z;
    driver.tilt(0.3, 1).press().ms(500);
    driver.release().ms(120);
    expect(driver.view.state).not.toBe('attached');
    expect(hub.angvel().z).toBeLessThan(before - 0.15);
  });

  it('coasts to a halt once nobody is on it', async () => {
    const { driver, hub } = await rig(rightCabin);
    driver.ms(2500);
    driver.tilt(-0.4, 1).press().ms(500).release().tilt(0, 0);
    driver.ms(1500);
    const kicked = Math.abs(hub.angvel().z);
    expect(kicked).toBeGreaterThan(0.1);
    driver.ms(30_000);
    expect(Math.abs(hub.angvel().z)).toBeLessThan(kicked * 0.25);
  });

  it('replays identically from a snapshot taken mid-swing', async () => {
    const { sim, driver, hub, angleOf } = await rig(rightCabin);
    driver.ms(1800);
    const snap = sim.snapshot();
    driver.ms(3000);
    const first = { angle: angleOf(hub), speed: hub.angvel().z, y: driver.view.position.y };
    sim.restore(snap);
    driver.ms(3000);
    const bodyAfter = sim.physics.world.getRigidBody(sim.physics.props[0]!.bodyHandle);
    expect(angleOf(bodyAfter)).toBe(first.angle);
    expect(bodyAfter.angvel().z).toBe(first.speed);
    expect(driver.view.position.y).toBe(first.y);
  });

  it('is put back square and still when the level resets its props', async () => {
    const { sim, driver, hub, angleOf } = await rig(rightCabin);
    driver.ms(3000);
    expect(Math.abs(angleOf(hub))).toBeGreaterThan(0.3);
    sim.physics.resetDynamicProps();
    expect(angleOf(hub)).toBeCloseTo(0, 6);
    expect(hub.angvel().z).toBe(0);
  });
});
