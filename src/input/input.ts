import { Emitter } from '@/core/emitter';
import { clamp } from '@/core/mathx';
import type { Settings } from '@/platform/settings';
import type { InputFrame } from '@/sim/types';
import { ALWAYS_PAUSES, buildLookup, type KeyAction, type KeyBindings } from './keymap';
import { isTextEntry } from './text-entry';

export type InputDevice = 'keyboard' | 'mouse' | 'touch';

export interface InputEvents {
  pause: Record<string, never>;
  retry: Record<string, never>;
  /** Any gameplay input, used to start the SDK session and dismiss cards. */
  activity: { device: InputDevice };
  /** Tab hidden or window blurred; the game must stop gameplay. */
  interrupt: Record<string, never>;
}

export interface StickState {
  active: boolean;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

export interface InputOptions {
  /** Screen-space position of MAGNO, used for cursor-relative aim. */
  playerScreen: () => { x: number; y: number } | null;
  settings: () => Pick<Settings, 'aimMode' | 'touchLayout' | 'touchSensitivity' | 'keys'>;
}

const STICK_RADIUS = 64;
const STICK_DEADZONE = 0.12;
const MOUSE_RADIUS = 180;
const MOUSE_DEADZONE = 14;

const isMove = (action: KeyAction | null): boolean => action === 'left' || action === 'right' || action === 'up' || action === 'down';

type FlipEdge = 'down' | 'up';

/**
 * Merges keyboard, mouse and touch into one stream of fixed-tick input frames.
 * Presses and releases are queued so a tap shorter than a tick is never lost and
 * edges always arrive in the order the player made them.
 */
export class InputManager {
  readonly events = new Emitter<InputEvents>();
  readonly stick: StickState = { active: false, originX: 0, originY: 0, x: 0, y: 0 };
  device: InputDevice = 'keyboard';
  flipTouchActive = false;
  /** While false (a menu is open) gameplay input is ignored but pause still works. */
  private enabled = true;

  private readonly keys = new Set<string>();
  private readonly flipSources = new Set<string>();
  private readonly edgeQueue: FlipEdge[] = [];
  private held = false;
  private cursor = { x: 0, y: 0, seen: false };
  private stickPointer: number | null = null;
  private flipPointer: number | null = null;
  private detach: Array<() => void> = [];
  private lookup: { keys: KeyBindings; byCode: ReadonlyMap<string, KeyAction> } | null = null;

  constructor(
    private readonly stage: HTMLElement,
    private readonly options: InputOptions,
  ) {}

