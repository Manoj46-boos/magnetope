import type { MaterialVoice } from '@/config/materials';
import { Rng } from '@/core/rng';
import { clamp } from '@/core/mathx';
import type { AudioEngine, BusName } from './engine';

/**
 * Material-coded voices (PRD 9.2). Each recipe builds a short graph from
 * oscillators and filtered noise, routes it to a bus, and lets it free itself.
 */
export type SurfaceVoice = MaterialVoice;

interface Graph {
  ctx: AudioContext;
  out: GainNode;
  t: number;
}

/**
 * R-AU-10 (Devine): the take jitter. Every repeat-prone voice is a performance,
 * not a trigger — pitch and decay wander inside ±10%, note offsets inside
 * ±20 ms — so the same event never machine-guns. The draws are deterministic
 * per session (a seeded take, like a player with habits), and every voice keeps
 * its own identity law: a chirp stays inside its quarter second, a melody keeps
 * its tune, a UI blip keeps its class peak.
 */
const take = new Rng(0x5eed);
const takeRange = (lo: number, hi: number): number => take.range(lo, hi);
/** Pitch within ±10% of the identity. */
const takePitch = (hz: number): number => hz * takeRange(0.9, 1.1);
/** Decay within ±10%, never past the limit the voice's own law sets. */
const takeDecay = (s: number, limit = Infinity): number => Math.min(s * takeRange(0.9, 1.1), limit);
/** Micro-timing within ±20 ms, never before the graph opens. */
const takeTiming = (s: number): number => Math.max(0, s + takeRange(-0.02, 0.02));

function open(engine: AudioEngine, bus: BusName, duration: number, gain: number, destination?: AudioNode, at?: number): Graph | null {
  const ctx = engine.ctx;
  const target = destination ?? engine.bus(bus);
  if (!ctx || !target || !engine.acquireVoice(duration)) return null;
  const out = ctx.createGain();
  out.gain.value = gain;
  out.connect(target);
  return { ctx, out, t: at ?? ctx.currentTime };
}

function tone(g: Graph, type: OscillatorType, from: number, to: number, glide: number, decay: number, peak: number, delay = 0): void {
  const osc = g.ctx.createOscillator();
  const amp = g.ctx.createGain();
  osc.type = type;
  const start = g.t + delay;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + glide);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  osc.connect(amp);
  amp.connect(g.out);
  osc.start(start);
  osc.stop(start + decay + 0.02);
}

/** A slow-attack voice for pads and swells: rises over `attack`, holds, then dies away over `release`. */
function swell(g: Graph, freq: number, attack: number, hold: number, release: number, peak: number, delay = 0, detuneCents = 0): void {
  const osc = g.ctx.createOscillator();
  const amp = g.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.detune.value = detuneCents;
  const start = g.t + delay;
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(peak, start + attack);
  amp.gain.setValueAtTime(peak, start + attack + hold);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
  osc.connect(amp);
  amp.connect(g.out);
  osc.start(start);
  osc.stop(start + attack + hold + release + 0.05);
}

function noiseBurst(
  g: Graph,
  engine: AudioEngine,
  filter: BiquadFilterType,
  from: number,
  to: number,
  q: number,
  decay: number,
  peak: number,
  delay = 0,
): void {
  const buffer = engine.noiseBuffer;
  if (!buffer) return;
  const src = g.ctx.createBufferSource();
  src.buffer = buffer;
  const f = g.ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  const start = g.t + delay;
  f.frequency.setValueAtTime(from, start);
  if (to !== from) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + decay);
  const amp = g.ctx.createGain();
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.003);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + decay);
  src.connect(f);
  f.connect(amp);
  amp.connect(g.out);
  src.start(start, (start * 7.13) % 1.4, decay + 0.05);
}

