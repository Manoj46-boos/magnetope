// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputManager } from '@/input/input';
import { DEFAULT_KEYS, rebind, type KeyBindings } from '@/input/keymap';
import { setLocale } from '@/locale';
import { DEFAULT_SETTINGS } from '@/platform/settings';
import { KeysScreen } from '@/ui/keys-screen';
import { ModalHost } from '@/ui/modal-host';
import { GameUi, type UiHandlers } from '@/ui/ui';

const noop = (): void => undefined;

const custom = (...edits: Array<[Parameters<typeof rebind>[1], number, string]>): KeyBindings => {
  let keys: KeyBindings = DEFAULT_KEYS;
  for (const [action, slot, code] of edits) {
    const result = rebind(keys, action, slot, code);
    if (!result.ok) throw new Error(result.reason);
    keys = result.keys;
  }
  return keys;
};

/** Screens built by the current test; each is closed afterwards so none leaves a key capture armed on the shared window. */
const built: KeysScreen[] = [];

const rig = (keys: KeyBindings = DEFAULT_KEYS, layout: Map<string, string> | null = null) => {
  const set = vi.fn<(keys: KeyBindings) => void>();
  const back = vi.fn();
  const screen = new KeysScreen(document.body, new ModalHost(), { set, back, tick: noop }, async () => layout);
  built.push(screen);
  screen.show(keys);
  return { screen, set, back };
};

const cap = (action: string, slot: number): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`.key-cap[data-action="${action}"][data-slot="${slot}"]`)!;
const status = (): string => document.querySelector('.key-status')!.textContent!;
const resetButton = (): HTMLButtonElement => document.querySelector<HTMLButtonElement>('.key-foot .btn')!;

/** happy-dom does not carry an event from the page up to the window as a browser does, so keys are sent to the window itself. */
const press = (code: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
};
const release = (code: string): KeyboardEvent => {
  const event = new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  document.body.innerHTML = '';
  setLocale('en');
});

afterEach(() => {
  built.splice(0).forEach((screen) => screen.hide());
  setLocale('en');
});

describe('the key list', () => {
  it('shows every action with the keys it answers to', () => {
    rig();
    expect([...document.querySelectorAll('.key-name')].map((n) => n.textContent)).toEqual(['Flip', 'Aim left', 'Aim right', 'Aim up', 'Aim down', 'Pause', 'Restart']);
    expect([cap('flip', 0).textContent, cap('flip', 1).textContent]).toEqual(['Space', 'J']);
    expect([cap('left', 0).textContent, cap('left', 1).textContent]).toEqual(['A', '←']);
    expect([cap('retry', 0).textContent, cap('retry', 1).textContent]).toEqual(['R', 'None']);
  });

  it('shows Escape on the pause row as a key that cannot be changed', () => {
    rig();
    const fixed = document.querySelector<HTMLElement>('.key-cap.fixed')!;
    expect(fixed.textContent).toBe('Esc');
    expect(fixed.tagName).not.toBe('BUTTON');
    expect(fixed.closest('.key-row')!.textContent).toContain('Pause');
  });

  it('marks an empty second slot as empty', () => {
    rig();
    expect(cap('retry', 1).classList.contains('empty')).toBe(true);
    expect(cap('flip', 1).classList.contains('empty')).toBe(false);
  });

  it('names each cap for assistive technology with its action', () => {
    rig();
    expect(cap('flip', 0).getAttribute('aria-label')).toBe('Flip: Space');
  });

  it("prints the keys of the player's own layout when the browser reports it", async () => {
    rig(DEFAULT_KEYS, new Map([['KeyW', 'z'], ['KeyA', 'q']]));
    await Promise.resolve();
    await Promise.resolve();
    expect(cap('up', 0).textContent).toBe('Z');
    expect(cap('left', 0).textContent).toBe('Q');
  });
});

