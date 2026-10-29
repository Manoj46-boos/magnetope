import { describe, expect, it } from 'vitest';
import { LandscapeHint } from '@/game/landscape-hint';

/**
 * The landscape chip's own manners (P-MO-06): a suggestion the game earns the
 * right to make — two failed attempts in a row, at a wide metropolis climb,
 * held portrait — and says exactly once in a session, never blocking and
 * never repeating itself.
 */

describe('the landscape hint policy', () => {
  it('stays quiet until a wide climb, held portrait, has been failed twice in a row', () => {
    const hint = new LandscapeHint();
    hint.failed();
    expect(hint.due('metropolis', true)).toBe(false);
    hint.failed();
    expect(hint.due('scrapyard', true)).toBe(false);
    expect(hint.due('metropolis', false)).toBe(false);
    expect(hint.due('metropolis', true)).toBe(true);
  });

  it('says its one sentence once a session, however the fight goes after that', () => {
    const hint = new LandscapeHint();
    hint.failed();
    hint.failed();
    hint.spend();
    for (let i = 0; i < 10; i++) hint.failed();
    expect(hint.due('metropolis', true)).toBe(false);
  });

  it('lets a clear or a leave close the streak, so a fresh fight must earn it again', () => {
    const hint = new LandscapeHint();
    hint.failed();
    hint.reset();
    hint.failed();
    expect(hint.due('metropolis', true)).toBe(false);
    hint.failed();
    expect(hint.due('metropolis', true)).toBe(true);
  });
});