function toRoom(g: Graph, engine: AudioEngine, amount: number): void {
  const send = engine.reverbSend;
  if (!send) return;
  const tap = g.ctx.createGain();
  tap.gain.value = amount;
  g.out.connect(tap);
  tap.connect(send);
}

/**
 * Attach thunk — and the score's own drum (R-AU-04): the junk orchestra strikes
 * this exact recipe, on the music bus, at the score's own times. `pitch` shifts
 * the whole recipe down for impacts; the `at` schedules it into the score's
 * clock, and `destination` rides it through a stem. Each take wanders inside
 * ±10% (R-AU-10) so the same surface never answers twice the same.
 */
export function playAttach(engine: AudioEngine, voice: SurfaceVoice, intensity: number, pitch = 1, bus: BusName = 'sfx', at?: number, destination?: AudioNode): void {
  const level = clamp(intensity, 0.15, 1);
  const g = open(engine, bus, 0.5, 0.55 * level + 0.18, destination, at);
  if (!g) return;
  pitch *= takeRange(0.9, 1.1);
  switch (voice) {
    case 'body':
      tone(g, 'sine', 180 * pitch, 120 * pitch, 0.06, 0.14, 0.9);
      noiseBurst(g, engine, 'bandpass', 900 * pitch, 900 * pitch, 1.2, 0.012, 0.5);
      tone(g, 'sine', 90 * pitch, 80 * pitch, 0.1, 0.14, 0.4, 0.01);
      toRoom(g, engine, 0.3);
      break;
    case 'beam':
      tone(g, 'sine', 420 * pitch, 418 * pitch, 0.1, 0.26, 0.55);
      tone(g, 'sine', 426.5 * pitch, 424 * pitch, 0.1, 0.24, 0.5);
      tone(g, 'triangle', 1260 * pitch, 1240 * pitch, 0.1, 0.1, 0.12);
      noiseBurst(g, engine, 'highpass', 2800, 2800, 0.8, 0.02, 0.22);
      toRoom(g, engine, 0.22);
      break;
    case 'crumple':
      noiseBurst(g, engine, 'bandpass', 3000 * pitch, 800 * pitch, 1.6, 0.24, 0.7);
      noiseBurst(g, engine, 'bandpass', 2400 * pitch, 700 * pitch, 2.4, 0.2, 0.45, 0.045);
      break;
    case 'wood':
      tone(g, 'triangle', 260 * pitch, 150 * pitch, 0.09, 0.12, 0.8);
      noiseBurst(g, engine, 'bandpass', 1400, 600, 1, 0.04, 0.35);
      break;
    case 'rubber':
      tone(g, 'sine', 150 * pitch, 62 * pitch, 0.14, 0.2, 0.95);
      break;
    case 'glass':
      noiseBurst(g, engine, 'highpass', 4200, 6000, 0.9, 0.2, 0.5);
      tone(g, 'sine', 2600 * pitch, 2580 * pitch, 0.1, 0.3, 0.2);
      tone(g, 'sine', 3470 * pitch, 3440 * pitch, 0.1, 0.22, 0.15);
      break;
    case 'soft':
      noiseBurst(g, engine, 'lowpass', 520 * pitch, 160 * pitch, 0.7, 0.16, 0.7);
      tone(g, 'sine', 100 * pitch, 60 * pitch, 0.1, 0.16, 0.5);
      break;
    case 'stone':
      noiseBurst(g, engine, 'lowpass', 900 * pitch, 240 * pitch, 0.8, 0.14, 0.65);
      tone(g, 'sine', 95 * pitch, 55 * pitch, 0.08, 0.16, 0.6);
      break;
    case 'spring':
      tone(g, 'sine', 110 * pitch, 330 * pitch, 0.12, 0.34, 0.9);
      tone(g, 'triangle', 220 * pitch, 640 * pitch, 0.12, 0.2, 0.28, 0.02);
      noiseBurst(g, engine, 'lowpass', 700, 300, 0.7, 0.05, 0.3);
      break;
  }
}

