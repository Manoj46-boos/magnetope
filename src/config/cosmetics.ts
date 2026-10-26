import type { BiomeId } from '@/sim/types';

/**
 * The launch locker (PRD 5.8, 13.2): 24 cosmetics plus the two classic defaults.
 * Twelve are bought with Scrap, eight are earned by playing, four are seasonal.
 * Looks are plain hex data so the runtime, the locker preview and the tests all
 * read the same table.
 */

export type CosmeticKind = 'skin' | 'field';
export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type GradeName = 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';

export const GRADE_ORDER: readonly GradeName[] = ['C', 'B', 'A', 'S', 'SS', 'SSS'];

export type Requirement =
  | { type: 'stars'; count: number }
  | { type: 'clears'; count: number }
  | { type: 'perfect'; count: number }
  | { type: 'grade'; atLeast: GradeName }
  | { type: 'level'; id: string };

export type Acquire =
  | { how: 'default' }
  | { how: 'scrap'; price: number }
  | { how: 'reward'; requirement: Requirement }
  | { how: 'seasonal'; season: Season; price: number };

export type Accessory = 'antenna' | 'sticker' | 'flag';

export interface SkinLook {
  body: string;
  ring: string;
  socket: string;
  tip: string;
  accessory?: Accessory;
}

export interface FieldLook {
  attract: string;
  attractCore: string;
  repel: string;
  repelCore: string;
}

interface CosmeticBase {
  id: string;
  name: string;
  acquire: Acquire;
}

export interface SkinCosmetic extends CosmeticBase {
  kind: 'skin';
  look: SkinLook;
}

export interface FieldCosmetic extends CosmeticBase {
  kind: 'field';
  look: FieldLook;
}

export type Cosmetic = SkinCosmetic | FieldCosmetic;

export const DEFAULT_SKIN_ID = 'skin.classic';
export const DEFAULT_FIELD_ID = 'field.classic';

const skin = (id: string, name: string, acquire: Acquire, look: SkinLook): SkinCosmetic => ({ id, name, kind: 'skin', acquire, look });
const field = (id: string, name: string, acquire: Acquire, look: FieldLook): FieldCosmetic => ({ id, name, kind: 'field', acquire, look });
const scrap = (price: number): Acquire => ({ how: 'scrap', price });
const reward = (requirement: Requirement): Acquire => ({ how: 'reward', requirement });
const seasonal = (season: Season, price: number): Acquire => ({ how: 'seasonal', season, price });

/** Classic is tuned in the renderer's linear space; these are its on-screen equivalents for previews. */
export const CLASSIC_SKIN_LOOK: SkinLook = { body: '#bfc9d1', ring: '#f1f1f1', socket: '#4b5365', tip: '#f25d70' };
export const CLASSIC_FIELD_LOOK: FieldLook = { attract: '#60d7fb', attractCore: '#d8f9fd', repel: '#ff9b29', repelCore: '#fde8b4' };

export const COSMETICS: readonly Cosmetic[] = [
  skin(DEFAULT_SKIN_ID, 'Classic', { how: 'default' }, CLASSIC_SKIN_LOOK),
  field(DEFAULT_FIELD_ID, 'Classic', { how: 'default' }, CLASSIC_FIELD_LOOK),

  skin('skin.rust', 'Rustbucket', scrap(150), { body: '#b4673a', ring: '#d9c3a0', socket: '#2a1710', tip: '#3fb8b0' }),
  skin('skin.teal', 'Teal Tin', scrap(150), { body: '#3aa7a0', ring: '#e6f4f2', socket: '#0f2523', tip: '#ff7a45' }),
  skin('skin.cherry', 'Cherry Bolt', scrap(200), { body: '#d6414f', ring: '#f3e6e8', socket: '#2a1013', tip: '#ffd24a' }),
  skin('skin.mint', 'Mint Condition', scrap(200), { body: '#7fd6b0', ring: '#f0fff8', socket: '#14281f', tip: '#ff7c8e' }),
  skin('skin.cobalt', 'Cobalt Core', scrap(250), { body: '#3f63d8', ring: '#dfe6ff', socket: '#0f1530', tip: '#ffb347' }),
  skin('skin.violet', 'Violet Volt', scrap(300), { body: '#8a55d9', ring: '#eadfff', socket: '#1b1230', tip: '#5fe0d0' }),
  skin('skin.gold', 'Gold Plate', scrap(350), { body: '#d4a72c', ring: '#fff2c4', socket: '#2d2308', tip: '#c2332f' }),
  skin('skin.midnight', 'Midnight Mk II', scrap(400), { body: '#2b3446', ring: '#8ea0bd', socket: '#05070c', tip: '#5fd4ff' }),
  field('field.rose', 'Rose Quartz', scrap(150), { attract: '#ff6fb5', attractCore: '#ffd3ea', repel: '#2f8fff', repelCore: '#cfe2ff' }),
  field('field.lime', 'Limelight', scrap(200), { attract: '#b6f23c', attractCore: '#f0ffc0', repel: '#b45cff', repelCore: '#ecd4ff' }),
  field('field.ember', 'Ember', scrap(250), { attract: '#ff9040', attractCore: '#ffe0c0', repel: '#4aa8ff', repelCore: '#c8e4ff' }),
  field('field.ice', 'Glacier', scrap(300), { attract: '#8fe8ff', attractCore: '#f2fdff', repel: '#ff5c7a', repelCore: '#ffd0d8' }),

  skin('skin.sunny', 'Sunny Side', reward({ type: 'stars', count: 3 }), { body: '#f2c53d', ring: '#fff7d6', socket: '#2e2508', tip: '#e5484d' }),
  skin('skin.antenna', 'Antenna Pal', reward({ type: 'level', id: 'scrapyard-03' }), {
    body: '#8d9bb0',
    ring: '#e9edf2',
    socket: '#10151e',
    tip: '#ff5ca8',
    accessory: 'antenna',
  }),
  skin('skin.flag', 'Summit Flag', reward({ type: 'stars', count: 15 }), {
    body: '#5e8f6a',
    ring: '#e5f1e8',
    socket: '#0e1f14',
    tip: '#e5484d',
    accessory: 'flag',
  }),
  skin('skin.chrome', 'Mirror Chrome', reward({ type: 'perfect', count: 3 }), { body: '#c8d0da', ring: '#ffffff', socket: '#1a1f27', tip: '#9fb7ff' }),
  skin('skin.sticker', 'Slap Happy', reward({ type: 'grade', atLeast: 'A' }), {
    body: '#a68fd0',
    ring: '#f1ebfa',
    socket: '#171027',
    tip: '#ffb347',
    accessory: 'sticker',
  }),
  field('field.aurora', 'Aurora', reward({ type: 'stars', count: 34 }), { attract: '#3dffb0', attractCore: '#d4fff0', repel: '#c85cff', repelCore: '#f0d0ff' }),
  field('field.sparks', 'Spark Plug', reward({ type: 'grade', atLeast: 'S' }), { attract: '#fff06a', attractCore: '#fffbd0', repel: '#ff3cac', repelCore: '#ffd0ec' }),
  field('field.beacon', 'Beacon Gold', reward({ type: 'clears', count: 7 }), { attract: '#ffc94d', attractCore: '#fff1c4', repel: '#6a7bff', repelCore: '#d6dbff' }),

  skin('skin.frost', 'Frostbite', seasonal('winter', 300), { body: '#bfe6f7', ring: '#ffffff', socket: '#10222c', tip: '#6ec6ff' }),
  skin('skin.bloom', 'Spring Loaded', seasonal('spring', 300), { body: '#f4a6c8', ring: '#fff0f7', socket: '#2a1220', tip: '#7ad66f' }),
  skin('skin.sunburn', 'Beach Bolt', seasonal('summer', 300), { body: '#ff9f43', ring: '#fff0d8', socket: '#2b1608', tip: '#12b5cb' }),
  field('field.leaf', 'Leaf Pile', seasonal('autumn', 250), { attract: '#ffb347', attractCore: '#ffe6bd', repel: '#4fd18b', repelCore: '#cdf7e0' }),
];

