import { describe, expect, it } from 'vitest';
import { propKind } from '@/config/props';
import type { SimEvents } from '@/sim/simulation';
import type { PropPlacement } from '@/sim/types';
import { Driver, createSim, floor, makeLevel } from './helpers/harness';

type Name = keyof SimEvents;

/** A sim with its events recorded, so a test can say what happened and in what order. */
async function observe(props: PropPlacement[], spawn: { x: number; y: number }) {
  const sim = await createSim(makeLevel(props, { spawn, bounds: { minX: -60, maxX: 60 }, killY: -80 }));
  const seen: Array<{ name: string; at: number; payload: unknown }> = [];
  for (const name of ['boing', 'crumbleWarn', 'crumble', 'restore', 'followerMove', 'glassBreak', 'attach', 'limp', 'fall'] as Name[]) {
    sim.events.on(name, (payload) => seen.push({ name, at: sim.tick, payload }));
  }
  const of = (name: string) => seen.filter((e) => e.name === name);
  return { sim, driver: new Driver(sim), seen, of };
}

const msBetween = (a: number, b: number): number => ((b - a) * 1000) / 60;

describe('boing surfaces', () => {
  const washer: PropPlacement = { kind: 'boing-washer', x: 0, y: 1.15 };

  it('throws MAGNO back up when he lands hard, instead of letting him stick', async () => {
    const { driver, of } = await observe([floor(), washer], { x: 0, y: 17 });
    driver.start().ms(2600);
    const [first] = of('boing');
    expect(first).toBeDefined();
    const e = first!.payload as SimEvents['boing'];
    expect(e.speed).toBeGreaterThan(12);
    expect(e.outSpeed).toBeGreaterThan(9);
    expect(e.normal.y).toBeGreaterThan(0.9);
    expect(driver.view.state).not.toBe('attached');
  });

  it('returns less speed than it receives, so a fall never turns into endless bouncing', async () => {
    const { driver, of } = await observe([floor(), washer], { x: 0, y: 17 });
    driver.start().ms(14_000);
    const bounces = of('boing').map((e) => e.payload as SimEvents['boing']);
    expect(bounces.length).toBeGreaterThanOrEqual(2);
    for (const b of bounces) expect(b.outSpeed).toBeLessThan(b.speed);
    const outs = bounces.map((b) => b.outSpeed);
    expect(outs).toEqual([...outs].sort((a, b) => b - a));
    expect(driver.view.state).toBe('attached');
  });

  it('holds him like any appliance when he comes down gently', async () => {
    const { driver, of } = await observe([floor(), washer], { x: 0, y: 3.6 });
    driver.start().ms(2500);
    expect(of('boing')).toHaveLength(0);
    expect(driver.view.state).toBe('attached');
  });

  it('refuses to catch him for a moment after a bounce, so he clears the surface he left', async () => {
    const { driver, of, sim } = await observe([floor(), washer], { x: 0, y: 17 });
    driver.start();
    expect(driver.until(() => of('boing').length > 0, 4000)).toBe(true);
    driver.ms(120);
    expect(sim.magno.view.state).toBe('airborne');
    expect(sim.magno.view.velocity.y).toBeGreaterThan(3);
    expect(sim.magno.view.position.y).toBeGreaterThan(2.5);
  });

  it('does not bounce him when he aimed at it with a snap', async () => {
    const { driver, of } = await observe([floor(), washer], { x: 0, y: 5.6 });
    driver.start().tilt(0, -1).press().ms(100).release();
    driver.ms(2500);
    expect(of('boing')).toHaveLength(0);
    expect(driver.view.state).toBe('attached');
  });

  it('keeps the sideways part of his motion, so a boing can carry him across a gap', async () => {
    const { driver, of } = await observe([floor({ w: 40 }), washer], { x: -0.8, y: 15 });
    driver.start().tilt(0.3, 0);
    driver.until(() => of('boing').length > 0, 4000);
    const e = of('boing')[0]?.payload as SimEvents['boing'] | undefined;
    expect(e).toBeDefined();
    driver.tilt(0, 0).ms(600);
    expect(driver.view.velocity.x).toBeGreaterThan(0.4);
  });

  it('is felt on soft surfaces too: a bouncy castle never leaves him limp or counts a fall', async () => {
    const castle: PropPlacement = { kind: 'bouncy-castle', x: 0, y: 0.9 };
    const { driver, of, sim } = await observe([floor(), castle], { x: 0, y: 18 });
    driver.start().ms(3000);
    expect(of('boing').length).toBeGreaterThanOrEqual(1);
    expect(of('limp')).toHaveLength(0);
    expect(sim.run.fallCount).toBe(0);
  });

  it('lets an awning throw him from a modest drop where a washer would hold him', async () => {
    const awning: PropPlacement = { kind: 'awning', x: 0, y: 1.1 };
    const soft = await observe([floor(), awning], { x: 0, y: 2.4 });
    soft.driver.start().ms(1500);
    expect(soft.of('boing').length).toBeGreaterThanOrEqual(1);
    const washerDrop = await observe([floor(), { kind: 'boing-washer', x: 0, y: 1.15 }], { x: 0, y: 3.4 });
    washerDrop.driver.start().ms(1500);
    expect(washerDrop.of('boing')).toHaveLength(0);
  });
});

