import { Emitter } from '@/core/emitter';
import { clamp } from '@/core/mathx';
import { COSMETIC_IDS, DEFAULT_FIELD_ID, DEFAULT_SKIN_ID, isGrade, type GradeName } from '@/config/cosmetics';
import { sanitizeKeys } from '@/input/keymap';
import { cleanName } from '@/sim/ghost-code';
import { DEFAULT_SETTINGS, UI_SCALES, type Settings, type UiScale } from './settings';

export const SAVE_VERSION = 2;
const MAX_GHOST_CHARS = 60_000;
const MAX_GHOSTS = 90;
const MAX_TALLIES = 128;
const MAX_FLAGS = 32;
const STORAGE_KEY = 'magnetope.save';

export interface BestFall {
  heightMeters: number;
  grade: string;
}

/** Same-day clear tally per level, for the replay decay (R-EC-10). */
export interface ClearTally {
  /** The calendar day the tally counts, local time. */
  day: string;
  clears: number;
}

export interface FriendGhost {
  name: string;
  /** Encoded track, in the same form as a personal ghost. */
  ghost: string;
}

export interface SaveData {
  version: number;
  stars: Record<string, number>;
  bestMs: Record<string, number>;
  scrap: number;
  owned: string[];
  equipped: { skin: string; field: string };
  bestFall: BestFall | null;
  /** Best fall grade per level, shown as a badge on the map. */
  bestGrade: Record<string, GradeName>;
  /** Encoded personal ghosts, one per level. */
  ghosts: Record<string, string>;
  /** The same-day clear tally per level the replay decay reads (R-EC-10). */
  clearTally: Record<string, ClearTally>;
  /** The ghost a friend shared for each level, with the name it arrived under. */
  friends: Record<string, FriendGhost>;
  /** The name that travels with the player's own ghost codes. */
  alias: string;
  /** One-time flags: tutorial coach, staged HUD reveals. */
  seen: string[];
  settings: Settings;
}

export interface KeyValueBackend {
  read(): string | null;
  write(value: string): void;
}

/** localStorage, probed on construction because private modes throw on access. */
export class LocalBackend implements KeyValueBackend {
  private constructor(private readonly storage: Storage) {}

  static tryCreate(): LocalBackend | null {
    try {
      const storage = globalThis.localStorage;
      if (!storage) return null;
      const probe = `${STORAGE_KEY}.probe`;
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return new LocalBackend(storage);
    } catch {
      return null;
    }
  }

  read(): string | null {
    return this.storage.getItem(STORAGE_KEY);
  }

  write(value: string): void {
    this.storage.setItem(STORAGE_KEY, value);
  }
}

export class MemoryBackend implements KeyValueBackend {
  private value: string | null = null;

  read(): string | null {
    return this.value;
  }

  write(value: string): void {
    this.value = value;
  }
}

export const freshSave = (): SaveData => ({
  version: SAVE_VERSION,
  stars: {},
  bestMs: {},
  scrap: 0,
  owned: [DEFAULT_SKIN_ID, DEFAULT_FIELD_ID],
  equipped: { skin: DEFAULT_SKIN_ID, field: DEFAULT_FIELD_ID },
  bestFall: null,
  bestGrade: {},
  ghosts: {},
  clearTally: {},
  friends: {},
  alias: '',
  seen: [],
  settings: { ...DEFAULT_SETTINGS },
});

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const numberMap = (v: unknown, lo: number, hi: number): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!isRecord(v)) return out;
  for (const [key, value] of Object.entries(v)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = clamp(Math.round(value), lo, hi);
  }
  return out;
};

