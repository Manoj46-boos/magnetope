import type { AudioEngine } from './engine';
import type { HumParams } from './mix';

const SMOOTH = 0.05;

/** The polarity hum: low sines in attract mode, a detuned saw shimmer in repel mode. */
export class HumVoice {
  private gAttract: GainNode | null = null;
  private gRepel: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private tremolo: GainNode | null = null;
  private built = false;

  constructor(private readonly engine: AudioEngine) {}

  private build(): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('sfx');
    if (!ctx || !bus) return;
    this.built = true;

    this.gAttract = ctx.createGain();
    this.gAttract.gain.value = 0;
    for (const f of [55, 110]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = f === 55 ? 1 : 0.55;
      o.connect(g);
      g.connect(this.gAttract);
      o.start();
    }
    this.gAttract.connect(bus);

    this.gRepel = ctx.createGain();
    this.gRepel.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 400;
    this.filter.Q.value = 2.5;
    this.tremolo = ctx.createGain();
    this.tremolo.gain.value = 1;
    for (const detune of [-9, 9]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 110;
      o.detune.value = detune;
      o.connect(this.filter);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 16;
    const depth = ctx.createGain();
    depth.gain.value = 0;
    lfo.connect(depth);
    depth.connect(this.tremolo.gain);
    lfo.start();
    this.lfoDepth = depth;
    this.filter.connect(this.tremolo);
    this.tremolo.connect(this.gRepel);
    this.gRepel.connect(bus);
  }

  private lfoDepth: GainNode | null = null;

  update(params: HumParams): void {
    if (!this.engine.audible) return;
    if (!this.built) this.build();
    const ctx = this.engine.ctx;
    if (!ctx || !this.gAttract || !this.gRepel || !this.filter || !this.lfoDepth) return;
    const t = ctx.currentTime;
    this.gAttract.gain.setTargetAtTime(params.attractGain, t, SMOOTH);
    this.gRepel.gain.setTargetAtTime(params.repelGain, t, SMOOTH);
    this.filter.frequency.setTargetAtTime(params.repelCutoffHz, t, SMOOTH);
    this.lfoDepth.gain.setTargetAtTime(params.tremoloDepth, t, 0.08);
  }

  silence(): void {
    this.update({ attractGain: 0, repelGain: 0, repelCutoffHz: 400, tremoloDepth: 0 });
  }
}

/** One filtered-noise wind voice shared by the ambience and the gameplay gust. */
export class WindVoice {
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private built = false;

  constructor(private readonly engine: AudioEngine) {}

  private build(): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('amb');
    const buffer = this.engine.noiseBuffer;
    if (!ctx || !bus || !buffer) return;
    this.built = true;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.Q.value = 0.7;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    src.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(bus);
    src.start();
  }

  update(centerHz: number, gain: number): void {
    if (!this.engine.audible) return;
    if (!this.built) this.build();
    const ctx = this.engine.ctx;
    if (!ctx || !this.filter || !this.gain) return;
    this.filter.frequency.setTargetAtTime(centerHz, ctx.currentTime, 0.2);
    this.gain.gain.setTargetAtTime(gain, ctx.currentTime, 0.25);
  }
}

/** A heavy wheel turning on a dry bearing: a low saw through a band-pass, shuddering once per rotation of the rim. */
export class AxleVoice {
  private osc: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private built = false;

  constructor(private readonly engine: AudioEngine) {}

  private build(): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('amb');
    if (!ctx || !bus) return;
    this.built = true;
    this.osc = ctx.createOscillator();
    this.osc.type = 'sawtooth';
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.Q.value = 5;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    const shudder = ctx.createOscillator();
    shudder.frequency.value = 3.1;
    const depth = ctx.createGain();
    depth.gain.value = 18;
    shudder.connect(depth);
    depth.connect(this.osc.frequency);
    this.osc.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(bus);
    this.osc.start();
    shudder.start();
  }

  update(pitchHz: number, cutoffHz: number, gain: number): void {
    if (!this.engine.audible) return;
    if (!this.built) {
      if (gain <= 0) return;
      this.build();
    }
    const ctx = this.engine.ctx;
    if (!ctx || !this.osc || !this.filter || !this.gain) return;
    const t = ctx.currentTime;
    this.osc.frequency.setTargetAtTime(pitchHz, t, 0.2);
    this.filter.frequency.setTargetAtTime(cutoffHz, t, 0.2);
    this.gain.gain.setTargetAtTime(gain, t, 0.25);
  }
}

/** Mains-frequency buzz with harmonics: the Metropolis signage you never see but always hear. */
export class BuzzVoice {
  private gain: GainNode | null = null;
  private built = false;

  constructor(private readonly engine: AudioEngine) {}

  private build(): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('amb');
    if (!ctx || !bus) return;
    this.built = true;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 1.2;
    const partials: Array<[number, OscillatorType, number]> = [
      [60, 'sine', 0.9],
      [120, 'sawtooth', 0.7],
      [240, 'square', 0.25],
    ];
    for (const [frequency, type, level] of partials) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g);
      g.connect(filter);
      osc.start();
    }
    filter.connect(this.gain);
    this.gain.connect(bus);
  }

  update(level: number): void {
    if (!this.engine.audible) return;
    if (!this.built) {
      if (level <= 0) return;
      this.build();
    }
    const ctx = this.engine.ctx;
    if (!ctx || !this.gain) return;
    this.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.3);
  }
}

/** Sine glide whistle for long falls; pitch follows the drop and the shared time scale. */
export class WhistleVoice {
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private vibrato: GainNode | null = null;
  private built = false;

  constructor(private readonly engine: AudioEngine) {}

  private build(): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.bus('sfx');
    if (!ctx || !bus) return;
    this.built = true;
    this.osc = ctx.createOscillator();
    this.osc.type = 'sine';
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6.5;
    this.vibrato = ctx.createGain();
    this.vibrato.gain.value = 0;
    lfo.connect(this.vibrato);
    this.vibrato.connect(this.osc.frequency);
    this.osc.connect(this.gain);
    this.gain.connect(bus);
    this.osc.start();
    lfo.start();
  }

  update(frequency: number, gain: number, slowMo: boolean): void {
    if (!this.engine.audible) return;
    if (!this.built) this.build();
    const ctx = this.engine.ctx;
    if (!ctx || !this.osc || !this.gain || !this.vibrato) return;
    const t = ctx.currentTime;
    this.osc.frequency.setTargetAtTime(frequency, t, 0.05);
    this.gain.gain.setTargetAtTime(gain, t, 0.06);
    this.vibrato.gain.setTargetAtTime(slowMo ? frequency * 0.04 : 0, t, 0.1);
  }
}
