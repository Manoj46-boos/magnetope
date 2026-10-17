import {
  ALWAYS_PAUSES,
  DEFAULT_KEYS,
  KEYS_PER_ACTION,
  clearSlot,
  isDefaultKeys,
  keyLabel,
  rebind,
  type KeyAction,
  type KeyBindings,
  type LayoutMap,
} from '@/input/keymap';
import { t, tf, type StringKey } from '@/locale';
import { el, esc } from './dom';
import { ICONS } from './icons';
import type { ModalHost } from './modal-host';

export interface KeysHandlers {
  set(keys: KeyBindings): void;
  back(): void;
  tick(): void;
}

interface Row {
  action: KeyAction;
  label: StringKey;
}

const ROWS: ReadonlyArray<Row> = [
  { action: 'flip', label: 'keyFlip' },
  { action: 'left', label: 'keyLeft' },
  { action: 'right', label: 'keyRight' },
  { action: 'up', label: 'keyUp' },
  { action: 'down', label: 'keyDown' },
  { action: 'pause', label: 'keyPause' },
  { action: 'retry', label: 'restart' },
];

interface Listening {
  action: KeyAction;
  slot: number;
}

const noGuard = (): void => undefined;

/** Chrome can say which character a physical key prints on the player's own layout; other browsers cannot. */
export async function browserLayoutMap(): Promise<LayoutMap | null> {
  try {
    const keyboard = (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<LayoutMap> } }).keyboard;
    return (await keyboard?.getLayoutMap()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Keyboard remapping (PRD table 4.2). Every action shows its keys as caps; a
 * click arms one, and the next key pressed is bound to it. The press is taken at
 * window level before anything else sees it, so Escape cancels the capture
 * rather than closing the screen and the bound key never reaches the game.
 */
export class KeysScreen {
  readonly modal: HTMLElement;
  private keys: KeyBindings = DEFAULT_KEYS;
  private layout: LayoutMap | null = null;
  private layoutAsked = false;
  private listening: Listening | null = null;
  private readonly caps = new Map<string, HTMLButtonElement>();
  private readonly status: HTMLElement;
  private readonly reset: HTMLButtonElement;

  constructor(
    parent: HTMLElement,
    private readonly host: ModalHost,
    private readonly handlers: KeysHandlers,
    private readonly readLayout: () => Promise<LayoutMap | null> = browserLayoutMap,
  ) {
    this.modal = el('div', { class: 'layer modal', 'data-ui': true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'keys-title' });
    const panel = el('div', { class: 'panel keys' });

    const head = el('header', { class: 'exchange-head' });
    const back = el('button', { class: 'icon-btn small', type: 'button', 'data-nav': true, 'data-autofocus': true, 'data-ui': true, 'aria-label': t('back') }, ICONS.back);
    back.addEventListener('click', () => {
      this.handlers.tick();
      this.handlers.back();
    });
    head.append(back, el('h2', { id: 'keys-title', 'data-i18n': 'keysTitle' }, esc(t('keysTitle'))));
    panel.appendChild(head);

    const list = el('div', { class: 'key-list' });
    for (const row of ROWS) list.appendChild(this.buildRow(row));
    panel.appendChild(list);

    this.status = el('p', { class: 'key-status', role: 'status', 'aria-live': 'polite' });
    this.reset = el('button', { class: 'btn small', type: 'button', 'data-nav': true, 'data-ui': true }, `${ICONS.restart}<span data-i18n="keyReset">${esc(t('keyReset'))}</span>`);
    this.reset.addEventListener('click', () => {
      this.handlers.tick();
      this.cancel();
      this.apply(DEFAULT_KEYS);
      this.say('');
    });
    const foot = el('div', { class: 'key-foot' });
    foot.append(this.status, this.reset);
    panel.appendChild(foot);

    this.modal.appendChild(panel);
    parent.appendChild(this.modal);
    this.render();
  }

  show(keys: KeyBindings): void {
    this.keys = keys;
    this.say('');
    this.render();
    this.host.open(this.modal);
    if (!this.layoutAsked) {
      this.layoutAsked = true;
      void this.readLayout().then((layout) => {
        this.layout = layout;
        this.render();
      });
    }
  }

  hide(): void {
    this.cancel();
    this.dropReleaseGuard();
    this.host.close(this.modal);
  }

  get isOpen(): boolean {
    return this.host.active === this.modal;
  }

  sync(keys: KeyBindings): void {
    this.keys = keys;
    this.render();
  }

  applyLocale(): void {
    this.modal.querySelectorAll<HTMLElement>('[data-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.i18n as StringKey);
    });
    this.modal.querySelector('.key-cap.fixed')?.setAttribute('title', t('keyFixed'));
    this.render();
  }

  private buildRow({ action, label }: Row): HTMLElement {
    const row = el('div', { class: 'key-row' });
    const slots = el('div', { class: 'key-slots' });
    if (action === 'pause') slots.appendChild(el('span', { class: 'key-cap fixed', title: t('keyFixed') }, 'Esc'));
    for (let slot = 0; slot < KEYS_PER_ACTION; slot++) {
      const cap = el('button', { class: 'key-cap', type: 'button', 'data-nav': true, 'data-ui': true, 'data-action': action, 'data-slot': slot });
      cap.addEventListener('click', () => this.arm(action, slot));
      cap.addEventListener('blur', () => {
        if (this.listening?.action === action && this.listening.slot === slot) this.cancel();
      });
      this.caps.set(`${action}:${slot}`, cap);
      slots.appendChild(cap);
    }
    row.append(el('span', { class: 'key-name', 'data-i18n': label }, esc(t(label))), slots);
    return row;
  }

  private nameOf(action: KeyAction): string {
    return t(ROWS.find((row) => row.action === action)!.label);
  }

  private labelOf(code: string): string {
    return keyLabel(code, t('keySpace'), this.layout);
  }

  private render(): void {
    for (const { action } of ROWS) {
      for (let slot = 0; slot < KEYS_PER_ACTION; slot++) {
        const cap = this.caps.get(`${action}:${slot}`)!;
        const code = this.keys[action][slot];
        const armed = this.listening?.action === action && this.listening.slot === slot;
        cap.textContent = armed ? t('keyPress') : code === undefined ? t('keyNone') : this.labelOf(code);
        cap.classList.toggle('empty', code === undefined && !armed);
        cap.classList.toggle('listening', armed);
        cap.setAttribute('aria-label', `${this.nameOf(action)}: ${cap.textContent}`);
      }
    }
    this.reset.disabled = isDefaultKeys(this.keys);
  }

  private say(message: string): void {
    this.status.textContent = message;
  }

  private arm(action: KeyAction, slot: number): void {
    this.handlers.tick();
    this.cancel();
    this.listening = { action, slot: Math.min(slot, this.keys[action].length) };
    window.addEventListener('keydown', this.onCapture, true);
    this.say(t('keyHint'));
    this.render();
  }

  private cancel(): void {
    if (!this.listening) return;
    this.listening = null;
    window.removeEventListener('keydown', this.onCapture, true);
    this.say('');
    this.render();
  }

  private readonly onCapture = (e: KeyboardEvent): void => {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat || !this.listening) return;
    const { action, slot } = this.listening;

    if (e.code === ALWAYS_PAUSES || ((e.code === 'Backspace' || e.code === 'Delete') && slot >= this.keys[action].length)) {
      this.cancel();
      return;
    }
    if (e.code === 'Backspace' || e.code === 'Delete') {
      const cleared = clearSlot(this.keys, action, slot);
      if (!cleared) {
        this.say(t('keyLast'));
        return;
      }
      this.cancel();
      this.apply(cleared);
      return;
    }

    const result = rebind(this.keys, action, slot, e.code);
    if (!result.ok) {
      this.say(result.reason === 'last-key' ? t('keyLast') : tf('keyReserved', { k: this.labelOf(e.code) }));
      return;
    }
    this.swallowRelease(e.code);
    this.cancel();
    if (result.keys !== this.keys) this.apply(result.keys);
    this.say(result.displaced ? tf('keySwapped', { a: this.nameOf(result.displaced) }) : '');
  };

  /**
   * The release that ends the press just bound must not click the cap it was
   * bound on. The guard lasts for that one release only: a new key press or
   * losing focus ends it, so it can never eat a release the game is waiting for.
   */
  private swallowRelease(code: string): void {
    this.dropReleaseGuard();
    const swallow = (e: KeyboardEvent): void => {
      if (e.code !== code) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.dropReleaseGuard();
    };
    const expire = (): void => this.dropReleaseGuard();
    window.addEventListener('keyup', swallow, true);
    window.addEventListener('keydown', expire, true);
    window.addEventListener('blur', expire, true);
    this.dropReleaseGuard = () => {
      window.removeEventListener('keyup', swallow, true);
      window.removeEventListener('keydown', expire, true);
      window.removeEventListener('blur', expire, true);
      this.dropReleaseGuard = noGuard;
    };
  }

  private dropReleaseGuard: () => void = noGuard;

  private apply(keys: KeyBindings): void {
    this.keys = keys;
    this.render();
    this.handlers.set(keys);
  }
}