/** Short chirp for the Suburbia ambience. `seed` picks one of a few fixed songs so the yard sounds alive but repeatable. */
export function playBird(engine: AudioEngine, seed: number): void {
  const g = open(engine, 'amb', 0.6, 0.32);
  if (!g) return;
  const base = 2300 + (seed % 5) * 260;
  const notes = 2 + (seed % 3);
  for (let i = 0; i < notes; i++) {
    const from = base * (1 + 0.12 * ((i + seed) % 3));
    tone(g, 'sine', from, from * 1.35, 0.06, 0.09, 0.5, i * 0.11);
  }
  toRoom(g, engine, 0.35);
}

export function playImpact(engine: AudioEngine, voice: SurfaceVoice, speed: number): void {
  const intensity = clamp(speed / 14, 0.2, 1);
  playAttach(engine, voice, intensity, 0.82);
  const g = open(engine, 'sfx', 0.35, 0.5 * intensity);
  if (!g) return;
  noiseBurst(g, engine, 'lowpass', 1200, 200, 0.7, 0.28, 0.8);
}

/** Air whoosh swept by launch power, with a sub thump at full charge. */
export function playRepel(engine: AudioEngine, power01: number): void {
  const g = open(engine, 'sfx', 0.4, 0.4 + 0.45 * power01);
  if (!g) return;
  const center = 500 + 1300 * power01;
  noiseBurst(g, engine, 'bandpass', center * 0.6, center * 1.5, 1.1, 0.18 + 0.1 * power01, 0.9);
  if (power01 > 0.8) tone(g, 'sine', 62, 38, 0.16, 0.2, 1);
}

export function playSnapEngage(engine: AudioEngine): void {
  const g = open(engine, 'sfx', 0.3, 0.38);
  if (!g) return;
  const osc = g.ctx.createOscillator();
  const filter = g.ctx.createBiquadFilter();
  const amp = g.ctx.createGain();
  osc.type = 'sawtooth';
  // R-AU-10: the engage's zip is the game's most repeated voice — every take its own.
  const lo = takePitch(220);
  osc.frequency.setValueAtTime(lo, g.t);
  osc.frequency.exponentialRampToValueAtTime(takePitch(880), g.t + 0.09);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(600, g.t);
  filter.frequency.exponentialRampToValueAtTime(3200, g.t + 0.09);
  amp.gain.setValueAtTime(0.0001, g.t);
  amp.gain.exponentialRampToValueAtTime(0.7, g.t + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, g.t + takeDecay(0.22));
  osc.connect(filter);
  filter.connect(amp);
  amp.connect(g.out);
  osc.start(g.t);
  osc.stop(g.t + 0.25);
}

export function playSnapWhiff(engine: AudioEngine): void {
  const g = open(engine, 'sfx', 0.2, 0.2);
  if (!g) return;
  noiseBurst(g, engine, 'bandpass', 1800, 700, 2, 0.1, 0.5);
}

/** The UI class's shared peak: every verdict voice lands in the same window (R-AU-08), measured on the offline renders. */
export function playTick(engine: AudioEngine, pitch = 2000, bus: BusName = 'ui', gain = 2.5): void {
  const g = open(engine, bus, 0.05, gain);
  if (!g) return;
  const hz = takePitch(pitch);
  noiseBurst(g, engine, 'bandpass', hz, hz, 4, 0.012, 0.9);
}

/** Rising blip as the charge meter reaches each of its three levels. */
export function playChargeLevel(engine: AudioEngine, level: number): void {
  const g = open(engine, 'ui', 0.14, 0.56);
  if (!g) return;
  const f = takePitch([440, 587, 880][clamp(level, 1, 3) - 1]!);
  tone(g, 'sine', f, f * 1.02, 0.05, 0.09, 0.7);
  if (level === 3) tone(g, 'triangle', f * 2, f * 2, 0.05, 0.12, 0.25);
}