export const COSMETIC_IDS: ReadonlySet<string> = new Set(COSMETICS.map((c) => c.id));

export const cosmeticById = (id: string): Cosmetic | undefined => COSMETICS.find((c) => c.id === id);

export interface CosmeticSet {
  /** The biome the set dresses; the locker reads its name from the locale. */
  biome: BiomeId;
  pieces: readonly Cosmetic[];
}

const SET_MEMBERS: Readonly<Record<BiomeId, readonly string[]>> = {
  scrapyard: ['skin.rust', 'skin.teal', 'skin.antenna', 'field.rose', 'field.ember'],
  suburbia: ['skin.mint', 'skin.cherry', 'skin.flag', 'field.lime', 'skin.sticker'],
  metropolis: ['skin.cobalt', 'skin.violet', 'skin.midnight', 'skin.chrome', 'field.beacon'],
  playground: ['skin.sunny', 'skin.gold', 'field.sparks', 'field.ice', 'skin.sunburn'],
  stratosphere: ['field.aurora', 'skin.frost', 'skin.bloom', 'field.leaf'],
};

/** The collection sets (R-EC-05): four to five looks a biome calls its own, so the shelf reads as five stories rather than one pile. */
export const SETS: readonly CosmeticSet[] = Object.entries(SET_MEMBERS).map(([biome, ids]) => ({
  biome: biome as BiomeId,
  pieces: ids.map((id) => cosmeticById(id)!),
}));

const SET_OF_ID = new Map<string, CosmeticSet>(SETS.flatMap((set) => set.pieces.map((piece) => [piece.id, set] as const)));

/** The set a look belongs to, or null for the timeless classics (R-EC-05). */
export const setOf = (item: Cosmetic): CosmeticSet | null => SET_OF_ID.get(item.id) ?? null;

const SPOTLIGHT_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SPOTLIGHT_POOL: readonly Cosmetic[] = COSMETICS.filter((c) => c.acquire.how === 'seasonal');

/** The look the spotlight features this week: free for its week, then the next seasonal in the rotation (R-RT-05, R-EC-03). */
export function spotlightOf(date: Date): Cosmetic {
  const week = Math.floor(date.getTime() / SPOTLIGHT_WEEK_MS);
  return SPOTLIGHT_POOL[week % SPOTLIGHT_POOL.length]!;
}

export const cosmeticsOfKind = <K extends CosmeticKind>(kind: K): Array<Extract<Cosmetic, { kind: K }>> =>
  COSMETICS.filter((c): c is Extract<Cosmetic, { kind: K }> => c.kind === kind);

export const gradeRank = (grade: string): number => GRADE_ORDER.indexOf(grade as GradeName);

export const isGrade = (value: unknown): value is GradeName => typeof value === 'string' && GRADE_ORDER.includes(value as GradeName);

export function seasonOf(date: Date): Season {
  const month = date.getMonth();
  if (month === 11 || month <= 1) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'autumn';
}