describe('crumbling surfaces', () => {
  const grate = (y = 0.14): PropPlacement => ({ kind: 'rust-grate', x: 0, y });
  const reaction = (id: string) => {
    const r = propKind(id).reaction;
    if (r?.type !== 'crumble') throw new Error(`${id} does not crumble`);
    return r;
  };

  it('shivers first and gives way only after carrying his weight for its hold time', async () => {
    const { driver, of } = await observe([grate()], { x: 0, y: 0.28 });
    expect(driver.until(() => of('crumble').length > 0, 4000)).toBe(true);
    const warn = of('crumbleWarn')[0]!;
    const gone = of('crumble')[0]!;
    expect(msBetween(warn.at, gone.at)).toBeGreaterThan(reaction('rust-grate').warnMs * 0.8);
    expect(msBetween(warn.at, gone.at)).toBeLessThan(reaction('rust-grate').warnMs * 1.3);
  });

  it('drops him when it goes, and he cannot grab what is no longer there', async () => {
    const { driver, sim, of } = await observe([grate()], { x: 0, y: 0.28 });
    driver.until(() => of('crumble').length > 0, 4000);
    const y0 = driver.view.position.y;
    driver.ms(1200);
    expect(driver.view.position.y).toBeLessThan(y0 - 3);
    expect(driver.view.state).toBe('airborne');
    expect(sim.reactive.crumbleView(0).gone).toBe(true);
  });

  it('forgives a quick hop: brief weight wears off before it can build up', async () => {
    const { driver, sim } = await observe([grate()], { x: 0, y: 0.28 });
    for (let i = 0; i < 4; i++) {
      driver.ms(500).tilt(0, 1).press().ms(500).release().tilt(0, 0).ms(1800);
    }
    expect(sim.reactive.crumbleView(0).gone).toBe(false);
  });

  it('re-forms once its time is up and nobody is under it', async () => {
    const { driver, sim, of } = await observe([floor({ w: 60, x: 20 }), grate(6)], { x: 0, y: 6.28 });
    driver.until(() => of('crumble').length > 0, 4000);
    driver.ms(200).tilt(1, 0).ms(2500).tilt(0, 0);
    expect(driver.until(() => of('restore').length > 0, reaction('rust-grate').restoreMs + 3000)).toBe(true);
    expect(sim.reactive.crumbleView(0).gone).toBe(false);
    const gone = of('crumble')[0]!.at;
    expect(msBetween(gone, of('restore')[0]!.at)).toBeGreaterThanOrEqual(reaction('rust-grate').restoreMs - 20);
  });

  it('waits to re-form while MAGNO stands where it would come back', async () => {
    const { driver, sim, of } = await observe([floor({ w: 30 }), grate(1.2)], { x: 0, y: 1.34 });
    driver.until(() => of('crumble').length > 0, 4000);
    driver.ms(reaction('rust-grate').restoreMs + 2500);
    expect(of('restore')).toHaveLength(0);
    expect(sim.reactive.crumbleView(1).gone).toBe(true);
    driver.tilt(1, 0).ms(2600).tilt(0, 0).ms(600);
    expect(of('restore')).toHaveLength(1);
  });

  it('wears down under weight alone: a wooden grate that holds no magnet crumbles just the same', async () => {
    const wooden: PropPlacement = { kind: 'rust-grate', x: 0, y: 0.14, material: 'wood' };
    const { driver, of } = await observe([wooden], { x: 0, y: 0.28 });
    expect(driver.until(() => of('crumble').length > 0, 4000)).toBe(true);
    expect(driver.view.state).not.toBe('attached');
  });

  it('holds a frost-caked truss for longer than rust, and still warns first', async () => {
    const truss: PropPlacement = { kind: 'frost-truss', x: 0, y: 0.25 };
    const { driver, of } = await observe([truss], { x: 0, y: 0.4 });
    driver.ms(1200);
    expect(of('crumble')).toHaveLength(0);
    expect(driver.until(() => of('crumble').length > 0, 3000)).toBe(true);
    const e = of('crumble')[0]!.payload as SimEvents['crumble'];
    expect(e.point.y).toBeCloseTo(0.25, 2);
    expect(msBetween(of('crumbleWarn')[0]!.at, of('crumble')[0]!.at)).toBeGreaterThan(reaction('frost-truss').warnMs * 0.8);
  });

  it('survives a snapshot taken mid-collapse and finishes the collapse on the same tick', async () => {
    const a = await observe([grate()], { x: 0, y: 0.28 });
    a.driver.ms(900);
    const snap = a.sim.snapshot();
    a.driver.until(() => a.of('crumble').length > 0, 3000);
    const reference = a.of('crumble')[0]!.at;

    const b = await observe([grate()], { x: 0, y: 0.28 });
    b.driver.ms(300);
    b.sim.restore(snap);
    b.driver.until(() => b.of('crumble').length > 0, 3000);
    expect(b.of('crumble')[0]!.at).toBe(reference);
  });
});

