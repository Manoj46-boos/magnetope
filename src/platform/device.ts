import type { InputDevice } from '@/input/input';

/** What the browser says about the pointing devices a machine has. */
export interface PointerEnvironment {
  /** The main pointer is a finger: phones, tablets, an iPad with a trackpad. */
  coarsePrimary: boolean;
  anyCoarse: boolean;
  anyFine: boolean;
}

export function readPointerEnvironment(win: Pick<Window, 'matchMedia'>): PointerEnvironment {
  const matches = (query: string): boolean => win.matchMedia?.(query).matches ?? false;
  return {
    coarsePrimary: matches('(pointer: coarse)'),
    anyCoarse: matches('(any-pointer: coarse)'),
    anyFine: matches('(any-pointer: fine)'),
  };
}

/** Tablets are forced onto the touch layout (Poki requirement); so is a touchscreen with no mouse or trackpad at all. */
export const startsInTouchMode = (env: PointerEnvironment): boolean => env.coarsePrimary || (env.anyCoarse && !env.anyFine);

/**
 * A touchscreen laptop or Chromebook has a keyboard and trackpad as its main input and a screen
 * that also takes touches. It starts in keyboard mode and follows whichever the player uses.
 */
export const followsActivity = (env: PointerEnvironment): boolean => env.anyCoarse && env.anyFine && !env.coarsePrimary;

/** Whether the on-screen touch controls (and the touch tutorial) are showing. */
export class TouchMode {
  private on: boolean;

  constructor(
    private readonly env: PointerEnvironment,
    private readonly changed: (touch: boolean) => void,
  ) {
    this.on = startsInTouchMode(env);
  }

  get touch(): boolean {
    return this.on;
  }

  /** Called whenever the player presses a key, clicks, or touches the screen. */
  noteActivity(device: InputDevice): void {
    if (!followsActivity(this.env)) return;
    const next = device === 'touch';
    if (next === this.on) return;
    this.on = next;
    this.changed(next);
  }
}
