import { clamp, lerp, smoothstep } from '@/core/mathx';
import type { BiomeId } from '@/sim/types';

/** Pure rules behind the audio layer, kept free of Web Audio so they are testable. */

export interface MusicState {
  /** A run is in progress (not on a menu or card). */
  running: boolean;
  /** Altitude as a share of the level's climb, 0..1. */
  heightFrac: number;
  /** Three surfaces caught inside six seconds. */
  chaining: boolean;
  /** Current simulation time scale; below 1 during the slow-motion fall. */
  timeScale: number;
  /** Event-density envelope, 0..1: how thick the run's beats are right now (R-LD-08). */
  intensity: number;
}

export interface LayerMix {
  ground: number;
  layer1: number;
  layer2: number;
  /** Low-pass cutoff for the whole score; closes during slow motion. */
  cutoffHz: number;
  /** Tempo multiplier, stretched with the shared clock. */
  tempo: number;
}

/**
 * Deterministic layering (PRD 9.4): ground always plays during a run, the melodic
 * layer rides the run's own event density and keeps a floor at altitude, the
 * pad engages for the densest stretches — a snap chain pushes it there on its
 * own — and everything darkens and stretches with the time scale during slow
 * motion.
 */
export function layerMix(state: MusicState): LayerMix {
  const slow = clamp((1 - state.timeScale) / 0.65, 0, 1);
  const events = smoothstep(0.3, 0.55, state.intensity);
  const altitude = smoothstep(0.45, 0.65, state.heightFrac);
  const pad = Math.max(state.chaining ? 1 : 0, smoothstep(0.6, 0.85, state.intensity));
  return {
    ground: state.running ? 1 : 0.35,
    layer1: state.running ? Math.max(events, altitude) : 0,
    layer2: state.running ? pad : 0,
    cutoffHz: lerp(14000, 480, slow),
    tempo: clamp(state.timeScale, 0.35, 1),
  };
}

export interface HumInput {
  polarity: 'attract' | 'repel';
  charge01: number;
  /** Closeness of ferromagnetic mass, 0 far to 1 touching. */
  proximity: number;
  attached: boolean;
}

export interface HumParams {
  attractGain: number;
  repelGain: number;
  repelCutoffHz: number;
  tremoloDepth: number;
}

const HUM_LEVEL = 0.05;

/** The magnet's own voice: swells with proximity, shimmers brighter with charge, tenses at full. */
export function humParams(input: HumInput): HumParams {
  const repel = input.polarity === 'repel';
  const proximity = input.attached ? 1 : input.proximity;
  return {
    attractGain: repel ? 0 : HUM_LEVEL * (0.25 + 0.75 * proximity),
    repelGain: repel ? HUM_LEVEL * (0.6 + 0.9 * input.charge01) : 0,
    repelCutoffHz: 380 + 3400 * input.charge01 ** 1.4,
    tremoloDepth: repel && input.charge01 >= 0.995 ? 0.35 : 0,
  };
}

/** Fall whistle pitch glides from 1200 Hz down to 300 Hz as the drop grows. */
export function whistleFrequency(dropMeters: number, timeScale: number): number {
  const t = clamp((dropMeters - 4) / 36, 0, 1);
  return lerp(1200, 300, t) * clamp(timeScale, 0.5, 1);
}

export function whistleGain(dropMeters: number, speed: number): number {
  return clamp((dropMeters - 5) / 8, 0, 1) * clamp(speed / 14, 0, 1) * 0.22;
}

/** Wind voice centre frequency and level by altitude; the stratosphere thins to a whistle then silence. */
export function windVoice(biome: BiomeId, altitudeFrac: number, gust: number): { centerHz: number; gain: number } {
  const quiet = biome === 'stratosphere' ? 1 - clamp(altitudeFrac * 1.1, 0, 1) : 1;
  const base = biome === 'scrapyard' ? 0.05 : 0.09;
  return {
    centerHz: lerp(320, biome === 'stratosphere' ? 2400 : 900, clamp(altitudeFrac, 0, 1)) * (1 + gust * 0.35),
    gain: (base + 0.1 * clamp(altitudeFrac, 0, 1) + gust * 0.14) * quiet,
  };
}

/** Wheel axle groan: silent while a wheel is still, rising in pitch and level as it picks up speed (rad/s). */
export function axleGroan(speed: number): { pitchHz: number; cutoffHz: number; gain: number } {
  const u = clamp((speed - 0.06) / 0.9, 0, 1);
  return { pitchHz: lerp(46, 82, u), cutoffHz: lerp(260, 900, u), gain: 0.085 * u * u * (3 - 2 * u) };
}

export const stepSeconds = (bpm: number, tempo: number): number => 60 / bpm / 4 / Math.max(0.2, tempo);

export interface BiomeScore {
  tonicHz: number;
  bpm: number;
  /** Semitone offsets from the tonic; every layer draws from this set so any combination is consonant. */
  scale: readonly number[];
  motif: readonly number[];
  chord: readonly number[];
}

/** One key per biome. Scrapyard sits in A minor pentatonic. */
export const SCORES: Readonly<Record<BiomeId, BiomeScore>> = {
  scrapyard: { tonicHz: 55, bpm: 92, scale: [0, 3, 5, 7, 10], motif: [0, 2, 4, 2, 3, 1, 2, 0], chord: [0, 7, 15, 19] },
  suburbia: { tonicHz: 65.41, bpm: 108, scale: [0, 2, 4, 7, 9], motif: [0, 1, 2, 4, 2, 1, 3, 2], chord: [0, 7, 16, 19] },
  metropolis: { tonicHz: 61.74, bpm: 120, scale: [0, 3, 5, 7, 10], motif: [0, 3, 2, 4, 1, 3, 2, 0], chord: [0, 7, 12, 15] },
  playground: { tonicHz: 73.42, bpm: 100, scale: [0, 2, 4, 7, 9], motif: [4, 2, 3, 1, 2, 0, 1, 2], chord: [0, 7, 16, 21] },
  stratosphere: { tonicHz: 51.91, bpm: 70, scale: [0, 2, 3, 7, 8], motif: [0, 4, 2, 3, 1, 4, 2, 0], chord: [0, 7, 14, 19] },
};

export const semitones = (base: number, n: number): number => base * 2 ** (n / 12);

export interface Ambience {
  /** One-shot flavour sound scattered through a run. */
  event: 'clank' | 'bird' | 'creak' | 'ping' | null;
  /** Seconds between flavour sounds, drawn uniformly from this range. */
  intervalS: readonly [number, number];
  /** Level of the continuous electrical buzz; zero where there is none. */
  buzz: number;
}

/** Per-biome ambience (PRD 9.5): clanks in the Scrapyard, birdsong in Suburbia, neon buzz in Metropolis, chain creaks in the Playground and a rare ping in thin air. */
export const AMBIENCE: Readonly<Record<BiomeId, Ambience>> = {
  scrapyard: { event: 'clank', intervalS: [4, 9], buzz: 0 },
  suburbia: { event: 'bird', intervalS: [2.2, 6], buzz: 0 },
  metropolis: { event: null, intervalS: [0, 0], buzz: 0.016 },
  playground: { event: 'creak', intervalS: [3.5, 8], buzz: 0 },
  stratosphere: { event: 'ping', intervalS: [11, 24], buzz: 0 },
};
