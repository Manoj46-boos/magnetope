import { Rng } from '@/core/rng';
import { clamp, hypot2 } from '@/core/mathx';
import { MATERIALS } from '@/config/materials';
import { TUNING } from '@/config/tuning';
import type { Simulation } from '@/sim/simulation';
import { gustForecast } from '@/sim/wind';
import { EventEnvelope, EVENT_WEIGHTS } from './intensity';
import { AxleVoice, BuzzVoice, HumVoice, WhistleVoice, WindVoice } from './continuous';
import type { AudioEngine } from './engine';
import { AMBIENCE, axleGroan, humParams, whistleFrequency, whistleGain, windVoice, type Ambience } from './mix';
import { MusicPlayer } from './music';
import {
  playAttach,
  playBird,
  playBoing,
  playChargeLevel,
  playBloomSwell,
  playChirp,
  playClank,
  playCoreSeat,
  playCreak,
  playCrumble,
  playFanfare,
  playGetUp,
  playGlassBreak,
  playIceBreak,
  playImpact,
  playPing,
  playPullbackPad,
  playRepel,
  playSlide,
  playSnapEngage,
  playSnapWhiff,
  playStarStamp,
  playStress,
  playTick,
  type ChirpName,
} from './recipes';

const AMBIENT_VOICES: Readonly<Record<NonNullable<Ambience['event']>, (engine: AudioEngine, seed: number) => void>> = {
  clank: playClank,
  bird: playBird,
  creak: playCreak,
  ping: playPing,
};

export interface AudioFrame {
  running: boolean;
  timeScale: number;
  dt: number;
  slowMo: boolean;
}

const PROXIMITY_INTERVAL = 0.1;
/** R-AU-06: the same word twice inside this window is machine-gun fire, not speech. */
const CHIRP_REPEAT_S = 2;

/** Maps simulation events and state onto the audio engine; the only audio entry point for the game. */
export class AudioDirector {
  readonly music: MusicPlayer;
  private readonly hum: HumVoice;
  private readonly wind: WindVoice;
  private readonly buzz: BuzzVoice;
  private readonly axle: AxleVoice;
  private readonly whistle: WhistleVoice;
  private readonly rng = new Rng(404);
  private readonly envelope = new EventEnvelope();
  private sim: Simulation | null = null;
  private unsubscribe: Array<() => void> = [];
  private proximity = 0;
  private proximityClock = 0;
  private ambienceClock = 4;
  private endingGain: GainNode | null = null;
  /** R-AU-06: the chirp bus holds its tongue while a stinger owns the moment. */
  private quietUntil = 0;
  private readonly lastChirpAt = new Map<ChirpName, number>();

  constructor(private readonly engine: AudioEngine) {
    this.music = new MusicPlayer(engine);
    this.hum = new HumVoice(engine);
    this.wind = new WindVoice(engine);
    this.buzz = new BuzzVoice(engine);
    this.axle = new AxleVoice(engine);
    this.whistle = new WhistleVoice(engine);
  }

  bind(sim: Simulation): void {
    this.unbind();
    this.sim = sim;
    this.envelope.reset();
    this.music.setBiome(sim.level.biome);
    const e = this.engine;
    const on = sim.events.on.bind(sim.events);
    this.unsubscribe.push(
      on('attach', (ev) => {
        playAttach(e, MATERIALS[ev.material].voice, clamp(ev.speed / 12, 0.2, 1));
        this.envelope.event(ev.viaSnap ? EVENT_WEIGHTS.snap : EVENT_WEIGHTS.catch);
        if (ev.viaSnap) playTick(e, 2000, 'sfx');
      }),
      on('repel', (ev) => {
        playRepel(e, ev.power);
        this.envelope.event(EVENT_WEIGHTS.launch);
        // R-CH-06: the whee belongs to the full-power release — the same bar that earns the freeze.
        if (ev.power >= 1) this.chirp('whee');
      }),
      on('snapEngage', () => playSnapEngage(e)),
      on('snapWhiff', () => {
        playSnapWhiff(e);
        this.chirp('miss');
      }),
      on('impact', (ev) => {
        if (ev.speed >= 3) playImpact(e, MATERIALS[ev.material].voice, ev.speed);
      }),
      on('chargeLevel', (ev) => {
        playChargeLevel(e, ev.level);
        // R-CH-06: focus is named at the top of the meter, not on every step of the climb.
        if (ev.level === 3) this.chirp('focused');
      }),
      on('limp', () => this.chirp('ouch')),
      on('recoverBegin', () => this.chirp('weary')),
      on('recoverEnd', () => playGetUp(e)),
      on('weakCrumble', () => playCrumble(e)),
      on('glassBreak', () => playGlassBreak(e)),
      on('boing', (ev) => playBoing(e, ev.outSpeed)),
      on('crumbleWarn', (ev) => {
        playStress(e, this.isIcy(ev.propIndex));
        this.chirp('wary');
      }),
      on('crumble', (ev) => (this.isIcy(ev.propIndex) ? playIceBreak(e) : playCrumble(e))),
      on('restore', () => playTick(e, 1500, 'sfx')),
      on('followerMove', (ev) => playSlide(e, ev.direction)),
      on('slowMo', () => this.chirp('uh-oh')),
      on('saved', () => this.chirp('relief')),
      on('summit', () => {
        playFanfare(e, this.music.tonicHz);
        this.quietFor(1.6);
      }),
    );
  }

