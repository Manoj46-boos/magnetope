import { AudioDirector } from '@/audio/director';
import { AudioEngine, FLAT_MASTER, type BusName } from '@/audio/engine';
import { playBiomeCall, playChargeLevel, playFallTopper, playFanfare, playGhostSet, playParCall, playStarStamp } from '@/audio/recipes';
import { levelById } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';
import { IDLE_INPUT } from '@/sim/types';
import { measure, METER_RATE, type Loudness } from '../helpers/loudness';

/**
 * Renders the game's real audio graph offline, faster than real time, while a
 * real simulation plays a verified route, then measures the result. The audio
 * clock is stepped in 16 ms slices, which is what the game loop hands the
 * director on a 60 Hz screen.
 */

export type Scenario =
  | { kind: 'route'; levelId: string }
  | { kind: 'tumble'; levelId: string; fallAtSeconds: number }
  | { kind: 'ending' }
  | { kind: 'stinger'; levelId: string; callAtSeconds: number; call: 'biome' | 'clear' | 'none' }
  | { kind: 'voice'; name: UiVoice; levelId: string };

/** The UI class, one voice at a time, for the peak-normalisation law (R-AU-08). */
export type UiVoice =
  | 'tick'
  | 'charge1'
  | 'charge2'
  | 'charge3'
  | 'stamp0'
  | 'stamp1'
  | 'stamp2'
  | 'fanfare'
  | 'biomeCall'
  | 'parCall'
  | 'ghostSet'
  | 'fallTopper';

export interface RenderSpec {
  scenario: Scenario;
  seconds: number;
  /** Buses to silence, to hear the others on their own. */
  mute?: BusName[];
  /** Skip the mastering stage, to compare the buses as the mix sets them. */
  flatMaster?: boolean;
  /** An ad plays between these two times, in seconds; the game ducks its music around it. */
  adBetween?: [from: number, to: number];
  /** Record this bus's gain each slice, for the mix's own audits. */
  watch?: BusName;
}

export interface RenderReport extends Loudness {
  seconds: number;
  /** RMS level of each second of the left channel, in dBFS, to find where a mix gets loud. */
  perSecondDb: number[];
  /** The watched bus's gain, in dB, at each slice. */
  watchedDb: number[];
}

