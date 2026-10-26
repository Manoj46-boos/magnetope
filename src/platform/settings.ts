import { DEFAULT_KEYS, type KeyBindings } from '@/input/keymap';

export type AimMode = 'auto' | 'keyboard' | 'mouse';
export type TouchLayout = 'split' | 'single';

/** The three interface sizes a player can choose (R-AC-06). */
export const UI_SCALES = [1, 1.25, 1.5] as const;
export type UiScale = (typeof UI_SCALES)[number];

export interface Settings {
  sound: boolean;
  music: boolean;
  /** 'auto' follows the platform language. */
  language: string;
  assist: boolean;
  reducedMotion: boolean;
  /** Interface zoom for small screens and tired eyes; the world never scales. */
  uiScale: UiScale;
  aimMode: AimMode;
  touchLayout: TouchLayout;
  touchSensitivity: number;
  rimTint: boolean;
  /** Draws the par and personal ghosts during a run. */
  ghosts: boolean;
  keys: KeyBindings;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  sound: true,
  music: true,
  language: 'auto',
  assist: true,
  reducedMotion: false,
  uiScale: 1,
  aimMode: 'auto',
  touchLayout: 'split',
  touchSensitivity: 1,
  rimTint: true,
  ghosts: true,
  keys: DEFAULT_KEYS,
});
