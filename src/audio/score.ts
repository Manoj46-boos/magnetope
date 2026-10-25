import type { MaterialId } from '@/config/materials';
import type { BiomeId } from '@/sim/types';

/**
 * The compositional rules of the score (premium PRD W9): the MAGNO motif one
 * shape carried by every biome's key, the cell vocabulary each stem rotates
 * through, the per-biome treatment that maps the music onto the world's own
 * materials, and the one level where the score thins to its air stem. Pure
 * data and arithmetic — no Web Audio here, so every law is testable as
 * written.
 */

/** R-AU-01 (Kondo): the five-note identity, as indices into the biome's scale. */
export const MAGNO_MOTIF = [0, 1, 2, 3, 5] as const;

/** A sixteenth-note grid; 32 steps are two 4/4 bars, the smallest cell. */
export const CELL_STEPS = 32;

/** The wrap rule both the motif and the cells share: past the scale's end, add the octave. */
export const degreeSemitones = (scale: readonly number[], index: number): number =>
  scale[index % scale.length]! + (index >= scale.length ? 12 : 0);

export interface NoteCell {
  /** Which steps of the cell carry a note, ascending. */
  steps: readonly number[];
  /** The scale-degree each carried step plays. */
  degrees: readonly number[];
}

/**
 * The melody's four cells (R-AU-02, Phillips). Cell 0 is the motif statement,
 * so wherever a cue begins — boot, a rest after a settle — the identity is the
 * first thing the melody says.
 */
export const MEL_CELLS: readonly NoteCell[] = [
  { steps: [0, 4, 8, 12, 16, 24], degrees: [0, 1, 2, 3, 5, 3] },
  { steps: [0, 2, 4, 8, 10, 16, 18, 24], degrees: [5, 4, 3, 4, 2, 3, 1, 0] },
  { steps: [0, 2, 4, 6, 8, 12, 14, 16, 18, 20, 24, 28], degrees: [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 2] },
  { steps: [0, 16], degrees: [4, 5] },
];

/** The bass walks under the melody; cell 2 shadows the motif an octave down, the boot hum's own line. */
export const BASS_CELLS: readonly NoteCell[] = [
  { steps: [0, 8, 16, 24], degrees: [0, 0, 3, 0] },
  { steps: [0, 4, 8, 12, 16, 20, 24, 28], degrees: [0, 0, 2, 3, 0, 2, 4, 3] },
  { steps: [0, 4, 8, 12, 16], degrees: [0, 1, 2, 3, 5] },
];

/**
 * The percussion's hit maps (R-AU-02/04). Only the steps are authored here —
 * the voice of each hit is drawn from the biome's own materials, so the same
 * step map sounds different in every biome and the world plays the beat.
 */
export const PERC_CELLS: readonly { steps: readonly number[] }[] = [
  { steps: [0, 8, 16, 24] },
  { steps: [0, 6, 8, 16, 22, 24] },
  { steps: [0, 4, 8, 12, 16, 20, 24, 28] },
];

/** The air's two voicings (Raine's space): straight, then the root lifted an octave. */
export const AIR_CELLS: readonly { rotate: number }[] = [{ rotate: 0 }, { rotate: 1 }];

export type StemName = 'mel' | 'bass' | 'perc' | 'air';

/** Every stem's cell count, the rotation's own vocabulary. */
export const CELLS: Readonly<Record<StemName, readonly unknown[]>> = {
  mel: MEL_CELLS,
  bass: BASS_CELLS,
  perc: PERC_CELLS,
  air: AIR_CELLS,
};

export interface BiomeTreatment {
  /** R-AU-04 (Stocco): the biome's percussion, drawn from its own materials. */
  perc: readonly MaterialId[];
  /** R-AU-03 (Raine): the one-word treatment name for the doc and the panel. */
  character: 'jaunty' | 'breezy' | 'neon-pulse' | 'toy-box' | 'thin-air';
  /** R-AU-08 (Katz): the parity trim, measured on the five route renders, so every biome's programme sits at the law's one loudness. */
  trimDb: number;
}

/** One motif, five harmonizations: each biome's key already spells the shape, its junk plays the beat. */
export const TREATMENTS: Readonly<Record<BiomeId, BiomeTreatment>> = {
  scrapyard: { perc: ['locker', 'steel', 'appliance'], character: 'jaunty', trimDb: 2.55 },
  suburbia: { perc: ['wood', 'appliance'], character: 'breezy', trimDb: 2.95 },
  metropolis: { perc: ['dish', 'can', 'sheet'], character: 'neon-pulse', trimDb: 3.75 },
  playground: { perc: ['plastic', 'trampoline'], character: 'toy-box', trimDb: 2.7 },
  stratosphere: { perc: ['glass'], character: 'thin-air', trimDb: 0.7 },
};

/**
 * R-AU-12 (Wintory): the Stratosphere's first level runs the air stem alone —
 * thin-air quiet that teaches the ear the dynamics the ending's one
 * through-composed cue spends.
 */
export const THIN_AIR_LEVEL = 'stratosphere-01';

export const isThinAir = (levelId: string): boolean => levelId === THIN_AIR_LEVEL;

/**
 * The anti-identical law (R-AU-02): a cell may return, never as itself. The
 * melody alternates its octave on every pass, the air turns its inversion, the
 * percussion walks its materials — so two passes of one cell differ by
 * construction, and the take jitter (R-AU-10) does the rest.
 */
export const passOctave = (pass: number): number => (pass % 2 === 1 ? 12 : 0);

/** The air voicing for a pass: the chord rotated by the cell's own shape plus one step per pass. */
export const airRotation = (cellRotate: number, pass: number): number => cellRotate + pass;

/** The material a percussion hit plays: round-robin through the biome's own junk, by hit and by pass. */
export const percMaterial = (materials: readonly MaterialId[], hit: number, pass: number): MaterialId =>
  materials[(hit + pass) % materials.length]!;
