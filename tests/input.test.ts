// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InputManager } from '@/input/input';
import { DEFAULT_KEYS, rebind, type KeyBindings } from '@/input/keymap';
import { DEFAULT_SETTINGS } from '@/platform/settings';

let stage: HTMLElement;
let input: InputManager;
let settings = { ...DEFAULT_SETTINGS };
let player: { x: number; y: number } | null = { x: 400, y: 300 };

const key = (type: 'keydown' | 'keyup', code: string, repeat = false) =>
  window.dispatchEvent(new KeyboardEvent(type, { code, repeat, bubbles: true, cancelable: true }));

const pointer = (
  type: string,
  init: { id?: number; kind?: 'mouse' | 'touch'; x?: number; y?: number; button?: number; target?: Element },
) => {
  const event = new PointerEvent(type, {
    pointerId: init.id ?? 1,
    pointerType: init.kind ?? 'mouse',
    clientX: init.x ?? 0,
    clientY: init.y ?? 0,
    button: init.button ?? 0,
    bubbles: true,
    cancelable: true,
  });
  (init.target ?? stage).dispatchEvent(event);
};

beforeEach(() => {
  document.body.innerHTML = '<div id="stage"><button data-ui id="btn">Retry</button></div>';
  stage = document.getElementById('stage')!;
  stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0 }) as DOMRect;
  settings = { ...DEFAULT_SETTINGS };
  player = { x: 400, y: 300 };
  input = new InputManager(stage, { playerScreen: () => player, settings: () => settings });
  input.attach();
});

afterEach(() => input.dispose());

describe('flip edges', () => {
  it('reports a clean press and release across ticks', () => {
    key('keydown', 'Space');
    const a = input.sample();
    const b = input.sample();
    key('keyup', 'Space');
    const c = input.sample();
    expect([a.flipDown, a.flipHeld]).toEqual([true, true]);
    expect([b.flipDown, b.flipHeld, b.flipUp]).toEqual([false, true, false]);
    expect([c.flipUp, c.flipHeld]).toEqual([true, false]);
  });

  it('never loses a tap shorter than one simulation tick', () => {
    key('keydown', 'Space');
    key('keyup', 'Space');
    const first = input.sample();
    const second = input.sample();
    const third = input.sample();
    expect(first.flipDown).toBe(true);
    expect(second.flipUp).toBe(true);
    expect(third.flipDown || third.flipUp).toBe(false);
  });

  it('preserves the order of rapid taps', () => {
    const edges: string[] = [];
    for (let i = 0; i < 3; i++) {
      key('keydown', 'KeyJ');
      key('keyup', 'KeyJ');
    }
    for (let i = 0; i < 8; i++) {
      const f = input.sample();
      if (f.flipDown) edges.push('down');
      if (f.flipUp) edges.push('up');
    }
    expect(edges).toEqual(['down', 'up', 'down', 'up', 'down', 'up']);
  });

  it('ignores key repeat so a held key does not re-trigger', () => {
    key('keydown', 'Space');
    key('keydown', 'Space', true);
    key('keydown', 'Space', true);
    const downs = [input.sample(), input.sample(), input.sample()].filter((f) => f.flipDown);
    expect(downs).toHaveLength(1);
  });

  it('treats overlapping keyboard and mouse flips as a single press', () => {
    key('keydown', 'Space');
    pointer('pointerdown', { button: 0 });
    key('keyup', 'Space');
    const frames = [input.sample(), input.sample(), input.sample()];
    expect(frames.some((f) => f.flipUp)).toBe(false);
    expect(frames[2]!.flipHeld).toBe(true);
    pointer('pointerup', { button: 0 });
    const end = [input.sample(), input.sample()];
    expect(end.some((f) => f.flipUp)).toBe(true);
  });
});

