import { describe, expect, it } from 'vitest';
import { TUNING } from '@/config/tuning';
import { gradeFall, fallScore, type FallReport } from '@/sim/fall';
import type { PropPlacement } from '@/sim/types';
import { Driver, createSim, makeLevel } from './helpers/harness';

const slabFloor: PropPlacement = { kind: 'slab', x: 0, y: -0.6, w: 300, h: 1.2 };

/** Releases MAGNO in open air at `height` so the drop is exactly that tall. */
async function dropFrom(height: number, extra: PropPlacement[] = []) {
  const sim = await createSim(makeLevel([slabFloor, ...extra], { spawn: { x: -8, y: 0 } }));
  const d = new Driver(sim);
  const falls: FallReport[] = [];
  const slowMo: number[] = [];
  sim.events.on('fall', (f) => falls.push(f));
  sim.events.on('slowMo', (e) => slowMo.push(e.heightMeters));
  d.ms(400);
  const body = sim.physics.magnoBody;
  body.setTranslation({ x: 0, y: height + 0.3, z: 0 }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  return { sim, d, falls, slowMo };
}

describe('fall detection', () => {
  it('scores a long fall once MAGNO has come to rest', async () => {
    const { d, falls } = await dropFrom(18);
    expect(d.until(() => falls.length > 0, 8000)).toBe(true);
    const fall = falls[0]!;
    expect(fall.heightMeters).toBeGreaterThan(14);
    expect(fall.beyondSafetyLine).toBe(true);
    expect(fall.bounces).toBeGreaterThanOrEqual(1);
  });

  it('scores one tumble as one fall, through the whole get-up and the minutes after', async () => {
    const { d, falls } = await dropFrom(18);
    d.ms(9000);
    expect(falls).toHaveLength(1);
  });

  it('scores a second tumble after the first has been recovered from', async () => {
    const { sim, d, falls } = await dropFrom(18);
    d.until(() => falls.length > 0, 8000);
    d.ms(2500);
    expect(d.view.state).toBe('airborne');
    sim.physics.magnoBody.setTranslation({ x: 0, y: 14, z: 0 }, true);
    sim.physics.magnoBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    d.ms(9000);
    expect(falls).toHaveLength(2);
    expect(falls[1]!.heightMeters).toBeGreaterThan(10);
  });

  it('does not treat a short hop as a fall', async () => {
    const { d, falls } = await dropFrom(2.5);
    d.ms(4000);
    expect(falls).toHaveLength(0);
  });

  it('cancels the fall when MAGNO catches a surface before landing', async () => {
    const { sim, d, falls } = await dropFrom(11, [{ kind: 'girder', x: 0, y: 5.9, w: 6, h: 0.4 }]);
    const saved: number[] = [];
    sim.events.on('saved', (e) => saved.push(e.heightMeters));
    d.until(() => d.view.state === 'attached', 4000);
    d.ms(1500);
    expect(d.view.state).toBe('attached');
    expect(falls).toHaveLength(0);
    expect(saved).toHaveLength(1);
  });

  it('puts MAGNO limp after a hard landing, then runs the get-up before control returns', async () => {
    const { sim, d } = await dropFrom(18);
    const phases: string[] = [];
    sim.events.on('limp', () => phases.push('limp'));
    sim.events.on('recoverBegin', () => phases.push('recover'));
    sim.events.on('recoverEnd', () => phases.push('ready'));
    expect(d.until(() => phases.includes('ready'), 9000)).toBe(true);
    expect(phases).toEqual(['limp', 'recover', 'ready']);
    expect(d.view.state).toBe('airborne');
    expect(d.view.limp).toBe(false);
  });

  it('takes roughly the get-up duration to recover', async () => {
    const { sim, d } = await dropFrom(18);
    let began = -1;
    let ended = -1;
    sim.events.on('recoverBegin', () => (began = sim.tick));
    sim.events.on('recoverEnd', () => (ended = sim.tick));
    d.until(() => ended > 0, 9000);
    const ms = ((ended - began) * 1000) / 60;
    expect(ms).toBeGreaterThan(TUNING.recover.getUpMs);
    expect(ms).toBeLessThan(TUNING.recover.getUpMs + TUNING.recover.settleBounceMs + 60);
  });

  it('keeps the player in control on a short drop', async () => {
    const { d } = await dropFrom(3);
    let limp = false;
    d.sim.events.on('limp', () => (limp = true));
    d.ms(3000);
    expect(limp).toBe(false);
  });
});

describe('slow motion trigger', () => {
  it('requests slow motion for a drop beyond 12 metres', async () => {
    const { d, slowMo } = await dropFrom(24);
    d.until(() => slowMo.length > 0, 6000);
    expect(slowMo).toHaveLength(1);
    expect(slowMo[0]!).toBeGreaterThanOrEqual(TUNING.fall.slowMoHeight);
  });

  it('stays quiet for a 9 metre drop', async () => {
    const { d, slowMo } = await dropFrom(9);
    d.ms(5000);
    expect(slowMo).toHaveLength(0);
  });

  it('fires once per fall even though the drop keeps growing', async () => {
    const { d, slowMo } = await dropFrom(34);
    d.ms(6000);
    expect(slowMo).toHaveLength(1);
  });
});

describe('junk displaced', () => {
  it('counts loose props that the fall knocks around', async () => {
    const { d, falls } = await dropFrom(14, [
      { kind: 'loose-crate', x: -4, y: 0.7 },
      { kind: 'loose-crate', x: 0.45, y: 0.7 },
    ]);
    d.until(() => falls.length > 0, 9000);
    expect(falls).toHaveLength(1);
    expect(falls[0]!.junkDisplaced).toBeGreaterThanOrEqual(1);
  });
});

describe('grading', () => {
  it('maps score bands to letter grades C through SSS', () => {
    expect(gradeFall(3)).toBe('C');
    expect(gradeFall(10)).toBe('B');
    expect(gradeFall(20)).toBe('A');
    expect(gradeFall(30)).toBe('S');
    expect(gradeFall(50)).toBe('SS');
    expect(gradeFall(90)).toBe('SSS');
  });

  it('rewards height, bounces and displaced junk', () => {
    expect(fallScore(10, 0, 0)).toBeLessThan(fallScore(10, 4, 0));
    expect(fallScore(10, 4, 0)).toBeLessThan(fallScore(10, 4, 3));
    expect(gradeFall(fallScore(30, 5, 4))).toBe('SS');
  });
});
