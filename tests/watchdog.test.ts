import { describe, expect, it } from 'vitest';
import { FrameWatchdog, PATIENCE_S } from '@/game/watchdog';
import type { QualityTier } from '@/render/quality';

/**
 * R-PE-08: a frame-time watchdog that may only step the tier down at state
 * boundaries — perched and quiet — never in flight, never mid-charge, and
 * never below low. All the timings below are synthetic frame clocks, so the
 * laws run in seconds instead of wall time.
 */

const FRAME = 1000 / 60;
/** A frame well over the 34 ms budget the watchdog reads as slow. */
const SLOW = 40;

const make = (tier: QualityTier) => {
  const steps: Array<{ from: QualityTier; to: QualityTier; fps: number }> = [];
  const watchdog = new FrameWatchdog({
    tier: () => tier,
    onDowngrade: (from, to, fps) => {
      tier = to;
      steps.push({ from, to, fps });
    },
  });
  return { watchdog, steps, tier: () => tier };
};

describe('the frame watchdog', () => {
  it('leaves a healthy frame rate alone', () => {
    const { watchdog, steps } = make('high');
    for (let i = 0; i < 60 * 30; i++) watchdog.frame(FRAME, true);
    expect(steps).toEqual([]);
  });

  it('steps down after a full patience window of slow frames', () => {
    const { watchdog, steps } = make('high');
    for (let i = 0; i < 60 * (PATIENCE_S + 1); i++) watchdog.frame(SLOW, false);
    watchdog.frame(SLOW, true);
    expect(steps).toEqual([{ from: 'high', to: 'mid', fps: expect.any(Number) }]);
    expect(steps[0]!.fps).toBeLessThan(30);
  });

  it('fires at the first boundary after arming, and not before', () => {
    const { watchdog, steps } = make('high');
    // In flight the whole time: armed but forbidden to act (never mid-flight).
    for (let i = 0; i < 60 * (PATIENCE_S + 1); i++) watchdog.frame(SLOW, false);
    expect(steps).toEqual([]);
    // The first perched frame spends the decision.
    watchdog.frame(SLOW, true);
    expect(steps.length).toBe(1);
  });

  it('stands the armed step down back down when the average recovers', () => {
    const { watchdog, steps } = make('high');
    for (let i = 0; i < 60 * (PATIENCE_S + 1); i++) watchdog.frame(SLOW, false);
    for (let i = 0; i < 120; i++) watchdog.frame(FRAME, false);
    watchdog.frame(FRAME, true);
    expect(steps).toEqual([]);
  });

  it('never steps below low', () => {
    const { watchdog, steps } = make('low');
    for (let i = 0; i < 60 * (PATIENCE_S * 2 + 1); i++) watchdog.frame(SLOW * 3, true);
    expect(steps).toEqual([]);
  });

  it('climbs down one tier at a time', () => {
    const { watchdog, steps } = make('high');
    for (let i = 0; i < 60 * (PATIENCE_S * 2 + 2); i++) watchdog.frame(SLOW, true);
    expect(steps.map((s) => s.to)).toEqual(['mid', 'low']);
  });

  it('does not cry wolf over one bad frame', () => {
    const { watchdog, steps } = make('high');
    for (let i = 0; i < 300; i++) {
      watchdog.frame(i === 150 ? 400 : FRAME, true);
    }
    expect(steps).toEqual([]);
  });

  it('reports the frame rate it decided on', () => {
    const { watchdog } = make('mid');
    for (let i = 0; i < 600; i++) watchdog.frame(20, false);
    expect(Math.round(watchdog.fps)).toBe(50);
  });
});