describe('followers', () => {
  const cabinet: PropPlacement = { kind: 'filing-cabinet', x: 0, y: 1.35, tag: 'files' };
  const drawer = (): PropPlacement => ({
    kind: 'file-drawer',
    x: 2.1,
    y: 1.6,
    follow: { tag: 'files', dx: 1.6, dy: 0, extendMs: 700, retractMs: 1400, holdMs: 2500 },
  });
  const drawerBody = (sim: Awaited<ReturnType<typeof observe>>['sim']) => sim.physics.world.getRigidBody(sim.physics.props[2]!.bodyHandle);

  it('stays shut until someone clings to its cabinet', async () => {
    const { driver, sim } = await observe([floor(), cabinet, drawer()], { x: 12, y: 0.2 });
    driver.ms(2000);
    expect(drawerBody(sim).translation().x).toBeCloseTo(2.1, 2);
  });

  it('slides out while MAGNO holds the cabinet, and stops where it should', async () => {
    const { driver, sim, of } = await observe([floor(), cabinet, drawer()], { x: 0, y: 2.7 });
    driver.ms(1800);
    expect(driver.view.state).toBe('attached');
    expect(drawerBody(sim).translation().x).toBeCloseTo(3.7, 1);
    expect(of('followerMove').map((e) => (e.payload as SimEvents['followerMove']).direction)).toEqual(['out']);
  });

  it('stays out a while after he lets go, then slides back', async () => {
    const { driver, sim, of } = await observe([floor(), cabinet, drawer()], { x: 0, y: 2.7 });
    driver.ms(1500).tilt(-1, 0.6).press().ms(500).release().tilt(0, 0);
    driver.ms(1200);
    expect(drawerBody(sim).translation().x).toBeGreaterThan(3.6);
    driver.ms(2800);
    expect(drawerBody(sim).translation().x).toBeLessThan(3.0);
    driver.ms(2500);
    expect(drawerBody(sim).translation().x).toBeCloseTo(2.1, 1);
    expect(of('followerMove').map((e) => (e.payload as SimEvents['followerMove']).direction)).toEqual(['out', 'in']);
  });

  it('keeps itself out while MAGNO rides it, then lifts him with it at its own speed', async () => {
    const lift: PropPlacement = {
      kind: 'service-lift',
      x: 0,
      y: 0.2,
      follow: { tag: 'call', dx: 0, dy: 7, extendMs: 3500, retractMs: 5000, holdMs: 1500 },
    };
    const { driver, sim } = await observe([lift], { x: 0, y: 0.4 });
    driver.ms(500);
    const startY = driver.view.position.y;
    driver.ms(1800);
    expect(driver.view.position.y).toBeGreaterThan(startY + 1);
    expect(driver.view.state).toBe('attached');
    driver.ms(2500);
    expect(driver.view.position.y).toBeGreaterThan(startY + 6.5);
    expect(sim.run.fallCount).toBe(0);
    expect(driver.view.state).toBe('attached');
  });

  it('answers to a call box on the same tag from across the level', async () => {
    const box: PropPlacement = { kind: 'call-box', x: -6, y: 0.6, tag: 'lift-1' };
    const lift: PropPlacement = {
      kind: 'service-lift',
      x: 3,
      y: 0.2,
      follow: { tag: 'lift-1', dx: 0, dy: 6, extendMs: 3000, retractMs: 4000, holdMs: 2000 },
    };
    const { driver, sim } = await observe([floor({ w: 30 }), box, lift], { x: -6, y: 1.4 });
    driver.ms(3600);
    expect(driver.view.state).toBe('attached');
    expect(sim.physics.world.getRigidBody(sim.physics.props[2]!.bodyHandle).translation().y).toBeGreaterThan(5.5);
  });

  it('carries the same state through a snapshot, so a planner branch sees the drawer where it was', async () => {
    const a = await observe([floor(), cabinet, drawer()], { x: 0, y: 2.7 });
    a.driver.ms(1000);
    const snap = a.sim.snapshot();
    a.driver.ms(2000);
    const reference = drawerBody(a.sim).translation().x;

    const b = await observe([floor(), cabinet, drawer()], { x: 0, y: 2.7 });
    b.driver.ms(200);
    b.sim.restore(snap);
    b.driver.ms(2000);
    expect(drawerBody(b.sim).translation().x).toBeCloseTo(reference, 3);
  });
});

