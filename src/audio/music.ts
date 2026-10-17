import type { BiomeId } from '@/sim/types';
import type { AudioEngine } from './engine';
import { SCORES, layerMix, semitones, stepSeconds, type BiomeScore, type MusicState } from './mix';

const LOOKAHEAD = 0.16;
const CROSSFADE_TAU = 0.1;

/**
 * Generative adaptive score. Every layer is synthesised from the biome's single
 * key, so any combination is consonant and nothing ships as a recording.
 */
export class MusicPlayer {
  private layerFilter: BiquadFilterNode | null = null;
  private layers: { ground: GainNode; layer1: GainNode; layer2: GainNode } | null = null;
  private score: BiomeScore = SCORES.scrapyard;
  private nextStepTime = 0;
  private step = 0;
  private started = false;

  constructor(private readonly engine: AudioEngine) {}

  setBiome(biome: BiomeId): void {
    this.score = SCORES[biome];
  }

  get tonicHz(): number {
    return this.score.tonicHz;
  }

  private build(): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('music');
    if (!ctx || !bus) return;
    this.layerFilter = ctx.createBiquadFilter();
    this.layerFilter.type = 'lowpass';
    this.layerFilter.frequency.value = 14000;
    this.layerFilter.Q.value = 0.5;
    this.layerFilter.connect(bus);
    const make = (): GainNode => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.layerFilter!);
      return g;
    };
    this.layers = { ground: make(), layer1: make(), layer2: make() };
    this.nextStepTime = ctx.currentTime + 0.1;
    this.started = true;
  }

  update(state: MusicState): void {
    if (!this.engine.audible) return;
    if (!this.started) this.build();
    const ctx = this.engine.ctx;
    if (!ctx || !this.layers || !this.layerFilter) return;

    const mix = layerMix(state);
    const t = ctx.currentTime;
    this.layers.ground.gain.setTargetAtTime(mix.ground, t, CROSSFADE_TAU);
    this.layers.layer1.gain.setTargetAtTime(mix.layer1, t, CROSSFADE_TAU);
    this.layers.layer2.gain.setTargetAtTime(mix.layer2, t, CROSSFADE_TAU);
    this.layerFilter.frequency.setTargetAtTime(mix.cutoffHz, t, 0.08);

    while (this.nextStepTime < t + LOOKAHEAD) {
      this.scheduleStep(this.step, this.nextStepTime, stepSeconds(this.score.bpm, mix.tempo));
      this.nextStepTime += stepSeconds(this.score.bpm, mix.tempo);
      this.step = (this.step + 1) % 16;
    }
  }

  private scheduleStep(step: number, at: number, length: number): void {
    const ctx = this.engine.ctx;
    const layers = this.layers;
    if (!ctx || !layers) return;
    const { tonicHz, scale, motif, chord } = this.score;

    if (step === 0 || step === 6 || step === 10) this.kick(layers.ground, at);
    if (step === 4 || step === 12) this.snare(layers.ground, at);
    if (step % 4 === 2) this.hat(layers.ground, at);
    if (step === 0 || step === 8) this.bass(layers.ground, at, tonicHz, length * 5);
    if (step === 11) this.bass(layers.ground, at, semitones(tonicHz, scale[3] ?? 7), length * 3);

    if (step % 2 === 0) {
      const index = motif[(step / 2) % motif.length]!;
      const degree = scale[index % scale.length]! + (index >= scale.length ? 12 : 0);
      this.pluck(layers.layer1, at, semitones(tonicHz * 4, degree), length * 3.2);
    }

    if (step === 0) {
      for (const n of chord) this.pad(layers.layer2, at, semitones(tonicHz * 2, n), length * 16);
    }
  }

  private kick(dest: GainNode, at: number): void {
    const ctx = this.engine.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(115, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.14);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.9, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    o.connect(g);
    g.connect(dest);
    o.start(at);
    o.stop(at + 0.25);
  }

  private noiseHit(dest: GainNode, at: number, type: BiquadFilterType, freq: number, decay: number, peak: number): void {
    const ctx = this.engine.ctx!;
    const buffer = this.engine.noiseBuffer;
    if (!buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(at, (at * 3.7) % 1.5, decay + 0.03);
  }

  private snare(dest: GainNode, at: number): void {
    this.noiseHit(dest, at, 'bandpass', 1900, 0.11, 0.4);
  }

  private hat(dest: GainNode, at: number): void {
    this.noiseHit(dest, at, 'highpass', 7000, 0.04, 0.16);
  }

  private bass(dest: GainNode, at: number, hz: number, length: number): void {
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
    g.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
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
    g.gain.exponentialRampToValueAtTime(0.34, at + 0.006);
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
    g.gain.exponentialRampToValueAtTime(0.16, at + length * 0.3);
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
