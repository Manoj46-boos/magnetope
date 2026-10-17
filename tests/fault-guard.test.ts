import { describe, expect, it } from 'vitest';
import { FaultGuard } from '@/platform/fault-guard';

const boom = (message: string) => new Error(message);

function frames(guard: FaultGuard, count: number, at: number, error = boom('frame')) {
  return Array.from({ length: count }, (_, i) => guard.fail(error, at + i * 16));
}

describe('a frame that throws', () => {
  it('is skipped when it is a one-off glitch', () => {
    const guard = new FaultGuard(() => undefined);
    expect(guard.fail(boom('once'), 0)).toBe('continue');
    guard.ok();
    expect(guard.fail(boom('again'), 5000)).toBe('continue');
  });

  it('does not accumulate across healthy frames', () => {
    const guard = new FaultGuard(() => undefined);
    for (let round = 0; round < 50; round++) {
      frames(guard, 4, round * 1000);
      guard.ok();
    }
    expect(guard.fail(boom('late'), 60_000)).toBe('continue');
  });

  it('rebuilds the level once a streak shows the level itself is broken', () => {
    const guard = new FaultGuard(() => undefined);
    const actions = frames(guard, 5, 0);
    expect(actions.slice(0, 4).every((a) => a === 'continue')).toBe(true);
    expect(actions[4]).toBe('restart');
  });

  it('gives up cleanly when the rebuilt level breaks again straight away', () => {
    const guard = new FaultGuard(() => undefined);
    frames(guard, 5, 0);
    const second = frames(guard, 5, 2000);
    expect(second[4]).toBe('fatal');
  });

  it('allows another rebuild once the game has run well for a while after the last one', () => {
    const guard = new FaultGuard(() => undefined);
    frames(guard, 5, 0);
    guard.ok();
    expect(frames(guard, 5, 60_000)[4]).toBe('restart');
  });

  it('reports a fault that repeats every frame exactly once', () => {
    const seen: unknown[] = [];
    const guard = new FaultGuard((e) => seen.push(e));
    frames(guard, 3, 0, boom('same'));
    guard.ok();
    frames(guard, 3, 1000, boom('same'));
    expect(seen).toHaveLength(1);
  });

  it('reports different faults separately and copes with thrown non-errors', () => {
    const seen: unknown[] = [];
    const guard = new FaultGuard((e) => seen.push(e));
    guard.fail(boom('a'), 0);
    guard.fail(boom('b'), 16);
    guard.fail('plain string', 32);
    guard.fail('plain string', 48);
    expect(seen).toHaveLength(3);
  });
});
