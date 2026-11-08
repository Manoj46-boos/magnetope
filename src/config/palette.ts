/**
 * The master palette (visual renewal PRD 15): every colour the chrome, the
 * brand and the effect family may show, locked at the values the audited build
 * ships. The biome skies and props live in `render/palette.ts`'s HSL system —
 * committed per biome, doc-generated as the colour script — and everything
 * cross-cutting lives here. A new visual need is met by reusing a token, not
 * by writing a new literal: `scripts/check-budget.mjs` fails the build on any
 * colour this module does not own (the one exemption is `config/cosmetics.ts`,
 * the locker's own inventory — content the player unlocks, not chrome).
 *
 * The lock is v1.0 (PRD 15.5): changing a value here means changing what every
 * audited surface — the cards' contrast gates, the rail's derivation, the
 * coach's legibility — was measured against, so it goes through a written
 * justification first, and the colour script and the affected audits are
 * regenerated in the same change.
 */

/** The identity: the pole pair, the signature cyan, the ink and the warm paper white. */
export const BRAND = {
  /** MAGNO's north tip, the rewarded accent, the summit banner — the only red that may read as "magnet". */
  poleNorth: '#e53935',
  /** The south tip, the next-level family — the pair is the game's name, never split. */
  poleSouth: '#1e88e5',
  /** The field-line arc, the loading bar's ink, the wordmark's crossbar. */
  fieldLine: '#00e5ff',
  /** The wordmark's non-magnet letters. */
  ink: '#0a0a0a',
  /** The sclera and the marker glyph's warm white, one step warmer than UI ink. */
  paper: '#f7f4ee',
} as const;

/** The marker glyph's own sheet, shared by the rail marker, the icons and the share card. */
export const CHARACTER = {
  headSteel: '#e9edf2',
  bodyGrey: '#cfd6df',
  socket: '#10161f',
  pupil: '#0c1118',
} as const;

/** The studio mark's pair; the red is the mark's own, warmer than the pole. */
export const STUDIO = {
  markAmber: '#ffb347',
  markRed: '#e5484d',
} as const;

/** The chrome: what `src/ui/style.css`'s `:root` custom properties carry, by the names they own there. */
export const UI = {
  /** The page's base coat behind every layer. */
  bg: '#151a22',
  panel: 'rgba(13, 17, 25, 0.84)',
  panelEdge: 'rgba(255, 255, 255, 0.09)',
  ink: '#f4efe5',
  inkDim: 'rgba(244, 239, 229, 0.66)',
  amber: '#ffb347',
  amberDeep: '#e8881c',
  cyan: '#5fd4ff',
  danger: '#ff6b5e',
  /** Tonal pair every palette keeps for strokes and shadows. */
  white: '#ffffff',
  black: '#000000',
} as const;

/** The primary action: a warm gradient, its own dark ink, and the pale rim that catches the light. */
export const BUTTON = {
  top: '#ffc96b',
  ink: '#2a1700',
  rim: '#ffe2aa',
} as const;

/** One-role chrome tints: success, the inks that sit on bright chips, and the night-blue backdrop family. */
export const STATE = {
  success: '#a8f5b6',
  /** The ink the language picker's options must fall back to in browsers that ignore the dark UI. */
  inkOnLight: '#111111',
  /** The ink on the amber badge and its deeper sibling on the gold. */
  goldInk: '#241503',
  /** The ink on the cyan chips (coach steps, biometrics). */
  cyanInk: '#04202b',
  /** The partner the cyan gradient lightens into. */
  cyanPale: '#c8f1ff',
  panelDeep: '#0c1018',
  panelDusk: '#141a24',
  panelShade: '#090c12',
  nightHi: '#2a3342',
  nightLo: '#12161e',
  nightRadialHi: '#2b3547',
  nightRadialLo: '#151b26',
  nightDeep: '#05070b',
  /** The ghost exchange's swatch pair: mine wears the gold, a friend the violet. */
  swatchMine: '#ffc16b',
  swatchFriend: '#e0a3ff',
} as const;

/** The share card's rank medals, one hue per tier. */
export const RANKS = {
  sss: '#ff8a5c',
  s: '#ffd96b',
  a: '#9fe7ff',
  b: '#c9f2d4',
} as const;

/** The fall card's grade ladder (renewal 17.8): the dim ink C climbs the golds to the pole red SSS. */
export const GRADE_LADDER = {
  c: 'rgba(244, 239, 229, 0.66)',
  b: '#ffe082',
  a: '#ffca28',
  s: '#ffab00',
  ss: '#ff6f00',
  sss: '#e53935',
} as const;

/** An effect colour in its authoring space: three's HSL, as the family was tuned. */
export interface FxHsl {
  h: number;
  s: number;
  l: number;
}

/**
 * The two-note effect family, locked in the space it was authored in: three's
 * own HSL, so the tokens and the shipped colours are the same values by
 * construction. `render/palette.ts` builds its colours straight from these; the
 * colour script prints their display hex for humans, rendered from the same
 * constants.
 */
export const FX = {
  attract: { h: 0.54, s: 0.95, l: 0.68 },
  attractCore: { h: 0.52, s: 0.9, l: 0.92 },
  repel: { h: 0.09, s: 1, l: 0.58 },
  repelCore: { h: 0.12, s: 0.95, l: 0.85 },
  rim: { h: 0.52, s: 0.8, l: 0.55 },
} as const satisfies Record<string, FxHsl>;

/** The toon band the committed look shades every surface with, as the lit/shadow/edge mix the shader owns. */
export const TOON = {
  shadow: 0.35,
  lit: 1.0,
  edgeFloor: 0.85,
  edgeCeil: 1.0,
} as const;

/** The custom property each UI token owns, so the sync audit can hold stylesheet and module together. */
export const UI_VARS = {
  '--ink': UI.ink,
  '--ink-dim': UI.inkDim,
  '--panel': UI.panel,
  '--panel-edge': UI.panelEdge,
  '--amber': UI.amber,
  '--amber-deep': UI.amberDeep,
  '--cyan': UI.cyan,
  '--danger': UI.danger,
  '--paper': BRAND.paper,
  '--ui-bg': UI.bg,
  '--btn-top': BUTTON.top,
  '--btn-ink': BUTTON.ink,
  '--btn-rim-60': 'rgba(255, 226, 170, 0.6)',
  '--success': STATE.success,
  '--cyan-pale': STATE.cyanPale,
  '--ink-on-light': STATE.inkOnLight,
  '--night-hi': STATE.nightHi,
  '--night-lo': STATE.nightLo,
  '--panel-deep': STATE.panelDeep,
  '--panel-dusk': STATE.panelDusk,
  '--cyan-ink': STATE.cyanInk,
  '--gold-ink': STATE.goldInk,
  '--night-radial-hi': STATE.nightRadialHi,
  '--night-radial-lo': STATE.nightRadialLo,
  '--night-deep': STATE.nightDeep,
  '--swatch-mine': STATE.swatchMine,
  '--swatch-friend': STATE.swatchFriend,
  '--grade-b': GRADE_LADDER.b,
  '--grade-a': GRADE_LADDER.a,
  '--grade-s': GRADE_LADDER.s,
  '--grade-ss': GRADE_LADDER.ss,
  '--grade-sss': GRADE_LADDER.sss,
  '--white-ink': UI.white,
  '--black-mask': UI.black,
} as const;