/** Springy get-up: a damped bounce sweeping 90 -> 160 -> 130 Hz. */
export function playGetUp(engine: AudioEngine): void {
  const g = open(engine, 'sfx', 0.45, 0.55);
  if (!g) return;
  const osc = g.ctx.createOscillator();
  const amp = g.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(90, g.t);
  osc.frequency.exponentialRampToValueAtTime(160, g.t + 0.12);
  osc.frequency.exponentialRampToValueAtTime(130, g.t + 0.3);
  amp.gain.setValueAtTime(0.0001, g.t);
  amp.gain.exponentialRampToValueAtTime(0.9, g.t + 0.03);
  amp.gain.setTargetAtTime(0.0001, g.t + 0.1, 0.09);
  osc.connect(amp);
  amp.connect(g.out);
  osc.start(g.t);
  osc.stop(g.t + 0.45);
}

export function playCrumble(engine: AudioEngine): void {
  const g = open(engine, 'sfx', 0.5, 0.5);
  if (!g) return;
  for (let i = 0; i < 4; i++) noiseBurst(g, engine, 'bandpass', 3400 - i * 500, 600, 2.2, 0.12, 0.5, i * 0.05);
}

/** The cartoon spring: a fast upward glide with a wobbling tail, pitched higher the harder MAGNO was thrown. */
export function playBoing(engine: AudioEngine, outSpeed: number): void {
  const g = open(engine, 'sfx', 0.6, 0.62);
  if (!g) return;
  const k = 0.85 + clamp(outSpeed / 18, 0.2, 1) * 0.5;
  tone(g, 'sine', 130 * k, 470 * k, 0.15, 0.4, 0.9);
  tone(g, 'triangle', 260 * k, 940 * k, 0.15, 0.26, 0.24, 0.01);
  tone(g, 'sine', 560 * k, 400 * k, 0.2, 0.34, 0.2, 0.13);
  tone(g, 'sine', 430 * k, 520 * k, 0.12, 0.2, 0.12, 0.3);
  noiseBurst(g, engine, 'lowpass', 900, 220, 0.7, 0.08, 0.45);
}

/**
 * The warning a surface gives before it fails: a run of small ticks that speed up, rust grinding
 * and ice pinging. `bright` picks the glassy voice.
 */
export function playStress(engine: AudioEngine, bright: boolean): void {
  const g = open(engine, 'sfx', 0.8, 0.4);
  if (!g) return;
  for (let i = 0; i < 4; i++) {
    const at = i * (0.17 - i * 0.025);
    if (bright) tone(g, 'sine', 3100 + i * 380, 2900 + i * 330, 0.04, 0.12, 0.3, at);
    else tone(g, 'sawtooth', 240 + i * 22, 190 + i * 15, 0.1, 0.16, 0.2, at);
    noiseBurst(g, engine, 'bandpass', bright ? 5200 : 1700, bright ? 3600 : 900, 3, 0.05, 0.22, at);
  }
}

/** Ice giving way: a sharp crack, then a glassy rattle falling away. */
export function playIceBreak(engine: AudioEngine): void {
  const g = open(engine, 'sfx', 0.9, 0.6);
  if (!g) return;
  noiseBurst(g, engine, 'highpass', 5200, 2400, 0.8, 0.09, 0.9);
  for (let i = 0; i < 6; i++) tone(g, 'sine', 3600 - i * 330, 3200 - i * 290, 0.06, 0.14, 0.14, 0.04 + i * 0.045);
  noiseBurst(g, engine, 'lowpass', 600, 140, 0.7, 0.32, 0.5, 0.05);
}

