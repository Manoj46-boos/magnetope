import { t, type StringKey } from '@/locale';
import type { AimMode, Settings, TouchLayout } from '@/platform/settings';
import { el, esc } from './dom';
import { ICONS } from './icons';
import type { ModalHost } from './modal-host';

export interface ControlsHandlers {
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  openKeys(): void;
  back(): void;
  tick(): void;
}

interface Choice<V extends string> {
  value: V;
  label: StringKey;
}

const LAYOUTS: ReadonlyArray<Choice<TouchLayout>> = [
  { value: 'split', label: 'layoutSplit' },
  { value: 'single', label: 'layoutButton' },
];

const AIMS: ReadonlyArray<Choice<AimMode>> = [
  { value: 'auto', label: 'aimAuto' },
  { value: 'keyboard', label: 'aimKeys' },
  { value: 'mouse', label: 'aimMouse' },
];

export const SENSITIVITY_MIN = 0.5;
export const SENSITIVITY_MAX = 1.5;
const SENSITIVITY_STEP = 0.05;

/**
 * Input and visibility options (PRD 12.4): the touch layout, how far a thumb
 * must travel to steer, how aim is read on a desktop (mouse-only play is a
 * first-class mode), the cyan rim that marks grabbable surfaces and the way in
 * to keyboard remapping.
 */
export class ControlsScreen {
  readonly modal: HTMLElement;
  private readonly groups = new Map<string, HTMLElement>();
  private readonly slider: HTMLInputElement;
  private readonly sliderValue: HTMLElement;
  private readonly rim: HTMLButtonElement;

  constructor(
    parent: HTMLElement,
    private readonly host: ModalHost,
    private readonly handlers: ControlsHandlers,
  ) {
    this.modal = el('div', { class: 'layer modal', 'data-ui': true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'controls-title' });
    const panel = el('div', { class: 'panel controls' });

    const head = el('header', { class: 'exchange-head' });
    const back = el('button', { class: 'icon-btn small', type: 'button', 'data-nav': true, 'data-autofocus': true, 'data-ui': true, 'aria-label': t('back') }, ICONS.back);
    back.addEventListener('click', () => {
      this.handlers.tick();
      this.handlers.back();
    });
    head.append(back, el('h2', { id: 'controls-title', 'data-i18n': 'controls' }, esc(t('controls'))));
    panel.appendChild(head);

    panel.appendChild(this.segmented('touchLayout', 'touchLayout', LAYOUTS, (value) => this.handlers.set('touchLayout', value)));

    this.slider = el('input', {
      class: 'range',
      type: 'range',
      min: SENSITIVITY_MIN,
      max: SENSITIVITY_MAX,
      step: SENSITIVITY_STEP,
      value: 1,
      'data-nav': true,
      'data-ui': true,
      'aria-labelledby': 'sensitivity-label',
    });
    this.sliderValue = el('b', { class: 'range-value' });
    this.slider.addEventListener('input', () => this.showSensitivity());
    this.slider.addEventListener('change', () => {
      this.handlers.tick();
      this.handlers.set('touchSensitivity', Number(this.slider.value));
    });
    const sensitivity = el('div', { class: 'control-row' });
    const label = el('div', { class: 'control-label' });
    label.append(el('span', { id: 'sensitivity-label', 'data-i18n': 'sensitivity' }, esc(t('sensitivity'))), this.sliderValue);
    sensitivity.append(label, this.slider);
    panel.appendChild(sensitivity);

    panel.appendChild(this.segmented('aiming', 'aimMode', AIMS, (value) => this.handlers.set('aimMode', value)));

    const keys = el('button', { class: 'btn', type: 'button', 'data-nav': true, 'data-ui': true, 'data-opens': 'keys' }, `${ICONS.keyboard}<span data-i18n="keysTitle">${esc(t('keysTitle'))}</span>`);
    keys.addEventListener('click', () => {
      this.handlers.tick();
      this.handlers.openKeys();
    });
    panel.appendChild(keys);

    this.rim = el('button', { class: 'toggle', type: 'button', 'data-nav': true, 'data-ui': true, 'aria-pressed': 'true' }, `${ICONS.assist}<span data-i18n="rimTint">${esc(t('rimTint'))}</span>`);
    this.rim.addEventListener('click', () => {
      const next = this.rim.getAttribute('aria-pressed') !== 'true';
      this.rim.setAttribute('aria-pressed', String(next));
      this.handlers.tick();
      this.handlers.set('rimTint', next);
    });
    panel.appendChild(this.rim);

    this.modal.appendChild(panel);
    parent.appendChild(this.modal);
  }

  show(settings: Settings): void {
    this.sync(settings);
    this.host.open(this.modal);
  }

  hide(): void {
    this.host.close(this.modal);
  }

  get isOpen(): boolean {
    return this.host.active === this.modal;
  }

  sync(settings: Settings): void {
    this.select('touchLayout', settings.touchLayout);
    this.select('aimMode', settings.aimMode);
    this.slider.value = String(settings.touchSensitivity);
    this.showSensitivity();
    this.rim.setAttribute('aria-pressed', String(settings.rimTint));
  }

  applyLocale(): void {
    this.modal.querySelectorAll<HTMLElement>('[data-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.i18n as StringKey);
    });
  }

  private segmented<V extends string>(title: StringKey, key: string, choices: ReadonlyArray<Choice<V>>, onPick: (value: V) => void): HTMLElement {
    const row = el('div', { class: 'control-row' });
    const titleId = `${key}-label`;
    const group = el('div', { class: 'segmented', role: 'radiogroup', 'aria-labelledby': titleId });
    for (const { value, label } of choices) {
      const b = el('button', { class: 'segment', type: 'button', role: 'radio', 'aria-checked': 'false', 'data-value': value, 'data-nav': true, 'data-ui': true, 'data-i18n': label }, esc(t(label)));
      b.addEventListener('click', () => {
        this.handlers.tick();
        this.select(key, value);
        onPick(value);
      });
      group.appendChild(b);
    }
    this.groups.set(key, group);
    row.append(el('div', { class: 'control-label' }, `<span id="${titleId}" data-i18n="${title}">${esc(t(title))}</span>`), group);
    return row;
  }

  private select(key: string, value: string): void {
    this.groups.get(key)?.querySelectorAll<HTMLElement>('.segment').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === value)));
  }

  private showSensitivity(): void {
    this.sliderValue.textContent = `${Math.round(Number(this.slider.value) * 100)}%`;
  }
}
