import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KEYS,
  KEY_ACTIONS,
  actionOf,
  buildLookup,
  clearSlot,
  isBindable,
  isDefaultKeys,
  keyLabel,
  rebind,
  sanitizeKeys,
  type KeyBindings,
} from '@/input/keymap';

const must = (result: ReturnType<typeof rebind>) => {
  if (!result.ok) throw new Error(`rebind refused: ${result.reason}`);
  return result;
};

const allKeys = (keys: KeyBindings): string[] => KEY_ACTIONS.flatMap((action) => [...keys[action]]);

const assertSound = (keys: KeyBindings): void => {
  for (const action of KEY_ACTIONS) {
    expect(keys[action].length, `${action} has a key`).toBeGreaterThanOrEqual(1);
    expect(keys[action].length, `${action} has at most two`).toBeLessThanOrEqual(2);
  }
  const codes = allKeys(keys);
  expect(new Set(codes).size, 'no key on two actions').toBe(codes.length);
  for (const code of codes) expect(isBindable(code)).toBe(true);
};

describe('default bindings', () => {
  it('match the PRD input map and are a sound layout', () => {
    expect(DEFAULT_KEYS.flip).toEqual(['Space', 'KeyJ']);
    expect(DEFAULT_KEYS.left).toEqual(['KeyA', 'ArrowLeft']);
    expect(DEFAULT_KEYS.pause).toEqual(['KeyP']);
    expect(DEFAULT_KEYS.retry).toEqual(['KeyR']);
    assertSound(DEFAULT_KEYS);
    expect(isDefaultKeys(DEFAULT_KEYS)).toBe(true);
  });

  it('look up every key to the action it drives, and nothing else', () => {
    const lookup = buildLookup(DEFAULT_KEYS);
    expect(lookup.get('Space')).toBe('flip');
    expect(lookup.get('ArrowDown')).toBe('down');
    expect(lookup.get('KeyQ')).toBeUndefined();
    expect(lookup.size).toBe(allKeys(DEFAULT_KEYS).length);
  });
});

describe('rebinding', () => {
  it('puts a free key on the slot that was picked and leaves the rest alone', () => {
    const { keys, displaced } = must(rebind(DEFAULT_KEYS, 'flip', 0, 'KeyF'));
    expect(keys.flip).toEqual(['KeyF', 'KeyJ']);
    expect(keys.left).toEqual(DEFAULT_KEYS.left);
    expect(displaced).toBeNull();
    expect(actionOf(keys, 'Space')).toBeNull();
  });

  it('adds a second key to an action that has only one', () => {
    const { keys } = must(rebind(DEFAULT_KEYS, 'pause', 1, 'KeyO'));
    expect(keys.pause).toEqual(['KeyP', 'KeyO']);
  });

  it('swaps with the action that owned the key, so neither is left unbound', () => {
    const { keys, displaced } = must(rebind(DEFAULT_KEYS, 'flip', 0, 'KeyA'));
    expect(keys.flip).toEqual(['KeyA', 'KeyJ']);
    expect(keys.left).toEqual(['Space', 'ArrowLeft']);
    expect(displaced).toBe('left');
    assertSound(keys);
  });

  it('takes a key from the second slot of another action without touching its first', () => {
    const { keys, displaced } = must(rebind(DEFAULT_KEYS, 'pause', 1, 'ArrowUp'));
    expect(keys.pause).toEqual(['KeyP', 'ArrowUp']);
    expect(keys.up).toEqual(['KeyW']);
    expect(displaced).toBe('up');
  });

  it('refuses to strip an action of its only key', () => {
    expect(rebind(DEFAULT_KEYS, 'pause', 1, 'KeyR')).toEqual({ ok: false, reason: 'last-key' });
  });

  it('swaps the two slots when the action already holds the key', () => {
    const { keys, displaced } = must(rebind(DEFAULT_KEYS, 'flip', 0, 'KeyJ'));
    expect(keys.flip).toEqual(['KeyJ', 'Space']);
    expect(displaced).toBeNull();
  });

  it('changes nothing when the key is already on that slot', () => {
    const result = must(rebind(DEFAULT_KEYS, 'flip', 0, 'Space'));
    expect(result.keys).toBe(DEFAULT_KEYS);
  });

  it.each(['Escape', 'Enter', 'NumpadEnter', 'Tab', 'F5', 'MetaLeft', 'ControlLeft', 'AltRight', 'CapsLock', 'Backspace', ''])(
    'keeps %s out of the map',
    (code) => {
      expect(rebind(DEFAULT_KEYS, 'flip', 0, code)).toEqual({ ok: false, reason: 'reserved' });
    },
  );

  it.each(['KeyZ', 'Digit7', 'Numpad4', 'NumpadAdd', 'ShiftLeft', 'Comma', 'Backquote', 'ArrowRight', 'Space'])('accepts %s', (code) => {
    expect(isBindable(code)).toBe(true);
  });

  it('never changes the bindings it was given', () => {
    const before = JSON.stringify(DEFAULT_KEYS);
    rebind(DEFAULT_KEYS, 'flip', 0, 'KeyA');
    clearSlot(DEFAULT_KEYS, 'flip', 1);
    expect(JSON.stringify(DEFAULT_KEYS)).toBe(before);
  });
});