/** A drawer or lift on its rails: a rolling rasp that rises going out and falls coming back, with a clunk at the stops. */
export function playSlide(engine: AudioEngine, direction: 'out' | 'in'): void {
  const g = open(engine, 'sfx', 0.9, 0.42);
  if (!g) return;
  const out = direction === 'out';
  noiseBurst(g, engine, 'bandpass', out ? 500 : 1200, out ? 1300 : 480, 2.4, 0.55, 0.5);
  tone(g, 'triangle', out ? 90 : 120, out ? 120 : 80, 0.4, 0.5, 0.18);
  tone(g, 'sine', 150, 70, 0.07, 0.12, 0.6, 0.5);
  noiseBurst(g, engine, 'bandpass', 900, 500, 1.4, 0.04, 0.5, 0.5);
}

export function playGlassBreak(engine: AudioEngine): void {
  const g = open(engine, 'sfx', 0.7, 0.6);
  if (!g) return;
  noiseBurst(g, engine, 'highpass', 3000, 7000, 0.7, 0.4, 0.8);
  for (let i = 0; i < 5; i++) tone(g, 'sine', 2200 + i * 520, 2100 + i * 500, 0.08, 0.16, 0.12, i * 0.03);
}

/**
 * R-AU-01: the motif quote — five notes and a resolve, the game's name signed
 * at every payoff. The notes are the biome's own spelling of the shape, so the
 * clear card, the summit and the ending's credits all sing the same word.
 */
export function playFanfare(engine: AudioEngine, motifHz: readonly number[]): void {
  const g = open(engine, 'ui', 1.5, 0.42);
  if (!g) return;
  for (let i = 0; i < motifHz.length; i++) {
    const at = takeTiming(i * 0.13);
    tone(g, 'triangle', motifHz[i]!, motifHz[i]!, 0.1, i === motifHz.length - 1 ? 0.55 : 0.32, 0.6, at);
    tone(g, 'sine', motifHz[i]! / 2, motifHz[i]! / 2, 0.1, 0.35, 0.2, at);
  }
  // The resolve: the fifth note held, a soft sparkle over it.
  const home = takeTiming(0.62);
  tone(g, 'triangle', motifHz[4]!, motifHz[4]!, 0.1, 0.7, 0.7, home);
  tone(g, 'sine', motifHz[4]! * 2, motifHz[4]! * 2, 0.1, 0.5, 0.22, home);
  noiseBurst(g, engine, 'highpass', 6000, 9000, 0.8, 0.4, 0.18, home);
  toRoom(g, engine, 0.25);
}

/** The star stamps sing the motif's own degrees — do, then the third, then the octave — and never outlast the card's rhythm. */
export function playStarStamp(engine: AudioEngine, index: number, motifHz: readonly number[]): void {
  const g = open(engine, 'ui', 0.3, 0.62);
  if (!g) return;
  const f = motifHz[[0, 2, 4][clamp(index, 0, 2)]!]!;
  tone(g, 'sine', f, f, 0.05, 0.18, 0.6);
  noiseBurst(g, engine, 'bandpass', 1200, 400, 1, 0.06, 0.4);
}

/**
 * R-AU-05: the biome call — the motif stated once, slowly, in the new biome's
 * own spelling, with air in the gaps. The re-harmonized identity is the
 * announcement itself (R-AU-01/R-AU-03).
 */
export function playBiomeCall(engine: AudioEngine, motifHz: readonly number[]): void {
  const g = open(engine, 'ui', 1.5, 0.59);
  if (!g) return;
  for (let i = 0; i < motifHz.length; i++) {
    const at = takeTiming(i * 0.22);
    tone(g, 'sine', motifHz[i]!, motifHz[i]!, 0.12, 0.4, 0.5, at);
    tone(g, 'triangle', motifHz[i]! * 2, motifHz[i]! * 2, 0.12, 0.2, 0.14, at);
  }
  noiseBurst(g, engine, 'highpass', 5000, 7000, 0.7, 0.3, 0.12, 1.0);
  toRoom(g, engine, 0.4);
}

