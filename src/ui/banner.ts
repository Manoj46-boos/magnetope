import { el, esc } from './dom';

const VISIBLE_MS = 2600;

/**
 * Title card shown as a new biome begins (PRD 12). It never takes input, and the
 * stylesheet fades it in place rather than sliding it when motion is reduced.
 */
export class BiomeBanner {
  readonly element: HTMLElement;
  private timer = 0;

  constructor(parent: HTMLElement) {
    this.element = el('div', { class: 'biome-banner', role: 'status', 'aria-live': 'polite' });
    parent.appendChild(this.element);
  }

  get visible(): boolean {
    return this.element.classList.contains('show');
  }

  show(name: string, detail: string): void {
    window.clearTimeout(this.timer);
    this.element.innerHTML = `<span class="rule"></span><b>${esc(name)}</b><small>${esc(detail)}</small>`;
    this.element.classList.add('show');
    this.timer = window.setTimeout(() => this.hide(), VISIBLE_MS);
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.element.classList.remove('show');
  }
}
