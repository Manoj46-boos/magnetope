import { describe, expect, it } from 'vitest';
import { GUST_LEAD_MS, gustForecast, windAcceleration } from '@/sim/wind';
import type { LevelDef, PropPlacement, WindSpec } from '@/sim/types';
import { Driver, createSim, floor, makeLevel } from './helpers/harness';

const withWind = (wind: WindSpec | undefined, props: PropPlacement[] = [], overrides: Partial<LevelDef> = {}): LevelDef =>
  makeLevel(props, { wind, ...overrides });

describe('gust profile', () => {
  const level = withWind({ strength: 4, gustPeriod: 6 });

  it('is calm between gusts and peaks at the strength it was given', () => {
    expect(windAcceleration(level, 0)).toBeCloseTo(0, 9);
    expect(windAcceleration(level, 1500)).toBeCloseTo(4, 9);
    expect(windAcceleration(level, 4500)).toBe(0);
    for (let ms = 0; ms < 24_000; ms += 50) {
      const a = windAcceleration(level, ms);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(4);
    }
  });

  it('blows left when the strength is negative', () => {
    const left = withWind({ strength: -3, gustPeriod: 6 });
    expect(windAcceleration(left, 1500)).toBeCloseTo(-3, 9);
  });

  it('is zero on levels with no wind', () => {
    expect(windAcceleration(withWind(undefined), 1500)).toBe(0);
    expect(gustForecast(withWind(undefined), 1500)).toBe(0);
  });

  it('shelters the ground and builds to full strength over a few metres of altitude', () => {
    const sheltered = withWind({ strength: 4, gustPeriod: 6, fromY: 10 });
    const readings = [8, 10, 11, 12, 13, 20].map((y) => windAcceleration(sheltered, 1500, y));
    expect(readings[0]).toBe(0);
    expect(readings[1]).toBe(0);
    expect(readings[2]).toBeGreaterThan(0);
    expect(readings[4]).toBeCloseTo(4, 9);
    expect(readings[5]).toBeCloseTo(4, 9);
    for (let i = 1; i < readings.length; i++) expect(readings[i]).toBeGreaterThanOrEqual(readings[i - 1]!);
  });
});

describe('gust forecast', () => {
  const level = withWind({ strength: 4, gustPeriod: 4 });

  it('reads the gust as it will be a moment from now', () => {
    const now = 3000;
    expect(gustForecast(level, now)).toBeCloseTo(windAcceleration(level, now + GUST_LEAD_MS) / 4, 9);
  });

  it('rises before the push does, so the player hears it coming', () => {
    expect(windAcceleration(level, 3900)).toBe(0);
    expect(gustForecast(level, 3900)).toBeGreaterThan(0.15);
  });

  it('never exceeds one', () => {
    for (let ms = 0; ms < 16_000; ms += 40) expect(gustForecast(level, ms)).toBeLessThanOrEqual(1);
  });
});

describe('wind in the simulation', () => {
  const GUSTY: WindSpec = { strength: 6, gustPeriod: 4 };

  async function driftOf(level: LevelDef, ms: number): Promise<number> {
    const sim = await createSim(level);
    const d = new Driver(sim).start().ms(ms);
    return d.view.position.x;
  }

  it('shoves a falling MAGNO downwind', async () => {
    const calm = await driftOf(makeLevel([], { spawn: { x: 0, y: 60 } }), 1800);
    const windy = await driftOf(withWind(GUSTY, [], { spawn: { x: 0, y: 60 } }), 1800);
    expect(Math.abs(calm)).toBeLessThan(0.05);
    expect(windy).toBeGreaterThan(calm + 1);
  });

  it('shoves him the other way when the wind reverses', async () => {
    const windy = await driftOf(withWind({ strength: -6, gustPeriod: 4 }, [], { spawn: { x: 0, y: 60 } }), 1800);
    expect(windy).toBeLessThan(-1);
  });

  it('cannot move MAGNO while he is stuck to steel', async () => {
    const x = await driftOf(withWind({ strength: 12, gustPeriod: 3 }, [floor()]), 6000);
    expect(Math.abs(x)).toBeLessThan(0.1);
  });

  it('leaves him alone in air that is sheltered', async () => {
    const x = await driftOf(withWind({ strength: 6, gustPeriod: 4, fromY: 200 }, [], { spawn: { x: 0, y: 60 } }), 1800);
    expect(Math.abs(x)).toBeLessThan(0.05);
  });

  it('sets hung props swaying with the gust', async () => {
    const plate: PropPlacement = { kind: 'swing-plate', x: 0, y: 6, hinge: { x: 0, y: 10 } };
    const sway = async (wind: WindSpec | undefined): Promise<number> => {
      const sim = await createSim(withWind(wind, [floor(), plate]));
      const body = sim.physics.world.getRigidBody(sim.physics.props[1]!.bodyHandle);
      const d = new Driver(sim).start();
      let peak = 0;
      for (let i = 0; i < 60 * 8; i++) {
        d.tick();
        peak = Math.max(peak, Math.abs(body.translation().x));
      }
      return peak;
    };
    expect(await sway(undefined)).toBeLessThan(0.02);
    expect(await sway({ strength: 6, gustPeriod: 4 })).toBeGreaterThan(0.2);
  });

  it('is identical on every run, so replays stay valid', async () => {
    const a = await driftOf(withWind(GUSTY, [], { spawn: { x: 0, y: 60 } }), 2400);
    const b = await driftOf(withWind(GUSTY, [], { spawn: { x: 0, y: 60 } }), 2400);
    expect(a).toBe(b);
  });
});