describe('keyboard tilt', () => {
  it('normalises diagonals so they are not faster than straight lines', () => {
    key('keydown', 'KeyW');
    key('keydown', 'KeyD');
    const f = input.sample();
    expect(Math.hypot(f.tiltX, f.tiltY)).toBeCloseTo(1, 5);
    expect(f.tiltX).toBeGreaterThan(0);
    expect(f.tiltY).toBeGreaterThan(0);
  });

  it('cancels opposite keys', () => {
    key('keydown', 'ArrowLeft');
    key('keydown', 'ArrowRight');
    expect(input.sample().tiltX).toBe(0);
  });

  it('releases tilt when the key comes up', () => {
    key('keydown', 'KeyA');
    expect(input.sample().tiltX).toBe(-1);
    key('keyup', 'KeyA');
    expect(input.sample().tiltX).toBe(0);
  });
});

describe('remapped keys', () => {
  const remap = (...edits: Array<[Parameters<typeof rebind>[1], number, string]>): void => {
    let keys: KeyBindings = DEFAULT_KEYS;
    for (const [action, slot, code] of edits) {
      const result = rebind(keys, action, slot, code);
      if (!result.ok) throw new Error(result.reason);
      keys = result.keys;
    }
    settings = { ...settings, keys };
  };

  it('flips on the new key and no longer on the one it replaced', () => {
    remap(['flip', 0, 'KeyF']);
    key('keydown', 'Space');
    expect(input.sample().flipDown).toBe(false);
    key('keyup', 'Space');
    key('keydown', 'KeyF');
    expect(input.sample().flipDown).toBe(true);
  });

  it('keeps the second flip key working beside a new first one', () => {
    remap(['flip', 0, 'KeyF']);
    key('keydown', 'KeyJ');
    expect(input.sample().flipDown).toBe(true);
  });

  it('steers with remapped direction keys, and the old ones go quiet', () => {
    remap(['left', 0, 'KeyJ'], ['right', 0, 'KeyL'], ['up', 0, 'KeyI'], ['down', 0, 'KeyK']);
    key('keydown', 'KeyL');
    key('keydown', 'KeyI');
    const f = input.sample();
    expect(f.tiltX).toBeGreaterThan(0.7);
    expect(f.tiltY).toBeGreaterThan(0.7);
    key('keyup', 'KeyL');
    key('keyup', 'KeyI');
    key('keydown', 'KeyD');
    expect(input.sample().tiltX).toBe(0);
  });

  it('does not double the tilt when both keys of one direction are held', () => {
    key('keydown', 'KeyD');
    key('keydown', 'ArrowRight');
    expect(input.sample().tiltX).toBe(1);
  });

  it('pauses on a remapped pause key, never on the one it left, and always on Escape', () => {
    remap(['pause', 0, 'KeyO']);
    let pauses = 0;
    input.events.on('pause', () => pauses++);
    key('keydown', 'KeyP');
    expect(pauses).toBe(0);
    key('keydown', 'KeyO');
    expect(pauses).toBe(1);
    key('keydown', 'Escape');
    expect(pauses).toBe(2);
  });

  it('restarts on a remapped restart key', () => {
    remap(['retry', 0, 'KeyT']);
    let retries = 0;
    input.events.on('retry', () => retries++);
    key('keydown', 'KeyR');
    key('keydown', 'KeyT');
    expect(retries).toBe(1);
  });

  it('takes the new layout the moment it changes, mid-session', () => {
    key('keydown', 'Space');
    expect(input.sample().flipDown).toBe(true);
    key('keyup', 'Space');
    input.sample();
    remap(['flip', 0, 'KeyF']);
    key('keydown', 'Space');
    expect(input.sample().flipDown).toBe(false);
  });

  it('lets go of a key bound a moment ago when it comes up, so nothing is left held', () => {
    key('keydown', 'Space');
    input.sample();
    remap(['flip', 0, 'KeyF']);
    key('keyup', 'Space');
    expect(input.sample().flipHeld).toBe(false);
    key('keydown', 'KeyD');
    input.sample();
    remap(['right', 0, 'KeyL']);
    key('keyup', 'KeyD');
    expect(input.sample().tiltX).toBe(0);
  });

  it('keeps a swapped pair working: each action answers to the other key', () => {
    remap(['flip', 0, 'KeyA']);
    key('keydown', 'KeyA');
    expect(input.sample().flipDown).toBe(true);
    key('keyup', 'KeyA');
    key('keydown', 'Space');
    expect(input.sample().tiltX).toBe(-1);
  });
});

