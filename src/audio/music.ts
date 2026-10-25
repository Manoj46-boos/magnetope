import { Rng } from '@/core/rng';
import type { BiomeId } from '@/sim/types';
import { MATERIALS } from '@/config/materials';
import type { AudioEngine } from './engine';
import { fromDb } from './engine';
import { SCORES, semitones, stemMix, stepSeconds, type BiomeScore, type MusicState } from './mix';
import {
  AIR_CELLS,
  BASS_CELLS,
  CELLS,
  CELL_STEPS,
  MAGNO_MOTIF,
  MEL_CELLS,
  PERC_CELLS,
  TREATMENTS,
  airRotation,
  degreeSemitones,
  isThinAir,
  passOctave,
  percMaterial,
  type StemName,
} from './score';
import { playAttach } from './recipes';

const LOOKAHEAD = 0.16;
/** R-AU-02: the crossfade law is a half second; the score changes hands in a tenth of it. Published for the doc spine. */
export const CROSSFADE_TAU = 0.1;
/** R-AU-04: how hard the junk plays when the score strikes it — a drum, not a collision. */
const PERC_HIT_LEVEL = 0.58;

interface StemState {
  cell: number;
  pass: number;
}

/**
 * Generative adaptive score, built the Phillips/Korb/Prunty way (R-AU-02): four
 * stems — melody, bass, percussion, air — each rotating its own two-to-four-bar
 * cells, crossed by three tiers the run earns. The percussion is the junk
 * orchestra (R-AU-04): every hit is one of the biome's own material voices,
 * the same recipes the physics plays, so the world keeps its own beat. Nothing
 * here is a recording; every note is synthesised from the biome's single key,
 * so any combination is consonant.
 */
export class MusicPlayer {
  private layerFilter: BiquadFilterNode | null = null;
  /** R-AU-08: the parity trim sits after the stems, one gain per biome's measured programme level. */
  private trim: GainNode | null = null;
  private stems: { mel: GainNode; bass: GainNode; perc: GainNode; air: GainNode } | null = null;
  private score: BiomeScore = SCORES.scrapyard;
  private treatment = TREATMENTS.scrapyard;
  private thinAir = false;
  private ending = false;
  private nextStepTime = 0;
  private stepAt = 0;
  private started = false;
  private readonly rotation: Record<StemName, StemState> = {
    mel: { cell: 0, pass: 0 },
    bass: { cell: 0, pass: 0 },
    perc: { cell: 0, pass: 0 },
    air: { cell: 0, pass: 0 },
  };
  /** R-AU-10: the take jitter — every repeated note is a performance, never a trigger. */
  private readonly take = new Rng(0x9e37);
  private readonly played: Record<StemName, number> = { mel: 0, bass: 0, perc: 0, air: 0 };
  private percHit = 0;

  constructor(private readonly engine: AudioEngine) {}

  setBiome(biome: BiomeId, levelId?: string): void {
    this.score = SCORES[biome];
    this.treatment = TREATMENTS[biome];
    // R-AU-12: the Stratosphere teaches its thin air with the score's own silence.
    this.thinAir = levelId !== undefined && isThinAir(levelId);
    if (this.trim && this.engine.ctx) this.trim.gain.value = fromDb(this.treatment.trimDb);
  }

  get tonicHz(): number {
    return this.score.tonicHz;
  }

  /** R-AU-01: the five motif notes, in the key the game is currently in. */
  get motifHz(): readonly number[] {
    return MAGNO_MOTIF.map((i) => semitones(this.score.tonicHz * 4, degreeSemitones(this.score.scale, i)));
  }

  /** R-AU-02: the audit counter — how many cells each stem has played this session. */
  get cellsPlayed(): Readonly<Record<StemName, number>> {
    return this.played;
  }

  /** R-AU-12 (Wintory): the ending is through-composed — the cue owns the film, the score stands down. */
  setEnding(on: boolean): void {
    this.ending = on;
  }

