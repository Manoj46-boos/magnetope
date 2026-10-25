import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BiomeId } from '@/sim/types';
import { MATERIALS } from '@/config/materials';
import { CROSSFADE_TAU } from '@/audio/music';
import {
  AIR_CELLS,
  BASS_CELLS,
  CELLS,
  CELL_STEPS,
  MAGNO_MOTIF,
  MEL_CELLS,
  TREATMENTS,
  airRotation,
  degreeSemitones,
  isThinAir,
  passOctave,
  percMaterial,
} from '@/audio/score';
import { SCORES } from '@/audio/mix';

/**
 * The composition's own laws (R-AU-01…04, R-AU-12): the motif one shape every
 * key spells, the cells each stem rotates, the five harmonizations and the junk
 * each biome keeps the beat with, the thin-air level, and the crossfade law —
 * all held to the data the score is actually built from.
 */

const here = resolve(__dirname, '..');
const BIOMES = Object.keys(SCORES) as BiomeId[];

describe('the MAGNO motif (R-AU-01)', () => {
  it('is five notes, one rising contour, the fifth wrapping to the octave', () => {
    expect(MAGNO_MOTIF).toHaveLength(5);
    for (const biome of BIOMES) {
      const scale = SCORES[biome].scale;
      const notes = MAGNO_MOTIF.map((d) => degreeSemitones(scale, d));
      expect(notes[4], `${biome} resolves on the octave`).toBe(scale[0]! + 12);
      for (let i = 1; i < 5; i++) expect(notes[i]!, `${biome} climbs`).toBeGreaterThan(notes[i - 1]!);
    }
  });

  it('is the first thing the melody says, and the bass shadows it (the boot hum)', () => {
    expect(MEL_CELLS[0]!.degrees.slice(0, 5)).toEqual([...MAGNO_MOTIF]);
    expect(MEL_CELLS[0]!.steps.slice(0, 5)).toEqual([0, 4, 8, 12, 16]);
    expect(BASS_CELLS.some((cell) => cell.degrees.slice(0, 5).join() === MAGNO_MOTIF.join())).toBe(true);
  });
});

describe('the five harmonizations (R-AU-03)', () => {
  it('gives every biome one treatment, each with its own character', () => {
    expect(Object.keys(TREATMENTS)).toEqual(BIOMES);
    expect(new Set(Object.values(TREATMENTS).map((t) => t.character)).size).toBe(BIOMES.length);
  });

  it('keeps the beat with each biome\u2019s own junk — real materials, real voices (R-AU-04)', () => {
    for (const biome of BIOMES) {
      const perc = TREATMENTS[biome].perc;
      expect(perc.length, `${biome} has a band`).toBeGreaterThan(0);
      for (const id of perc) {
        expect(MATERIALS[id], `${biome} names ${id}`).toBeTruthy();
        expect(MATERIALS[id].voice).toBeTruthy();
      }
    }
    expect(new Set(Object.values(TREATMENTS).map((t) => t.perc.join('+'))).size).toBe(BIOMES.length);
  });
});

describe('the cell vocabulary (R-AU-02)', () => {
  it('is two-to-four-bar cells, every note on the grid, ascending in its cell', () => {
    expect(CELL_STEPS).toBe(32);
    const note = (cell: { steps: readonly number[]; degrees: readonly number[] }) => {
      expect(cell.steps.length).toBe(cell.degrees.length);
      expect(cell.steps[0]!).toBe(0);
      for (let i = 1; i < cell.steps.length; i++) expect(cell.steps[i]!).toBeGreaterThan(cell.steps[i - 1]!);
    };
    for (const cell of MEL_CELLS) note(cell);
    for (const cell of BASS_CELLS) note(cell);
    for (const stem of CELLS.perc) expect((stem as { steps: readonly number[] }).steps.every((s) => s < CELL_STEPS)).toBe(true);
    for (const cell of AIR_CELLS) expect(cell.rotate).toBeLessThan(2);
  });

  it('rotates more than one cell per stem, so no cue is a fixed loop', () => {
    for (const stem of Object.values(CELLS)) expect(stem.length).toBeGreaterThanOrEqual(2);
  });

  it('never repeats a cell as itself: the octave alternates by the pass, the junk walks round-robin', () => {
    expect(passOctave(0)).toBe(0);
    expect(passOctave(1)).toBe(12);
    expect(passOctave(2)).toBe(0);
    const band = TREATMENTS.scrapyard.perc;
    expect(percMaterial(band, 0, 0)).toBe(band[0]);
    expect(percMaterial(band, 1, 0)).toBe(band[1]);
    expect(percMaterial(band, 0, 1)).toBe(band[1]);
    expect(airRotation(1, 2)).toBe(3);
  });

  it('crossfades well inside the half-second law', () => {
    expect(CROSSFADE_TAU).toBeLessThanOrEqual(0.5);
  });
});

describe('silence is composed (R-AU-12)', () => {
  it('is the Stratosphere\u2019s first level alone that runs the air stem', () => {
    expect(isThinAir('stratosphere-01')).toBe(true);
    expect(isThinAir('stratosphere-02')).toBe(false);
    expect(isThinAir('stratosphere-14')).toBe(false);
    expect(isThinAir('scrapyard-00')).toBe(false);
  });
});

describe('the zero-bytes law (R-AU-04, the payload law)', () => {
  it('loads no sample, ever — the whole audio stack is synthesis', () => {
    const forbidden = [/\.(mp3|ogg|wav|flac|m4a)\b/i, /new Audio\(/, /decodeAudioData/, /XMLHttpRequest/];
    const files = ['engine.ts', 'music.ts', 'mix.ts', 'recipes.ts', 'director.ts', 'continuous.ts', 'intensity.ts', 'score.ts', 'stingers.ts'];
    for (const file of files) {
      const source = readFileSync(resolve(here, `src/audio/${file}`), 'utf8');
      for (const pattern of forbidden) expect(source.match(pattern), `${file} reaches for a sample`).toBeNull();
    }
  });
});