/** R-AU-05: the par coda — two quick notes up the motif's last steps, the verdict's own sparkle. */
export function playParCall(engine: AudioEngine, motifHz: readonly number[], at?: number): void {
  const g = open(engine, 'ui', 0.4, 0.56, undefined, at);
  if (!g) return;
  tone(g, 'sine', motifHz[3]!, motifHz[3]!, 0.05, 0.12, 0.55);
  tone(g, 'sine', motifHz[4]!, motifHz[4]!, 0.05, 0.16, 0.6, 0.12);
  noiseBurst(g, engine, 'bandpass', 5000, 6500, 2, 0.08, 0.25, 0.12);
}

/** R-AU-05: the ghost-set toast — a two-note stamp and a tape tick, the run put on record. */
export function playGhostSet(engine: AudioEngine, motifHz: readonly number[], at?: number): void {
  const g = open(engine, 'ui', 0.6, 0.66, undefined, at);
  if (!g) return;
  tone(g, 'triangle', motifHz[2]!, motifHz[2]!, 0.04, 0.16, 0.55);
  tone(g, 'triangle', motifHz[4]!, motifHz[4]!, 0.04, 0.22, 0.6, 0.14);
  noiseBurst(g, engine, 'bandpass', 3000, 2600, 6, 0.05, 0.3, 0.32);
}

/**
 * R-AU-05: the small-fall topper — one low bwomp, deadpan, over in a quarter
 * second. The spectacular falls get nothing: the stage clears for MAGNO's own
 * deadpan, and the silence is the sting (the comedy law, Ch. 20.4).
 */
export function playFallTopper(engine: AudioEngine): void {
  const g = open(engine, 'ui', 0.35, 0.67);
  if (!g) return;
  tone(g, 'sine', takePitch(170), takePitch(110), 0.12, 0.22, 0.6);
  noiseBurst(g, engine, 'lowpass', 500, 180, 0.8, 0.12, 0.4);
}

/** Distant metal creak for the Scrapyard ambience — the score's drum shares it (R-AU-04). */
export function playClank(engine: AudioEngine, seed: number): void {
  const g = open(engine, 'amb', 1, 0.5);
  if (!g) return;
  const base = takePitch(170 + (seed % 7) * 38);
  tone(g, 'sine', base, base * 0.97, 0.3, takeDecay(0.9, 0.85), 0.5);
  tone(g, 'sine', base * 2.41, base * 2.3, 0.3, takeDecay(0.5, 0.45), 0.2);
  noiseBurst(g, engine, 'bandpass', 1500, 500, 3, 0.1, 0.25);
  toRoom(g, engine, 0.6);
}

/** A rusted swing chain taking weight: a rising squeal that eases back, for the Playground ambience. */
export function playCreak(engine: AudioEngine, seed: number): void {
  const g = open(engine, 'amb', 0.9, 0.34);
  if (!g) return;
  const base = 520 + (seed % 6) * 45;
  tone(g, 'sawtooth', base, base * 1.45, 0.32, 0.42, 0.22);
  tone(g, 'square', base * 1.38, base * 1.05, 0.28, 0.38, 0.12, 0.26);
  noiseBurst(g, engine, 'bandpass', 2200, 1500, 6, 0.3, 0.1);
  toRoom(g, engine, 0.5);
}

/** A far-off beacon heard through thin air: one soft sine with two fading echoes, for the Stratosphere ambience. */
export function playPing(engine: AudioEngine, seed: number): void {
  const g = open(engine, 'amb', 2.6, 0.3);
  if (!g) return;
  const pitch = 1318.5 * [1, 1.125, 1.5][seed % 3]!;
  tone(g, 'sine', pitch, pitch, 0.01, 1.7, 0.3);
  tone(g, 'sine', pitch, pitch, 0.01, 1.4, 0.12, 0.42);
  tone(g, 'sine', pitch, pitch, 0.01, 1.1, 0.05, 0.84);
  toRoom(g, engine, 0.8);
}