const ROUTES = import.meta.glob('../../src/levels/routes/*.json', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

const QUANTUM_FRAMES = 768;
const SLICE_SECONDS = QUANTUM_FRAMES / METER_RATE;
const SIM_HZ = 60;
const ENDING_CUES: ReadonlyArray<[seconds: number, cue: 'seat' | 'bloom' | 'pullback' | 'credits']> = [
  [10, 'seat'],
  [10, 'bloom'],
  [22, 'pullback'],
  [48, 'credits'],
];

async function loadRoute(levelId: string): Promise<ReplayPlayer> {
  const load = ROUTES[`../../src/levels/routes/${levelId}.json`];
  if (!load) throw new Error(`no stored route for ${levelId}`);
  return new ReplayPlayer(decodeRecording(await load()));
}

async function render(spec: RenderSpec): Promise<RenderReport> {
  const ctx = new OfflineAudioContext(2, Math.round(spec.seconds * METER_RATE), METER_RATE);
  const engine = new AudioEngine({ createContext: () => ctx as unknown as AudioContext, master: spec.flatMaster ? FLAT_MASTER : undefined });
  engine.unlock();
  for (const name of spec.mute ?? []) engine.bus(name)!.gain.value = 0;

  const director = new AudioDirector(engine);
  const levelId = spec.scenario.kind === 'ending' ? 'stratosphere-14' : spec.scenario.levelId;
  const sim = new Simulation(await loadRapier(), levelById(levelId));
  director.bind(sim);
  const quiet = spec.scenario.kind === 'ending' || spec.scenario.kind === 'stinger' || spec.scenario.kind === 'voice';
  const player = quiet ? null : await loadRoute(levelId);
  const fallAt = spec.scenario.kind === 'tumble' ? spec.scenario.fallAtSeconds : Infinity;
  const stinger = spec.scenario.kind === 'stinger' ? { at: spec.scenario.callAtSeconds, call: spec.scenario.call, fired: false } : null;
  const voice = spec.scenario.kind === 'voice' ? { name: spec.scenario.name, fired: false } : null;

  const slices = Math.floor(spec.seconds / SLICE_SECONDS);
  const stops = Array.from({ length: slices - 1 }, (_, k) => ctx.suspend((k + 1) * SLICE_SECONDS));
  const rendered = ctx.startRendering();

  let simTicks = 0;
  let ducked = false;
  const watched: number[] = [];
  const cues = [...ENDING_CUES];
  for (let k = 0; k < stops.length; k++) {
    await stops[k];
    const t = (k + 1) * SLICE_SECONDS;
    if (player) {
      while (simTicks < Math.floor(t * SIM_HZ)) {
        sim.step(t >= fallAt || player.done ? IDLE_INPUT : player.next());
        simTicks++;
      }
    }
    const inAd = spec.adBetween !== undefined && t >= spec.adBetween[0] && t < spec.adBetween[1];
    if (inAd !== ducked) engine.setAdDuck((ducked = inAd));
    while (cues.length > 0 && cues[0]![0] <= t) director.endingCue(cues.shift()![1]);
    if (stinger && !stinger.fired && t >= stinger.at) {
      stinger.fired = true;
      if (stinger.call === 'biome') director.biomeCall();
      else if (stinger.call === 'clear') sim.events.emit('summit', { clearTimeMs: 9000, falls: 0, noFall: true, underPar: false, stars: 3 });
    }
    if (voice && !voice.fired && t >= 0.5) {
      voice.fired = true;
      speak(voice.name, director, engine);
    }
    director.update({ running: true, timeScale: 1, dt: SLICE_SECONDS, slowMo: false });
    if (spec.watch) {
      const gain = engine.bus(spec.watch)?.gain.value ?? 0;
      watched.push(gain > 0 ? 20 * Math.log10(gain) : -120);
    }
    ctx.resume();
  }

  const buffer = await rendered;
  const left = buffer.getChannelData(0);
  return { seconds: spec.seconds, ...measure([left, buffer.getChannelData(1)]), perSecondDb: secondsProfile(left), watchedDb: watched };
}

function secondsProfile(samples: Float32Array): number[] {
  const out: number[] = [];
  for (let start = 0; start + METER_RATE <= samples.length; start += METER_RATE) {
    let acc = 0;
    for (let i = start; i < start + METER_RATE; i++) acc += samples[i]! * samples[i]!;
    out.push(10 * Math.log10(acc / METER_RATE + 1e-12));
  }
  return out;
}

/** 16-bit PCM WAV of an offline render, base64 — the blind-listen panel's own material (R-AU-11). */
function encodeWav(buffer: AudioBuffer): string {
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const frames = left.length;
  const data = new DataView(new ArrayBuffer(44 + frames * 4));
  const string = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) data.setUint8(at + i, text.charCodeAt(i));
  };
  const number = (at: number, value: number, bytes: number) => {
    for (let i = 0; i < bytes; i++) data.setUint8(at + i, (value >>> (i * 8)) & 0xff);
  };
  string(0, 'RIFF');
  number(4, 36 + frames * 4, 4);
  string(8, 'WAVEfmt ');
  number(16, 16, 4);
  number(20, 1, 2);
  number(22, 2, 2);
  number(24, METER_RATE, 4);
  number(28, METER_RATE * 4, 4);
  number(32, 4, 2);
  number(34, 16, 2);
  string(36, 'data');
  number(40, frames * 4, 4);
  let at = 44;
  for (let i = 0; i < frames; i++) {
    for (const channel of [left, right]) {
      const sample = Math.max(-1, Math.min(1, channel[i]!));
      data.setInt16(at, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      at += 2;
    }
  }
  // Base64 in chunks: a spread over a whole render would blow the call stack.
  const bytes = new Uint8Array(data.buffer);
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(text);
}

