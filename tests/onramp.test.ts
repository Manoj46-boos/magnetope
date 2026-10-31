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
 * The casual on-ramp (rebuild PRD Volume II, P-FT-03/P-FT-05): the first three
 * levels hold the hand widest, four steps halfway down, five settles at the
 * strength the first ten have always kept, six to ten let go in half steps, and
 * the first two launches of the first three levels carry a magnetism that bends
 * an aimed throw toward the steel it already points at. Everything here is
 * measured through the real simulation — the query, the scoring, the recorded
 * routes, and the one-thumb constraint the acceptance names.
 */

const routesDir = resolve(__dirname, '../src/levels/routes');
const recordingFor = (level: LevelDef): Recording => decodeRecording(readFileSync(resolve(routesDir, `${level.id}.json`), 'utf8'));

const FULL = { catchWindow: ON_RAMP.catchWindow, assist: ON_RAMP.assist, launchAim: true };
const STEP = { catchWindow: (ON_RAMP.catchWindow + ON_RAMP.settledCatchWindow) / 2, assist: (ON_RAMP.assist + ON_RAMP.settledAssist) / 2, launchAim: false };
const SETTLED = { catchWindow: ON_RAMP.settledCatchWindow, assist: ON_RAMP.settledAssist, launchAim: false };
const HALF = { catchWindow: 1 + (ON_RAMP.settledCatchWindow - 1) / 2, assist: 1 + (ON_RAMP.settledAssist - 1) / 2, launchAim: false };
const NONE = { catchWindow: 1, assist: 1, launchAim: false };

