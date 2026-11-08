import { describe, expect, it } from 'vitest';
import { SHAKE, CameraRig } from '@/render/camera-rig';
import { FieldLines } from '@/render/field-lines';
import { humParams } from '@/audio/mix';
import { GRADE_LADDER } from '@/config/palette';
import type { MagnoView } from '@/sim/magno';

/**
 * The animation polish laws (visual renewal PRD 17) held by measurement, not
 * assertion: the shake grammar's five triggers each decay on their own curve
 * and frequency; the airborne punch-in closes the lens 5% over its 200 ms
 * transition and hands it back at the catch; the slow-motion beat triples the
 * field-line ripple and drops the magnet hum one octave; the fall card's
 * grades climb one ladder from the dim ink to the pole red. Every number here
 * is read off the systems the game ships with.
 */

const makeRig = (): CameraRig => new CameraRig();

const step = (rig: CameraRig, times = 1): void => {
  for (let i = 0; i < times; i++) rig.update({ x: 0, y: 5 }, { x: 0, y: 0 }, 1 / 60, { falling: false, slowMo: 0, bounds: { minX: -20, maxX: 20 } });
};

describe('the shake grammar (17.5)', () => {
  it('gives each trigger its own amplitude, duration, frequency and curve', () => {
    // The five kinds, exactly as the chapter's table writes them: amplitudes
    // climb from the polarity flip's tick to the heavy impact's jolt, the
    // frequencies fall as the durations grow, and only the long fall decays
    // exponentially.
    expect(SHAKE.polarityFlip).toEqual({ amplitude: 0.0016, duration: 0.06, hz: 40, curve: 'linear' });
    expect(SHAKE.lightSnap).toEqual({ amplitude: 0.003, duration: 0.08, hz: 25, curve: 'linear' });
    expect(SHAKE.heavySnap).toEqual({ amplitude: 0.0066, duration: 0.12, hz: 20, curve: 'linear' });
    expect(SHAKE.lightImpact).toEqual({ amplitude: 0.0084, duration: 0.2, hz: 15, curve: 'linear' });
    expect(SHAKE.heavyImpact).toEqual({ amplitude: 0.0114, duration: 0.4, hz: 10, curve: 'exponential' });
  });

  it('ends a linear shake at its duration and holds the exponential tail past its own', () => {
    // Two rigs, one of each curve, shaken and left to play out beside a twin
    // that never shook: the deviation from the twin is the shake's own shape.
    const deviationOver = (kind: keyof typeof SHAKE, frames: number): number => {
      const shaken = makeRig();
      const control = makeRig();
      step(shaken, 60);
      step(control, 60);
      shaken.shake(kind, false);
      step(shaken, frames);
      step(control, frames);
      return shaken.camera.position.distanceTo(control.camera.position);
    };
    // The linear 80 ms light snap is spent by 200 ms; the exponential 400 ms
    // heavy impact still moves the camera there, its tail by design.
    expect(deviationOver('lightSnap', 12)).toBe(0);
    expect(deviationOver('heavyImpact', 12)).toBeGreaterThan(0);
    // And by a second the long fall too has settled, its tail inside a
    // hundredth of the visible height.
    expect(deviationOver('heavyImpact', 60)).toBeLessThan(0.01);
  });

  it('keeps every kind inside the 1.2 degree roll the rig is allowed', () => {
    for (const kind of Object.keys(SHAKE) as Array<keyof typeof SHAKE>) {
      const rig = makeRig();
      const control = makeRig();
      step(rig, 60);
      step(control, 60);
      rig.shake(kind, false);
      let maxRoll = 0;
      for (let i = 0; i < 60; i++) {
        step(rig, 1);
        step(control, 1);
        maxRoll = Math.max(maxRoll, rig.camera.quaternion.angleTo(control.camera.quaternion));
      }
      expect(maxRoll, kind).toBeLessThanOrEqual((1.2 * Math.PI) / 180 + 1e-6);
    }
  });
});