describe('spring boards', () => {
  const board = (kind: string): PropPlacement => {
    const w = propKind(kind).shape.type === 'box' ? (propKind(kind).shape as { w: number }).w : 0;
    return { kind, x: w / 2 - 0.3, y: 8, hinge: { x: -0.3, y: 8 } };
  };
  const angleOf = (sim: Awaited<ReturnType<typeof observe>>['sim']) => {
    const q = sim.physics.world.getRigidBody(sim.physics.props[0]!.bodyHandle).rotation();
    return 2 * Math.atan2(q.z, q.w);
  };
  const tip = (kind: string) => (propKind(kind).shape as { w: number }).w - 0.9;

  for (const kind of ['diving-board', 'drawbridge']) {
    describe(kind, () => {
      it('rests level on its own spring, hinged at one end, however long it waits', async () => {
        const { driver, sim } = await observe([board(kind)], { x: 40, y: 8 });
        driver.ms(4000);
        expect(Math.abs(angleOf(sim))).toBeLessThan(0.03);
      });

      it('dips under MAGNO at the free end and never past its stop', async () => {
        const { driver, sim } = await observe([board(kind)], { x: tip(kind), y: 8.4 });
        let lowest = 0;
        for (let i = 0; i < 60 * 5; i++) {
          driver.tick();
          lowest = Math.min(lowest, angleOf(sim));
        }
        const limit = propKind(kind).tilt!.limit;
        expect(lowest).toBeLessThan(-0.1);
        expect(lowest).toBeGreaterThan(-limit - 0.08);
        expect(driver.view.state).toBe('attached');
      });

      it('springs back and overshoots level when he lets go, as a board on a spring does', async () => {
        const { driver, sim } = await observe([board(kind)], { x: tip(kind), y: 8.4 });
        driver.ms(3500);
        driver.tilt(0, 1).press().ms(500).release().tilt(0, 0);
        let highest = -1;
        for (let i = 0; i < 60 * 4; i++) {
          driver.tick();
          highest = Math.max(highest, angleOf(sim));
        }
        expect(highest).toBeGreaterThan(0.015);
      });
    });
  }

  it('adds the speed of the rebounding board to a well timed flip, and costs height when mistimed', async () => {
    const peakAfter = async (delayMs: number | null) => {
      const props: PropPlacement[] = delayMs === null ? [{ kind: 'girder', x: 1.9, y: 8, w: 4.6, h: 0.3 }] : [board('diving-board')];
      const { driver } = await observe(props, { x: 3.7, y: 8.4 });
      driver.ms(delayMs ?? 1000);
      let peak = -Infinity;
      driver.tilt(0, 1).press().ms(900).release();
      for (let i = 0; i < 60 * 3; i++) {
        driver.tick();
        peak = Math.max(peak, driver.view.position.y);
      }
      return peak;
    };
    const rigid = await peakAfter(null);
    const timed = Math.max(await peakAfter(400), await peakAfter(600));
    const early = await peakAfter(0);
    expect(timed).toBeGreaterThan(rigid + 1.5);
    expect(early).toBeLessThan(rigid - 5);
  });
});

describe('broken glass', () => {
  it('removes the pane from the world when it breaks, and a snapshot restore brings it back', async () => {
    const pane: PropPlacement = { kind: 'pane', x: 0, y: 6 };
    const { driver, sim, of } = await observe([floor(), pane], { x: 0, y: 16 });
    const before = sim.snapshot();
    driver.start();
    expect(driver.until(() => of('glassBreak').length > 0, 4000)).toBe(true);
    expect(sim.physics.isIntact(sim.physics.props[1]!)).toBe(false);
    sim.restore(before);
    expect(sim.physics.isIntact(sim.physics.props[1]!)).toBe(true);
  });
});