  attach(): void {
    const on = <T extends EventTarget>(target: T, type: string, handler: (e: never) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, handler as EventListener, opts);
      this.detach.push(() => target.removeEventListener(type, handler as EventListener, opts));
    };
    on(window, 'keydown', (e: KeyboardEvent) => this.onKeyDown(e));
    on(window, 'keyup', (e: KeyboardEvent) => this.onKeyUp(e));
    on(window, 'blur', () => this.interrupt());
    on(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.interrupt();
    });
    on(this.stage, 'pointerdown', (e: PointerEvent) => this.onPointerDown(e));
    on(this.stage, 'pointermove', (e: PointerEvent) => this.onPointerMove(e));
    on(this.stage, 'pointerup', (e: PointerEvent) => this.onPointerUp(e));
    on(this.stage, 'pointercancel', (e: PointerEvent) => this.onPointerUp(e));
    on(this.stage, 'contextmenu', (e: Event) => {
      e.preventDefault();
      this.events.emit('pause', {});
    });
  }

  dispose(): void {
    this.detach.forEach((off) => off());
    this.detach = [];
    this.events.clear();
  }

  /** Releases every held input and flushes pending edges, e.g. when a menu opens. */
  reset(): void {
    this.keys.clear();
    this.flipSources.clear();
    this.edgeQueue.length = 0;
    this.held = false;
    this.stick.active = false;
    this.stick.x = this.stick.y = 0;
    this.stickPointer = null;
    this.flipPointer = null;
    this.flipTouchActive = false;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.reset();
  }

  /** Produces the input for exactly one simulation tick. */
  sample(): InputFrame {
    if (!this.enabled) return { tiltX: 0, tiltY: 0, flipHeld: false, flipDown: false, flipUp: false };
    let flipDown = false;
    let flipUp = false;
    const next = this.edgeQueue[0];
    if (next === 'down' && !this.held) {
      this.edgeQueue.shift();
      this.held = true;
      flipDown = true;
    } else if (next === 'up' && this.held) {
      this.edgeQueue.shift();
      this.held = false;
      flipUp = true;
    } else if (next !== undefined) {
      // A redundant edge (e.g. down while already held) is dropped rather than replayed.
      this.edgeQueue.shift();
    }
    const tilt = this.tilt();
    return { tiltX: tilt.x, tiltY: tilt.y, flipHeld: this.held, flipDown, flipUp };
  }

  private tilt(): { x: number; y: number } {
    const aim = this.options.settings().aimMode;
    const keyboard = this.keyboardTilt();
    const usesMouse = aim === 'mouse' || (aim === 'auto' && this.device === 'mouse');

    if (this.device === 'touch' && this.stick.active) return { x: this.stick.x, y: this.stick.y };
    if (keyboard.x !== 0 || keyboard.y !== 0) return keyboard;
    if (usesMouse && this.cursor.seen) return this.mouseTilt();
    return { x: 0, y: 0 };
  }

  private actionFor(code: string): KeyAction | null {
    const keys = this.options.settings().keys;
    if (this.lookup?.keys !== keys) this.lookup = { keys, byCode: buildLookup(keys) };
    return this.lookup.byCode.get(code) ?? null;
  }

  private keyboardTilt(): { x: number; y: number } {
    let left = false;
    let right = false;
    let up = false;
    let down = false;
    for (const code of this.keys) {
      const action = this.actionFor(code);
      if (action === 'left') left = true;
      else if (action === 'right') right = true;
      else if (action === 'up') up = true;
      else if (action === 'down') down = true;
    }
    let x = (right ? 1 : 0) - (left ? 1 : 0);
    let y = (up ? 1 : 0) - (down ? 1 : 0);
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  private mouseTilt(): { x: number; y: number } {
    const player = this.options.playerScreen();
    if (!player) return { x: 0, y: 0 };
    const dx = this.cursor.x - player.x;
    const dy = player.y - this.cursor.y;
    const dist = Math.hypot(dx, dy);
    if (dist < MOUSE_DEADZONE) return { x: 0, y: 0 };
    const strength = clamp((dist - MOUSE_DEADZONE) / (MOUSE_RADIUS - MOUSE_DEADZONE), 0, 1);
    return { x: (dx / dist) * strength, y: (dy / dist) * strength };
  }

  private setFlipSource(source: string, down: boolean): void {
    const had = this.flipSources.size > 0;
    if (down) this.flipSources.add(source);
    else this.flipSources.delete(source);
    const has = this.flipSources.size > 0;
    if (has && !had) this.edgeQueue.push('down');
    else if (!has && had) this.edgeQueue.push('up');
  }

  private activity(device: InputDevice): void {
    this.device = device;
    this.events.emit('activity', { device });
  }

  private interrupt(): void {
    this.reset();
    this.events.emit('interrupt', {});
  }

  // ------------------------------------------------------------------ keyboard

  private onKeyDown(e: KeyboardEvent): void {
    const action = this.actionFor(e.code);
    if (e.repeat) {
      if (action === 'flip' || isMove(action)) e.preventDefault();
      return;
    }
    if ((e.code === ALWAYS_PAUSES || action === 'pause') && (e.code === ALWAYS_PAUSES || !isTextEntry(e.target))) {
      this.events.emit('pause', {});
      return;
    }
    if (isTextEntry(e.target)) return;
    if (action === 'retry') {
      this.events.emit('retry', {});
      return;
    }
    if (!this.enabled) return;
    if (action === 'flip') {
      e.preventDefault();
      this.activity('keyboard');
      this.setFlipSource(`key:${e.code}`, true);
    } else if (isMove(action)) {
      e.preventDefault();
      this.activity('keyboard');
      this.keys.add(e.code);
    }
  }

  /** Releases by code, not by action, so a key bound a moment ago can never be left held. */
  private onKeyUp(e: KeyboardEvent): void {
    this.setFlipSource(`key:${e.code}`, false);
    this.keys.delete(e.code);
  }

  // ------------------------------------------------------------ pointer / touch

  private isUi(e: PointerEvent): boolean {
    const target = e.target;
    return target instanceof Element && target.closest('[data-ui]') !== null;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled || this.isUi(e)) return;
    if (e.pointerType === 'touch') {
      this.touchDown(e);
      return;
    }
    this.cursor = { x: e.clientX, y: e.clientY, seen: true };
    if (e.button === 2) return;
    if (e.button === 0) {
      this.activity('mouse');
      this.setFlipSource('mouse', true);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerType === 'touch') {
      this.touchMove(e);
      return;
    }
    this.cursor = { x: e.clientX, y: e.clientY, seen: true };
    if (this.device !== 'mouse' && this.options.settings().aimMode === 'auto') this.device = 'mouse';
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.pointerType === 'touch') {
      this.touchUp(e);
      return;
    }
    if (e.button === 0 || e.type === 'pointercancel') this.setFlipSource('mouse', false);
  }

  private touchDown(e: PointerEvent): void {
    this.activity('touch');
    const rect = this.stage.getBoundingClientRect();
    const layout = this.options.settings().touchLayout;
    const inFlipZone =
      layout === 'split' ? e.clientX - rect.left > rect.width / 2 : this.inFlipButton(e.clientX, e.clientY, rect);
    if (inFlipZone && this.flipPointer === null) {
      this.flipPointer = e.pointerId;
      this.flipTouchActive = true;
      this.setFlipSource('touch', true);
    } else if (!inFlipZone && this.stickPointer === null) {
      this.stickPointer = e.pointerId;
      this.stick.active = true;
      this.stick.originX = e.clientX;
      this.stick.originY = e.clientY;
      this.stick.x = 0;
      this.stick.y = 0;
    }
  }

  private inFlipButton(x: number, y: number, rect: DOMRect): boolean {
    const radius = Math.min(rect.width, rect.height) * 0.2;
    const cx = rect.left + rect.width - radius * 1.4;
    const cy = rect.top + rect.height - radius * 1.4;
    return Math.hypot(x - cx, y - cy) <= radius * 1.25;
  }

  private touchMove(e: PointerEvent): void {
    if (e.pointerId !== this.stickPointer) return;
    const sensitivity = this.options.settings().touchSensitivity;
    const dx = e.clientX - this.stick.originX;
    const dy = this.stick.originY - e.clientY;
    const radius = STICK_RADIUS / sensitivity;
    const dist = Math.hypot(dx, dy);
    const strength = clamp(dist / radius, 0, 1);
    if (strength < STICK_DEADZONE) {
      this.stick.x = this.stick.y = 0;
    } else {
      this.stick.x = (dx / dist) * strength;
      this.stick.y = (dy / dist) * strength;
    }
  }

  private touchUp(e: PointerEvent): void {
    if (e.pointerId === this.stickPointer) {
      this.stickPointer = null;
      this.stick.active = false;
      this.stick.x = this.stick.y = 0;
    }
    if (e.pointerId === this.flipPointer) {
      this.flipPointer = null;
      this.flipTouchActive = false;
      this.setFlipSource('touch', false);
    }
  }
}
