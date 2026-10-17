import type { CoachCue } from '@/game/coach';
import { el } from './dom';
import { HAND } from './icons';

export type CoachDevice = 'touch' | 'keyboard' | 'mouse';

export interface CoachFrame {
  cue: CoachCue;
  device: CoachDevice;
  /** Unit direction of the first hop in screen space (y grows downward). */
  direction: { x: number; y: number };
  /** MAGNO in CSS pixels. */
  anchor: { x: number; y: number };
}

const KEY_GLYPH = { up: '↑', left: '←', down: '↓', right: '→' } as const;

/** The key that points most nearly along `direction`. */
export function dominantKey(direction: { x: number; y: number }): keyof typeof KEY_GLYPH {
  if (Math.abs(direction.x) > Math.abs(direction.y)) return direction.x > 0 ? 'right' : 'left';
  return direction.y > 0 ? 'down' : 'up';
}

/**
 * The ghost hand (PRD 12.1): a wordless, looping demonstration of the next
 * gesture. It shows where to go with a pulsing arrow on MAGNO, and how to
 * ask for it with the device the player is actually using.
 */
export class CoachOverlay {
  readonly root: HTMLElement;
  private readonly arrow: HTMLElement;
  private readonly stage: HTMLElement;
  private signature = '';

  constructor(parent: HTMLElement) {
    this.root = el('div', { class: 'layer coach', 'aria-hidden': 'true' });
    this.arrow = el('div', { class: 'coach-arrow' }, '<i></i><i></i><i></i>');
    this.stage = el('div', { class: 'coach-stage' });
    this.root.append(this.arrow, this.stage);
    parent.appendChild(this.root);
  }

  get visible(): boolean {
    return this.root.classList.contains('show');
  }

  show(frame: CoachFrame): void {
    this.root.classList.add('show');
    const angle = Math.atan2(frame.direction.y, frame.direction.x);
    this.arrow.style.transform = `translate(${Math.round(frame.anchor.x)}px, ${Math.round(frame.anchor.y)}px) rotate(${angle.toFixed(3)}rad)`;

    const key = dominantKey(frame.direction);
    const signature = `${frame.cue}|${frame.device}|${key}|${Math.round(frame.direction.x * 4)}|${Math.round(frame.direction.y * 4)}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.stage.dataset.cue = frame.cue;
    this.stage.dataset.device = frame.device;
    this.stage.style.setProperty('--vx', frame.direction.x.toFixed(2));
    this.stage.style.setProperty('--vy', frame.direction.y.toFixed(2));
    this.stage.innerHTML = this.markup(frame.device, key);
  }

  hide(): void {
    this.root.classList.remove('show');
    this.signature = '';
  }

  private markup(device: CoachDevice, key: keyof typeof KEY_GLYPH): string {
    if (device === 'touch') {
      return `
        <div class="demo stick"><span class="ring"></span><span class="hand">${HAND}</span></div>
        <div class="demo flip"><span class="pad"></span><span class="hand">${HAND}</span><span class="pulse"></span></div>`;
    }
    const keys = (['up', 'left', 'down', 'right'] as const)
      .map((k) => `<kbd class="key ${k} ${k === key ? 'lit' : ''}">${KEY_GLYPH[k]}</kbd>`)
      .join('');
    const flip = device === 'mouse' ? '<span class="mouse"><i></i></span>' : '<kbd class="key space">␣</kbd>';
    return `<div class="demo keys"><div class="cluster">${keys}</div><div class="flip-key">${flip}</div></div>`;
  }
}