/** The power core clicking home: a hard metal seat, a bell over it and a rising sweep that opens the bloom. */
export function playCoreSeat(engine: AudioEngine): void {
  const g = open(engine, 'sfx', 1.8, 0.9);
  if (!g) return;
  noiseBurst(g, engine, 'highpass', 4200, 6500, 0.9, 0.06, 0.9);
  tone(g, 'sine', 240, 96, 0.12, 0.22, 0.9);
  tone(g, 'triangle', 1760, 1750, 0.05, 0.7, 0.4, 0.01);
  tone(g, 'sine', 3520, 3510, 0.05, 1, 0.14, 0.01);
  tone(g, 'sine', 220, 1760, 0.5, 0.6, 0.2, 0.05);
  toRoom(g, engine, 0.55);
}

/** The field lines blooming outward: a major chord that rises over three seconds and fades over several more. */
export function playBloomSwell(engine: AudioEngine, tonicHz: number, destination?: AudioNode): void {
  const g = open(engine, 'music', 14, 0.9, destination);
  if (!g) return;
  [4, 5, 6, 8, 10, 12].forEach((ratio, i) => {
    swell(g, tonicHz * ratio, 3, 5, 6, 0.16 - i * 0.012, i * 0.12, i % 2 === 0 ? -6 : 6);
  });
  toRoom(g, engine, 0.7);
}

/** The long pull-back over the mountain: a deep pedal with an open fifth and an added ninth, under a high shimmer. */
export function playPullbackPad(engine: AudioEngine, tonicHz: number, destination?: AudioNode): void {
  const g = open(engine, 'music', 30, 0.8, destination);
  if (!g) return;
  swell(g, tonicHz * 2, 4, 16, 8, 0.34);
  swell(g, tonicHz * 3, 6, 14, 8, 0.2, 1);
  swell(g, tonicHz * 8, 7, 12, 9, 0.12, 2, -5);
  swell(g, tonicHz * 12, 8, 11, 9, 0.09, 3, 5);
  swell(g, tonicHz * 18, 10, 9, 9, 0.05, 4);
  toRoom(g, engine, 0.8);
}

/**
 * R-CH-06 / R-AU-06: the twelve words of MAGNO's language. Each is a tiny
 * synthesized figure — no samples, no human speech, ever — mapped one to one
 * onto the emotion table in `src/game/magno-table.ts`, and every contour is
 * the shape of its feeling: questions rise, zaps fall, boasts climb a triad.
 */
export type ChirpName =
  | 'curious'
  | 'focused'
  | 'whee'
  | 'uh-oh'
  | 'ouch'
  | 'relief'
  | 'ta-da'
  | 'deadpan'
  | 'weary'
  | 'wary'
  | 'miss'
  | 'home';

/** R-AU-06: the voice's own band — bright enough to sit over the score, never the air above it. Published for the doc spine. */
export const CHIRP_BAND_HZ: [number, number] = [1000, 8000];
/** R-AU-06: no chirp outlasts a quarter second, voice and tail included. */
const CHIRP_MAX_S = 0.25;

/** Opens the chirp graph: the band limit rides the chain itself, ahead of the bus, so no figure can speak outside the range. */
function openChirp(engine: AudioEngine, gain: number): Graph | null {
  const ctx = engine.ctx;
  const bus = engine.bus('chirp');
  if (!ctx || !bus || !engine.acquireVoice(CHIRP_MAX_S)) return null;
  const out = ctx.createGain();
  out.gain.value = gain;
  const lowCut = ctx.createBiquadFilter();
  lowCut.type = 'highpass';
  lowCut.frequency.value = CHIRP_BAND_HZ[0];
  const highCut = ctx.createBiquadFilter();
  highCut.type = 'lowpass';
  highCut.frequency.value = CHIRP_BAND_HZ[1];
  out.connect(lowCut);
  lowCut.connect(highCut);
  highCut.connect(bus);
  return { ctx, out, t: ctx.currentTime };
}

