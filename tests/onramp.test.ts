import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ON_RAMP, onRampFor } from '@/config/onramp';
import { TUNING } from '@/config/tuning';
import { ALL_LEVELS } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording, type Recording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';
import type { LevelDef, PropPlacement } from '@/sim/types';
import { Driver, createSim, floor, makeLevel } from './helpers/harness';

/**
 * The casual on-ramp (PRD 14.3, R-LD-14 / R-ON-10): the first ten levels play
 * with wider catches and a stronger fall assist, the boosts halve at six and
 * vanish at eleven, and levels one and two are guaranteed-clearable with the
 * default settings a fresh player boots into. Everything here is measured
 * through the real simulation — the query, the scoring, the recorded routes.
 */

const routesDir = resolve(__dirname, '../src/levels/routes');
const recordingFor = (level: LevelDef): Recording => decodeRecording(readFileSync(resolve(routesDir, `${level.id}.json`), 'utf8'));

const FULL = { catchWindow: ON_RAMP.catchWindow, assist: ON_RAMP.assist };
const HALF = { catchWindow: 1 + (ON_RAMP.catchWindow - 1) / 2, assist: 1 + (ON_RAMP.assist - 1) / 2 };

describe('the ramp table', () => {
  it('holds the hand fully through level five, halves the grip to ten, and lets go after', () => {
    for (let n = 1; n <= ON_RAMP.fullThrough; n++) expect(onRampFor(n), `level ${n}`).toEqual(FULL);
    for (let n = ON_RAMP.fullThrough + 1; n <= ON_RAMP.taperThrough; n++) expect(onRampFor(n), `level ${n}`).toEqual(HALF);
    for (let n = ON_RAMP.taperThrough + 1; n <= 70; n++) expect(onRampFor(n), `level ${n}`).toEqual({ catchWindow: 1, assist: 1 });
  });

  it('arms exactly the first ten levels of the progression with their position in the ramp', () => {
    for (let i = 0; i < ALL_LEVELS.length; i++) {
      const level = ALL_LEVELS[i]!;
      expect(level.onRamp ?? { catchWindow: 1, assist: 1 }, level.id).toEqual(onRampFor(i + 1));
    }
    expect(ALL_LEVELS[ON_RAMP.taperThrough - 1]!.onRamp).toBeDefined();
    expect(ALL_LEVELS[ON_RAMP.taperThrough]!.onRamp).toBeUndefined();
  });

  it('keeps the authored difficulty of the held-hand levels inside the ten-percent gate', () => {
    const early = ALL_LEVELS.slice(0, ON_RAMP.fullThrough).map((l) => l.fallRateTarget).sort((a, b) => a - b);
    expect(early[Math.floor(early.length / 2)]).toBeLessThanOrEqual(0.1);
  });
});

describe('the widened catch window', () => {
  it('plays the level at the boosted radius without touching the base one', async () => {
    const plain = await createSim(makeLevel([floor()]));
    expect(plain.physics.snapRadius).toBe(TUNING.snap.radius);
    const boosted = await createSim(makeLevel([floor()], { onRamp: FULL }));
    expect(boosted.physics.snapRadius).toBeCloseTo(TUNING.snap.radius * FULL.catchWindow, 10);
  });

  /** A fridge wall whose face sits in the band the boost opens: 4.9 m out, past the 4.5 m base window. */
  const wallLevel = (): PropPlacement[] => [floor(), { kind: 'fridge', x: 5.8, y: 6.5, w: 1.8, h: 4 }];

  /** Rides a full charge straight up from the floor, arms the snap mid-flight, and reports what the magnet wants. */
  const flightTargets = async (onRamp?: LevelDef['onRamp']): Promise<Array<{ y: number; target: { x: number; y: number } | null }>> => {
    const sim = await createSim(makeLevel(wallLevel(), { onRamp }));
    const d = new Driver(sim);
    d.tilt(0, 1).press().ms(380).release();
    d.tick(20);
    // arms with hands off the stick, so the aim falls to the velocity and the flight stays a straight line
    d.tilt(0, 0).press();
    const readings: Array<{ y: number; target: { x: number; y: number } | null }> = [];
    for (let i = 0; i < 150; i++) {
      d.tick();
      const view = d.view;
      readings.push({ y: view.position.y, target: view.snapTarget ? { ...view.snapTarget } : null });
    }
    return readings;
  };

  it('keeps deliberate flight on the base window, then rescues a falling player toward the wall', async () => {
    const boosted = await flightTargets(FULL);
    // rising past the wall: the flight is deliberate, so the wall stays invisible and nothing nearer exists
    const rising = boosted.filter((r) => r.y > 5 && r.y < 7.4);
    expect(rising.length).toBeGreaterThan(10);
    for (const r of rising) expect(r.target).toBeNull();
    // the fall home: the assist wakes, the widened band sees the wall, and the magnet picks the save over the floor
    const falling = boosted.filter((r) => r.target && r.target.x > 4);
    expect(falling.length).toBeGreaterThan(3);
    for (const r of falling) expect(r.y).toBeGreaterThan(2);
  });

  it('never shows the wall to a player flying the same line without the boosts', async () => {
    const plain = await flightTargets(undefined);
    expect(plain.filter((r) => r.target && r.target.x > 4)).toEqual([]);
    // and when only the floor is in range, that is what the magnet arms
    expect(plain.some((r) => r.target && r.target.x < 0.5 && r.target.y < 1)).toBe(true);
  });
});