describe('clearing a slot', () => {
  it('empties the second key', () => {
    expect(clearSlot(DEFAULT_KEYS, 'flip', 1)!.flip).toEqual(['Space']);
  });

  it('never empties the first key', () => {
    expect(clearSlot(DEFAULT_KEYS, 'flip', 0)).toBeNull();
    expect(clearSlot(DEFAULT_KEYS, 'pause', 1)).toBeNull();
  });
});

describe('a long run of edits', () => {
  it('keeps every action bound and no key doubled, whatever the player does', () => {
    const pool = ['Space', 'KeyJ', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyF', 'KeyP', 'KeyR', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Digit1', 'Comma', 'Enter', 'Escape', 'Tab'];
    let seed = 7;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    let keys: KeyBindings = DEFAULT_KEYS;
    let refused = 0;
    for (let i = 0; i < 5000; i++) {
      const action = KEY_ACTIONS[Math.floor(rand() * KEY_ACTIONS.length)]!;
      const slot = Math.floor(rand() * 2);
      if (rand() < 0.2) {
        keys = clearSlot(keys, action, slot) ?? keys;
      } else {
        const result = rebind(keys, action, slot, pool[Math.floor(rand() * pool.length)]!);
        if (result.ok) keys = result.keys;
        else refused++;
      }
      assertSound(keys);
    }
    expect(refused).toBeGreaterThan(0);
  });
});

describe('loading saved bindings', () => {
  it('keeps a valid custom layout', () => {
    const custom = must(rebind(DEFAULT_KEYS, 'flip', 0, 'KeyF')).keys;
    expect(sanitizeKeys(JSON.parse(JSON.stringify(custom)))).toEqual(custom);
  });

  it('hands back the shared defaults for a layout that matches them', () => {
    expect(sanitizeKeys(JSON.parse(JSON.stringify(DEFAULT_KEYS)))).toBe(DEFAULT_KEYS);
  });

  it.each([
    ['nothing', undefined],
    ['a string', 'WASD'],
    ['an array', []],
    ['a missing action', { ...DEFAULT_KEYS, flip: undefined }],
    ['an action with no keys', { ...DEFAULT_KEYS, flip: [] }],
    ['a key on two actions', { ...DEFAULT_KEYS, left: ['Space'] }],
    ['a key that cannot be bound', { ...DEFAULT_KEYS, flip: ['Enter'] }],
    ['a number for a key', { ...DEFAULT_KEYS, flip: [32] }],
  ])('falls back to the defaults for %s, whole rather than half-applied', (_name, raw) => {
    expect(sanitizeKeys(raw)).toBe(DEFAULT_KEYS);
  });

  it('trims a third key', () => {
    const keys = sanitizeKeys({ ...DEFAULT_KEYS, flip: ['Space', 'KeyJ', 'KeyF'] });
    expect(keys.flip).toEqual(['Space', 'KeyJ']);
  });
});

describe('key labels', () => {
  it('print the common keys the way a player says them', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Digit3')).toBe('3');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('Space', 'Leertaste')).toBe('Leertaste');
    expect(keyLabel('Comma')).toBe(',');
    expect(keyLabel('Numpad7')).toBe('Num 7');
    expect(keyLabel('NumpadAdd')).toBe('Num +');
    expect(keyLabel('ShiftRight')).toBe('R Shift');
  });

  it("follow the player's own keyboard layout when the browser can say what it is", () => {
    const azerty = new Map([['KeyW', 'z'], ['KeyA', 'q'], ['KeyM', ',']]);
    expect(keyLabel('KeyW', 'Space', azerty)).toBe('Z');
    expect(keyLabel('KeyA', 'Space', azerty)).toBe('Q');
    expect(keyLabel('KeyS', 'Space', azerty)).toBe('S');
  });
});
