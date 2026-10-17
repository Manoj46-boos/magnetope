import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { MAX_STREAKS, WindStreaks, type WindView } from '@/render/wind-streaks';

const VIEW: WindView = { cx: 0, cy: 10, halfW: 8, halfH: 6 };
const GALE = { intensity: 1, direction: 1 } as const;

const make = () => new WindStreaks(new Scene(), 0);

/** Runs the streaks for `seconds` of frame time under a fixed gust. */
function blow(streaks: WindStreaks, seconds: number, wind: { intensity: number; direction: 1 | -1 } = GALE, view: WindView = VIEW): void {
  for (let t = 0; t < seconds; t += 1 / 60) streaks.update(1 / 60, view, wind);
}

const alphas = (streaks: WindStreaks): number[] => Array.from(streaks.mesh.geometry.getAttribute('color').array).filter((_, i) => i % 4 === 3);
const xs = (streaks: WindStreaks): number[] => Array.from(streaks.mesh.geometry.getAttribute('position').array).filter((_, i) => i % 3 === 0);

describe('wind streaks', () => {
  it('stays hidden and costs nothing while the air is calm', () => {
    const streaks = make();
    blow(streaks, 3, { intensity: 0, direction: 1 });
    expect(streaks.mesh.visible).toBe(false);
    expect(streaks.alive).toBe(0);
  });

  it('draws at most the 18 streaks the effect budget allows, even in a full gale', () => {
    const streaks = make();
    expect(MAX_STREAKS).toBe(18);
    for (let i = 0; i < 600; i++) {
      streaks.update(1 / 60, VIEW, GALE);
      expect(streaks.alive).toBeLessThanOrEqual(MAX_STREAKS);
    }
    expect(streaks.alive).toBe(MAX_STREAKS);
  });

  it('draws more streaks as the gust strengthens', () => {
    const counts = [0.2, 0.5, 1].map((intensity) => {
      const streaks = make();
      blow(streaks, 2, { intensity, direction: 1 });
      return streaks.alive;
    });
    expect(counts[0]!).toBeLessThan(counts[1]!);
    expect(counts[1]!).toBeLessThan(counts[2]!);
  });

  it('honours the lower ceilings of weaker device tiers', () => {
    const streaks = make();
    streaks.setCeiling(6);
    blow(streaks, 2);
    expect(streaks.alive).toBe(6);
    streaks.setCeiling(0);
    blow(streaks, 8);
    expect(streaks.alive).toBe(0);
  });

  it('sweeps with the wind: rightward gusts move streaks right, leftward gusts left', () => {
    const drift = (direction: 1 | -1): number => {
      const streaks = make();
      streaks.setCeiling(1);
      blow(streaks, 0.1, { intensity: 1, direction });
      const before = xs(streaks)[0]!;
      blow(streaks, 0.2, { intensity: 1, direction });
      return xs(streaks)[0]! - before;
    };
    expect(drift(1)).toBeGreaterThan(0);
    expect(drift(-1)).toBeLessThan(0);
  });

  it('trails each streak behind its head, opposite to the wind', () => {
    const streaks = make();
    blow(streaks, 0.6, { intensity: 1, direction: 1 });
    const positions = streaks.mesh.geometry.getAttribute('position').array;
    const head = positions[0]!;
    const tail = positions[5 * 2 * 3]!;
    expect(tail).toBeLessThan(head);
  });

  it('fades each streak in and out so none pops on or off screen', () => {
    const streaks = make();
    blow(streaks, 1.5);
    const values = alphas(streaks);
    expect(Math.max(...values)).toBeGreaterThan(0.1);
    expect(Math.max(...values)).toBeLessThanOrEqual(0.71);
    expect(values.every((a) => a >= 0 && Number.isFinite(a))).toBe(true);
  });

  it('keeps streaks upwind of the view when they are born', () => {
    const streaks = make();
    streaks.update(1 / 60, VIEW, GALE);
    const positions = streaks.mesh.geometry.getAttribute('position').array;
    for (let s = 0; s < streaks.alive; s++) {
      const head = positions[s * 12 * 3]!;
      expect(head).toBeLessThan(VIEW.cx + VIEW.halfW);
    }
  });

  it('retires streaks once the gust passes, so the screen clears after it', () => {
    const streaks = make();
    blow(streaks, 2);
    expect(streaks.alive).toBeGreaterThan(0);
    blow(streaks, 6, { intensity: 0, direction: 1 });
    expect(streaks.alive).toBe(0);
    expect(streaks.mesh.visible).toBe(false);
  });

  it('stays finite through violent changes of gust and camera', () => {
    const streaks = make();
    for (let i = 0; i < 1200; i++) {
      const view: WindView = { cx: Math.sin(i / 7) * 40, cy: i * 0.2, halfW: 8, halfH: 6 };
      streaks.update(1 / 60, view, { intensity: Math.abs(Math.sin(i / 30)), direction: i % 400 < 200 ? 1 : -1 });
    }
    const positions = Array.from(streaks.mesh.geometry.getAttribute('position').array);
    expect(positions.every(Number.isFinite)).toBe(true);
  });

  it('clears instantly when a level is torn down', () => {
    const streaks = make();
    blow(streaks, 1);
    streaks.clear();
    expect(streaks.mesh.visible).toBe(false);
    expect(streaks.alive).toBe(0);
  });

  it('switches blending with the sky: additive light at dusk, ordinary paint in bright air', () => {
    const streaks = make();
    streaks.setTint([0.6, 0.8, 1], false);
    const dusk = (streaks.mesh.material as { blending: number }).blending;
    streaks.setTint([0.3, 0.4, 0.5], true);
    const bright = (streaks.mesh.material as { blending: number }).blending;
    expect(dusk).not.toBe(bright);
  });

  it('removes itself from the scene on dispose', () => {
    const scene = new Scene();
    const streaks = new WindStreaks(scene, 0);
    expect(scene.children).toContain(streaks.mesh);
    streaks.dispose();
    expect(scene.children).not.toContain(streaks.mesh);
  });
});
