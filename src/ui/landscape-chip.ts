import { t } from '@/locale';
import { el } from './dom';
import { ICONS } from './icons';

const VISIBLE_MS = 8000;

/**
 * The optional landscape chip (P-MO-06): one quiet sentence, offered by the
 * game's own policy when a wide metropolis climb is being fought in portrait.
 * It never takes gameplay input — only the dismiss control listens — and it
 * leaves on its own the way the toast does, so a player who ignores it never
 * has to reach for it.
 */
export class LandscapeChip {
  readonly element: HTMLElement;
  private timer = 0;
  private readonly text: HTMLElement;
  private readonly dismiss: HTMLButtonElement;

  constructor(parent: HTMLElement) {
    this.element = el('div', { class: 'landscape-chip', role: 'status', 'aria-live': 'polite' });
    this.text = el('p');
    this.dismiss = el('button', { class: 'chip-dismiss', type: 'button', 'aria-label': t('hintDismiss'), 'data-ui': true }, ICONS.close);
    this.dismiss.addEventListener('click', () => this.hide());
    this.element.append(this.text, this.dismiss);
    parent.appendChild(this.element);
  }

  get visible(): boolean {
    return this.element.classList.contains('show');
  }

  show(hint: string): void {
    window.clearTimeout(this.timer);
    this.text.textContent = hint;
    this.dismiss.setAttribute('aria-label', t('hintDismiss'));
    this.element.classList.add('show');
    this.timer = window.setTimeout(() => this.hide(), VISIBLE_MS);
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.element.classList.remove('show');
  }
}