describe('the ramp table (P-FT-03)', () => {
  it('holds the hand widest through level three, steps down at four, settles at five, halves to ten, and lets go after', () => {
    for (let n = 1; n <= ON_RAMP.fullThrough; n++) expect(onRampFor(n), `level ${n}`).toEqual(FULL);
    expect(onRampFor(ON_RAMP.fullThrough + 1)).toEqual(STEP);
    expect(onRampFor(5)).toEqual(SETTLED);
    for (let n = 6; n <= ON_RAMP.taperThrough; n++) expect(onRampFor(n), `level ${n}`).toEqual(HALF);
    for (let n = ON_RAMP.taperThrough + 1; n <= 70; n++) expect(onRampFor(n), `level ${n}`).toEqual(NONE);
  });

  it('arms exactly the first ten levels of the progression with their position in the ramp', () => {
    for (let i = 0; i < ALL_LEVELS.length; i++) {
      const level = ALL_LEVELS[i]!;
      expect(level.onRamp ?? NONE, level.id).toEqual(onRampFor(i + 1));
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
    // the fall home: the assist wakes, the widened band sees the wall, and the magnet
    // picks the save over the floor — the wider window now reaches the save from
    // lower down, so the band's floor is where a wall catch stops beating the plate
    const falling = boosted.filter((r) => r.target && r.target.x > 4);
    expect(falling.length).toBeGreaterThan(3);
    for (const r of falling) expect(r.y).toBeGreaterThan(1.5);
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
    const sim = await createSim(makeLevel(props, { onRamp: { catchWindow: 1, assist, launchAim: false } }));
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

describe('the launch-aim magnetism (P-FT-05)', () => {
  /**
   * A flat steel plate with a fridge standing up and ahead: near enough to the
   * throw's own line that the on-ramp's cone covers it. The repel event's
   * direction is the measurement, taken with the pose it launched from.
   */
  const launch = async (onRamp?: LevelDef['onRamp']): Promise<{ dir: { x: number; y: number }; pose: { x: number; y: number } } | null> => {
    const props: PropPlacement[] = [floor(), { kind: 'fridge', x: 2.2, y: 8, w: 1.8, h: 4 }];
    const sim = await createSim(makeLevel(props, { onRamp }));
    const d = new Driver(sim);
    let out: { dir: { x: number; y: number }; pose: { x: number; y: number } } | null = null;
    sim.events.on('repel', (e) => {
      if (e.power > 0.9) out = { dir: { ...e.direction }, pose: { ...d.view.position } };
    });
    d.press().ms(900).tilt(0.25, 0.75).release().tick();
    sim.dispose();
    return out;
  };

  /** The throw the plate itself makes with this tilt: the aim's own share onto the up normal. */
  const baseDir = (): { x: number; y: number } => {
    const raw = { x: 0.25 * TUNING.repel.tiltShare * TUNING.repel.fullSpeed, y: TUNING.repel.fullSpeed * (1 + 0.75 * TUNING.repel.tiltShare) };
    const len = Math.hypot(raw.x, raw.y);
    return { x: raw.x / len, y: raw.y / len };
  };

  it('bends a cone-inside launch toward the steel by the authored share', async () => {
    const boosted = await launch(FULL);
    expect(boosted).not.toBeNull();
    const plain = baseDir();
    // the fridge's nearest point to the launch pose is its lower-left corner
    const corner = { x: 2.2 - 0.9, y: 8 - 2 };
    const to = { x: corner.x - boosted!.pose.x, y: corner.y - boosted!.pose.y };
    const toLen = Math.hypot(to.x, to.y);
    const target = { x: to.x / toLen, y: to.y / toLen };
    const expected = {
      x: plain.x + (target.x - plain.x) * 0.15,
      y: plain.y + (target.y - plain.y) * 0.15,
    };
    expect(boosted!.dir.x, 'the throw bent a fifteen-percent share toward the steel').toBeGreaterThan(plain.x);
    expect(Math.abs(boosted!.dir.x - expected.x)).toBeLessThan(0.02);
    expect(Math.abs(boosted!.dir.y - expected.y)).toBeLessThan(0.02);
  });

  it('never bends a throw the level does not carry the magnetism for', async () => {
    const plainLaunch = await launch(undefined);
    expect(plainLaunch).not.toBeNull();
    const plain = baseDir();
    expect(Math.abs(plainLaunch!.dir.x - plain.x)).toBeLessThan(0.02);
    expect(Math.abs(plainLaunch!.dir.y - plain.y)).toBeLessThan(0.02);

    const settled = await launch(SETTLED);
    expect(Math.abs(settled!.dir.x - plain.x)).toBeLessThan(0.02);
  });

  it('leaves a throw aimed outside the cone alone', async () => {
    const props: PropPlacement[] = [floor(), { kind: 'fridge', x: 5, y: 8, w: 1.8, h: 4 }];
    const sim = await createSim(makeLevel(props, { onRamp: FULL }));
    const d = new Driver(sim);
    let dir: { x: number; y: number } | null = null;
    sim.events.on('repel', (e) => {
      if (e.power > 0.9) dir = { ...e.direction };
    });
    d.press().ms(900).tilt(0.25, 0.75).release().tick();
    sim.dispose();
    const plain = baseDir();
    expect(dir).not.toBeNull();
    expect(Math.abs(dir!.x - plain.x)).toBeLessThan(0.02);
    expect(Math.abs(dir!.y - plain.y)).toBeLessThan(0.02);
  });

  it('spends itself on the first two hops of a level and then goes quiet', async () => {
    const props: PropPlacement[] = [floor(), { kind: 'fridge', x: 2.2, y: 8, w: 1.8, h: 4 }];
    const sim = await createSim(makeLevel(props, { onRamp: FULL }));
    const d = new Driver(sim);
    const dirs: Array<{ x: number; y: number }> = [];
    sim.events.on('repel', (e) => dirs.push({ ...e.direction }));
    // two taps count as the first two hops: the magnetism rides them and is spent
    d.tap(60);
    d.until(() => d.view.state === 'attached', 6000);
    d.ms(300);
    d.tap(60);
    d.until(() => d.view.state === 'attached', 6000);
    d.ms(300);
    d.press().ms(900).tilt(0.25, 0.75).release().tick();
    sim.dispose();
    const plain = baseDir();
    // the taps launch off a zero tilt, so any sideways share at all is the bend
    expect(dirs[0]!.x).toBeGreaterThan(0.01);
    expect(dirs[1]!.x).toBeGreaterThan(0.01);
    expect(Math.abs(dirs[2]!.x - plain.x)).toBeLessThan(0.02);
  });

  it('is the same bend every time: the launch stays deterministic', async () => {
    const a = await launch(FULL);
    const b = await launch(FULL);
    expect(a).toEqual(b);
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
