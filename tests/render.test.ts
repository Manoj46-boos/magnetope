import { Group, Mesh, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { PROPS } from '@/config/props';
import { CameraRig } from '@/render/camera-rig';
import { cosmeticById } from '@/config/cosmetics';
import { blinkLook } from '@/render/blink-look';
import { MagnoRig, skinFromLook } from '@/render/magno-rig';
import { ParticleSystem, RingPool } from '@/render/particles';
import { PALETTES } from '@/render/palette';
import { buildPropParts } from '@/render/prop-mesh';
import { layoutStage } from '@/render/stage';
import type { MagnoView } from '@/sim/magno';
import { createSim, makeLevel } from './helpers/harness';

const everyKind = Object.values(PROPS).map((kind, i) => ({ kind: kind.id, x: i * 6, y: 2 }));

describe('prop meshes', () => {
  it('builds clean, finite geometry for every prop in the physics table', async () => {
    const sim = await createSim(makeLevel(everyKind));
    for (const prop of sim.physics.props) {
      const parts = buildPropParts(prop, PALETTES.scrapyard, 3);
      for (const builder of [parts.body, parts.glass, parts.rim, parts.glow]) {
        expect(builder.positions.every(Number.isFinite)).toBe(true);
        expect(builder.colors.every(Number.isFinite)).toBe(true);
        expect(builder.positions.length).toBe(builder.colors.length);
        expect(builder.positions.length % 9).toBe(0);
      }
      expect(parts.body.triangleCount + parts.glass.triangleCount).toBeGreaterThan(8);
    }
  });

  it('keeps each prop inside the 900 triangle budget of the art bible', async () => {
    const sim = await createSim(makeLevel(everyKind));
    for (const prop of sim.physics.props) {
      const parts = buildPropParts(prop, PALETTES.scrapyard, 3);
      const total = parts.body.triangleCount + parts.glass.triangleCount + parts.rim.triangleCount + parts.glow.triangleCount;
      expect(total, prop.kind.id).toBeLessThanOrEqual(900);
    }
  });

  it('marks grabbable metal with a rim and leaves inert material without one', async () => {
    const sim = await createSim(makeLevel(everyKind));
    for (const prop of sim.physics.props) {
      const parts = buildPropParts(prop, PALETTES.scrapyard, 3);
      const magnetic = prop.material.magnetic !== 'inert';
      expect(parts.rim.triangleCount > 0, prop.kind.id).toBe(magnetic);
    }
  });

  it('keeps glass out of the opaque mesh so it can be transparent', async () => {
    const sim = await createSim(makeLevel([{ kind: 'pane', x: 0, y: 3 }]));
    const parts = buildPropParts(sim.physics.props[0]!, PALETTES.scrapyard, 1);
    expect(parts.glass.triangleCount).toBeGreaterThan(0);
  });

  it('is deterministic so a level looks the same every load', async () => {
    const sim = await createSim(makeLevel(everyKind));
    const prop = sim.physics.props[0]!;
    const a = buildPropParts(prop, PALETTES.scrapyard, 5).body.colors;
    const b = buildPropParts(prop, PALETTES.scrapyard, 5).body.colors;
    expect(a).toEqual(b);
  });
});

const view = (overrides: Partial<MagnoView> = {}): MagnoView => ({
  position: { x: 0, y: 0.3 },
  velocity: { x: 0, y: 0 },
  angle: 0,
  visualAngle: 0,
  state: 'airborne',
  polarity: 'attract',
  charge01: 0,
  chargeLevel: 0,
  snapArmed: false,
  snapEngaged: false,
  snapTarget: null,
  attachNormal: null,
  limp: false,
  scramble: false,
  recoverPhase: 0,
  grounded: false,
  chaining: false,
  dropMeters: 0,
  ...overrides,
});

const triangles = (root: Group): number => {
  let total = 0;
  root.traverseVisible((o) => {
    if (o instanceof Mesh) {
      const g = o.geometry;
      total += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    }
  });
  return total;
};

describe('MAGNO rig', () => {
  const run = (rig: MagnoRig, v: MagnoView, ms: number) => {
    const steps = Math.round(ms / (1000 / 120));
    for (let i = 0; i < steps; i++) rig.update(v, v.position, 1 / 120, false);
  };
  const deformScale = (rig: MagnoRig): number => (rig.root.children[0] as Group).scale.y;

  it('squashes to about 85% along the contact normal on attach, then recovers', () => {
    const rig = new MagnoRig();
    const v = view({ attachNormal: { x: 0, y: 1 }, visualAngle: 0 });
    run(rig, v, 40);
    rig.onAttach({ x: 0, y: 1 });
    run(rig, v, 95);
    expect(deformScale(rig)).toBeGreaterThan(0.82);
    expect(deformScale(rig)).toBeLessThan(0.9);
    run(rig, v, 400);
    expect(deformScale(rig)).toBeCloseTo(1, 1);
  });

  it('squashes the same 85% however fast he arrives', () => {
    const deepest = (approachSpeed: number) => {
      const rig = new MagnoRig();
      const v = view({ attachNormal: { x: 0, y: 1 }, visualAngle: 0, velocity: { x: 0, y: -approachSpeed } });
      run(rig, v, 40);
      rig.onAttach({ x: 0, y: 1 });
      let min = 1;
      for (let i = 0; i < 60; i++) {
        rig.update(v, v.position, 1 / 120, false);
        min = Math.min(min, deformScale(rig));
      }
      return min;
    };
    expect(deepest(6)).toBeCloseTo(0.85, 2);
    expect(deepest(16)).toBeCloseTo(0.85, 2);
  });

  it('stretches 118% to 124% along the launch for a flip, scaling with power', () => {
    const peak = (power: number) => {
      const rig = new MagnoRig();
      const v = view();
      run(rig, v, 30);
      rig.onRepel({ x: 0, y: 1 }, power);
      let max = 1;
      for (let i = 0; i < 12; i++) {
        rig.update(v, v.position, 1 / 120, false);
        max = Math.max(max, deformScale(rig));
      }
      return max;
    };
    const tap = peak(0);
    const full = peak(1);
    expect(tap).toBeGreaterThanOrEqual(1.16);
    expect(full).toBeLessThanOrEqual(1.26);
    expect(full).toBeGreaterThan(tap);
  });

  it('bottoms out near 72% on a hard landing', () => {
    const rig = new MagnoRig();
    const v = view();
    run(rig, v, 30);
    rig.onImpact({ x: 0, y: 1 }, 18);
    let min = 1;
    for (let i = 0; i < 14; i++) {
      rig.update(v, v.position, 1 / 120, false);
      min = Math.min(min, deformScale(rig));
    }
    expect(min).toBeLessThan(0.78);
    expect(min).toBeGreaterThan(0.68);
  });

  it('applies a gentle 108% stretch while free-falling fast', () => {
    const rig = new MagnoRig();
    run(rig, view({ velocity: { x: 0, y: -16 }, dropMeters: 12 }), 800);
    expect(deformScale(rig)).toBeGreaterThan(1.05);
    expect(deformScale(rig)).toBeLessThanOrEqual(1.09);
  });

  it('coils along its axis while the charge builds, reading well before a full release', () => {
    // R-GF-02: the anticipation is a squash that grows with the charge, so the
    // release stretch unwinds a spring the player already saw winding. At 900 ms
    // of charge, 120 ms before the top is charge01 = 0.867.
    const rig = new MagnoRig();
    const coilAt = (charge01: number) => {
      const v = view({ state: 'charging', charge01, chargeLevel: 3, polarity: 'repel', attachNormal: { x: 0, y: 1 } });
      run(rig, v, 200);
      return deformScale(rig);
    };
    expect(coilAt(0.2)).toBeGreaterThan(0.98);
    expect(coilAt(0.867)).toBeLessThan(0.92);
    expect(coilAt(1)).toBeLessThan(0.9);
  });

  it('wobbles after a catch in a damped sway spent inside three cycles', () => {
    // R-GF-02: the follow-through after the squash is an oscillation around
    // rest, small enough to read as weight and short enough to never noodle.
    const rig = new MagnoRig();
    const v = view({ attachNormal: { x: 0, y: 1 }, visualAngle: 0 });
    run(rig, v, 40);
    rig.onAttach({ x: 0, y: 1 });
    let crossings = 0;
    let above = 0;
    let latePeak = 0;
    for (let i = 0; i < Math.round(0.5 / (1 / 120)); i++) {
      rig.update(v, v.position, 1 / 120, false);
      const s = deformScale(rig);
      const side = s > 1.0015 ? 1 : s < 0.9985 ? -1 : above;
      if (side !== 0 && above !== 0 && side !== above) crossings++;
      if (side !== 0) above = side;
      if (i * (1 / 120) > 0.23) latePeak = Math.max(latePeak, Math.abs(s - 1));
    }
    expect(crossings).toBeGreaterThanOrEqual(2);
    expect(crossings).toBeLessThanOrEqual(7);
    expect(latePeak).toBeGreaterThan(0.002);
    expect(latePeak).toBeLessThan(0.04);
  });

  it('lets the eye lead the flight while the head is still arriving', () => {
    // R-GF-02: overlapping action — in flight the gaze rides a quick spring so
    // it is on the heading before the head's 30 ms lean has finished arriving.
    const rig = new MagnoRig();
    const pupil = (rig as unknown as { pupil: { position: { x: number } } }).pupil;
    const head = (rig as unknown as { headPivot: { rotation: { z: number } } }).headPivot;
    const still = view({ velocity: { x: 0, y: 0 } });
    run(rig, still, 400);
    const rest = head.rotation.z;
    const flying = view({ velocity: { x: 10, y: 0 } });
    for (let i = 0; i < 6; i++) rig.update(flying, flying.position, 1 / 120, false);
    const gazeEarly = pupil.position.x;
    const leanEarly = Math.abs(head.rotation.z - rest);
    run(rig, flying, 500);
    const gazeSettled = pupil.position.x;
    const leanSettled = Math.abs(head.rotation.z - rest);
    expect(gazeEarly / gazeSettled).toBeGreaterThan(leanEarly / leanSettled + 0.05);
    expect(gazeEarly / gazeSettled).toBeGreaterThan(0.8);
  });

  it('halves the squash for reduced motion', () => {
    const peak = (reduced: boolean) => {
      const rig = new MagnoRig();
      const v = view({ attachNormal: { x: 0, y: 1 } });
      rig.update(v, v.position, 1 / 120, reduced);
      rig.onAttach({ x: 0, y: 1 });
      let min = 1;
      for (let i = 0; i < 20; i++) {
        rig.update(v, v.position, 1 / 120, reduced);
        min = Math.min(min, deformScale(rig));
      }
      return 1 - min;
    };
    expect(peak(true)).toBeLessThan(peak(false) * 0.7);
  });

  // ----------------------------------------------- the face and the performance (W8)

  const pupilOf = (rig: MagnoRig): Mesh => (rig as unknown as { pupil: Mesh }).pupil;
  const lidValue = (rig: MagnoRig): number => (rig as unknown as { lidOpen: { value: number } }).lidOpen.value;

  it('names the focused face while charging, the pupil dilating with the charge', () => {
    const rig = new MagnoRig();
    const v = view({ state: 'charging', charge01: 1, chargeLevel: 3, polarity: 'repel', attachNormal: { x: 0, y: 1 } });
    run(rig, v, 200);
    expect(rig.eyeState).toBe('focused');
    expect(pupilOf(rig).scale.x).toBeGreaterThan(1.25);
    rig.dispose();
  });

  it('reads the panic face on a fall deep enough for the windmill', () => {
    const rig = new MagnoRig();
    const v = view({ dropMeters: 12, velocity: { x: 0, y: -14 } });
    run(rig, v, 300);
    expect(rig.eyeState).toBe('panic');
    expect(pupilOf(rig).scale.x).toBeLessThan(1);
    rig.dispose();
  });

  it('squeezes the eye shut on a landing that hurts, then recovers it', () => {
    const rig = new MagnoRig();
    const v = view({ attachNormal: { x: 0, y: 1 }, visualAngle: 0 });
    run(rig, v, 100);
    rig.onImpact({ x: 0, y: 1 }, 12);
    let lowest = 1;
    let sawWince = false;
    for (let i = 0; i < Math.round(0.18 / (1 / 120)); i++) {
      rig.update(v, v.position, 1 / 120, false);
      sawWince = sawWince || rig.eyeState === 'wince';
      lowest = Math.min(lowest, lidValue(rig));
    }
    expect(sawWince).toBe(true);
    expect(lowest).toBeLessThan(0.4);
    run(rig, v, 400);
    expect(lidValue(rig)).toBeGreaterThan(0.85);
    expect(rig.eyeState).toBe('idle');
    rig.dispose();
  });

  it('swaps the pupil for the comic X after a fall deep enough to earn it', () => {
    const deep = new MagnoRig();
    const falling = view({ dropMeters: 14, velocity: { x: 0, y: -16 } });
    run(deep, falling, 200);
    const bonked = view({ ...falling, limp: true, velocity: { x: 0, y: 0 } });
    run(deep, bonked, 200);
    const daze = (deep as unknown as { daze: Group }).daze;
    expect(deep.eyeState).toBe('dazed');
    expect(daze.visible).toBe(true);
    expect(pupilOf(deep).visible).toBe(false);
    deep.dispose();

    // A small bonk keeps the seeing-stars pulse: the X is earned, not automatic.
    const small = new MagnoRig();
    run(small, view({ limp: true, dropMeters: 3 }), 200);
    expect((small as unknown as { daze: Group }).daze.visible).toBe(false);
    expect(pupilOf(small).visible).toBe(true);
    small.dispose();
  });

  it('carries the clear gleam through the pride window and out the other side', () => {
    const rig = new MagnoRig();
    const v = view({ attachNormal: { x: 0, y: 1 }, visualAngle: 0 });
    run(rig, v, 100);
    rig.onClear();
    run(rig, v, 100);
    expect(rig.eyeState).toBe('pride');
    expect((rig as unknown as { gleam: Group }).gleam.visible).toBe(true);
    run(rig, v, 2500);
    expect((rig as unknown as { gleam: Group }).gleam.visible).toBe(false);
    expect(rig.eyeState).toBe('idle');
    rig.dispose();
  });

  it('shows the relief face when a panic ends in a catch', () => {
    const rig = new MagnoRig();
    const falling = view({ dropMeters: 12, velocity: { x: 0, y: -14 } });
    run(rig, falling, 200);
    rig.onAttach({ x: 0, y: 1 });
    const landed = view({ attachNormal: { x: 0, y: 1 }, visualAngle: 0 });
    run(rig, landed, 150);
    expect(rig.eyeState).toBe('relief');
    run(rig, landed, 1000);
    expect(rig.eyeState).toBe('idle');
    rig.dispose();
  });

  // ------------------------------------- the staged card's face (rebuild PRD 1.4.2)

  const eyeScaleOf = (rig: MagnoRig): number => (rig as unknown as { eyeScale: { value: number } }).eyeScale.value;
  const mouthOf = (rig: MagnoRig): Mesh => (rig as unknown as { mouth: Mesh }).mouth;
  const sparkOf = (rig: MagnoRig): Mesh => (rig as unknown as { spark: Mesh }).spark;

  it('performs the card-grade panic on command: the oversized eye, the agape mouth, the small pupil on wide white', () => {
    const rig = new MagnoRig();
    const flying = view({ velocity: { x: 3.94, y: 3.08 }, snapTarget: { x: 0.55, y: 16.6 }, polarity: 'repel' });
    rig.setCardFace('panic');
    run(rig, flying, 300);
    expect(rig.eyeState).toBe('panic');
    // the eye grows past anything gameplay asks of it — the 12-pixel law at 128 px
    expect(eyeScaleOf(rig)).toBeGreaterThan(2.2);
    expect(mouthOf(rig).visible).toBe(true);
    expect(sparkOf(rig).visible).toBe(true);
    // the pupil shrinks onto the wide white: half the eye reads as a lens, a quarter reads as panic
    expect(pupilOf(rig).scale.x).toBeLessThan(0.6);
    expect(pupilOf(rig).scale.x).toBeGreaterThan(0.3);
    rig.dispose();
  });

  it('performs the panic on an upward launch, where no fall exists to earn it', () => {
    const rig = new MagnoRig();
    const rising = view({ velocity: { x: 3.94, y: 3.08 }, polarity: 'repel' });
    rig.setCardFace('panic');
    run(rig, rising, 300);
    expect(rig.eyeState).toBe('panic');
    // the gameplay panic would never fire here: the override owns the face
    const plain = new MagnoRig();
    run(plain, rising, 300);
    expect(plain.eyeState).not.toBe('panic');
    plain.dispose();
    rig.dispose();
  });

  it('hands the face back: gameplay never shows the mouth, and the socket returns to its own scale', () => {
    const rig = new MagnoRig();
    const flying = view({ velocity: { x: 3.94, y: 3.08 }, snapTarget: { x: 0.55, y: 16.6 } });
    rig.setCardFace('panic');
    run(rig, flying, 300);
    expect(mouthOf(rig).visible).toBe(true);
    rig.setCardFace(null);
    run(rig, flying, 300);
    expect(mouthOf(rig).visible).toBe(false);
    expect(sparkOf(rig).visible).toBe(false);
    expect(eyeScaleOf(rig)).toBeLessThan(1.3);
    rig.dispose();
  });

  it('squints and darts the pupil at the surface failing under him', () => {
    const rig = new MagnoRig();
    const v = view({ state: 'attached', attachNormal: { x: 0, y: 1 }, visualAngle: 0 });
    run(rig, v, 200);
    rig.setWary({ x: 4, y: -1 });
    run(rig, v, 250);
    expect(rig.eyeState).toBe('wary');
    expect(lidValue(rig)).toBeLessThan(0.93);
    expect(pupilOf(rig).position.x).toBeGreaterThan(0.012);
    run(rig, v, 3000);
    expect(rig.eyeState).toBe('idle');
    rig.dispose();
  });

  it('gazes upward through the ending homecoming', () => {
    const rig = new MagnoRig();
    rig.setJoy(1);
    const v = view({ state: 'attached', attachNormal: { x: 0, y: 1 }, visualAngle: 0 });
    run(rig, v, 500);
    expect(rig.eyeState).toBe('home');
    expect(pupilOf(rig).position.y).toBeGreaterThan(0.01);
    rig.dispose();
  });

  it('breathes while settled', () => {
    const rig = new MagnoRig();
    const v = view({ state: 'attached', attachNormal: { x: 0, y: 1 }, visualAngle: 0 });
    run(rig, v, 500);
    const inner = (rig as unknown as { inner: Group }).inner;
    let low = inner.scale.y;
    let high = inner.scale.y;
    for (let i = 0; i < Math.round(2.5 / (1 / 120)); i++) {
      rig.update(v, v.position, 1 / 120, false);
      low = Math.min(low, inner.scale.y);
      high = Math.max(high, inner.scale.y);
    }
    expect(high - low).toBeGreaterThan(0.012);
    run(rig, view({ velocity: { x: 12, y: 0 } }), 1000);
    expect(Math.abs(inner.scale.y - 1)).toBeLessThan(0.004);
    rig.dispose();
  });

  it('blinks on its own cadence while settled', () => {
    const rig = new MagnoRig();
    const v = view({ state: 'attached', attachNormal: { x: 0, y: 1 }, visualAngle: 0 });
    let blinks = 0;
    let prev = 1;
    for (let i = 0; i < Math.round(15 / (1 / 120)); i++) {
      rig.update(v, v.position, 1 / 120, false);
      const lid = lidValue(rig);
      if (lid < 0.5 && prev >= 0.5) blinks++;
      prev = Math.min(prev, lid);
      if (lid >= 0.9) prev = lid;
    }
    expect(blinks).toBeGreaterThanOrEqual(2);
    expect(blinks).toBeLessThanOrEqual(4);
    rig.dispose();
  });

  it('performs one character beat around every twenty seconds of idling', () => {
    const rig = new MagnoRig();
    const v = view({ state: 'attached', attachNormal: { x: 0, y: 1 }, visualAngle: 0 });
    const beats: number[] = [];
    let seconds = 0;
    for (let i = 0; i < Math.round(30 / (1 / 120)); i++) {
      rig.update(v, v.position, 1 / 120, false);
      seconds += 1 / 120;
      if (rig.takeCharacterBeat()) beats.push(seconds);
    }
    expect(beats.length).toBe(1);
    expect(beats[0]).toBeGreaterThan(15);
    expect(beats[0]).toBeLessThan(25);

    // The world moving silences the performance: no beat while airborne.
    const flying = view({ velocity: { x: 10, y: 0 } });
    run(rig, flying, 5000);
    expect(rig.takeCharacterBeat()).toBeNull();
    rig.dispose();
  });

  it('flips in place at full motion and only looks around at reduced motion', () => {
    const innerRoll = (rig: MagnoRig): number => (rig as unknown as { inner: Group }).inner.rotation.z;
    const head = (rig: MagnoRig) => (rig as unknown as { headPivot: { rotation: { z: number } } }).headPivot;
    const v = view({ state: 'attached', attachNormal: { x: 0, y: 1 }, visualAngle: 0 });

    const full = new MagnoRig();
    const rest = head(full).rotation.z;
    let beatSeen = false;
    let peakRoll = 0;
    let peakSweep = 0;
    for (let i = 0; i < Math.round(25 / (1 / 120)) && !beatSeen; i++) {
      full.update(v, v.position, 1 / 120, false);
      beatSeen = full.takeCharacterBeat() !== null;
    }
    expect(beatSeen).toBe(true);
    for (let i = 0; i < Math.round(1.5 / (1 / 120)); i++) {
      full.update(v, v.position, 1 / 120, false);
      peakRoll = Math.max(peakRoll, innerRoll(full));
      peakSweep = Math.max(peakSweep, Math.abs(head(full).rotation.z - rest));
    }
    expect(peakRoll).toBeGreaterThan(Math.PI);
    expect(peakSweep).toBeGreaterThan((6 * Math.PI) / 180);
    full.dispose();

    const reduced = new MagnoRig();
    const headRest = head(reduced).rotation.z;
    let reducedBeat = false;
    let reducedRoll = 0;
    let reducedSweep = 0;
    for (let i = 0; i < Math.round(25 / (1 / 120)); i++) {
      reduced.update(v, v.position, 1 / 120, true);
      if (reduced.takeCharacterBeat()) reducedBeat = true;
      if (reducedBeat) {
        reducedRoll = Math.max(reducedRoll, Math.abs(innerRoll(reduced)));
        reducedSweep = Math.max(reducedSweep, Math.abs(head(reduced).rotation.z - headRest));
      }
    }
    expect(reducedBeat).toBe(true);
    expect(reducedRoll).toBe(0);
    expect(reducedSweep).toBeGreaterThan((4 * Math.PI) / 180);
    reduced.dispose();
  });

  it('glances at the nearest steel on the blink-look cycle', () => {
    const rig = new MagnoRig();
    const v = view({ state: 'attached', attachNormal: { x: 0, y: 1 }, visualAngle: 0 });
    rig.setCuriosity({ x: 5, y: 4 });
    run(rig, v, 3500);
    expect(pupilOf(rig).position.x).toBeLessThan(0.01);
    let peak = 0;
    for (let i = 0; i < Math.round(5 / (1 / 120)); i++) {
      rig.update(v, v.position, 1 / 120, false);
      peak = Math.max(peak, pupilOf(rig).position.x);
    }
    expect(peak).toBeGreaterThan(0.015);
    rig.dispose();
  });

  it('stays inside the character budget with every accessory skin equipped', () => {
    const rig = new MagnoRig();
    for (const id of ['skin.antenna', 'skin.flag', 'skin.sticker']) {
      const item = cosmeticById(id)!;
      if (item.kind === 'skin') rig.applySkin(skinFromLook(item.look));
      expect(triangles(rig.root), id).toBeLessThanOrEqual(480 + 240 + 260);
    }
  });

  it('keeps its triangle count inside the character budget', () => {
    expect(triangles(new MagnoRig().root)).toBeLessThanOrEqual(480 + 2 * 120 + 260);
  });

  it('keeps positions finite across a hostile sequence of states', () => {
    const rig = new MagnoRig();
    const states: Array<Partial<MagnoView>> = [
      { state: 'charging', charge01: 1, chargeLevel: 3, polarity: 'repel', attachNormal: { x: 1, y: 0 }, visualAngle: -Math.PI / 2 },
      { limp: true, velocity: { x: 30, y: -30 }, angle: 3 },
      { state: 'recovering', recoverPhase: 0.5 },
      { snapEngaged: true, snapTarget: { x: 4, y: 3 } },
      { dropMeters: 40, velocity: { x: 0, y: -28 } },
    ];
    for (let i = 0; i < 600; i++) rig.update(view(states[i % states.length]), { x: i * 0.01, y: 3 }, 1 / 60, false);
    rig.root.traverse((o) => {
      expect(Number.isFinite(o.position.x + o.position.y + o.position.z)).toBe(true);
      expect(Number.isFinite(o.scale.x + o.scale.y + o.scale.z)).toBe(true);
    });
  });
});

describe('camera shake grammar', () => {
  const opts = { falling: false, slowMo: 0, bounds: { minX: -20, maxX: 20 } };
  const makeRig = () => {
    const rig = new CameraRig();
    rig.setLayout(layoutStage(1280, 720));
    rig.snapTo({ x: 0, y: 5 });
    for (let i = 0; i < 240; i++) rig.update({ x: 0, y: 5 }, { x: 0, y: 0 }, 1 / 60, opts);
    return rig;
  };
  const step = (rig: CameraRig) => rig.update({ x: 0, y: 5 }, { x: 0, y: 0 }, 1 / 60, opts);

  /** Peak distance between a shaken camera and an identical camera that never shook. */
  const deviation = (kind: 'micro' | 'small' | 'big', critical = false, reduced = false) => {
    const shaken = makeRig();
    const control = makeRig();
    shaken.reducedMotion = reduced;
    shaken.shake(kind, critical);
    let max = 0;
    let roll = 0;
    for (let i = 0; i < 40; i++) {
      step(shaken);
      step(control);
      max = Math.max(max, shaken.camera.position.distanceTo(control.camera.position));
      roll = Math.max(roll, shaken.camera.quaternion.angleTo(control.camera.quaternion));
    }
    return { max, roll };
  };

  it('orders amplitudes micro < small < big', () => {
    const micro = deviation('micro').max;
    const small = deviation('small').max;
    const big = deviation('big').max;
    expect(micro).toBeGreaterThan(0);
    expect(small).toBeGreaterThan(micro);
    expect(big).toBeGreaterThan(small);
  });

  it('never shakes during an input-critical window such as a snap in progress', () => {
    expect(deviation('big', true).max).toBe(0);
  });

  it('settles back once the shake has played out', () => {
    const shaken = makeRig();
    const control = makeRig();
    shaken.shake('big', false);
    for (let i = 0; i < 240; i++) {
      step(shaken);
      step(control);
    }
    expect(shaken.camera.position.distanceTo(control.camera.position)).toBeLessThan(0.002);
  });

  it('cuts shake by 70% for reduced motion', () => {
    const normal = deviation('big').max;
    const reduced = deviation('big', false, true).max;
    expect(reduced).toBeLessThan(normal * 0.4);
    expect(reduced).toBeGreaterThan(0);
  });

  it('removes rotational shake entirely for reduced motion', () => {
    expect(deviation('big', false, true).roll).toBeLessThan(1e-6);
    expect(deviation('big').roll).toBeGreaterThan(0);
  });

  it('keeps rotation under 1.2 degrees', () => {
    expect(deviation('big').roll).toBeLessThanOrEqual((1.2 * Math.PI) / 180 + 1e-6);
  });

  it('pulls back during a long fall so the landing zone can be read', () => {
    const rig = makeRig();
    const start = rig.camera.position.z;
    for (let i = 0; i < 120; i++) {
      rig.update({ x: 0, y: 5 }, { x: 0, y: -20 }, 1 / 60, { ...opts, falling: true, slowMo: 1 });
    }
    expect(rig.camera.position.z).toBeGreaterThan(start * 1.3);
  });

  it('keeps the play frame framed in portrait', () => {
    const rig = new CameraRig();
    rig.setLayout(layoutStage(390, 844));
    rig.snapTo({ x: 0, y: 3 });
    expect(rig.camera.aspect).toBeCloseTo(390 / 844, 3);
    expect(rig.camera.position.z).toBeGreaterThan(10);
  });
});

describe('particles', () => {
  const spark = { x: 0, y: 0, vx: 1, vy: 1, life: 0.5, size: 0.1, color: [1, 1, 1] as const };

  it('never exceeds its ceiling', () => {
    const system = new ParticleSystem(900, true, 0);
    system.setCeiling(260);
    let accepted = 0;
    for (let i = 0; i < 2000; i++) if (system.emit(spark)) accepted++;
    expect(accepted).toBe(260);
    expect(system.alive).toBe(260);
  });

  it('retires particles at the end of their life and frees slots for new ones', () => {
    const system = new ParticleSystem(100, true, 0);
    for (let i = 0; i < 50; i++) system.emit(spark);
    for (let i = 0; i < 40; i++) system.update(1 / 60);
    expect(system.alive).toBe(0);
    expect(system.emit(spark)).toBe(true);
  });

  it('applies gravity and drag to particle motion', () => {
    const system = new ParticleSystem(10, true, 0);
    system.emit({ ...spark, vx: 0, vy: 0, gravity: -10, life: 1 });
    for (let i = 0; i < 30; i++) system.update(1 / 60);
    const y = system.points.geometry.getAttribute('position').getY(0);
    expect(y).toBeLessThan(-0.5);
  });

  it('keeps its buffers finite after heavy churn', () => {
    const system = new ParticleSystem(300, false, 0);
    for (let frame = 0; frame < 300; frame++) {
      for (let i = 0; i < 5; i++) system.emit({ ...spark, life: 0.2 + (i % 3) * 0.1 });
      system.update(1 / 60);
    }
    const position = system.points.geometry.getAttribute('position');
    for (let i = 0; i < system.alive; i++) expect(Number.isFinite(position.getX(i) + position.getY(i))).toBe(true);
  });

  it('expands rings and then hides them', () => {
    const scene = new Scene();
    const pool = new RingPool(scene, 3, 0);
    pool.spawn(0, 0, 0.1, 2, 0.3, [1, 1, 1]);
    const ring = scene.children[0] as Mesh;
    expect(ring.visible).toBe(true);
    for (let i = 0; i < 10; i++) pool.update(1 / 60);
    expect(ring.scale.x).toBeGreaterThan(0.5);
    for (let i = 0; i < 30; i++) pool.update(1 / 60);
    expect(ring.visible).toBe(false);
  });
});

describe('flickering signs', () => {
  const sample = (reduced: boolean) => Array.from({ length: 400 }, (_, i) => blinkLook('warn', i * 10, reduced).glow);

  it('draws a lit sign solid and a dark one as a faint ghost the player can still plan around', () => {
    expect(blinkLook('on', 1234, false)).toEqual({ body: 1, glow: 1, rim: 0.85 });
    const dark = blinkLook('off', 1234, false);
    expect(dark.body).toBeLessThan(0.2);
    expect(dark.glow).toBeGreaterThan(0.05);
    expect(dark.glow).toBeLessThan(0.2);
    expect(dark.rim).toBeGreaterThan(0.1);
  });

  it('flickers in warning, but slower than three flashes a second', () => {
    const levels = sample(false);
    expect(new Set(levels).size).toBeGreaterThan(1);
    let transitions = 0;
    for (let i = 1; i < levels.length; i++) if (levels[i] !== levels[i - 1]) transitions++;
    const flashesPerSecond = transitions / 2 / (levels.length / 100);
    expect(flashesPerSecond).toBeLessThanOrEqual(3);
  });

  it('holds a steady dim instead of flickering when reduced motion is on', () => {
    expect(new Set(sample(true)).size).toBe(1);
    expect(sample(true)[0]).toBeGreaterThan(0.3);
  });

  it('never leaves its opacity range, so a sign cannot vanish or blow out', () => {
    for (const state of ['on', 'warn', 'off'] as const) {
      for (let ms = 0; ms < 5000; ms += 37) {
        for (const reduced of [false, true]) {
          const look = blinkLook(state, ms, reduced);
          for (const v of [look.body, look.glow, look.rim]) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});
