import { describe, expect, it } from 'vitest';
import type { PropPlacement } from '@/sim/types';
import { Driver, createSim, floor, makeLevel } from './helpers/harness';

const lift = (): PropPlacement => ({
  kind: 'washer-rig',
  x: 12,
  y: 1,
  motion: { type: 'slide', dx: 0, dy: 6, period: 8 },
});

const sign = (): PropPlacement => ({ kind: 'neon-panel', x: -12, y: 1, cycle: { period: 6, on: 0.5, warn: 0.6 } });

const levelWithHazards = (overrides = {}) =>
  makeLevel([floor(), lift(), sign()], { wind: { strength: 4, gustPeriod: 4 }, spawn: { x: 0, y: 0 }, ...overrides });

const liftHeight = (d: Driver): number => {
  const prop = d.sim.physics.props.find((p) => p.kind.id === 'washer-rig')!;
  return d.sim.physics.world.getRigidBody(prop.bodyHandle).translation().y;
};

describe('hazard clock', () => {
  it('holds every hazard still until the player makes a first move', async () => {
    const d = new Driver(await createSim(levelWithHazards()));
    const before = liftHeight(d);
    d.ms(6000);
    expect(d.sim.run.started).toBe(false);
    expect(d.sim.hazardClockMs).toBe(0);
    expect(liftHeight(d)).toBe(before);
  });

  it('sets the hazards running the moment the run starts', async () => {
    const d = new Driver(await createSim(levelWithHazards())).start();
    const start = liftHeight(d);
    d.ms(4000);
    expect(d.sim.hazardClockMs).toBeGreaterThan(3900);
    expect(liftHeight(d)).toBeGreaterThan(start + 3);
  });

  it('shows every attempt the same hazards at the same moment of the run, however long the player waited', async () => {
    const quick = new Driver(await createSim(levelWithHazards())).ms(100).start().ms(3000);
    const patient = new Driver(await createSim(levelWithHazards())).ms(9000).start().ms(3000);
    expect(liftHeight(patient)).toBeCloseTo(liftHeight(quick), 6);
    expect(patient.sim.hazardClockMs).toBe(quick.sim.hazardClockMs);
  });

  it('blows the same gust at the same run time on every attempt', async () => {
    // Near-zero gravity lets MAGNO hang in the air through a long wait without falling out of the test.
    const drift = async (waitMs: number): Promise<number> => {
      const level = makeLevel([], { wind: { strength: 6, gustPeriod: 4 }, spawn: { x: 0, y: 80 }, gravityScale: 0.01 });
      const d = new Driver(await createSim(level)).ms(waitMs).start().ms(1800);
      return d.view.position.x;
    };
    expect(await drift(200)).toBeCloseTo(await drift(5000), 5);
  });

  it('freezes the hazards at the summit so the clear never sees a platform leave', async () => {
    const level = levelWithHazards({ summit: { x: 0, y: 0.5, radius: 3 } });
    const d = new Driver(await createSim(level)).start().ms(500);
    expect(d.sim.run.cleared).toBe(true);
    const clock = d.sim.hazardClockMs;
    const frozen = liftHeight(d);
    d.ms(3000);
    expect(d.sim.hazardClockMs).toBe(clock);
    expect(liftHeight(d)).toBeCloseTo(frozen, 6);
  });

  it('resets with the level: a fresh simulation starts every hazard from its first pose', async () => {
    const first = await createSim(levelWithHazards());
    new Driver(first).start().ms(5000);
    const again = new Driver(await createSim(levelWithHazards()));
    expect(again.sim.hazardClockMs).toBe(0);
    expect(liftHeight(again)).toBeCloseTo(1, 6);
  });

  it('holds the frame at a full-power release without touching the hazard timeline', async () => {
    // R-GF-01's hit-stop freezes presentation only: hazards read the run clock,
    // and the run clock advances in simulation steps alone. Whatever the frame
    // rate does around the release — a 60 ms freeze included — the lift is
    // exactly where its tick count says, on every attempt.
    const run = async () => {
      const d = new Driver(await createSim(levelWithHazards())).start();
      const repels: number[] = [];
      d.sim.events.on('repel', (e) => repels.push(e.power));
      d.press().ms(900).release().tick();
      expect(repels).toEqual([1]);
      const afterRelease = d.sim.hazardClockMs;
      d.ms(600);
      return { afterRelease, end: d.sim.hazardClockMs, lift: liftHeight(d) };
    };
    const a = await run();
    const b = await run();
    expect(a).toEqual(b);
    expect(a.end - a.afterRelease).toBeGreaterThanOrEqual(600);
  });
});
