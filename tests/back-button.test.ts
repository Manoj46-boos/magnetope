import { describe, expect, it } from 'vitest';
import { BackGuard, type HistoryPort } from '@/input/back-button';

/** A browser history with only what the guard touches: entries stack up, back pops one and announces it. */
class FakeHistory implements HistoryPort {
  readonly events = new EventTarget();
  depth = 1;
  pushes = 0;
  leaves = 0;
  failPush = false;

  pushState(): void {
    if (this.failPush) throw new DOMException('denied', 'SecurityError');
    this.depth++;
    this.pushes++;
  }

  back(): void {
    this.leaves++;
    this.depth--;
    this.events.dispatchEvent(new Event('popstate'));
  }

  /** The player presses the system back button. */
  press(): void {
    if (this.depth <= 1) return;
    this.depth--;
    this.events.dispatchEvent(new Event('popstate'));
  }
}

const guard = (onBack: () => boolean) => {
  const history = new FakeHistory();
  const calls: string[] = [];
  const instance = new BackGuard({
    history,
    events: history.events,
    onBack: () => {
      calls.push('back');
      return onBack();
    },
  });
  return { history, instance, calls };
};

describe('hardware back', () => {
  it('puts one entry in front of the page and no more, however often it is armed', () => {
    const { history, instance } = guard(() => true);
    instance.arm();
    instance.arm();
    expect(history.depth).toBe(2);
    expect(history.pushes).toBe(1);
  });

  it('does nothing before the first gesture arms it', () => {
    const { history, calls } = guard(() => true);
    history.press();
    expect(calls).toEqual([]);
    expect(history.leaves).toBe(0);
  });

  it('answers a press while there is something to do, and keeps its place for the next one', () => {
    const { history, instance, calls } = guard(() => true);
    instance.arm();
    history.press();
    history.press();
    history.press();
    expect(calls).toEqual(['back', 'back', 'back']);
    expect(history.pushes).toBe(4);
    expect(history.depth).toBe(2);
    expect(history.leaves).toBe(0);
  });

  it('lets the player leave once the game has nothing left to close', () => {
    let busy = true;
    const { history, instance, calls } = guard(() => busy);
    instance.arm();
    history.press();
    busy = false;
    history.press();
    expect(calls).toEqual(['back', 'back']);
    expect(history.leaves).toBe(1);
    expect(history.depth).toBe(0);
  });

  it('is not armed again after letting go, so the next press is the browser\'s own', () => {
    const { history, instance, calls } = guard(() => false);
    instance.arm();
    history.press();
    const afterLeaving = calls.length;
    history.events.dispatchEvent(new Event('popstate'));
    expect(calls).toHaveLength(afterLeaving);
    expect(history.leaves).toBe(1);
  });

  it('ignores history movement it did not cause', () => {
    const { history, calls } = guard(() => true);
    history.events.dispatchEvent(new Event('popstate'));
    expect(calls).toEqual([]);
  });

  it('stays out of the way when the browser refuses a history entry', () => {
    const { history, instance, calls } = guard(() => true);
    history.failPush = true;
    expect(() => instance.arm()).not.toThrow();
    history.events.dispatchEvent(new Event('popstate'));
    expect(calls).toEqual([]);
    expect(history.leaves).toBe(0);
  });

  it('stops listening once disposed', () => {
    const { history, instance, calls } = guard(() => true);
    instance.arm();
    instance.dispose();
    history.press();
    expect(calls).toEqual([]);
  });
});
