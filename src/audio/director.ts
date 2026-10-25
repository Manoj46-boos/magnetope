import { Rng } from '@/core/rng';
import { clamp, hypot2 } from '@/core/mathx';
import { MATERIALS } from '@/config/materials';
import { gradeRank } from '@/config/cosmetics';
import { TUNING } from '@/config/tuning';
import type { Simulation } from '@/sim/simulation';
import type { FallGrade } from '@/sim/fall';
import { gustForecast } from '@/sim/wind';
import { EventEnvelope, EVENT_WEIGHTS } from './intensity';
import { AxleVoice, BuzzVoice, HumVoice, WhistleVoice, WindVoice } from './continuous';
import type { AudioEngine } from './engine';
import { AMBIENCE, axleGroan, humParams, whistleFrequency, whistleGain, windVoice, type Ambience } from './mix';
import { MusicPlayer } from './music';
import type { StingerKind } from './stingers';
import {
  playAttach,
  playBiomeCall,
  playBird,
  playBoing,
  playChargeLevel,
  playBloomSwell,
  playChirp,
  playClank,
  playCoreSeat,
  playCreak,
  playCrumble,
  playFallTopper,
  playFanfare,
  playGetUp,
  playGhostSet,
  playGlassBreak,
  playIceBreak,
  playImpact,
  playParCall,
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
/** R-AU-05: the breath after a stinger's slot, before the bed comes back up. */
const STINGER_GAP_S = 0.1;

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
  /** R-AU-05: the stinger slot — one word at a time, the bed held under it. */
  private stingerKind: StingerKind | null = null;
  private stingerUntil = 0;
  /** The clear verdict the card is about to spend: its stars, its par, its ghost. */
  private verdict: { stars: number; underPar: boolean; ghost: boolean } | null = null;

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
    this.music.setBiome(sim.level.biome, sim.level.id);
    const e = this.engine;
    const on = sim.events.on.bind(sim.events);
    this.unsubscribe.push(
      on('attach', (ev) => {
        playAttach(e, MATERIALS[ev.material].voice, clamp(ev.speed / 12, 0.2, 1));
        this.envelope.event(ev.viaSnap ? EVENT_WEIGHTS.snap : EVENT_WEIGHTS.catch);
        if (ev.viaSnap) playTick(e, 2000, 'sfx', 0.6);
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
      on('restore', () => playTick(e, 1500, 'sfx', 0.6)),
      on('followerMove', (ev) => playSlide(e, ev.direction)),
      on('slowMo', () => this.chirp('uh-oh')),
      on('saved', () => this.chirp('relief')),
      on('summit', (summary) => {
        // R-AU-01/05: the clear stinger signs the game's name — the motif quote — and the card's verdict follows it.
        this.verdict = { stars: summary.stars, underPar: summary.underPar, ghost: false };
        this.stinger('clear', 1.5, () => playFanfare(e, this.music.motifHz));
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
    this.music.setEnding(false);
    if (this.stingerKind !== null) this.engine.setStingerDuck(false);
    this.stingerKind = null;
    this.stingerUntil = 0;
    this.verdict = null;
  }

  /**
   * R-AU-05: the stinger slot. One word at a time, side-chaining the bed for its
   * whole length (never masked), quieting the chirp bus around it (R-AU-06); a
   * word may answer itself — the stamp ceremony — and a scheduled piece may
   * queue after the slot, but no word ever talks over another kind's moment.
   */
  private stinger(kind: StingerKind, maxS: number, speak: () => void, at?: number): boolean {
    const now = this.engine.now;
    const starts = at ?? now;
    if (starts < this.stingerUntil && this.stingerKind !== kind) return false;
    speak();
    this.stingerKind = kind;
    this.engine.setStingerDuck(true);
    const end = starts + maxS;
    this.stingerUntil = Math.max(this.stingerUntil, end);
    this.quietFor(end + STINGER_GAP_S - now);
    return true;
  }

  /** R-AU-01/03: the biome card's own spelling of the motif — the re-harmonized announce. */
  biomeCall(): void {
    this.stinger('biome-enter', 1.4, () => playBiomeCall(this.engine, this.music.motifHz));
  }

  /**
   * R-AU-05: the fall card's word. The small grades get the deadpan plop; the
   * spectacular ones keep the stage for MAGNO's own deadpan — the silence is
   * the sting (the comedy law).
   */
  fallVerdict(grade: FallGrade): void {
    if (gradeRank(grade) >= gradeRank('A')) return;
    this.stinger('fall-verdict', 0.35, () => playFallTopper(this.engine));
  }

  /** R-AU-05: the game's own knowledge — the run went on record; the toast rides the verdict chain. */
  ghostToast(): void {
    if (this.verdict) this.verdict.ghost = true;
  }

  starStamp(index: number, stars?: number): void {
    // R-CH-06: the ta-da is the ceremony's own coda — MAGNO's word rides the last stamp, in its moment.
    if (stars === 3 && index === 2) this.chirp('ta-da', true);
    const now = this.engine.now;
    if (!this.stinger('star-stamp', 0.26, () => playStarStamp(this.engine, index, this.music.motifHz))) return;
    // The verdict chain: the par coda and the ghost toast answer the last stamp, on the audio clock.
    const verdict = this.verdict;
    if (!verdict || index !== verdict.stars - 1) return;
    if (verdict.underPar) this.stinger('par-beat', 0.3, () => playParCall(this.engine, this.music.motifHz, now + 0.3), now + 0.3);
    if (verdict.ghost) {
      const at = now + (verdict.underPar ? 0.64 : 0.3);
      this.stinger('ghost-set', 0.5, () => playGhostSet(this.engine, this.music.motifHz, at), at);
    }
  }

  /** R-CH-06: one word of MAGNO's language, held to its bus, its repeat guard and the stinger gate. A word that owns its moment — the verdict's coda — may speak with its own ceremony. */
  chirp(name: ChirpName, ownMoment = false): void {
    const now = this.engine.ctx?.currentTime ?? -1;
    if (now < 0) return;
    if (!ownMoment && now < this.quietUntil) return;
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

  /** Score cues of the ending film. From the seat, the film is through-composed: the cues are the score (R-AU-12). */
  endingCue(cue: 'seat' | 'bloom' | 'pullback' | 'credits'): void {
    const motif = this.music.motifHz;
    if (cue === 'seat') {
      playCoreSeat(this.engine);
      this.quietFor(1.9);
      this.music.setEnding(true);
    } else if (cue === 'bloom') {
      playBloomSwell(this.engine, this.music.tonicHz, this.endingBus() ?? undefined);
    } else if (cue === 'pullback') {
      playPullbackPad(this.engine, this.music.tonicHz, this.endingBus() ?? undefined);
      // R-CH-06: the homecoming word rides the wide quiet shot, before the credits fanfare.
      this.chirp('home');
    } else {
      // R-AU-01: the ending resolve — the motif, signed off.
      playFanfare(this.engine, motif);
      this.quietFor(1.6);
    }
  }

  /** Fades the long pads out, e.g. when the player skips the film. */
  stopEnding(): void {
    this.music.setEnding(false);
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
    // R-AU-05: the bed comes back up when the stinger's slot has passed.
    const now = this.engine.now;
    if (this.stingerKind !== null && now >= this.stingerUntil) {
      this.stingerKind = null;
      this.engine.setStingerDuck(false);
    }
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
