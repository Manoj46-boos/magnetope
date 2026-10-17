import { isTextEntry } from '@/input/text-entry';

export type NavDirection = 'up' | 'down' | 'left' | 'right';

export interface NavRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const KEY_DIRECTIONS: Record<string, NavDirection> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

/** Cross-axis drift is penalised so focus prefers the item straight ahead over a nearer one off to the side. */
const CROSS_AXIS_WEIGHT = 2.2;

const centre = (r: NavRect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/**
 * Picks the focus target when a direction key is pressed: the nearest item
 * lying in that direction. Returns -1 when nothing lies that way so the caller
 * can wrap.
 */
export function pickNeighbour(rects: readonly NavRect[], from: number, direction: NavDirection): number {
  const origin = centre(rects[from]!);
  let best = -1;
  let bestScore = Infinity;
  rects.forEach((rect, i) => {
    if (i === from) return;
    const c = centre(rect);
    const dx = c.x - origin.x;
    const dy = c.y - origin.y;
    const along = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
    const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 1) return;
    const score = along + across * CROSS_AXIS_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** A slider uses left and right to change its value; up and down still leave it. */
const adjustsItself = (target: EventTarget | null, direction: NavDirection): boolean =>
  target instanceof HTMLInputElement && target.type === 'range' && (direction === 'left' || direction === 'right');

/**
 * Owns the modal layers. Screens stack: opening the map from the pause menu
 * hides pause, and closing the map brings it back. Focus follows the keyboard
 * and WASD in reading order for lists and spatially for grids, so every screen
 * is reachable without a mouse or touch (Poki input guidance).
 */
export class ModalHost {
  private stack: HTMLElement[] = [];

  constructor(doc: Document = document) {
    doc.addEventListener('keydown', (e) => this.onKey(e));
  }

  get active(): HTMLElement | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  get depth(): number {
    return this.stack.length;
  }

  has(modal: HTMLElement): boolean {
    return this.stack.includes(modal);
  }

  open(modal: HTMLElement): void {
    const covered = this.active;
    if (covered && covered !== modal) covered.classList.remove('open');
    this.stack = this.stack.filter((m) => m !== modal);
    this.stack.push(modal);
    modal.classList.add('open');
    window.setTimeout(() => this.focusFirst(modal), 40);
  }

  close(modal: HTMLElement): void {
    if (!this.has(modal)) return;
    const wasTop = this.active === modal;
    this.stack = this.stack.filter((m) => m !== modal);
    modal.classList.remove('open');
    (document.activeElement as HTMLElement | null)?.blur();
    const revealed = this.active;
    if (wasTop && revealed) {
      revealed.classList.add('open');
      window.setTimeout(() => this.focusFirst(revealed), 40);
    }
  }

  closeAll(): void {
    for (const modal of [...this.stack].reverse()) this.close(modal);
  }

  private focusFirst(modal: HTMLElement): void {
    if (this.active !== modal) return;
    const preferred = modal.querySelector<HTMLElement>('[data-nav][data-autofocus]') ?? modal.querySelector<HTMLElement>('[data-nav]');
    preferred?.focus({ preventScroll: true });
  }

  private onKey(e: KeyboardEvent): void {
    const modal = this.active;
    const direction = KEY_DIRECTIONS[e.code];
    if (!modal || !direction || isTextEntry(e.target) || adjustsItself(e.target, direction)) return;
    const items = [...modal.querySelectorAll<HTMLElement>('[data-nav]')].filter((n) => !n.hasAttribute('disabled') && n.offsetParent !== null);
    if (items.length === 0) return;
    e.preventDefault();

    const current = items.indexOf(document.activeElement as HTMLElement);
    if (current < 0) {
      items[0]!.focus({ preventScroll: true });
      return;
    }
    const rects = items.map((n) => {
      const r = n.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const laidOut = rects.some((r) => r.w > 0 || r.h > 0);
    let next = laidOut ? pickNeighbour(rects, current, direction) : -1;
    if (next < 0) {
      const forward = direction === 'down' || direction === 'right';
      next = (current + (forward ? 1 : -1) + items.length) % items.length;
    }
    items[next]!.focus({ preventScroll: false });
  }
}
