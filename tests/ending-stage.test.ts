import { Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { CLICK_SECONDS, EndingDirector, endingFrame } from '@/game/ending';
import { ALL_LEVELS } from '@/levels';
import { EndingStage, dipolePoints, type StageInputs } from '@/render/ending-stage';
import { MagnoRig } from '@/render/magno-rig';
import { mountainLayout } from '@/render/mountain';
import type { MagnoView } from '@/sim/magno';
import { Driver, createSim, makeLevel } from './helpers/harness';

const layout = mountainLayout(ALL_LEVELS);
const finale = ALL_LEVELS.find((l) => l.finale)!;

function inputs(seconds: number, overrides: Partial<StageInputs> = {}): StageInputs {
  return {
    frame: endingFrame(seconds),
    summit: { x: finale.summit.x, y: finale.summit.y },
    chest: { x: 0.4, y: finale.summit.y - 1.1 },
    head: { x: 0.4, y: finale.summit.y - 0.4 },
    axisAngle: 0,
    cameraDistance: 28,
    time: seconds,
    actorZ: 0.4,
    ...overrides,
  };
}

describe('dipole field lines', () => {
  it('leave the pole, swing out to the given reach beside the axis and come back to the pole', () => {
    const points = dipolePoints(2, false);
    const first = points[0]!;
    const last = points.at(-1)!;
    expect(Math.hypot(first.x, first.y)).toBeLessThan(0.2);
    expect(Math.hypot(last.x, last.y)).toBeLessThan(0.2);
    expect(first.y).toBeGreaterThan(0);
    expect(last.y).toBeLessThan(0);
    expect(Math.max(...points.map((p) => p.x))).toBeCloseTo(2, 1);
  });

  it('come in mirrored pairs so the bloom is symmetric about the magnet', () => {
    const right = dipolePoints(1.3, false);
    const left = dipolePoints(1.3, true);
    right.forEach((p, i) => {
      expect(left[i]!.x).toBeCloseTo(-p.x, 9);
      expect(left[i]!.y).toBeCloseTo(p.y, 9);
    });
  });

  it('are finite and never leave the plane', () => {
    for (const p of dipolePoints(2.9, true)) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(p.z).toBe(0);
    }
  });
});

describe('ending stage', () => {
  it('draws two lines per reach, and fewer on the low tier', () => {
    expect(new EndingStage(layout, false).bloomLineCount).toBe(14);
    expect(new EndingStage(layout, true).bloomLineCount).toBe(8);
  });

  it('shows only the loose core before the click: no bloom, no beam, no star, no mountain', () => {
    const stage = new EndingStage(layout, false);
    stage.apply(inputs(5));
    expect(stage.coreObject.visible).toBe(true);
    expect(stage.bloomObject.visible).toBe(false);
    expect(stage.beamObject.visible).toBe(false);
    expect(stage.starObject.visible).toBe(false);
    expect(stage.mountain.layers.every((l) => !l.visible)).toBe(true);
  });

  it('floats the core above the summit first, then carries it to the chest', () => {
    const stage = new EndingStage(layout, false);
    stage.apply(inputs(5.5));
    expect(stage.coreObject.position.y).toBeGreaterThan(finale.summit.y + 1);
    expect(stage.coreObject.position.x).toBeCloseTo(finale.summit.x, 1);

    stage.apply(inputs(CLICK_SECONDS - 0.01));
    expect(stage.coreObject.position.x).toBeCloseTo(0.4, 1);
    expect(stage.coreObject.position.y).toBeCloseTo(finale.summit.y - 1.1, 1);
  });

  it('shrinks the core as it travels so it fits the socket', () => {
    const stage = new EndingStage(layout, false);
    stage.apply(inputs(5.5));
    const big = stage.coreObject.scale.x;
    stage.apply(inputs(CLICK_SECONDS - 0.01));
    expect(stage.coreObject.scale.x).toBeLessThan(big * 0.2);
  });

  it('absorbs the core at the click and lights the chest, the bloom and the beam', () => {
    const stage = new EndingStage(layout, false);
    stage.apply(inputs(CLICK_SECONDS + 2));
    expect(stage.coreObject.visible).toBe(false);
    expect(stage.bloomObject.visible).toBe(true);
    expect(stage.starObject.visible).toBe(true);
    stage.apply(inputs(CLICK_SECONDS + 10));
    expect(stage.beamObject.visible).toBe(true);
  });

  it('grows the bloom around the head and turns it with the magnet', () => {
    const stage = new EndingStage(layout, false);
    stage.apply(inputs(12, { axisAngle: 0.5 }));
    const early = stage.bloomObject.scale.x;
    expect(stage.bloomObject.position.x).toBeCloseTo(0.4, 6);
    expect(stage.bloomObject.position.y).toBeCloseTo(finale.summit.y - 0.4, 6);
    expect(stage.bloomObject.rotation.z).toBeCloseTo(0.5, 6);
    stage.apply(inputs(30, { axisAngle: 0.5 }));
    expect(stage.bloomObject.scale.x).toBeGreaterThan(early * 4);
  });

  it('keeps the star visible as a point of light however far the camera backs away', () => {
    const stage = new EndingStage(layout, false);
    stage.apply(inputs(40, { cameraDistance: 30 }));
    const near = stage.starObject.scale.x;
    stage.apply(inputs(40, { cameraDistance: 800 }));
    expect(stage.starObject.scale.x).toBeGreaterThan(near * 10);
  });

  it('fades the mountain in only once the pull-back is under way', () => {
    const stage = new EndingStage(layout, false);
    stage.apply(inputs(24));
    expect(stage.mountain.layers.every((l) => !l.visible)).toBe(true);
    stage.apply(inputs(40));
    expect(stage.mountain.layers.every((l) => l.visible)).toBe(true);
  });

  it('puts the mountain behind the actors, with the pale far ridge furthest back', () => {
    const stage = new EndingStage(layout, false);
    const [far, near] = stage.mountain.layers;
    expect(far!.position.z).toBeLessThan(near!.position.z);
    expect(near!.position.z).toBeLessThan(0);
  });

  it('releases its meshes without throwing', () => {
    const stage = new EndingStage(layout, false);
    stage.apply(inputs(40));
    expect(() => stage.dispose()).not.toThrow();
    let meshes = 0;
    stage.group.traverse((o) => o instanceof Mesh && meshes++);
    expect(meshes).toBeGreaterThan(0);
  });
});