describe('the strengthened fall assist', () => {
  /**
   * Two saves while falling fast: a fridge nearly overhead, one aimed at
   * squarely to the right. At strength one the aim cone still decides and the
   * aimed save wins; at the on-ramp's full strength proximity takes over and
   * the magnet grabs the near one.
   */
  const fallTarget = async (assist: number): Promise<{ x: number; y: number } | null> => {
    const props: PropPlacement[] = [
      { kind: 'girder', x: 0, y: 0.8, w: 4, h: 0.4 },
      { kind: 'girder', x: 0, y: 4.6, w: 4, h: 0.4 },
      { kind: 'girder', x: 2.4, y: 3, w: 0.8, h: 4 },
    ];
    const sim = await createSim(makeLevel(props, { onRamp: { catchWindow: 1, assist } }));
    const body = sim.physics.magnoBody;
    body.setTranslation({ x: 0, y: 3, z: 0 }, true);
    body.setLinvel({ x: 0, y: -6, z: 0 }, true);
    const d = new Driver(sim);
    d.tilt(1, 0).press().tick(2);
    const target = d.view.snapTarget;
    return target ? { ...target } : null;
  };

  it('hands the catch to the aimed save at strength one and the near save at full strength', async () => {
    const aimed = await fallTarget(1);
    expect(aimed).not.toBeNull();
    expect(aimed!.x).toBeGreaterThan(1.5);

    const near = await fallTarget(ON_RAMP.assist);
    expect(near).not.toBeNull();
    expect(near!.y).toBeGreaterThan(4);
  });
});

describe('the guarantee', () => {
  it('clears the first ten levels over their recorded routes without one fall, boosts included', async () => {
    for (const level of ALL_LEVELS.slice(0, ON_RAMP.taperThrough)) {
      const sim = new Simulation(await loadRapier(), level);
      const player = new ReplayPlayer(recordingFor(level));
      const falls: number[] = [];
      sim.events.on('fall', (f) => falls.push(f.heightMeters));
      while (!player.done && !sim.run.cleared) sim.step(player.next());
      expect(sim.run.cleared, level.id).toBe(true);
      expect(falls, level.id).toEqual([]);
      sim.dispose();
    }
  });

  it('still clears them for a player who switched the assist off', async () => {
    for (const level of ALL_LEVELS.slice(0, 2)) {
      const sim = new Simulation(await loadRapier(), level);
      sim.magno.setAssist(false);
      const player = new ReplayPlayer(recordingFor(level));
      const falls: number[] = [];
      sim.events.on('fall', (f) => falls.push(f.heightMeters));
      while (!player.done && !sim.run.cleared) sim.step(player.next());
      expect(sim.run.cleared, level.id).toBe(true);
      expect(falls, level.id).toEqual([]);
      sim.dispose();
    }
  });
});
