import { el, esc } from './dom';
import { LOCKUP_WORDMARK } from './lockup';

const VISIBLE_MS = 1800;

/**
 * Title card shown as a new biome begins (PRD 12, renewal 17.7). It never takes
 * input, and it holds the screen for 1.8 seconds — 200 ms in, 1.4 s hold,
 * 200 ms out — from the upper-left rule-of-thirds intersection, so the biome
 * shift is named without covering the climb it names. On a fresh save's first
 * boot the card is the wordmark itself (P-FT-02): the game's name over the live
 * first level, the world already moving behind it.
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

  showWordmark(detail: string): void {
    window.clearTimeout(this.timer);
    this.element.innerHTML = `<span class="rule"></span>${LOCKUP_WORDMARK}<small>${esc(detail)}</small>`;
    this.element.classList.add('show');
    this.timer = window.setTimeout(() => this.hide(), VISIBLE_MS);
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.element.classList.remove('show');
  }
}