describe('finale to ending, with the real simulation and rig', () => {
  const view = (position: { x: number; y: number }): MagnoView => ({ position, velocity: { x: 0, y: 0 }, visualAngle: 0 }) as MagnoView;

  it('clears the finale at its summit, then seats the core exactly in the chest MAGNO is wearing', async () => {
    const level = makeLevel([{ kind: 'plate', x: 0, y: -0.4, w: 16, h: 0.8 }], {
      id: 'finale-test',
      summit: { x: 0, y: 0.6, radius: 3 },
      finale: true,
    });
    const sim = await createSim(level);
    const summits: unknown[] = [];
    sim.events.on('summit', (s) => summits.push(s));
    new Driver(sim).start().ms(600);
    expect(summits).toHaveLength(1);
    expect(sim.level.finale).toBe(true);

    const rig = new MagnoRig();
    const pos = sim.magno.view.position;
    for (let i = 0; i < 20; i++) rig.update(view(pos), pos, 1 / 60, false);

    const stage = new EndingStage(layout, false);
    const director = new EndingDirector();
    let clickFrame = -1;
    let frameCount = 0;
    director.events.on('click', () => (clickFrame = frameCount));
    let lastLoose = { x: 0, y: 0 };
    while (!director.finished) {
      director.update(1 / 60);
      frameCount++;
      rig.update(view(pos), pos, 1 / 60, false);
      const chest = rig.chestWorld();
      stage.apply({
        frame: director.frame,
        summit: sim.level.summit,
        chest,
        head: rig.headWorld(),
        axisAngle: 0,
        cameraDistance: 28,
        time: director.elapsed,
        actorZ: 0.4,
      });
      if (stage.coreObject.visible) lastLoose = { x: stage.coreObject.position.x, y: stage.coreObject.position.y };
    }

    const chest = rig.chestWorld();
    expect(Math.abs(clickFrame - CLICK_SECONDS * 60)).toBeLessThanOrEqual(1);
    expect(Math.hypot(lastLoose.x - chest.x, lastLoose.y - chest.y)).toBeLessThan(0.15);
    expect(chest.y).toBeLessThan(sim.magno.view.position.y);
    expect(stage.coreObject.visible).toBe(false);
  });

  it('shows the socket light only while the core is home', () => {
    const rig = new MagnoRig();
    expect(rig.coreLightVisible).toBe(false);
    rig.setCoreLight(0.8);
    expect(rig.coreLightVisible).toBe(true);
    rig.setCoreLight(0);
    expect(rig.coreLightVisible).toBe(false);
  });

  it('wears the socket below the head and above the feet, wherever MAGNO is turned', () => {
    const rig = new MagnoRig();
    const pos = { x: 3, y: 40 };
    for (let i = 0; i < 30; i++) rig.update(view(pos), pos, 1 / 60, false);
    const chest = rig.chestWorld();
    expect(chest.y).toBeLessThan(rig.headWorld().y);
    expect(chest.y).toBeLessThan(pos.y);
    expect(chest.y).toBeGreaterThan(pos.y - 0.3);
    expect(chest.x).toBeCloseTo(pos.x, 1);
  });
});