  private isIcy(propIndex: number): boolean {
    return this.sim?.physics.props[propIndex]?.kind.detail === 'ice';
  }

  unbind(): void {
    this.unsubscribe.forEach((off) => off());
    this.unsubscribe = [];
    this.hum.silence();
    this.buzz.update(0);
    this.axle.update(46, 260, 0);
  }

  starStamp(index: number, stars?: number): void {
    playStarStamp(this.engine, index, this.music.tonicHz);
    // R-CH-06: the ta-da is the full verdict's — the last stamp of a three-star clear.
    if (stars === 3 && index === 2) this.chirp('ta-da');
  }

  /** R-CH-06: one word of MAGNO's language, held to its bus, its repeat guard and the stinger gate. */
  chirp(name: ChirpName): void {
    const now = this.engine.ctx?.currentTime ?? -1;
    if (now < 0 || now < this.quietUntil) return;
    if (now - (this.lastChirpAt.get(name) ?? -Infinity) < CHIRP_REPEAT_S) return;
    this.lastChirpAt.set(name, now);
    playChirp(this.engine, name);
  }

  /** R-AU-06: holds the chirp bus silent while a stinger owns the moment. */
  private quietFor(seconds: number): void {
    const now = this.engine.ctx?.currentTime;
    if (now === undefined) return;
    this.quietUntil = Math.max(this.quietUntil, now + seconds);
  }

  /** The score's event-density envelope, 0..1 (R-LD-08): how thick the beats are right now. */
  get intensity(): number {
    return this.envelope.intensity;
  }

  tick(): void {
    playTick(this.engine);
  }

  /** Score cues of the ending film. The adaptive music stays underneath as the room tone. */
  endingCue(cue: 'seat' | 'bloom' | 'pullback' | 'credits'): void {
    const tonic = this.music.tonicHz;
    if (cue === 'seat') {
      playCoreSeat(this.engine);
      this.quietFor(1.9);
    } else if (cue === 'bloom') {
      playBloomSwell(this.engine, tonic, this.endingBus() ?? undefined);
    } else if (cue === 'pullback') {
      playPullbackPad(this.engine, tonic, this.endingBus() ?? undefined);
      // R-CH-06: the homecoming word rides the wide quiet shot, before the credits fanfare.
      this.chirp('home');
    } else {
      playFanfare(this.engine, tonic);
      this.quietFor(1.6);
    }
  }

  /** Fades the long pads out, e.g. when the player skips the film. */
  stopEnding(): void {
    const bus = this.endingGain;
    const ctx = this.engine.ctx;
    if (!bus || !ctx) return;
    this.endingGain = null;
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    window.setTimeout(() => bus.disconnect(), 1200);
  }

  private endingBus(): GainNode | null {
    if (this.endingGain) return this.endingGain;
    const ctx = this.engine.ctx;
    const music = this.engine.bus('music');
    if (!ctx || !music) return null;
    this.endingGain = ctx.createGain();
    this.endingGain.connect(music);
    return this.endingGain;
  }

  update(frame: AudioFrame): void {
    const sim = this.sim;
    if (!sim || !this.engine.audible) return;
    const view = sim.magno.view;
    const level = sim.level;

    this.proximityClock -= frame.dt;
    if (this.proximityClock <= 0) {
      this.proximityClock = PROXIMITY_INTERVAL;
      const near = sim.physics.snapCandidates(view.position, new Set());
      const nearest = near.reduce<number>((m, c) => Math.min(m, c.distance), TUNING.snap.radius);
      this.proximity = clamp(1 - nearest / TUNING.snap.radius, 0, 1);
    }

    this.hum.update(
      humParams({
        polarity: view.polarity,
        charge01: view.charge01,
        proximity: this.proximity,
        attached: view.state === 'attached' || view.state === 'charging',
      }),
    );

    const speed = hypot2(view.velocity.x, view.velocity.y);
    const falling = view.velocity.y < -4 && view.state !== 'attached' && view.state !== 'charging';
    this.whistle.update(
      whistleFrequency(view.dropMeters, frame.timeScale),
      falling ? whistleGain(view.dropMeters, speed) : 0,
      frame.slowMo,
    );

    const climb = Math.max(1, level.summit.y);
    const altitude = clamp(view.position.y / climb, 0, 1);
    const gust = gustForecast(level, sim.hazardClockMs, view.position.y);
    const voice = windVoice(level.biome, altitude, gust);
    this.wind.update(voice.centerHz, voice.gain);

    this.envelope.update(frame.dt);
    this.music.update({ running: frame.running, heightFrac: altitude, chaining: view.chaining, timeScale: frame.timeScale, intensity: this.envelope.intensity });

    const groan = axleGroan(frame.running ? sim.physics.axleSpeed() : 0);
    this.axle.update(groan.pitchHz, groan.cutoffHz, groan.gain);

    const ambience = AMBIENCE[level.biome];
    this.buzz.update(frame.running ? ambience.buzz : 0);
    if (ambience.event && frame.running) {
      this.ambienceClock -= frame.dt;
      if (this.ambienceClock <= 0) {
        this.ambienceClock = this.rng.range(ambience.intervalS[0], ambience.intervalS[1]);
        const seed = Math.floor(this.rng.next() * 1000);
        AMBIENT_VOICES[ambience.event](this.engine, seed);
      }
    }
  }
}
