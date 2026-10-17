import { describe, expect, it } from 'vitest';
import { TouchMode, followsActivity, readPointerEnvironment, startsInTouchMode, type PointerEnvironment } from '@/platform/device';

/**
 * Poki forces the touch layout on tablets, but the primary player (PRD 3.3) is on a school
 * Chromebook, many of which have a touchscreen as well as a keyboard and trackpad. Each device
 * below reports what its browser reports.
 */

const DEVICES: Record<string, PointerEnvironment> = {
  'Android phone': { coarsePrimary: true, anyCoarse: true, anyFine: false },
  'iPhone': { coarsePrimary: true, anyCoarse: true, anyFine: false },
  'Android tablet': { coarsePrimary: true, anyCoarse: true, anyFine: false },
  'iPad': { coarsePrimary: true, anyCoarse: true, anyFine: false },
  'iPad with a Magic Keyboard trackpad': { coarsePrimary: true, anyCoarse: true, anyFine: true },
  'Chromebook with a touchscreen': { coarsePrimary: false, anyCoarse: true, anyFine: true },
  'Windows touch laptop at 1080p': { coarsePrimary: false, anyCoarse: true, anyFine: true },
  'touch kiosk with no mouse': { coarsePrimary: false, anyCoarse: true, anyFine: false },
  'desktop with a mouse': { coarsePrimary: false, anyCoarse: false, anyFine: true },
  'laptop without a touchscreen': { coarsePrimary: false, anyCoarse: false, anyFine: true },
};

describe('which controls a device starts with', () => {
  it.each(['Android phone', 'iPhone', 'Android tablet', 'iPad', 'iPad with a Magic Keyboard trackpad', 'touch kiosk with no mouse'])(
    '%s gets the touch layout',
    (name) => {
      expect(startsInTouchMode(DEVICES[name]!)).toBe(true);
    },
  );

  it.each(['Chromebook with a touchscreen', 'Windows touch laptop at 1080p', 'desktop with a mouse', 'laptop without a touchscreen'])(
    '%s starts with keyboard and mouse controls',
    (name) => {
      expect(startsInTouchMode(DEVICES[name]!)).toBe(false);
    },
  );

  it('treats a browser that answers no pointer questions as a desktop', () => {
    const win = { matchMedia: undefined } as unknown as Pick<Window, 'matchMedia'>;
    expect(startsInTouchMode(readPointerEnvironment(win))).toBe(false);
  });

  it('reads the three pointer queries from the browser', () => {
    const asked: string[] = [];
    const win = {
      matchMedia: (query: string) => {
        asked.push(query);
        return { matches: query === '(any-pointer: coarse)' } as MediaQueryList;
      },
    } as Pick<Window, 'matchMedia'>;
    expect(readPointerEnvironment(win)).toEqual({ coarsePrimary: false, anyCoarse: true, anyFine: false });
    expect(asked).toEqual(['(pointer: coarse)', '(any-pointer: coarse)', '(any-pointer: fine)']);
  });
});

describe('a player on a hybrid laptop', () => {
  const run = (name: string) => {
    const changes: boolean[] = [];
    const mode = new TouchMode(DEVICES[name]!, (touch) => changes.push(touch));
    return { mode, changes };
  };

  it('only these devices follow the player between touch and keyboard', () => {
    const following = Object.entries(DEVICES)
      .filter(([, env]) => followsActivity(env))
      .map(([name]) => name);
    expect(following).toEqual(['Chromebook with a touchscreen', 'Windows touch laptop at 1080p']);
  });

  it('plays the first level with the keyboard and sees no on-screen controls', () => {
    const { mode, changes } = run('Chromebook with a touchscreen');
    mode.noteActivity('keyboard');
    mode.noteActivity('keyboard');
    expect(mode.touch).toBe(false);
    expect(changes).toEqual([]);
  });

  it('gets the touch layout the moment a finger touches the screen, and the keyboard back when a key is pressed', () => {
    const { mode, changes } = run('Windows touch laptop at 1080p');
    mode.noteActivity('touch');
    expect(mode.touch).toBe(true);
    mode.noteActivity('touch');
    mode.noteActivity('keyboard');
    expect(mode.touch).toBe(false);
    mode.noteActivity('mouse');
    expect(changes).toEqual([true, false]);
  });
});

describe('a player on a tablet or phone', () => {
  it('keeps the touch layout whatever else is plugged in', () => {
    const changes: boolean[] = [];
    const mode = new TouchMode(DEVICES['iPad with a Magic Keyboard trackpad']!, (touch) => changes.push(touch));
    mode.noteActivity('keyboard');
    mode.noteActivity('mouse');
    expect(mode.touch).toBe(true);
    expect(changes).toEqual([]);
  });

  it('does not flicker between layouts when a phone reports a stray mouse event after a tap', () => {
    const mode = new TouchMode(DEVICES['Android phone']!, () => undefined);
    mode.noteActivity('touch');
    mode.noteActivity('mouse');
    expect(mode.touch).toBe(true);
  });
});
