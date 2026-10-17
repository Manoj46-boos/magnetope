import { DEFAULT_KEYS, type KeyBindings } from '@/input/keymap';

export type AimMode = 'auto' | 'keyboard' | 'mouse';
export type TouchLayout = 'split' | 'single';

export interface Settings {
  sound: boolean;
  music: boolean;
  /** 'auto' follows the platform language. */
  language: string;
  assist: boolean;
  reducedMotion: boolean;
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
  aimMode: 'auto',
  touchLayout: 'split',
  touchSensitivity: 1,
  rimTint: true,
  ghosts: true,
  keys: DEFAULT_KEYS,
});
