import { Scene, Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { MATERIALS, type MaterialId } from '@/config/materials';
import { TUNING } from '@/config/tuning';
import { hypot2 } from '@/core/mathx';
import { CAMERA_FOV, CameraRig } from '@/render/camera-rig';
import { PROFILES, type QualityProfile } from '@/render/quality';
import { layoutStage } from '@/render/stage';
import { SPARK, Vfx } from '@/render/vfx';
import { Simulation } from '@/sim/simulation';
import type { MagnoEvents } from '@/sim/magno';
import { Driver, createSim, floor, makeLevel } from './helpers/harness';

/**
 * The juice pass (PRD 13.3, R-GF-01…05): the release and the catch are
 * compositions, and every layer of them is measured here against the envelopes
 * the requirements name — the camera's lunge and lens pop, the charge dolly,
 * the catch settle, the snap stack the VFX director answers with, and the
 * momentum the catch must not kill. The events ride the real simulation bus;
 * only the payloads are staged, so what is under test is the wiring a player
 * actually reaches.
 */

const CAMERA_OPTS = (charge = 0) => ({ falling: false, slowMo: 0, charge, bounds: { minX: -20, maxX: 20 } });

const cameraAtRest = (): CameraRig => {
  const rig = new CameraRig();
  rig.setLayout(layoutStage(1280, 720));
  rig.snapTo({ x: 0, y: 5 });
  for (let i = 0; i < 240; i++) rig.update({ x: 0, y: 5 }, { x: 0, y: 0 }, 1 / 60, CAMERA_OPTS());
  return rig;
};

const stepCamera = (rig: CameraRig, charge = 0) => rig.update({ x: 0, y: 5 }, { x: 0, y: 0 }, 1 / 60, CAMERA_OPTS(charge));

describe('the release camera beats', () => {
  it('lunges along the flight vector and gives it back inside 300 ms (R-GF-01)', () => {
    const kicked = cameraAtRest();
    const control = cameraAtRest();
    kicked.kick({ x: 1, y: 0 });
    let peak = 0;
    let late = 0;
    for (let i = 0; i < 30; i++) {
      stepCamera(kicked);
      stepCamera(control);
      const d = kicked.camera.position.distanceTo(control.camera.position);
      if (i < 3) peak = Math.max(peak, d);
      if (i >= 17) late = Math.max(late, d);
    }
    expect(peak).toBeGreaterThan(0.5);
    expect(late).toBeLessThan(0.055);
  });

  it('pops the lens three degrees wide and settles it back inside 400 ms (R-GF-01)', () => {
    const rig = cameraAtRest();
    rig.pop();
    stepCamera(rig);
    expect(rig.camera.fov).toBeGreaterThan(26);
    for (let i = 0; i < 24; i++) stepCamera(rig);
    expect(Math.abs(rig.camera.fov - CAMERA_FOV)).toBeLessThan(0.2);
    for (let i = 0; i < 48; i++) stepCamera(rig);
    expect(rig.camera.fov).toBe(CAMERA_FOV);
  });

  it('skips the lens pop entirely for reduced motion', () => {
    const rig = cameraAtRest();
    rig.reducedMotion = true;
    rig.pop();
    for (let i = 0; i < 4; i++) stepCamera(rig);
    expect(rig.camera.fov).toBe(CAMERA_FOV);
  });

  it('closes the lens by at most four percent while a charge is held (R-GF-05)', () => {
    const rig = cameraAtRest();
    const base = rig.verticalExtent;
    for (let i = 0; i < 120; i++) stepCamera(rig, 1);
    const tight = rig.verticalExtent;
    expect(tight).toBeLessThan(base * 0.985);
    expect(tight).toBeGreaterThan(base * 0.95);
    for (let i = 0; i < 180; i++) stepCamera(rig, 0);
    expect(Math.abs(rig.verticalExtent - base)).toBeLessThan(base * 0.005);
  });

  it('eases onto a catch and straight back off (R-GF-04)', () => {
    const rig = cameraAtRest();
    const base = rig.verticalExtent;
    rig.settle();
    let min = base;
    for (let i = 0; i < 18; i++) {
      stepCamera(rig);
      min = Math.min(min, rig.verticalExtent);
    }
    expect(min).toBeLessThan(base * 0.995);
    for (let i = 0; i < 42; i++) stepCamera(rig);
    expect(Math.abs(rig.verticalExtent - base)).toBeLessThan(base * 0.005);
  });
});

/** A quiet profile: no ambient dust, so particle counts read the bursts alone. */
const QUIET_PROFILE: QualityProfile = { ...PROFILES.high, dustScale: 0 };

interface Stage {
  sim: Simulation;
  vfx: Vfx;
  flashes: number[];
  shakes: string[];
  scene: Scene;
}

const stage = async (): Promise<Stage> => {
  const sim = await createSim(makeLevel([floor()]));
  const scene = new Scene();
  const flashes: number[] = [];
  const shakes: string[] = [];
  const vfx = new Vfx(scene, QUIET_PROFILE, 0, {
    shake: (kind) => shakes.push(kind),
    flash: (amount) => flashes.push(amount),
  });
  vfx.bind(sim);
  return { sim, vfx, flashes, shakes, scene };
};

const stepVfx = (s: Stage) => s.vfx.update(1 / 60, s.sim.magno.view, { x: 0, y: 0 }, 0);

const attach = (sim: Simulation, speed: number, viaSnap: boolean, material: MaterialId = 'steel') =>
  sim.events.emit('attach', {
    material,
    point: { x: 0, y: 0 },
    normal: { x: 0, y: 1 },
    speed,
    weak: false,
    viaSnap,
  } as MagnoEvents['attach']);

/** Every ring the pool currently shows, as { squash, scale } pairs. */
const liveRings = (scene: Scene): Array<{ squash: number; scale: number }> =>
  scene.children
    .filter((o): o is Mesh => o instanceof Mesh && o.visible && typeof o.userData.squash === 'number')
    .map((o) => ({ squash: o.userData.squash as number, scale: o.scale.x }));

describe('the snap stack', () => {
  it('flashes the ident on a snap catch and stays quiet on a plain one (R-SM-03)', async () => {
    const s = await stage();
    attach(s.sim, 8, false);
    stepVfx(s);
    expect(s.flashes).toEqual([]);

    attach(s.sim, 8, true);
    stepVfx(s);
    expect(s.flashes.length).toBe(1);
    expect(s.flashes[0]).toBeCloseTo(0.35, 5);
  });

  it('lights the caught surface with a squashed cyan patch (R-GF-04)', async () => {
    const s = await stage();
    attach(s.sim, 8, true);
    stepVfx(s);
    const glow = liveRings(s.scene).filter((r) => Math.abs(r.squash - 0.32) < 0.02);
    expect(glow.length).toBe(1);
    expect(glow[0]!.scale).toBeGreaterThan(0.2);
  });

  it('sizes the contact burst by arrival speed (R-GF-04)', async () => {
    const s = await stage();
    const burst = (speed: number) => {
      s.vfx.reset();
      attach(s.sim, speed, false);
      stepVfx(s);
      return s.vfx.additive.alive;
    };
    const slow = burst(6);
    const fast = burst(14);
    expect(fast).toBeGreaterThan(slow + 8);
    expect(slow).toBeGreaterThan(0);
  });

  it('gives every material voice a spark colour, so no surface answers in grey', () => {
    for (const material of Object.values(MATERIALS)) {
      expect(SPARK[material.voice], material.id).toBeDefined();
    }
  });

  it('blows an expanding ring out of the origin on a full-power release (R-GF-01)', async () => {
    const s = await stage();
    s.sim.events.emit('repel', { power: 0.5, speed: 9, normal: { x: 0, y: 1 }, point: { x: 0, y: 0 }, direction: { x: 0, y: 1 } });
    stepVfx(s);
    expect(liveRings(s.scene).some((r) => Math.abs(r.squash - 0.55) < 0.02 && r.scale < 0.8)).toBe(false);

    s.sim.events.emit('repel', { power: 1, speed: 14, normal: { x: 0, y: 1 }, point: { x: 0, y: 0 }, direction: { x: 0, y: 1 } });
    stepVfx(s);
    expect(liveRings(s.scene).some((r) => Math.abs(r.squash - 0.55) < 0.02 && r.scale < 0.8)).toBe(true);
  });
});

describe('the charge scene', () => {
  it('announces each meter threshold as it is crossed (R-GF-05)', async () => {
    const sim = await createSim(makeLevel([floor()]));
    const levels: number[] = [];
    sim.events.on('chargeLevel', (e) => levels.push(e.level));
    const d = new Driver(sim);
    d.start().press().ms(TUNING.repel.chargeMs + 50);
    expect(levels).toEqual([1, 2, 3]);
  });
});

describe('the catch keeps the run moving', () => {
  it("carries the flight's tangential momentum through the snap (R-GF-04)", async () => {
    const sim = await createSim(makeLevel([floor({ w: 40 })]));
    const d = new Driver(sim);
    d.start().tilt(0.8, 1).press().ms(500).release().tilt(0, 0);
    // Ride the arc until the floor is back inside the snap window, then arm,
    // let the magnet take the target, and release to fire the pull.
    expect(d.until(() => d.view.position.y < 2 && d.view.velocity.y < -2, 5000)).toBe(true);
    d.press();
    expect(d.until(() => d.view.snapTarget !== null, 1000)).toBe(true);
    d.release();
    expect(d.until(() => d.view.state === 'attached', 2000)).toBe(true);
    const speed = hypot2(d.view.velocity.x, d.view.velocity.y);
    expect(speed).toBeGreaterThan(0.3);
    const from = { ...d.view.position };
    d.ms(200);
    const moved = hypot2(d.view.position.x - from.x, d.view.position.y - from.y);
    expect(moved).toBeGreaterThan(0.05);
  });
});
