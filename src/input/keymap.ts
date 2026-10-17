/**
 * Keyboard bindings (PRD table 4.2: every control is remappable). Bindings are
 * physical key codes, so a layout change never moves an action, and each action
 * holds one or two of them. Escape is not part of the map: it always pauses,
 * because Poki's QA presses it to check the pause path.
 */

export const KEY_ACTIONS = ['flip', 'left', 'right', 'up', 'down', 'pause', 'retry'] as const;
export type KeyAction = (typeof KEY_ACTIONS)[number];

export type KeyBindings = Readonly<Record<KeyAction, readonly string[]>>;

export const KEYS_PER_ACTION = 2;
export const ALWAYS_PAUSES = 'Escape';

export const DEFAULT_KEYS: KeyBindings = Object.freeze({
  flip: Object.freeze(['Space', 'KeyJ']),
  left: Object.freeze(['KeyA', 'ArrowLeft']),
  right: Object.freeze(['KeyD', 'ArrowRight']),
  up: Object.freeze(['KeyW', 'ArrowUp']),
  down: Object.freeze(['KeyS', 'ArrowDown']),
  pause: Object.freeze(['KeyP']),
  retry: Object.freeze(['KeyR']),
});

/** Keys that stay with the page: Enter and Tab drive the menus, function keys and the OS keys belong to the browser. */
const BINDABLE = /^(Key[A-Z]|Digit\d|Numpad(\d|Add|Subtract|Multiply|Divide|Decimal)|Arrow(Up|Down|Left|Right)|Space|Minus|Equal|Bracket(Left|Right)|Backslash|IntlBackslash|Semicolon|Quote|Comma|Period|Slash|Backquote|Shift(Left|Right))$/;

export const isBindable = (code: string): boolean => BINDABLE.test(code);

export type RebindFailure = 'reserved' | 'last-key';

export type RebindResult =
  | { ok: true; keys: KeyBindings; displaced: KeyAction | null }
  | { ok: false; reason: RebindFailure };

const copy = (keys: KeyBindings): Record<KeyAction, string[]> => {
  const out = {} as Record<KeyAction, string[]>;
  for (const action of KEY_ACTIONS) out[action] = [...keys[action]];
  return out;
};

export function actionOf(keys: KeyBindings, code: string): KeyAction | null {
  for (const action of KEY_ACTIONS) if (keys[action].includes(code)) return action;
  return null;
}

/** Code to action, for the input layer's per-event lookup. */
export function buildLookup(keys: KeyBindings): ReadonlyMap<string, KeyAction> {
  const map = new Map<string, KeyAction>();
  for (const action of KEY_ACTIONS) for (const code of keys[action]) map.set(code, action);
  return map;
}

export const isDefaultKeys = (keys: KeyBindings): boolean =>
  KEY_ACTIONS.every((action) => keys[action].length === DEFAULT_KEYS[action].length && keys[action].every((code, i) => code === DEFAULT_KEYS[action][i]));

/**
 * Puts `code` on one slot of `action`. A key that already drives another action
 * swaps places with it; a key the action already holds swaps its two slots. An
 * action can never be left without a key.
 */
export function rebind(keys: KeyBindings, action: KeyAction, slot: number, code: string): RebindResult {
  if (!isBindable(code)) return { ok: false, reason: 'reserved' };
  const next = copy(keys);
  const mine = next[action];
  const target = Math.min(Math.max(slot, 0), mine.length);
  if (mine[target] === code) return { ok: true, keys, displaced: null };

  const owner = actionOf(keys, code);
  if (owner === action) {
    const from = mine.indexOf(code);
    if (mine[target] === undefined) return { ok: true, keys, displaced: null };
    [mine[from], mine[target]] = [mine[target]!, mine[from]!];
    return { ok: true, keys: next, displaced: null };
  }

  if (owner !== null) {
    const theirs = next[owner];
    const at = theirs.indexOf(code);
    const previous = mine[target];
    if (previous !== undefined) {
      theirs[at] = previous;
    } else if (theirs.length > 1) {
      theirs.splice(at, 1);
    } else {
      return { ok: false, reason: 'last-key' };
    }
  }
  mine[target] = code;
  return { ok: true, keys: next, displaced: owner };
}

/** Empties the second slot of an action. The first slot always keeps a key. */
export function clearSlot(keys: KeyBindings, action: KeyAction, slot: number): KeyBindings | null {
  if (slot < 1 || slot >= keys[action].length) return null;
  const next = copy(keys);
  next[action].splice(slot, 1);
  return next;
}

/**
 * Rebuilds bindings from untrusted JSON. A layout that is incomplete or has one
 * key on two actions is dropped whole, so a damaged save never half-applies.
 */
export function sanitizeKeys(raw: unknown): KeyBindings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_KEYS;
  const source = raw as Record<string, unknown>;
  const next = {} as Record<KeyAction, string[]>;
  const seen = new Set<string>();
  for (const action of KEY_ACTIONS) {
    const list = source[action];
    if (!Array.isArray(list)) return DEFAULT_KEYS;
    const codes: string[] = [];
    for (const code of list.slice(0, KEYS_PER_ACTION)) {
      if (typeof code !== 'string' || !isBindable(code) || seen.has(code)) return DEFAULT_KEYS;
      seen.add(code);
      codes.push(code);
    }
    if (codes.length === 0) return DEFAULT_KEYS;
    next[action] = codes;
  }
  return isDefaultKeys(next) ? DEFAULT_KEYS : next;
}

const PUNCTUATION: Readonly<Record<string, string>> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  IntlBackslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  NumpadAdd: '+',
  NumpadSubtract: '-',
  NumpadMultiply: '*',
  NumpadDivide: '/',
  NumpadDecimal: '.',
};

const ARROWS: Readonly<Record<string, string>> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };

export interface LayoutMap {
  get(code: string): string | undefined;
}

/**
 * What to print on a key cap. The layout map (where the browser offers one)
 * names the character the player's own keyboard puts on that key, so the
 * default W reads Z on a French board.
 */
export function keyLabel(code: string, spaceName = 'Space', layout: LayoutMap | null = null): string {
  const arrow = ARROWS[code];
  if (arrow) return arrow;
  if (code === 'Space') return spaceName;
  if (code === 'ShiftLeft') return 'L Shift';
  if (code === 'ShiftRight') return 'R Shift';
  const numpad = /^Numpad(\d)$/.exec(code);
  if (numpad) return `Num ${numpad[1]}`;
  if (code.startsWith('Numpad')) return `Num ${PUNCTUATION[code] ?? ''}`.trim();

  const printed = layout?.get(code);
  if (printed && printed.length === 1) return printed.toUpperCase();
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return PUNCTUATION[code] ?? code;
}