describe('binding a key', () => {
  it('arms the cap that was clicked and tells the player what to do', () => {
    rig();
    cap('flip', 0).click();
    expect(cap('flip', 0).textContent).toBe('Press a key');
    expect(cap('flip', 0).classList.contains('listening')).toBe(true);
    expect(status()).toContain('Esc cancels');
  });

  it('binds the next key pressed and hands the new layout to the game', () => {
    const { set } = rig();
    cap('flip', 0).click();
    press('KeyF');
    expect(cap('flip', 0).textContent).toBe('F');
    expect(set).toHaveBeenCalledTimes(1);
    expect(set.mock.calls[0]![0].flip).toEqual(['KeyF', 'KeyJ']);
    expect(cap('flip', 0).classList.contains('listening')).toBe(false);
  });

  it('fills an empty second slot', () => {
    const { set } = rig();
    cap('retry', 1).click();
    press('KeyT');
    expect(set.mock.calls[0]![0].retry).toEqual(['KeyR', 'KeyT']);
    expect(cap('retry', 1).textContent).toBe('T');
  });

  it('takes one key per click: a second press does nothing until a cap is armed again', () => {
    const { set } = rig();
    cap('flip', 0).click();
    press('KeyF');
    press('KeyG');
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('says what it swapped when the key belonged to another action', () => {
    const { set } = rig();
    cap('flip', 0).click();
    press('KeyA');
    const keys = set.mock.calls[0]![0];
    expect(keys.flip).toEqual(['KeyA', 'KeyJ']);
    expect(keys.left).toEqual(['Space', 'ArrowLeft']);
    expect(status()).toBe('Swapped with Aim left');
    expect(cap('left', 0).textContent).toBe('Space');
  });

  it('refuses reserved keys, names the key, and stays armed for another try', () => {
    const { set } = rig();
    cap('flip', 0).click();
    press('Enter');
    expect(status()).toBe('Enter is reserved');
    expect(set).not.toHaveBeenCalled();
    expect(cap('flip', 0).classList.contains('listening')).toBe(true);
    press('KeyF');
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('refuses to take the only key of another action', () => {
    const { set } = rig();
    cap('pause', 1).click();
    press('KeyR');
    expect(status()).toBe('Every action needs a key');
    expect(set).not.toHaveBeenCalled();
  });

  it('ignores a key held down, so repeats cannot rebind', () => {
    const { set } = rig();
    cap('flip', 0).click();
    press('KeyF', { repeat: true });
    expect(set).not.toHaveBeenCalled();
    expect(cap('flip', 0).classList.contains('listening')).toBe(true);
  });
});

describe('leaving a capture', () => {
  it('cancels on Escape without binding anything or letting the press through to pause', () => {
    const { set } = rig();
    const pauses = vi.fn();
    const input = new InputManager(document.body, { playerScreen: () => null, settings: () => DEFAULT_SETTINGS });
    input.attach();
    input.events.on('pause', pauses);

    cap('flip', 0).click();
    const escape = press('Escape');
    expect(escape.defaultPrevented).toBe(true);
    expect(pauses).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(cap('flip', 0).textContent).toBe('Space');

    press('Escape');
    expect(pauses).toHaveBeenCalledTimes(1);
    input.dispose();
  });

  it('cancels when focus moves to something else', () => {
    rig();
    cap('flip', 0).click();
    cap('flip', 0).dispatchEvent(new FocusEvent('blur'));
    expect(cap('flip', 0).classList.contains('listening')).toBe(false);
    expect(status()).toBe('');
  });

  it('cancels when the screen closes, and later key presses are the game\'s again', () => {
    const { screen } = rig();
    const seen = vi.fn();
    window.addEventListener('keydown', seen);
    cap('flip', 0).click();
    screen.hide();
    press('KeyF');
    expect(seen).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', seen);
  });

  it('keeps the captured key away from the game, and its release too', () => {
    rig();
    const seen = vi.fn();
    window.addEventListener('keydown', seen);
    window.addEventListener('keyup', seen);
    cap('flip', 0).click();
    press('KeyF');
    release('KeyF');
    expect(seen).not.toHaveBeenCalled();
    release('KeyF');
    expect(seen).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', seen);
    window.removeEventListener('keyup', seen);
  });
});

describe('a release that never comes', () => {
  it('is not waited for once the player presses anything else, so a later release always reaches the game', () => {
    rig();
    const released = vi.fn();
    window.addEventListener('keyup', released);
    cap('flip', 0).click();
    press('KeyF');
    press('KeyG');
    release('KeyF');
    expect(released).toHaveBeenCalledTimes(1);
    window.removeEventListener('keyup', released);
  });

  it('is not waited for after the window loses focus', () => {
    rig();
    const released = vi.fn();
    window.addEventListener('keyup', released);
    cap('flip', 0).click();
    press('KeyF');
    window.dispatchEvent(new Event('blur'));
    release('KeyF');
    expect(released).toHaveBeenCalledTimes(1);
    window.removeEventListener('keyup', released);
  });

  it('is not waited for after the screen closes', () => {
    const { screen } = rig();
    const released = vi.fn();
    window.addEventListener('keyup', released);
    cap('flip', 0).click();
    press('KeyF');
    screen.hide();
    release('KeyF');
    expect(released).toHaveBeenCalledTimes(1);
    window.removeEventListener('keyup', released);
  });
});

describe('clearing and resetting', () => {
  it('clears a second key with Backspace', () => {
    const { set } = rig();
    cap('flip', 1).click();
    press('Backspace');
    expect(set.mock.calls[0]![0].flip).toEqual(['Space']);
    expect(cap('flip', 1).textContent).toBe('None');
  });

  it('will not clear a first key', () => {
    const { set } = rig();
    cap('flip', 0).click();
    press('Backspace');
    expect(status()).toBe('Every action needs a key');
    expect(set).not.toHaveBeenCalled();
  });

  it('just cancels on Backspace over an empty slot', () => {
    const { set } = rig();
    cap('retry', 1).click();
    press('Backspace');
    expect(set).not.toHaveBeenCalled();
    expect(cap('retry', 1).classList.contains('listening')).toBe(false);
  });

  it('restores the defaults with one press, and is disabled when there is nothing to restore', () => {
    const { set } = rig(custom(['flip', 0, 'KeyF'], ['up', 0, 'KeyI']));
    expect(resetButton().disabled).toBe(false);
    resetButton().click();
    expect(set).toHaveBeenCalledWith(DEFAULT_KEYS);
    expect(cap('flip', 0).textContent).toBe('Space');
    expect(resetButton().disabled).toBe(true);
  });

  it('follows a layout changed elsewhere', () => {
    const { screen } = rig();
    screen.sync(custom(['flip', 0, 'KeyF']));
    expect(cap('flip', 0).textContent).toBe('F');
    expect(resetButton().disabled).toBe(false);
  });
});

describe('language', () => {
  it('speaks the player\'s language, including the name of the space bar', () => {
    const { screen } = rig();
    setLocale('de');
    screen.applyLocale();
    expect(document.getElementById('keys-title')!.textContent).toBe('Tastenbelegung');
    expect(cap('flip', 0).textContent).toBe('Leertaste');
    expect([...document.querySelectorAll('.key-name')][1]!.textContent).toBe('Nach links zielen');
    cap('flip', 0).click();
    expect(cap('flip', 0).textContent).toBe('Taste drücken');
  });
});

describe('inside the game menus', () => {
  const handlers = (setSetting: UiHandlers['setSetting']): UiHandlers => ({
    pause: noop,
    resume: noop,
    restart: noop,
    setSetting,
    next: noop,
    retry: noop,
    secondWind: noop,
    doubleScrap: noop,
    shareFall: noop,
    openMap: noop,
    openLocker: noop,
    watchEnding: noop,
    openExchange: noop,
    shareDuel: noop,
    tick: noop,
    stamp: noop,
    map: { select: noop, back: noop, openLocker: noop, share: noop, tick: noop },
    locker: { equip: noop, buy: noop, watch: noop, claim: noop, back: noop, tick: noop },
    exchange: { exportCode: async () => null, importCode: async () => ({ ok: false, message: 'ghostErrFormat' }), removeFriend: noop, back: noop, tick: noop },
  });
  const open = (label: string): void => {
    [...document.querySelectorAll<HTMLButtonElement>('#ui .btn')].find((b) => b.textContent!.includes(label))!.click();
  };

  it('opens from Controls, saves a rebinding through the game, and backs out one screen at a time', () => {
    const setSetting = vi.fn();
    const ui = new GameUi(document.body, handlers(setSetting));
    ui.syncSettings({ ...DEFAULT_SETTINGS });
    ui.openPause();
    open('Controls');
    open('Keyboard keys');
    expect(ui.keysScreen.isOpen).toBe(true);

    cap('flip', 0).click();
    press('KeyF');
    expect(setSetting).toHaveBeenCalledWith('keys', expect.objectContaining({ flip: ['KeyF', 'KeyJ'] }));

    expect(ui.dismissOverlayScreen()).toBe(true);
    expect(ui.keysScreen.isOpen).toBe(false);
    expect(ui.controls.isOpen).toBe(true);
    expect(ui.dismissOverlayScreen()).toBe(true);
    expect(ui.pauseOpen).toBe(true);
  });

  it('opens on the keys in force and follows a change made elsewhere', () => {
    const ui = new GameUi(document.body, handlers(noop));
    ui.syncSettings({ ...DEFAULT_SETTINGS, keys: custom(['flip', 0, 'KeyG']) });
    ui.openPause();
    open('Controls');
    open('Keyboard keys');
    expect(cap('flip', 0).textContent).toBe('G');
    ui.syncSettings({ ...DEFAULT_SETTINGS });
    expect(cap('flip', 0).textContent).toBe('Space');
  });
});