/** Rebuilds a save from untrusted JSON, keeping what is valid and defaulting the rest. */
export function sanitizeSave(raw: unknown): SaveData {
  const base = freshSave();
  if (!isRecord(raw)) return base;

  const settings = isRecord(raw.settings) ? raw.settings : {};
  const s = base.settings;
  const bool = (key: keyof Settings, fallback: boolean): boolean =>
    typeof settings[key] === 'boolean' ? (settings[key] as boolean) : fallback;

  const aim = settings.aimMode;
  const layout = settings.touchLayout;
  base.settings = {
    sound: bool('sound', s.sound),
    music: bool('music', s.music),
    language: typeof settings.language === 'string' ? settings.language.slice(0, 8) : s.language,
    assist: bool('assist', s.assist),
    reducedMotion: bool('reducedMotion', s.reducedMotion),
    uiScale: (UI_SCALES as readonly number[]).includes(Number(settings.uiScale)) ? (settings.uiScale as UiScale) : s.uiScale,
    aimMode: aim === 'keyboard' || aim === 'mouse' || aim === 'auto' ? aim : s.aimMode,
    touchLayout: layout === 'single' || layout === 'split' ? layout : s.touchLayout,
    touchSensitivity:
      typeof settings.touchSensitivity === 'number' ? clamp(settings.touchSensitivity, 0.5, 1.5) : s.touchSensitivity,
    rimTint: bool('rimTint', s.rimTint),
    ghosts: bool('ghosts', s.ghosts),
    keys: sanitizeKeys(settings.keys),
  };

  base.stars = numberMap(raw.stars, 0, 3);
  base.bestMs = numberMap(raw.bestMs, 1, 3_600_000);
  base.scrap = typeof raw.scrap === 'number' && Number.isFinite(raw.scrap) ? clamp(Math.floor(raw.scrap), 0, 9_999_999) : 0;

  if (Array.isArray(raw.owned)) {
    const owned = raw.owned.filter((id): id is string => typeof id === 'string' && COSMETIC_IDS.has(id));
    base.owned = [...new Set([...base.owned, ...owned])];
  }
  if (isRecord(raw.equipped)) {
    const { skin, field } = raw.equipped;
    if (typeof skin === 'string' && base.owned.includes(skin)) base.equipped.skin = skin;
    if (typeof field === 'string' && base.owned.includes(field)) base.equipped.field = field;
  }
  if (isRecord(raw.bestFall) && typeof raw.bestFall.heightMeters === 'number' && typeof raw.bestFall.grade === 'string') {
    base.bestFall = { heightMeters: clamp(raw.bestFall.heightMeters, 0, 5000), grade: raw.bestFall.grade.slice(0, 3) };
  }

  if (isRecord(raw.bestGrade)) {
    for (const [level, grade] of Object.entries(raw.bestGrade)) if (isGrade(grade)) base.bestGrade[level.slice(0, 40)] = grade;
  }
  if (isRecord(raw.ghosts)) {
    const entries = Object.entries(raw.ghosts).filter(([, v]) => typeof v === 'string' && v.length <= MAX_GHOST_CHARS);
    for (const [level, encoded] of entries.slice(0, MAX_GHOSTS)) base.ghosts[level.slice(0, 40)] = encoded as string;
  }
  if (isRecord(raw.clearTally)) {
    const entries = Object.entries(raw.clearTally).slice(0, MAX_TALLIES);
    for (const [level, entry] of entries) {
      if (!isRecord(entry) || typeof entry.day !== 'string' || typeof entry.clears !== 'number') continue;
      base.clearTally[level.slice(0, 40)] = { day: entry.day.slice(0, 10), clears: clamp(Math.round(entry.clears), 0, 999) };
    }
  }
  if (isRecord(raw.friends)) {
    const entries = Object.entries(raw.friends).slice(0, MAX_GHOSTS);
    for (const [level, entry] of entries) {
      if (!isRecord(entry) || typeof entry.ghost !== 'string' || entry.ghost.length > MAX_GHOST_CHARS) continue;
      base.friends[level.slice(0, 40)] = { name: cleanName(String(entry.name ?? ''), 'Friend'), ghost: entry.ghost };
    }
  }
  if (typeof raw.alias === 'string') base.alias = cleanName(raw.alias);
  if (Array.isArray(raw.seen)) {
    const flags = raw.seen.filter((f): f is string => typeof f === 'string' && f.length <= 24);
    base.seen = [...new Set(flags)].slice(0, MAX_FLAGS);
  }
  return base;
}

export interface SaveEvents {
  /** Persistence became unavailable; the UI shows a single soft toast. */
  degraded: Record<string, never>;
  changed: SaveData;
}

/**
 * Save game with graceful degradation: if the primary backend cannot be read or
 * written (incognito, quota, blocked storage) the store keeps working in memory.
 */
export class SaveStore {
  readonly events = new Emitter<SaveEvents>();
  private backend: KeyValueBackend;
  private memoryOnly: boolean;
  private current: SaveData;

  constructor(primary: KeyValueBackend | null = LocalBackend.tryCreate()) {
    this.memoryOnly = primary === null;
    this.backend = primary ?? new MemoryBackend();
    this.current = this.load();
  }

  get data(): Readonly<SaveData> {
    return this.current;
  }

  get persistent(): boolean {
    return !this.memoryOnly;
  }

  update(mutate: (draft: SaveData) => void): void {
    const draft = structuredClone(this.current);
    mutate(draft);
    this.current = sanitizeSave(draft);
    this.persist();
    this.events.emit('changed', this.current);
  }

  private load(): SaveData {
    try {
      const raw = this.backend.read();
      if (!raw) return freshSave();
      return sanitizeSave(JSON.parse(raw));
    } catch {
      return freshSave();
    }
  }

  private persist(): void {
    try {
      this.backend.write(JSON.stringify(this.current));
    } catch {
      this.degrade();
    }
  }

  private degrade(): void {
    if (this.memoryOnly) return;
    this.memoryOnly = true;
    const fallback = new MemoryBackend();
    fallback.write(JSON.stringify(this.current));
    this.backend = fallback;
    this.events.emit('degraded', {});
  }
}
