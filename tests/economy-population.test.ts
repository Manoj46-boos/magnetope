import { describe, expect, it } from 'vitest';
import { simulatePopulation } from '@/game/economy-replay';

/**
 * The thousand-player economy sim (R-EC-11): the population's own answers to
 * the pacing laws. No ad is ever watched, no clock is ever waited on, and the
 * laws are read off the playthroughs the sim actually ran — medians, the
 * honest ceiling for the content itself, and the collector's run on top.
 */

describe('the thousand-player economy sim (R-EC-11)', () => {
  it('holds every pacing law for a thousand honest players', () => {
    const verdict = simulatePopulation(1_000, 7);
    expect(verdict.players).toBe(1_000);
    expect(verdict.deadEnds, 'no player may hit a dead end').toBe(0);
    expect(verdict.overAccumulationShare, 'unspent hoards stay rare').toBeLessThan(0.02);
    expect(verdict.medianFirstItemSeconds, 'the first look is free inside three minutes').toBeLessThanOrEqual(180);
    expect(verdict.medianSecondItemSeconds, 'the second look is inside a quarter hour').toBeLessThanOrEqual(900);
    expect(verdict.hoursForContent, 'every level is reachable with zero ads inside ten honest hours').toBeLessThanOrEqual(10);
  });

  it('answers the same from the same seed, and holds its laws across other seeds', () => {
    expect(simulatePopulation(1_000, 7)).toEqual(simulatePopulation(1_000, 7));
    for (const seed of [1, 42, 2026]) {
      const verdict = simulatePopulation(500, seed);
      expect(verdict.deadEnds).toBe(0);
      expect(verdict.overAccumulationShare).toBeLessThan(0.02);
      expect(verdict.medianFirstItemSeconds).toBeLessThanOrEqual(180);
      expect(verdict.hoursForContent).toBeLessThanOrEqual(10);
    }
  });

  it('keeps the collector honest: the shelf sits on top of the content, never inside it', () => {
    const verdict = simulatePopulation(1_000, 7);
    expect(verdict.hoursForTheShelf).toBeGreaterThan(verdict.hoursForContent);
    expect(verdict.hoursForTheShelf).toBeLessThan(40);
  });
});