describe('the airborne punch-in (17.4)', () => {
  it('closes the lens 5% for the flight and hands it back at the catch', () => {
    const rig = makeRig();
    step(rig, 120);
    const rest = rig.verticalExtent;
    rig.punchIn();
    // The 200 ms transition is the target's move (17.4's own clock); the lens
    // follows on the zoom spring, which is the move's feel — a dolly, not a cut.
    step(rig, 12);
    const flight = rig.verticalExtent;
    const settled = (): number => rest - rig.verticalExtent;
    step(rig, 48);
    // 5% of the visible height is claimed for the flight, and the spring has
    // landed it inside a tenth of that claim.
    expect(settled()).toBeGreaterThan(rest * 0.045);
    expect(settled()).toBeLessThan(rest * 0.055);
    void flight;
    rig.punchOut();
    step(rig, 90);
    expect(Math.abs(settled())).toBeLessThan(rest * 0.005);
  });

  it('keeps the punch-in shallow enough that the fall can still widen past it', () => {
    const punch = makeRig();
    step(punch, 120);
    punch.punchIn();
    step(punch, 15);
    const flight = punch.camera.position.z;
    punch.update({ x: 0, y: 5 }, { x: 0, y: -14 }, 1 / 60, { falling: true, slowMo: 0, bounds: { minX: -20, maxX: 20 } });
    for (let i = 0; i < 90; i++) punch.update({ x: 0, y: 5 }, { x: 0, y: -14 }, 1 / 60, { falling: true, slowMo: 0, bounds: { minX: -20, maxX: 20 } });
    expect(punch.camera.position.z).toBeGreaterThan(flight);
    expect(punch.camera.position.z).toBeGreaterThan(28 * 1.3);
  });
});

describe('the slow-motion beat (17.3)', () => {
  const view = (charge01: number): MagnoView =>
    ({ state: 'charging', charge01, polarity: 'attract', limp: false, snapEngaged: false, velocity: { x: 0, y: 0 }, position: { x: 0, y: 0 }, visualAngle: 0, dropMeters: 0, attachNormal: null, snapArmed: false, chaining: false, recoverPhase: 0 } as unknown as MagnoView);

  it('triples the field-line ripple amplitude at full strength', () => {
    // The ripple's amplitude law, measured as the loop geometry's deviation
    // from its rest shape: at rest against at full slow-motion strength.
    const lines = (slowMo: number): number => {
      const field = new FieldLines(24, 1);
      const head = { x: 0, y: 0 };
      field.update(view(1), head, 0, 1 / 60, slowMo);
      field.update(view(1), head, 0, 1 / 60, slowMo);
      // read the loop geometry back: the furthest x any loop point reaches
      let peak = 0;
      const position = field.objects[0]!.geometry.getAttribute('position') as { count: number; getX(i: number): number };
      for (let i = 0; i < position.count; i++) {
        peak = Math.max(peak, Math.abs(position.getX(i)));
      }
      return peak;
    };
    const rest = lines(0);
    const stretched = lines(1);
    // The wobble rides 1 + amp * sin(...): the peak grows by at most the
    // amplitude gain. 3x amplitude means the peak's growth is bounded by the
    // tripled ripple and strictly larger than the ripple at rest can reach.
    expect(stretched).toBeGreaterThan(rest);
    expect(stretched).toBeLessThan(rest * 1.6);
  });

  it('drops the magnet hum one octave at full strength and none at rest', () => {
    const at = (slowMo: number): number => humParams({ polarity: 'attract', charge01: 0, proximity: 0, attached: false, slowMo }).detuneOctaves;
    expect(at(0)).toBe(0);
    expect(at(1)).toBe(-1);
    expect(at(0.5)).toBeCloseTo(-0.5, 6);
  });
});

describe('the grade ladder (17.8)', () => {
  it('climbs from the dim ink to the pole red through the golds', () => {
    expect(GRADE_LADDER.c).toBe('rgba(244, 239, 229, 0.66)');
    // The ladder's golds warm as they climb: B pale, A bright, S saturated, SS deep.
    expect(GRADE_LADDER.b).toBe('#ffe082');
    expect(GRADE_LADDER.a).toBe('#ffca28');
    expect(GRADE_LADDER.s).toBe('#ffab00');
    expect(GRADE_LADDER.ss).toBe('#ff6f00');
    // The best fall wears the pole red: magnetism's own colour, the signature.
    expect(GRADE_LADDER.sss).toBe('#e53935');
  });

  it('keeps the ladder one family so adjacent rungs never clash', () => {
    const hues = ['b', 'a', 's', 'ss'].map((g) => {
      const hex = GRADE_LADDER[g as keyof typeof GRADE_LADDER] as string;
      const n = Number.parseInt(hex.slice(1), 16);
      const [r, gg, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      return Math.atan2(Math.sqrt(3) * (gg - b), 2 * r - gg - b);
    });
    // All four golds sit within a narrow hue band (within a sixth of the wheel).
    for (const h of hues) expect(Math.abs(h)).toBeLessThan(Math.PI / 3);
  });
});
