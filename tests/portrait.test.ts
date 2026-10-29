import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CameraRig } from '@/render/camera-rig';
import { layoutStage } from '@/render/stage';
import type { Vec2 } from '@/core/mathx';

/**
 * The portrait climb doctrine (P-MO-01): the visit a phone holds upright is
 * the game's natural orientation, not a letterboxed apology. Every law here
 * is measured through the real camera projection — where MAGNO, the frame
 * and the summit actually land on screen — the same way the QA session that
 * named the 4/10 measured them.
 */

const PHONE_PORTRAIT = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 720 };
/** MAGNO's own body: the physics capsule is 0.45 m across, the rig a shade wider. */
const MAGNO_WIDTH = 0.6;

function rigAt(view: { width: number; height: number }): CameraRig {
  const rig = new CameraRig();
  rig.setLayout(layoutStage(view.width, view.height));
  return rig;
}

type UpdateOpts = Parameters<CameraRig['update']>[3];

function settle(rig: CameraRig, opts: Partial<UpdateOpts> = {}): CameraRig {
  rig.snapTo({ x: 0, y: 0 });
  for (let i = 0; i < 240; i++) rig.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1 / 60, { falling: false, slowMo: 0, bounds: { minX: -20, maxX: 20 }, ...opts });
  return rig;
}

/** Where a world point lands, as a fraction of the frame from the bottom. */
function fractionFromBottom(rig: CameraRig, point: Vec2): number {
  const v = new Vector3(point.x, point.y, 0).project(rig.camera);
  return (v.y + 1) / 2;
}

describe('the portrait stage', () => {
  it('holds the portrait visit to five metres of climb width (P-MO-01)', () => {
    const layout = layoutStage(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height);
    expect(layout.portrait).toBe(true);
    expect(layout.minVisibleWidth).toBeCloseTo(5.0, 6);
    expect(layout.minVisibleHeight).toBeLessThan(11);
    // The letterbox is gone: the old 7.6 m frame put MAGNO at a twelfth of the
    // width; five metres puts him at character scale.
    expect(MAGNO_WIDTH / layout.minVisibleWidth).toBeGreaterThan(0.11);
  });

  it('leaves the landscape frame exactly where it was', () => {
    const layout = layoutStage(DESKTOP.width, DESKTOP.height);
    expect(layout.portrait).toBe(false);
    expect(layout.minVisibleHeight).toBeCloseTo(8.6, 6);
    expect(layout.minVisibleWidth).toBeCloseTo((8.6 * 16) / 9, 6);
  });
});

describe('the portrait follow shot', () => {
  it('puts sixty-two percent of the frame above MAGNO', () => {
    const rig = settle(rigAt(PHONE_PORTRAIT));
    const player = fractionFromBottom(rig, { x: 0, y: 0 });
    expect(player).toBeGreaterThan(0.34);
    expect(player).toBeLessThan(0.42);
  });

  it('keeps the landscape follow where it always sat', () => {
    const rig = settle(rigAt(DESKTOP));
    const player = fractionFromBottom(rig, { x: 0, y: 0 });
    expect(player).toBeGreaterThan(0.42);
    expect(player).toBeLessThan(0.48);
  });

  it('brings the follow rest up the shaft, so the opener settles into the same shot', () => {
    const portrait = rigAt(PHONE_PORTRAIT).restFocus({ x: 0, y: 0 });
    const landscape = rigAt(DESKTOP).restFocus({ x: 0, y: 0 });
    expect(portrait.y).toBeGreaterThan(landscape.y * 2);
  });

  it('re-settles the follow when the screen turns mid-climb', () => {
    const rig = settle(rigAt(PHONE_PORTRAIT));
    rig.setLayout(layoutStage(844, 390));
    for (let i = 0; i < 240; i++) rig.update({ x: 0, y: 0 }, { x: 0, y: 0 }, 1 / 60, { falling: false, slowMo: 0, bounds: { minX: -20, maxX: 20 } });
    const v = new Vector3(0, 0, 0).project(rig.camera);
    expect(Math.abs(v.x)).toBeLessThan(1);
    const player = fractionFromBottom(rig, { x: 0, y: 0 });
    expect(player).toBeGreaterThan(0.42);
    expect(player).toBeLessThan(0.48);
  });
});

describe('the approach shot', () => {
  it('lifts its gaze to hold the summit in the upper third as the climb nears its end', () => {
    const rig = settle(rigAt(PHONE_PORTRAIT), { goal: { x: 0, y: 7 } });
    const summit = fractionFromBottom(rig, { x: 0, y: 7 });
    expect(summit).toBeGreaterThan(2 / 3 - 0.03);
    const player = fractionFromBottom(rig, { x: 0, y: 0 });
    expect(player).toBeGreaterThan(0.08);
  });

  it('leaves a distant summit to the climb it frames', () => {
    const rig = settle(rigAt(PHONE_PORTRAIT), { goal: { x: 0, y: 30 } });
    const player = fractionFromBottom(rig, { x: 0, y: 0 });
    expect(player).toBeGreaterThan(0.34);
    expect(player).toBeLessThan(0.42);
  });

  it('keeps the approach shot a portrait doctrine', () => {
    const rig = settle(rigAt(DESKTOP), { goal: { x: 0, y: 7 } });
    const player = fractionFromBottom(rig, { x: 0, y: 0 });
    expect(player).toBeGreaterThan(0.42);
    expect(player).toBeLessThan(0.48);
  });
});
