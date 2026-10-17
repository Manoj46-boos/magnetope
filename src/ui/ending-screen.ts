import { t } from '@/locale';
import type { EndingFrame } from '@/game/ending';
import { el } from './dom';
import { ICONS } from './icons';

export interface ClimbSummary {
  stars: number;
  maxStars: number;
  levelsCleared: number;
  totalLevels: number;
  bestFall: { heightMeters: number; grade: string } | null;
}

const SKIP_KEYS = new Set(['Escape', 'Enter', ' ', 'Spacebar']);

/**
 * Cinematic furniture around the ending: letterbox bars, a skip control that
 * works from the first frame, and the closing card with the player's climb.
 */
export class EndingScreen {
  readonly element: HTMLElement;
  private readonly skipButton: HTMLButtonElement;
  private readonly credits: HTMLElement;
  private onSkip: (() => void) | null = null;
  private readonly onKey = (event: KeyboardEvent): void => {
    if (!SKIP_KEYS.has(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    this.onSkip?.();
  };
  private creditsShown = false;

  constructor(parent: HTMLElement) {
    this.element = el('div', { class: 'layer ending', role: 'region', 'aria-hidden': 'true' });
    this.element.append(el('div', { class: 'cine top' }), el('div', { class: 'cine bottom' }));
    this.skipButton = el('button', { class: 'btn skip', type: 'button', 'data-ui': true, 'data-nav': true }, ICONS.next);
    this.skipButton.append(el('span', {}, t('skip')));
    this.skipButton.addEventListener('click', () => this.onSkip?.());
    this.credits = el('div', { class: 'credits', 'aria-live': 'polite' });
    this.element.append(this.credits, this.skipButton);
    parent.appendChild(this.element);
  }

  get visible(): boolean {
    return this.element.classList.contains('on');
  }

  show(summary: ClimbSummary, onSkip: () => void): void {
    this.onSkip = onSkip;
    this.creditsShown = false;
    this.credits.innerHTML = this.creditsMarkup(summary);
    this.element.setAttribute('aria-label', t('endingLabel'));
    this.element.removeAttribute('aria-hidden');
    this.element.classList.add('on');
    window.addEventListener('keydown', this.onKey, true);
    this.applyLocale();
    this.update(0, 0);
    this.skipButton.focus({ preventScroll: true });
  }

  hide(): void {
    window.removeEventListener('keydown', this.onKey, true);
    this.element.classList.remove('on');
    this.element.setAttribute('aria-hidden', 'true');
    this.onSkip = null;
    this.credits.replaceChildren();
  }

  /** Called every frame while the film plays. */
  render(frame: EndingFrame): void {
    this.update(frame.letterbox, frame.credits);
  }

  applyLocale(): void {
    if (this.visible) this.element.setAttribute('aria-label', t('endingLabel'));
    this.syncLabel();
  }

  private syncLabel(): void {
    (this.skipButton.lastElementChild as HTMLElement).textContent = this.creditsShown ? t('next') : t('skip');
  }

  private update(letterbox: number, credits: number): void {
    this.element.style.setProperty('--bars', letterbox.toFixed(3));
    this.element.style.setProperty('--credits', credits.toFixed(3));
    const shown = credits > 0.5;
    if (shown === this.creditsShown) return;
    this.creditsShown = shown;
    this.syncLabel();
  }

  private creditsMarkup({ stars, maxStars, levelsCleared, totalLevels, bestFall }: ClimbSummary): string {
    const fall = bestFall ? `${bestFall.heightMeters.toFixed(1)} ${t('meters')} · ${bestFall.grade}` : '–';
    const fact = (value: string, label: string): string => `<div class="fact"><b>${value}</b><span>${label}</span></div>`;
    return `
      <div class="mark">MAGNETOPE</div>
      <p class="thanks">${t('thanksForClimbing')}</p>
      <div class="facts">
        ${fact(`${stars}<small>/${maxStars}</small>`, t('stars'))}
        ${fact(`${levelsCleared}<small>/${totalLevels}</small>`, t('climbLevels'))}
        ${fact(fall, t('climbBestFall'))}
      </div>
      <p class="studio">${t('studioCredit')}</p>`;
  }
}