describe('mouse-only play', () => {
  it('aims toward the cursor relative to MAGNO and flips on left click', () => {
    settings.aimMode = 'mouse';
    pointer('pointermove', { x: 600, y: 200 });
    const f = input.sample();
    expect(f.tiltX).toBeGreaterThan(0.6);
    expect(f.tiltY).toBeGreaterThan(0.3);
    pointer('pointerdown', { x: 600, y: 200, button: 0 });
    expect(input.sample().flipDown).toBe(true);
  });

  it('stays centred inside the dead zone', () => {
    settings.aimMode = 'mouse';
    pointer('pointermove', { x: 404, y: 303 });
    const f = input.sample();
    expect([f.tiltX, f.tiltY]).toEqual([0, 0]);
  });

  it('lets keyboard tilt win over the cursor', () => {
    settings.aimMode = 'mouse';
    pointer('pointermove', { x: 700, y: 300 });
    key('keydown', 'KeyA');
    expect(input.sample().tiltX).toBe(-1);
  });

  it('follows the cursor automatically in auto mode once the mouse is in use', () => {
    pointer('pointermove', { x: 100, y: 300 });
    expect(input.sample().tiltX).toBeLessThan(-0.5);
  });

  it('scales aim by distance', () => {
    settings.aimMode = 'mouse';
    pointer('pointermove', { x: 440, y: 300 });
    const near = input.sample().tiltX;
    pointer('pointermove', { x: 560, y: 300 });
    const far = input.sample().tiltX;
    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThanOrEqual(1);
  });
});

describe('touch', () => {
  it('uses the left half as a drag-anywhere stick', () => {
    pointer('pointerdown', { id: 7, kind: 'touch', x: 200, y: 400 });
    pointer('pointermove', { id: 7, kind: 'touch', x: 260, y: 400 });
    const f = input.sample();
    expect(f.tiltX).toBeGreaterThan(0.8);
    expect(Math.abs(f.tiltY)).toBeLessThan(0.05);
    expect(input.stick.active).toBe(true);
  });

  it('inverts screen Y so dragging up tilts up', () => {
    pointer('pointerdown', { id: 7, kind: 'touch', x: 200, y: 400 });
    pointer('pointermove', { id: 7, kind: 'touch', x: 200, y: 340 });
    expect(input.sample().tiltY).toBeGreaterThan(0.8);
  });

  it('ignores tiny thumb drift inside the dead zone', () => {
    pointer('pointerdown', { id: 7, kind: 'touch', x: 200, y: 400 });
    pointer('pointermove', { id: 7, kind: 'touch', x: 203, y: 401 });
    const f = input.sample();
    expect([f.tiltX, f.tiltY]).toEqual([0, 0]);
  });

  it('flips from the right half while the stick is held with the other thumb', () => {
    pointer('pointerdown', { id: 1, kind: 'touch', x: 150, y: 400 });
    pointer('pointermove', { id: 1, kind: 'touch', x: 150, y: 350 });
    pointer('pointerdown', { id: 2, kind: 'touch', x: 650, y: 400 });
    const f = input.sample();
    expect(f.flipDown).toBe(true);
    expect(f.tiltY).toBeGreaterThan(0.5);
    pointer('pointerup', { id: 2, kind: 'touch', x: 650, y: 400 });
    expect(input.sample().flipUp).toBe(true);
    expect(input.stick.active).toBe(true);
  });

  it('honours the sensitivity setting', () => {
    settings.touchSensitivity = 1.5;
    pointer('pointerdown', { id: 3, kind: 'touch', x: 200, y: 400 });
    pointer('pointermove', { id: 3, kind: 'touch', x: 232, y: 400 });
    const high = input.sample().tiltX;
    pointer('pointerup', { id: 3, kind: 'touch', x: 232, y: 400 });
    settings.touchSensitivity = 0.5;
    pointer('pointerdown', { id: 4, kind: 'touch', x: 200, y: 400 });
    pointer('pointermove', { id: 4, kind: 'touch', x: 232, y: 400 });
    const low = input.sample().tiltX;
    expect(high).toBeGreaterThan(low);
  });

  it('supports the single-thumb layout with a corner flip button', () => {
    settings.touchLayout = 'single';
    pointer('pointerdown', { id: 1, kind: 'touch', x: 650, y: 200 });
    pointer('pointermove', { id: 1, kind: 'touch', x: 700, y: 200 });
    expect(input.sample().tiltX).toBeGreaterThan(0.5);
    pointer('pointerdown', { id: 2, kind: 'touch', x: 700, y: 520 });
    expect(input.sample().flipDown).toBe(true);
  });

  it('clears the stick on cancel so tilt never sticks', () => {
    pointer('pointerdown', { id: 7, kind: 'touch', x: 200, y: 400 });
    pointer('pointermove', { id: 7, kind: 'touch', x: 260, y: 400 });
    pointer('pointercancel', { id: 7, kind: 'touch' });
    expect(input.sample().tiltX).toBe(0);
  });
});

