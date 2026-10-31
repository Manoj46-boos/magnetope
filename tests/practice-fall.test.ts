import { describe, expect, it } from 'vitest';
import { TUNING } from '@/config/tuning';
import { levelById } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { Simulation } from '@/sim/simulation';
import type { InputFrame } from '@/sim/types';

/**
 * The practice fall (rebuild PRD Volume II, P-FT-07): the second level's clear
 * ends in a scripted descent — a celebration leap off the summit, the whole
 * way down the chimney, the soft base at the bottom. Everything the game layer
 * promises on top of this is promise about physics: here the physics itself is
 * held to the spec — unloseable, tall enough to trip the slow-motion trigger,
 * resolved as a graded fall, and the cleared run never un-cleared by it.
 */

const idle = (): InputFrame => ({ tiltX: 0, tiltY: 0, flipHeld: false, flipDown: false, flipUp: false });

/** The second level's simulation with the run marked finished, the state the game hands the descent. */
async function clearedSim() {
  return new Simulation(await loadRapier(), levelById('scrapyard-01'));
}

describe('the scripted practice descent', () => {
  const leap = { x: -2.15, y: 0.6, push: { x: -1.2, y: 1.5 } };

  it('drops the cleared run down the chimney into a graded fall and never un-clears it', async () => {
    const sim = await clearedSim();
    // the run is already cleared, the way the game hands the descent a finished level
    sim.run.started = true;
    sim.run.cleared = true;
    const level = sim.level;
    sim.practiceDrop({ x: level.summit.x + leap.x, y: level.summit.y + leap.y }, leap.push);

    let fell = false;
    let fellHeight = 0;
    let slowMoAt = 0;
    let voided = false;
    let firstImpact: { x: number; y: number } | null = null;
    sim.events.on('fall', (f) => {
      fell = true;
      fellHeight = f.heightMeters;
    });
    sim.events.on('slowMo', () => {
      slowMoAt = sim.magno.view.dropMeters;
    });
    sim.events.on('respawn', (e) => {
      if (e.reason === 'void') voided = true;
    });
    sim.events.on('impact', (e) => {
      if (!firstImpact) firstImpact = { x: e.point.x, y: e.point.y };
    });

    let ticks = 0;
    while (!fell && ticks < 60 * 30) {
      sim.step(idle());
      ticks++;
      expect(sim.run.cleared, 'the descent never un-clears the finished run').toBe(true);
    }

    expect(fell, 'the descent resolves as a fall, not a hang or a void').toBe(true);
    expect(voided).toBe(false);
    // tall enough to trip the game's own slow-motion trigger, and shareable
    expect(fellHeight).toBeGreaterThanOrEqual(TUNING.fall.slowMoHeight);
    expect(slowMoAt).toBeGreaterThanOrEqual(TUNING.fall.slowMoHeight);
    // a real grade came out of it: the deadpan card's own number
    expect(fellHeight).toBeLessThan(30);
    // the first thing the drop hits is the soft base, not the plate or a wall partway down
    expect(firstImpact, 'the descent landed on something').not.toBeNull();
    expect(firstImpact!.y).toBeGreaterThan(0.4);
    expect(Math.abs(firstImpact!.x)).toBeLessThan(1.6);
    // and once the bounce comedy plays out, the body rests somewhere down at the base
    for (let i = 0; i < 60 * 8; i++) sim.step(idle());
    expect(sim.magno.view.position.y).toBeLessThan(2);
    expect(Math.abs(sim.magno.view.position.x)).toBeLessThan(4);
    sim.dispose();
  }, 30_000);

  it('stages the drop from the summit the celebration leap reads from', async () => {
    const sim = await clearedSim();
    const level = sim.level;
    const before = sim.magno.view.position;
    sim.practiceDrop({ x: level.summit.x + leap.x, y: level.summit.y + leap.y }, leap.push);
    const after = sim.magno.view;
    // a small pop above the summit, clear of the steel it stands on, not a teleport across the level
    expect(after.position.y).toBeGreaterThan(level.summit.y);
    expect(after.position.y).toBeLessThan(level.summit.y + 2);
    expect(Math.abs(after.position.x - before.x)).toBeLessThan(6);
    expect(after.velocity.x).toBeLessThan(0);
    expect(after.state).toBe('airborne');
    sim.dispose();
  });
});