/** Renders the spec and returns its WAV, base64, for the listen panel. */
async function renderWavSpec(spec: RenderSpec): Promise<string> {
  const ctx = new OfflineAudioContext(2, Math.round(spec.seconds * METER_RATE), METER_RATE);
  const engine = new AudioEngine({ createContext: () => ctx as unknown as AudioContext, master: spec.flatMaster ? FLAT_MASTER : undefined });
  engine.unlock();
  for (const name of spec.mute ?? []) engine.bus(name)!.gain.value = 0;
  const director = new AudioDirector(engine);
  const levelId = spec.scenario.kind === 'ending' ? 'stratosphere-14' : spec.scenario.levelId;
  const sim = new Simulation(await loadRapier(), levelById(levelId));
  director.bind(sim);
  const quiet = spec.scenario.kind === 'ending' || spec.scenario.kind === 'stinger' || spec.scenario.kind === 'voice';
  const player = quiet ? null : await loadRoute(levelId);
  const fallAt = spec.scenario.kind === 'tumble' ? spec.scenario.fallAtSeconds : Infinity;
  const stinger = spec.scenario.kind === 'stinger' ? { at: spec.scenario.callAtSeconds, call: spec.scenario.call, fired: false } : null;
  const voice = spec.scenario.kind === 'voice' ? { name: spec.scenario.name, fired: false } : null;
  const slices = Math.floor(spec.seconds / SLICE_SECONDS);
  const stops = Array.from({ length: slices - 1 }, (_, k) => ctx.suspend((k + 1) * SLICE_SECONDS));
  const rendered = ctx.startRendering();
  let simTicks = 0;
  let ducked = false;
  const cues = [...ENDING_CUES];
  for (let k = 0; k < stops.length; k++) {
    await stops[k];
    const t = (k + 1) * SLICE_SECONDS;
    if (player) {
      while (simTicks < Math.floor(t * SIM_HZ)) {
        sim.step(t >= fallAt || player.done ? IDLE_INPUT : player.next());
        simTicks++;
      }
    }
    const inAd = spec.adBetween !== undefined && t >= spec.adBetween[0] && t < spec.adBetween[1];
    if (inAd !== ducked) engine.setAdDuck((ducked = inAd));
    while (cues.length > 0 && cues[0]![0] <= t) director.endingCue(cues.shift()![1]);
    if (stinger && !stinger.fired && t >= stinger.at) {
      stinger.fired = true;
      if (stinger.call === 'biome') director.biomeCall();
      else if (stinger.call === 'clear') sim.events.emit('summit', { clearTimeMs: 9000, falls: 0, noFall: true, underPar: false, stars: 3 });
    }
    if (voice && !voice.fired && t >= 0.5) {
      voice.fired = true;
      speak(voice.name, director, engine);
    }
    director.update({ running: true, timeScale: 1, dt: SLICE_SECONDS, slowMo: false });
    ctx.resume();
  }
  const buffer = await rendered;
  return encodeWav(buffer);
}

/** Speaks one UI voice, the way the game speaks it, for the class peak law (R-AU-08). */
function speak(name: UiVoice, director: AudioDirector, engine: AudioEngine): void {
  const motif = director.music.motifHz;
  switch (name) {
    case 'tick':
      director.tick();
      break;
    case 'charge1':
    case 'charge2':
    case 'charge3':
      playChargeLevel(engine, Number(name.slice(-1)));
      break;
    case 'stamp0':
    case 'stamp1':
    case 'stamp2':
      playStarStamp(engine, Number(name.slice(-1)), motif);
      break;
    case 'fanfare':
      playFanfare(engine, motif);
      break;
    case 'biomeCall':
      playBiomeCall(engine, motif);
      break;
    case 'parCall':
      playParCall(engine, motif);
      break;
    case 'ghostSet':
      playGhostSet(engine, motif);
      break;
    case 'fallTopper':
      playFallTopper(engine);
      break;
  }
}

const hooks = window as unknown as { renderAudio: typeof render; renderAudioWav: typeof renderWavSpec; ready: boolean };
hooks.renderAudio = render;
hooks.renderAudioWav = renderWavSpec;
hooks.ready = true;