  private build(): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('music');
    if (!ctx || !bus) return;
    this.trim = ctx.createGain();
    this.trim.gain.value = fromDb(this.treatment.trimDb);
    this.trim.connect(bus);
    this.layerFilter = ctx.createBiquadFilter();
    this.layerFilter.type = 'lowpass';
    this.layerFilter.frequency.value = 14000;
    this.layerFilter.Q.value = 0.5;
    this.layerFilter.connect(this.trim);
    const make = (): GainNode => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.layerFilter!);
      return g;
    };
    this.stems = { mel: make(), bass: make(), perc: make(), air: make() };
    this.nextStepTime = ctx.currentTime + 0.1;
    this.started = true;
  }

  update(state: MusicState): void {
    if (!this.engine.audible) return;
    if (!this.started) this.build();
    const ctx = this.engine.ctx;
    if (!ctx || !this.stems || !this.layerFilter) return;

    const mix = stemMix(state);
    const t = ctx.currentTime;
    const gains = this.ending
      ? { mel: 0, bass: 0, perc: 0, air: 0 }
      : this.thinAir
        ? { mel: 0, bass: 0, perc: 0, air: mix.air }
        : mix;
    this.stems.mel.gain.setTargetAtTime(gains.mel, t, CROSSFADE_TAU);
    this.stems.bass.gain.setTargetAtTime(gains.bass, t, CROSSFADE_TAU);
    this.stems.perc.gain.setTargetAtTime(gains.perc, t, CROSSFADE_TAU);
    this.stems.air.gain.setTargetAtTime(gains.air, t, CROSSFADE_TAU);
    this.layerFilter.frequency.setTargetAtTime(mix.cutoffHz, t, 0.08);

    const len = stepSeconds(this.score.bpm, mix.tempo);
    while (this.nextStepTime < t + LOOKAHEAD) {
      this.scheduleStep(this.nextStepTime, len);
      this.nextStepTime += len;
      this.stepAt++;
    }
  }

  /** Advances a stem's rotation at its cell boundary; the pass counts full cycles of the vocabulary. */
  private advance(name: StemName): void {
    const stem = this.rotation[name];
    stem.cell = (stem.cell + 1) % CELLS[name].length;
    if (stem.cell === 0) stem.pass++;
    this.played[name]++;
  }

  private scheduleStep(at: number, len: number): void {
    const ctx = this.engine.ctx;
    const stems = this.stems;
    if (!ctx || !stems) return;
    const abs = this.stepAt;
    const pos = abs % CELL_STEPS;
    const { tonicHz, scale, chord } = this.score;

    // The stems whose cells are two bars turn at the shared boundary.
    if (pos === 0 && abs > 0) {
      this.advance('mel');
      this.advance('bass');
      this.advance('perc');
    }

    const mel = MEL_CELLS[this.rotation.mel.cell]!;
    const melAt = mel.steps.indexOf(pos);
    if (melAt >= 0) {
      const semis = degreeSemitones(scale, mel.degrees[melAt]!) + passOctave(this.rotation.mel.pass);
      this.pluck(stems.mel, at, semitones(tonicHz * 4, semis), len * 3.5 * this.take.range(0.9, 1.1));
    }

    const bass = BASS_CELLS[this.rotation.bass.cell]!;
    const bassAt = bass.steps.indexOf(pos);
    if (bassAt >= 0) {
      const semis = degreeSemitones(scale, bass.degrees[bassAt]!);
      this.bassNote(stems.bass, at, semitones(tonicHz, semis), len * 4 * this.take.range(0.9, 1.1));
    }

    const perc = PERC_CELLS[this.rotation.perc.cell]!;
    if (perc.steps.includes(pos)) {
      const material = percMaterial(this.treatment.perc, this.percHit++, this.rotation.perc.pass);
      playAttach(this.engine, MATERIALS[material].voice, PERC_HIT_LEVEL, 1, 'music', at, stems.perc);
    }

    const airPos = abs % (CELL_STEPS * 2);
    if (airPos === 0 && abs > 0) this.advance('air');
    if (airPos === 0) {
      const cell = AIR_CELLS[this.rotation.air.cell]!;
      const rot = airRotation(cell.rotate, this.rotation.air.pass) % chord.length;
      const voicing = [...chord.slice(rot), ...chord.slice(0, rot).map((n) => n + 12)];
      for (const n of voicing) this.pad(stems.air, at, semitones(tonicHz * 2, n), len * CELL_STEPS * 2);
    }
  }

  private bassNote(dest: GainNode, at: number, hz: number, length: number): void {
    const ctx = this.engine.ctx!;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = hz;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(700, at);
    f.frequency.exponentialRampToValueAtTime(160, at + length);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.92, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    o.connect(f);
    f.connect(g);
    g.connect(dest);
    o.start(at);
    o.stop(at + length + 0.02);
  }

  private pluck(dest: GainNode, at: number, hz: number, length: number): void {
    const ctx = this.engine.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.64, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    o.connect(g);
    g.connect(dest);
    o.start(at);
    o.stop(at + length + 0.02);
  }

  private pad(dest: GainNode, at: number, hz: number, length: number): void {
    const ctx = this.engine.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.52, at + length * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    f.connect(g);
    g.connect(dest);
    for (const detune of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz;
      o.detune.value = detune;
      o.connect(f);
      o.start(at);
      o.stop(at + length + 0.05);
    }
  }
}

export type { MusicState };
