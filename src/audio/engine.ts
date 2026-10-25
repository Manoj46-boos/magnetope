/** Bus levels from PRD 9.6, in dB relative to the master. The chirp bus sits six
 * under the music bed by law (R-AU-06): MAGNO's voice is felt, never a soloist. */
export const BUS_DB = { sfx: -12, music: -18, amb: -24, ui: -20, chirp: -24 } as const;
export const AD_DUCK_DB = -6;
const AD_MUSIC_FLOOR_DB = -24;
const VOICE_TAIL_S = 0.04;

/**
 * The master stage after the buses (PRD 9.6: -14 LUFS integrated, true peak under -1.5 dBTP).
 * A compressor tames the transients, make-up gain brings the programme up to level, and a
 * soft-knee shaper at the ceiling keeps what is left of the peaks under it.
 */
export interface MasterStage {
  gain: number;
  compressor: { threshold: number; knee: number; ratio: number; attack: number; release: number };
  makeupDb: number;
  ceilingDb: number;
  kneeDb: number;
}

export const MASTER: MasterStage = {
  gain: 0.85,
  compressor: { threshold: -24, knee: 12, ratio: 6, attack: 0.003, release: 0.22 },
  makeupDb: 7.5,
  ceilingDb: -2,
  kneeDb: -8,
};

/** A master that changes nothing, so the buses can be measured against each other before mastering. */
export const FLAT_MASTER: MasterStage = {
  gain: MASTER.gain,
  compressor: { threshold: 0, knee: 0, ratio: 1, attack: 0.003, release: 0.25 },
  makeupDb: 0,
  ceilingDb: 0,
  kneeDb: 0,
};

/** Linear up to the knee, then bends smoothly toward the ceiling and never passes it. */
export function ceilingCurve(ceilingDb: number, kneeDb: number, points = 2049): Float32Array<ArrayBuffer> {
  const ceiling = fromDb(ceilingDb);
  const knee = fromDb(kneeDb);
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * 2 - 1;
    const magnitude = Math.abs(x);
    const room = ceiling - knee;
    const y = magnitude <= knee ? magnitude : room > 0 ? knee + room * Math.tanh((magnitude - knee) / room) : knee;
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

export const fromDb = (db: number): number => 10 ** (db / 20);

export type BusName = keyof typeof BUS_DB;

export interface AudioEngineOptions {
  createContext?: () => AudioContext;
  maxVoices?: number;
  /** Replaces the mastering stage; for measurement only. */
  master?: MasterStage;
}

/**
 * Owns the single AudioContext and the mix graph:
 * master -> compressor -> make-up -> ceiling -> destination, with sfx, music, ambience and
 * ui buses feeding the master. The context is created and resumed on the first
 * player input so autoplay policies are respected, and the whole layer is
 * optional: the game plays identically with it muted or unavailable.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buses = new Map<BusName, GainNode>();
  private noise: AudioBuffer | null = null;
  private room: AudioBuffer | null = null;
  private roomSend: ConvolverNode | null = null;
  private soundOn = true;
  private musicOn = true;
  private ducked = false;
  private voiceEnds: number[] = [];
  private readonly maxVoices: number;
  private readonly stage: MasterStage;
  private readonly createContext: () => AudioContext;

  constructor(options: AudioEngineOptions = {}) {
    this.maxVoices = options.maxVoices ?? 28;
    this.stage = options.master ?? MASTER;
    this.createContext =
      options.createContext ??
      (() => {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        return new Ctor({ latencyHint: 'interactive' });
      });
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  get audible(): boolean {
    return this.ctx !== null && this.soundOn;
  }

  /** Call from a real user gesture. Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) this.build();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
    } catch {
      this.ctx = null;
    }
  }

  private build(): void {
    const ctx = this.createContext();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.soundOn ? this.stage.gain : 0;
    const compressor = ctx.createDynamicsCompressor();
    Object.entries(this.stage.compressor).forEach(([name, value]) => {
      (compressor[name as keyof MasterStage['compressor']] as AudioParam).value = value;
    });
    const makeup = ctx.createGain();
    makeup.gain.value = fromDb(this.stage.makeupDb);
    const ceiling = ctx.createWaveShaper();
    ceiling.curve = ceilingCurve(this.stage.ceilingDb, this.stage.kneeDb);
    ceiling.oversample = '4x';
    master.connect(compressor);
    compressor.connect(makeup);
    makeup.connect(ceiling);
    ceiling.connect(ctx.destination);
    this.master = master;

    for (const name of Object.keys(BUS_DB) as BusName[]) {
      const bus = ctx.createGain();
      bus.gain.value = fromDb(BUS_DB[name]);
      bus.connect(master);
      this.buses.set(name, bus);
    }
    this.buses.get('music')!.gain.value = this.musicOn ? fromDb(BUS_DB.music) : 0;

    this.noise = this.makeNoise(ctx, 2);
    this.room = this.makeRoom(ctx);
    const convolver = ctx.createConvolver();
    convolver.buffer = this.room;
    const send = ctx.createGain();
    send.gain.value = 0.9;
    convolver.connect(send);
    send.connect(this.buses.get('sfx')!);
    this.roomSend = convolver;
  }

  private makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x9e3779b9;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }
    return buffer;
  }

  /** Generated 64-tap impulse response: a small room with zero download cost. */
  private makeRoom(ctx: AudioContext): AudioBuffer {
    const taps = 64;
    const length = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 7;
    for (let t = 0; t < taps; t++) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      const pos = Math.floor(Math.pow(t / taps, 1.7) * (length - 1));
      const sign = seed & 1 ? 1 : -1;
      data[pos] = (data[pos] ?? 0) + sign * Math.exp(-3.4 * (t / taps)) * 0.7;
    }
    return buffer;
  }

  bus(name: BusName): GainNode | null {
    return this.buses.get(name) ?? null;
  }

  get noiseBuffer(): AudioBuffer | null {
    return this.noise;
  }

  get reverbSend(): ConvolverNode | null {
    return this.roomSend;
  }

  /** Reserve a voice slot until the audio clock passes its end; false means the cap is reached and the sound is dropped. */
  acquireVoice(durationSeconds: number): boolean {
    if (!this.audible) return false;
    const now = this.now;
    this.voiceEnds = this.voiceEnds.filter((end) => end > now);
    if (this.voiceEnds.length >= this.maxVoices) return false;
    this.voiceEnds.push(now + durationSeconds + VOICE_TAIL_S);
    return true;
  }

  setSound(on: boolean): void {
    this.soundOn = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? this.stage.gain : 0, this.ctx.currentTime, 0.03);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    this.applyMusicGain();
  }

  /** Music dips 6 dB, and to a floor of -24 dB, around any ad so midrolls never fight the game. */
  setAdDuck(active: boolean): void {
    this.ducked = active;
    this.applyMusicGain();
  }

  private applyMusicGain(): void {
    const bus = this.buses.get('music');
    if (!bus || !this.ctx) return;
    let db: number = BUS_DB.music;
    if (this.ducked) db = Math.min(db + AD_DUCK_DB, AD_MUSIC_FLOOR_DB);
    bus.gain.setTargetAtTime(this.musicOn ? fromDb(db) : 0, this.ctx.currentTime, 0.12);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }
}
