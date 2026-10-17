// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '@/locale';
import { DEFAULT_SETTINGS, type Settings } from '@/platform/settings';
import { ControlsScreen, type ControlsHandlers } from '@/ui/controls-screen';
import { ModalHost } from '@/ui/modal-host';
import { GameUi, type UiHandlers } from '@/ui/ui';

const noop = (): void => undefined;

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...over });

const rig = () => {
  const set = vi.fn<(key: keyof Settings, value: Settings[keyof Settings]) => void>();
  const openKeys = vi.fn();
  const handlers: ControlsHandlers = { set: set as ControlsHandlers['set'], openKeys, back: noop, tick: noop };
  const screen = new ControlsScreen(document.body, new ModalHost(), handlers);
  return { screen, set, openKeys };
};

const group = (key: string): HTMLElement => document.querySelector(`[aria-labelledby="${key}-label"]`)!;
const checked = (key: string): string => group(key).querySelector<HTMLElement>('[aria-checked="true"]')!.dataset.value!;
const segment = (key: string, value: string): HTMLButtonElement => group(key).querySelector<HTMLButtonElement>(`[data-value="${value}"]`)!;
const slider = (): HTMLInputElement => document.querySelector('.range')!;
const rimToggle = (): HTMLButtonElement => document.querySelector('.panel.controls .toggle')!;

beforeEach(() => {
  document.body.innerHTML = '';
  setLocale('en');
});

afterEach(() => setLocale('en'));

describe('controls screen', () => {
  it('shows the settings the player already has', () => {
    const { screen } = rig();
    screen.show(settings({ touchLayout: 'single', aimMode: 'mouse', touchSensitivity: 0.7, rimTint: false }));
    expect(checked('touchLayout')).toBe('single');
    expect(checked('aimMode')).toBe('mouse');
    expect(slider().value).toBe('0.7');
    expect(document.querySelector('.range-value')!.textContent).toBe('70%');
    expect(rimToggle().getAttribute('aria-pressed')).toBe('false');
  });

  it('offers every layout and aim mode with a name, and exactly one is selected', () => {
    const { screen } = rig();
    screen.show(settings());
    expect([...group('touchLayout').children].map((b) => b.textContent)).toEqual(['Split', 'Button']);
    expect([...group('aimMode').children].map((b) => b.textContent)).toEqual(['Auto', 'Keys', 'Mouse']);
    for (const key of ['touchLayout', 'aimMode']) expect(group(key).querySelectorAll('[aria-checked="true"]')).toHaveLength(1);
  });

  it('applies a picked layout at once and moves the highlight to it', () => {
    const { screen, set } = rig();
    screen.show(settings());
    segment('touchLayout', 'single').click();
    expect(set).toHaveBeenCalledWith('touchLayout', 'single');
    expect(checked('touchLayout')).toBe('single');
    segment('aimMode', 'mouse').click();
    expect(set).toHaveBeenLastCalledWith('aimMode', 'mouse');
    expect(checked('aimMode')).toBe('mouse');
  });

  it('keeps the readout moving while the slider drags and saves once, when it is released', () => {
    const { screen, set } = rig();
    screen.show(settings());
    slider().value = '1.35';
    slider().dispatchEvent(new Event('input'));
    expect(document.querySelector('.range-value')!.textContent).toBe('135%');
    expect(set).not.toHaveBeenCalled();
    slider().dispatchEvent(new Event('change'));
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('touchSensitivity', 1.35);
  });

  it('keeps the slider inside the range the input code is built for', () => {
    rig().screen.show(settings());
    expect(Number(slider().min)).toBe(0.5);
    expect(Number(slider().max)).toBe(1.5);
  });

  it('switches the rim tint off and on', () => {
    const { screen, set } = rig();
    screen.show(settings());
    rimToggle().click();
    expect(set).toHaveBeenLastCalledWith('rimTint', false);
    rimToggle().click();
    expect(set).toHaveBeenLastCalledWith('rimTint', true);
  });

  it('leads to the key bindings', () => {
    const { screen, openKeys } = rig();
    screen.show(settings());
    document.querySelector<HTMLButtonElement>('[data-opens="keys"]')!.click();
    expect(openKeys).toHaveBeenCalledTimes(1);
  });

  it('follows the language the player picks', () => {
    const { screen } = rig();
    setLocale('de');
    screen.show(settings());
    screen.applyLocale();
    expect(document.querySelector('.controls h2')!.textContent).toBe('Steuerung');
    expect([...group('touchLayout').children].map((b) => b.textContent)).toEqual(['Geteilt', 'Button']);
  });

  it('labels the groups for assistive technology', () => {
    rig().screen.show(settings());
    expect(group('touchLayout').getAttribute('role')).toBe('radiogroup');
    expect(document.getElementById('touchLayout-label')!.textContent).toBe('Touch layout');
    expect(slider().getAttribute('aria-labelledby')).toBe('sensitivity-label');
  });
});

describe('keyboard use', () => {
  const press = (target: Element, code: string): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };

  it('lets a slider use left and right to change its value, while up and down still leave it', () => {
    const { screen } = rig();
    screen.show(settings());
    slider().focus();
    expect(press(slider(), 'ArrowRight').defaultPrevented).toBe(false);
    expect(press(slider(), 'ArrowLeft').defaultPrevented).toBe(false);
    expect(press(slider(), 'ArrowDown').defaultPrevented).toBe(true);
  });

  it('moves between the segments with the arrow keys', () => {
    const { screen } = rig();
    screen.show(settings());
    const first = segment('touchLayout', 'split');
    first.focus();
    expect(press(first, 'ArrowRight').defaultPrevented).toBe(true);
  });
});

describe('opened from the pause menu', () => {
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
    locker: { equip: noop, buy: noop, watch: noop, back: noop, tick: noop },
    exchange: { exportCode: async () => null, importCode: async () => ({ ok: false, message: 'ghostErrFormat' }), removeFriend: noop, back: noop, tick: noop },
  });
  const pauseButton = (label: string): HTMLButtonElement =>
    [...document.querySelectorAll<HTMLButtonElement>('#ui .btn')].find((b) => b.textContent!.includes(label))!;

  it('opens on the settings in force and passes changes to the game', () => {
    const setSetting = vi.fn();
    const ui = new GameUi(document.body, handlers(setSetting));
    ui.syncSettings(settings({ aimMode: 'keyboard', touchLayout: 'single' }));
    ui.openPause();
    pauseButton('Controls').click();
    expect(ui.controls.isOpen).toBe(true);
    expect(checked('aimMode')).toBe('keyboard');
    expect(checked('touchLayout')).toBe('single');
    segment('aimMode', 'auto').click();
    expect(setSetting).toHaveBeenCalledWith('aimMode', 'auto');
  });

  it('closes on back or Escape and returns to the pause menu', () => {
    const ui = new GameUi(document.body, handlers(noop));
    ui.openPause();
    pauseButton('Controls').click();
    expect(ui.dismissOverlayScreen()).toBe(true);
    expect(ui.controls.isOpen).toBe(false);
    expect(ui.pauseOpen).toBe(true);
  });

  it('reflects a setting changed elsewhere the next time it opens', () => {
    const ui = new GameUi(document.body, handlers(noop));
    ui.syncSettings(settings({ rimTint: false }));
    ui.openPause();
    pauseButton('Controls').click();
    expect(rimToggle().getAttribute('aria-pressed')).toBe('false');
  });
});