describe('menus and interruptions', () => {
  it('raises pause for Escape, P and a right click', () => {
    let pauses = 0;
    input.events.on('pause', () => pauses++);
    key('keydown', 'Escape');
    key('keydown', 'KeyP');
    stage.dispatchEvent(new Event('contextmenu', { cancelable: true, bubbles: true }));
    expect(pauses).toBe(3);
  });

  it('raises retry for R', () => {
    let retries = 0;
    input.events.on('retry', () => retries++);
    key('keydown', 'KeyR');
    expect(retries).toBe(1);
  });

  it('does not flip when the player clicks a UI control', () => {
    pointer('pointerdown', { button: 0, target: document.getElementById('btn')! });
    expect(input.sample().flipDown).toBe(false);
  });

  it('releases everything and raises interrupt when the window loses focus', () => {
    let interrupts = 0;
    input.events.on('interrupt', () => interrupts++);
    key('keydown', 'Space');
    key('keydown', 'KeyD');
    input.sample();
    window.dispatchEvent(new Event('blur'));
    const f = input.sample();
    expect(interrupts).toBe(1);
    expect(f.flipHeld).toBe(false);
    expect(f.tiltX).toBe(0);
  });

  it('announces activity per device so the SDK session can start on first input', () => {
    const devices: string[] = [];
    input.events.on('activity', (e) => devices.push(e.device));
    key('keydown', 'Space');
    pointer('pointerdown', { id: 9, kind: 'touch', x: 100, y: 100 });
    expect(devices).toEqual(['keyboard', 'touch']);
  });

  it('survives a fuzz of 5,000 random events without throwing or sticking', () => {
    const codes = ['Space', 'KeyJ', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'Escape', 'KeyR'];
    let seed = 99;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 5000; i++) {
      const r = rand();
      const code = codes[Math.floor(rand() * codes.length)]!;
      if (r < 0.3) key('keydown', code);
      else if (r < 0.6) key('keyup', code);
      else if (r < 0.7) pointer('pointerdown', { x: rand() * 800, y: rand() * 600, button: 0 });
      else if (r < 0.8) pointer('pointerup', { x: rand() * 800, y: rand() * 600, button: 0 });
      else if (r < 0.9) pointer('pointermove', { x: rand() * 800, y: rand() * 600 });
      input.sample();
    }
    for (const code of codes) key('keyup', code);
    pointer('pointerup', { button: 0 });
    let last = input.sample();
    for (let i = 0; i < 20; i++) last = input.sample();
    expect(last.flipHeld).toBe(false);
    expect(last.tiltX === 0 || Number.isFinite(last.tiltX)).toBe(true);
  });
});
