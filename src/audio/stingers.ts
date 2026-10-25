/**
 * The stinger grammar (R-AU-05, O'Donnell): one musical word per verdict, held
 * to its own mix slot, never stacked. Every row is law — the recipe named here
 * is the voice that speaks the moment, and the length is the longest the word
 * may hold the stage. The star ceremony is one word said in stamps: the card's
 * own rhythm spaces them, the par coda and the ghost toast answer the last
 * stamp, and the spectacular fall keeps the stage clear for MAGNO's own
 * deadpan — the silence is the sting (Ch. 20.4's comedy law).
 */

export type StingerKind = 'clear' | 'star-stamp' | 'par-beat' | 'ghost-set' | 'fall-verdict' | 'biome-enter';

export interface StingerDef {
  kind: StingerKind;
  /** The moment that owns the word. */
  trigger: string;
  /** The recipe that speaks it, as it exists in the audio modules. */
  voice: string;
  /** R-AU-05: the grammar's own limit — a word is short, ≤ 1.5 s. */
  maxS: number;
}

export const STINGERS: readonly StingerDef[] = [
  { kind: 'clear', trigger: 'the summit — the clear card is coming', voice: 'playFanfare', maxS: 1.5 },
  { kind: 'star-stamp', trigger: 'each earned star lands on the clear card', voice: 'playStarStamp', maxS: 0.26 },
  { kind: 'par-beat', trigger: 'the last star of a clear that beat par', voice: 'playParCall', maxS: 0.3 },
  { kind: 'ghost-set', trigger: 'the run recorded as the level\u2019s own ghost', voice: 'playGhostSet', maxS: 0.5 },
  { kind: 'fall-verdict', trigger: 'the fall card, for the small grades — the spectacular ones keep the stage for MAGNO\u2019s deadpan', voice: 'playFallTopper', maxS: 0.35 },
  { kind: 'biome-enter', trigger: 'the biome card — the motif, re-harmonized', voice: 'playBiomeCall', maxS: 1.4 },
];