/** R-AU-10: the word's own take — the syllables wander inside ±10% and the decay never spends past the quarter second. */
function word(g: Graph, type: OscillatorType, from: number, to: number, glide: number, decay: number, peak: number, delay = 0): void {
  const pitch = takeRange(0.9, 1.1);
  tone(g, type, from * pitch, to * pitch, glide, takeDecay(decay, CHIRP_MAX_S - delay - 0.02), peak, delay);
}

/** One word of the chirp language, on its own bus, inside its band and its quarter second. */
export function playChirp(engine: AudioEngine, name: ChirpName): void {
  const g = openChirp(engine, 0.5);
  if (!g) return;
  switch (name) {
    case 'curious':
      // Two rising notes: a question.
      word(g, 'sine', 1650, 1650, 0.05, 0.07, 0.6);
      word(g, 'sine', 2200, 2460, 0.06, 0.1, 0.65, 0.09);
      break;
    case 'focused':
      // One tight flat tick with a harmonic over it: attention without doubt.
      word(g, 'triangle', 1900, 1900, 0.05, 0.09, 0.55);
      word(g, 'sine', 3800, 3800, 0.04, 0.06, 0.2, 0.02);
      break;
    case 'whee':
      // The launch: a fast, clean slide up and away.
      word(g, 'sine', 2100, 3900, 0.12, 0.13, 0.7);
      word(g, 'triangle', 2600, 4200, 0.12, 0.08, 0.3, 0.03);
      break;
    case 'uh-oh':
      // The classic two-step drop, a short step apart.
      word(g, 'sine', 2350, 2350, 0.04, 0.08, 0.65);
      word(g, 'sine', 1870, 1870, 0.04, 0.12, 0.6, 0.1);
      break;
    case 'ouch':
      // A sharp zap down and out.
      word(g, 'square', 3200, 1500, 0.07, 0.1, 0.4);
      word(g, 'sine', 3100, 1400, 0.07, 0.11, 0.55, 0.01);
      break;
    case 'relief':
      // A soft settle: down a touch, then up, then quiet.
      word(g, 'sine', 3100, 2700, 0.08, 0.09, 0.4);
      word(g, 'sine', 2700, 3300, 0.08, 0.12, 0.45, 0.08);
      break;
    case 'ta-da':
      // The three-note boast, climbing a major triad.
      word(g, 'triangle', 1600, 1600, 0.04, 0.08, 0.6);
      word(g, 'triangle', 2000, 2000, 0.04, 0.08, 0.6, 0.07);
      word(g, 'triangle', 2400, 2400, 0.04, 0.09, 0.7, 0.14);
      break;
    case 'deadpan':
      // One flat, low blip: the comedy verdict, offered without comment.
      word(g, 'sine', 1400, 1380, 0.11, 0.11, 0.6);
      break;
    case 'weary':
      // The droop of a get-up that costs something.
      word(g, 'sine', 2000, 1480, 0.12, 0.11, 0.55);
      break;
    case 'wary':
      // A nervous trill: two quick alternations of the same two pitches.
      word(g, 'sine', 2600, 2600, 0.03, 0.05, 0.5);
      word(g, 'sine', 2200, 2200, 0.03, 0.05, 0.5, 0.07);
      word(g, 'sine', 2600, 2600, 0.03, 0.05, 0.45, 0.14);
      break;
    case 'miss':
      // The small embarrassed bwop: a wobble on the way down.
      word(g, 'sine', 2000, 1250, 0.13, 0.13, 0.55);
      word(g, 'sine', 1900, 1300, 0.13, 0.09, 0.25, 0.02);
      break;
    case 'home':
      // The homecoming: a soft fifth, resolved upward.
      word(g, 'sine', 1760, 1760, 0.05, 0.1, 0.4);
      word(g, 'sine', 2640, 2640, 0.06, 0.12, 0.45, 0.1);
      break;
  }
}
