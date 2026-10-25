import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AudioDirector } from '@/audio/director';
import { EventEnvelope, EVENT_WEIGHTS } from '@/audio/intensity';
import { AD_DUCK_DB, AudioEngine, BUS_DB, MASTER, MIX_HIERARCHY, STINGER_DUCK_DB, ceilingCurve, fromDb } from '@/audio/engine';
import { AMBIENCE, axleGroan, SCORES, stemMix, windVoice } from '@/audio/mix';
import { MAGNO_MOTIF, degreeSemitones } from '@/audio/score';
import { STINGERS } from '@/audio/stingers';
import { playAttach, playBird, playChirp, playFanfare, playRepel, playSnapEngage } from '@/audio/recipes';
import { prop } from '@/levels/author';
import { levelById } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';
import { gustForecast } from '@/sim/wind';
import { Driver, floor, makeLevel } from './helpers/harness';

class ParamStub {
  value = 0;
  lastTarget: number | null = null;
  setValueAtTime(v: number): void {
    this.value = v;
  }
  exponentialRampToValueAtTime(v: number): void {
    this.value = v;
  }
  linearRampToValueAtTime(v: number): void {
    this.value = v;
  }
  setTargetAtTime(v: number): void {
    this.lastTarget = v;
  }
}

const PARAMS = new Set(['gain', 'frequency', 'Q', 'detune', 'threshold', 'knee', 'ratio', 'attack', 'release']);

interface FakeNode {
  kind: string;
  [key: string]: unknown;
}

function createFakeContext() {
  const nodes: FakeNode[] = [];
  const make = (kind: string): FakeNode => {
    const store: Record<string, unknown> = { kind };
    const proxy = new Proxy(store, {
      get(target, prop: string) {
        if (prop === 'connect' || prop === 'disconnect' || prop === 'start' || prop === 'stop') return () => proxy;
        if (PARAMS.has(prop)) {
          target[prop] ??= new ParamStub();
          return target[prop];
        }
        return target[prop];
      },
      set(target, prop: string, value) {
        if (PARAMS.has(prop) && typeof value === 'number') {
          target[prop] ??= new ParamStub();
          (target[prop] as ParamStub).value = value;
          return true;
        }
        target[prop] = value;
        return true;
      },
    }) as FakeNode;
    nodes.push(proxy);
    return proxy;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    state: 'suspended' as AudioContextState,
    destination: make('destination'),
    resumeCalls: 0,
    suspendCalls: 0,
    createGain: () => make('gain'),
    createOscillator: () => make('oscillator'),
    createBiquadFilter: () => make('filter'),
    createBufferSource: () => make('bufferSource'),
    createConvolver: () => make('convolver'),
    createWaveShaper: () => make('waveShaper'),
    createDynamicsCompressor: () => make('compressor'),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }) as unknown as AudioBuffer,
    resume() {
      this.resumeCalls++;
      this.state = 'running';
      return Promise.resolve();
    },
    suspend() {
      this.suspendCalls++;
      this.state = 'suspended';
      return Promise.resolve();
    },
  };
  return { ctx: ctx as unknown as AudioContext, raw: ctx, nodes };
}

function setup() {
  const fake = createFakeContext();
  let created = 0;
  const engine = new AudioEngine({
    createContext: () => {
      created++;
      return fake.ctx;
    },
  });
  return { engine, fake, contexts: () => created };
}

const count = (nodes: FakeNode[], kind: string) => nodes.filter((n) => n.kind === kind).length;

describe('AudioEngine lifecycle', () => {
  it('creates nothing until the player acts, respecting autoplay policy', () => {
    const { engine, contexts } = setup();
    expect(engine.ready).toBe(false);
    expect(contexts()).toBe(0);
  });

  it('unlocks once, resumes the context and ignores repeat unlocks', () => {
    const { engine, fake, contexts } = setup();
    engine.unlock();
    engine.unlock();
    engine.unlock();
    expect(contexts()).toBe(1);
    expect(fake.raw.resumeCalls).toBeGreaterThanOrEqual(1);
    expect(engine.ready).toBe(true);
  });

  it('survives an environment where audio cannot be created', () => {
    const engine = new AudioEngine({
      createContext: () => {
        throw new Error('NotSupportedError');
      },
    });
    expect(() => engine.unlock()).not.toThrow();
    expect(engine.audible).toBe(false);
    expect(() => playAttach(engine, 'body', 1)).not.toThrow();
  });

  it('builds the buses at the mix levels of the design', () => {
    const { engine } = setup();
    engine.unlock();
    for (const name of ['sfx', 'music', 'amb', 'ui', 'chirp'] as const) {
      const gain = engine.bus(name)!.gain as unknown as ParamStub;
      expect(gain.value).toBeCloseTo(fromDb(BUS_DB[name]), 5);
    }
    expect(BUS_DB).toEqual({ sfx: -12, music: -18, amb: -24, ui: -20, chirp: -24 });
    // R-AU-06: MAGNO's voice sits at least six under the music bed by law.
    expect(BUS_DB.chirp).toBeLessThanOrEqual(BUS_DB.music - 6);
  });

  it('routes through a compressor and an oversampled ceiling into the destination', () => {
    const { engine, fake } = setup();
    engine.unlock();
    expect(count(fake.nodes, 'compressor')).toBe(1);
    const [shaper] = fake.nodes.filter((n) => n.kind === 'waveShaper');
    expect(shaper!.oversample).toBe('4x');
    expect(shaper!.curve).toBeInstanceOf(Float32Array);
  });
});

describe('the ceiling curve', () => {
  const curve = ceilingCurve(MASTER.ceilingDb, MASTER.kneeDb);
  const at = (x: number): number => curve[Math.round(((x + 1) / 2) * (curve.length - 1))]!;

  it('leaves quiet signal untouched below the knee', () => {
    for (const x of [0.02, 0.1, 0.25, 0.39]) expect(at(x)).toBeCloseTo(x, 3);
  });

  it('never lets anything past the ceiling, and a full-scale signal lands within half a dB of it', () => {
    const ceiling = fromDb(MASTER.ceilingDb);
    expect(Math.max(...curve)).toBeLessThanOrEqual(ceiling);
    expect(at(1)).toBeGreaterThan(ceiling * fromDb(-0.5));
  });

  it('rises steadily and treats both polarities alike, so it adds no offset and keeps order', () => {
    for (let i = 1; i < curve.length; i++) expect(curve[i]!).toBeGreaterThanOrEqual(curve[i - 1]!);
    for (const x of [0.2, 0.5, 0.9]) expect(at(-x)).toBeCloseTo(-at(x), 5);
    expect(at(0)).toBe(0);
  });
});

describe('mute and ducking', () => {
  it('is silent when sound is off: no voices are even built', () => {
    const { engine, fake } = setup();
    engine.setSound(false);
    engine.unlock();
    const before = count(fake.nodes, 'oscillator');
    playAttach(engine, 'beam', 1);
    playRepel(engine, 1);
    playFanfare(engine, [110, 130.8, 146.8, 164.8, 220]);
    expect(count(fake.nodes, 'oscillator')).toBe(before);
    expect(engine.audible).toBe(false);
  });

  it('plays voices once sound is switched back on', () => {
    const { engine, fake } = setup();
    engine.setSound(false);
    engine.unlock();
    engine.setSound(true);
    const before = count(fake.nodes, 'oscillator');
    playAttach(engine, 'beam', 1);
    expect(count(fake.nodes, 'oscillator')).toBeGreaterThan(before);
  });

  it('ducks the music at least 6 dB around an ad and restores it afterwards', () => {
    const { engine } = setup();
    engine.unlock();
    const music = engine.bus('music')!.gain as unknown as ParamStub;
    engine.setAdDuck(true);
    const ducked = music.lastTarget!;
    expect(ducked).toBeLessThanOrEqual(fromDb(BUS_DB.music + AD_DUCK_DB) + 1e-9);
    engine.setAdDuck(false);
    expect(music.lastTarget!).toBeCloseTo(fromDb(BUS_DB.music), 5);
    expect(music.lastTarget!).toBeGreaterThan(ducked);
  });

  it('keeps the music off through an ad when the player disabled music', () => {
    const { engine } = setup();
    engine.unlock();
    engine.setMusic(false);
    engine.setAdDuck(true);
    engine.setAdDuck(false);
    expect((engine.bus('music')!.gain as unknown as ParamStub).lastTarget).toBe(0);
  });

  it('caps simultaneous voices so a flurry of events cannot overload the mix', () => {
    const { engine } = setup();
    engine.unlock();
    const granted = Array.from({ length: 60 }, () => engine.acquireVoice(1)).filter(Boolean).length;
    expect(granted).toBe(28);
  });
});

describe('AudioDirector on a real run', () => {
  it('reacts to a full verified route without error and makes sound', async () => {
    const { engine, fake } = setup();
    engine.unlock();
    const director = new AudioDirector(engine);
    const level = levelById('scrapyard-00');
    const sim = new Simulation(await loadRapier(), level);
    director.bind(sim);
    const player = new ReplayPlayer(decodeRecording(readFileSync(resolve(__dirname, '../src/levels/routes/scrapyard-00.json'), 'utf8')));
    let frames = 0;
    while (!player.done && !sim.run.cleared) {
      sim.step(player.next());
      if (++frames % 4 === 0) director.update({ running: true, timeScale: 1, dt: 1 / 15, slowMo: false });
    }
    expect(sim.run.cleared).toBe(true);
    expect(count(fake.nodes, 'oscillator')).toBeGreaterThan(40);
    expect(count(fake.nodes, 'bufferSource')).toBeGreaterThan(5);
  });

  it('adds nothing after being unbound from a simulation', async () => {
    const { engine, fake } = setup();
    engine.unlock();
    const director = new AudioDirector(engine);
    const sim = new Simulation(await loadRapier(), levelById('scrapyard-00'));
    director.bind(sim);
    director.unbind();
    const before = fake.nodes.length;
    const player = new ReplayPlayer(decodeRecording(readFileSync(resolve(__dirname, '../src/levels/routes/scrapyard-00.json'), 'utf8')));
    while (!player.done) sim.step(player.next());
    expect(fake.nodes.length).toBe(before);
  });

  it('starts the adaptive score only once the first update arrives', async () => {
    const { engine, fake } = setup();
    engine.unlock();
    const director = new AudioDirector(engine);
    const sim = new Simulation(await loadRapier(), levelById('scrapyard-00'));
    director.bind(sim);
    const quiet = count(fake.nodes, 'oscillator');
    fake.raw.currentTime = 1;
    director.update({ running: true, timeScale: 1, dt: 0.016, slowMo: false });
    expect(count(fake.nodes, 'oscillator')).toBeGreaterThan(quiet);
  });
});

describe('the score follows the level event sequence (R-LD-08)', () => {
  it('rises on a beat and settles through the quiet', () => {
    const envelope = new EventEnvelope();
    for (let i = 0; i < 70; i++) envelope.update(1 / 60);
    expect(envelope.intensity).toBe(0);
    envelope.event(EVENT_WEIGHTS.snap);
    expect(envelope.intensity).toBeGreaterThan(0.4);
    for (let i = 0; i < 60; i++) envelope.update(1 / 60);
    expect(envelope.intensity).toBeLessThan(0.4);
  });

  it('peaks where a level histogram is densest, not where it is quiet', () => {
    const envelope = new EventEnvelope();
    const marks: Array<{ at: number; intensity: number }> = [];
    // A clockwork shape: a quiet establish, a twist, an escalation burst, a resolve.
    const beats = [5, 5.5, 9.4, 9.6, 9.8, 10.0, 13.6];
    for (let t = 0; t < 16; t += 1 / 60) {
      envelope.update(1 / 60);
      if (beats.some((b) => Math.abs(b - t) < 1 / 120)) envelope.event(EVENT_WEIGHTS.snap);
      marks.push({ at: t, intensity: envelope.intensity });
    }
    const peak = marks.reduce((best, m) => (m.intensity > best.intensity ? m : best));
    expect(peak.at).toBeGreaterThan(9);
    expect(peak.at).toBeLessThan(11);
    const establish = marks.filter((m) => m.at < 4.9).map((m) => m.intensity);
    expect(Math.max(...establish)).toBe(0);
  });

  it('mixes the stems by the tier the run has earned: rest, play, flight (R-AU-02)', () => {
    const quiet = stemMix({ running: true, heightFrac: 0.05, chaining: false, timeScale: 1, intensity: 0.05 });
    expect(quiet.tier).toBe('rest');
    expect(quiet.bass).toBe(0);
    expect(quiet.perc).toBe(0);
    expect(quiet.mel).toBeGreaterThan(0);
    const twisting = stemMix({ running: true, heightFrac: 0.3, chaining: false, timeScale: 1, intensity: 0.42 });
    expect(twisting.tier).toBe('play');
    expect(twisting.bass).toBeGreaterThan(0);
    expect(twisting.perc).toBeGreaterThan(0);
    const escalation = stemMix({ running: true, heightFrac: 0.7, chaining: true, timeScale: 1, intensity: 0.9 });
    expect(escalation.tier).toBe('flight');
    expect(escalation.perc).toBe(1);
    const settling = stemMix({ running: true, heightFrac: 0.7, chaining: false, timeScale: 1, intensity: 0.3 });
    expect(settling.tier).toBe('play');
    expect(settling.perc).toBeLessThan(escalation.perc);
  });

  it('breathes on a real verified route, not a flat line', async () => {
    const { engine } = setup();
    engine.unlock();
    const director = new AudioDirector(engine);
    const level = levelById('scrapyard-01');
    const sim = new Simulation(await loadRapier(), level);
    director.bind(sim);
    const player = new ReplayPlayer(decodeRecording(readFileSync(resolve(__dirname, '../src/levels/routes/scrapyard-01.json'), 'utf8')));
    const samples: number[] = [];
    while (!player.done && !sim.run.cleared) {
      sim.step(player.next());
      director.update({ running: true, timeScale: 1, dt: 1 / 60, slowMo: false });
      samples.push(director.intensity);
    }
    sim.dispose();
    director.unbind();
    expect(Math.max(...samples)).toBeGreaterThan(3 * Math.min(...samples));
    expect(Math.max(...samples)).toBeGreaterThan(0.5);
  });
});

describe('biome ambience', () => {
  async function runDirector(levelId: string, seconds: number, running = true) {
    const { engine, fake } = setup();
    engine.unlock();
    const director = new AudioDirector(engine);
    director.bind(new Simulation(await loadRapier(), levelById(levelId)));
    fake.raw.currentTime = 1;
    director.update({ running, timeScale: 1, dt: 0.016, slowMo: false });
    const first = count(fake.nodes, 'oscillator');
    for (let t = 0; t < seconds; t += 0.25) director.update({ running, timeScale: 1, dt: 0.25, slowMo: false });
    return { first, last: count(fake.nodes, 'oscillator') };
  }

  it('gives every biome its own flavour: clanks, birdsong, neon buzz, chain creaks, then a rare ping in thin air', () => {
    expect(AMBIENCE.scrapyard.event).toBe('clank');
    expect(AMBIENCE.suburbia.event).toBe('bird');
    expect(AMBIENCE.metropolis.event).toBeNull();
    expect(AMBIENCE.metropolis.buzz).toBeGreaterThan(0);
    expect(AMBIENCE.playground.event).toBe('creak');
    expect(AMBIENCE.stratosphere.event).toBe('ping');
    expect(AMBIENCE.stratosphere.buzz).toBe(0);
  });

  it('lets the stratosphere fall nearly silent: its pings are far sparser than any other biome', () => {
    const [shortest] = AMBIENCE.stratosphere.intervalS;
    for (const biome of ['scrapyard', 'suburbia', 'playground'] as const) {
      expect(shortest).toBeGreaterThan(AMBIENCE[biome].intervalS[1]);
    }
  });

  it('creaks the Playground chains as the run goes on', async () => {
    const { first, last } = await runDirector('playground-01', 40);
    expect(last).toBeGreaterThan(first + 2);
  });

  it('sends a ping through the thin air of the Stratosphere, but only a few in forty seconds', async () => {
    const { first, last } = await runDirector('stratosphere-01', 40);
    expect(last).toBeGreaterThan(first);
    expect(last - first).toBeLessThan(18);
  });

  it('scatters birdsong through Suburbia as the run goes on', async () => {
    const { first, last } = await runDirector('suburbia-01', 40);
    expect(last).toBeGreaterThan(first + 4);
  });

  it('keeps the Scrapyard ambience to distant clanks', async () => {
    const { first, last } = await runDirector('scrapyard-01', 40);
    expect(last).toBeGreaterThan(first);
  });

  it('holds a steady neon buzz in Metropolis instead of scattering one-shots', async () => {
    const { first, last } = await runDirector('metropolis-01', 40);
    expect(last).toBe(first);
  });

  it('builds the buzz only while a run is on, so menus stay quiet', async () => {
    const running = await runDirector('metropolis-01', 0);
    const idle = await runDirector('metropolis-01', 0, false);
    expect(running.first).toBe(idle.first + 3);
  });

  it('varies the birdsong: different seeds sing different phrases', () => {
    const { engine, fake } = setup();
    engine.unlock();
    const before = count(fake.nodes, 'oscillator');
    playBird(engine, 0);
    const short = count(fake.nodes, 'oscillator') - before;
    playBird(engine, 2);
    const long = count(fake.nodes, 'oscillator') - before - short;
    expect(long).toBeGreaterThan(short);
  });

  it('gives the trampoline its own springy voice', () => {
    const { engine, fake } = setup();
    engine.unlock();
    const before = count(fake.nodes, 'oscillator');
    playAttach(engine, 'spring', 1);
    expect(count(fake.nodes, 'oscillator')).toBeGreaterThan(before);
  });

  it('lets the wind voice swell before the gust arrives, so it can be heard coming', async () => {
    const { engine, fake } = setup();
    engine.unlock();
    const level = makeLevel([floor()], { biome: 'metropolis', wind: { strength: 4, gustPeriod: 4 } });
    const sim = new Simulation(await loadRapier(), level);
    const director = new AudioDirector(engine);
    director.bind(sim);
    new Driver(sim).start().until(() => sim.hazardClockMs >= 3900, 6000);
    expect(gustForecast(level, sim.hazardClockMs)).toBeGreaterThan(0.05);

    fake.raw.currentTime = 1;
    director.update({ running: true, timeScale: 1, dt: 0.016, slowMo: false });
    const altitude = sim.magno.view.position.y / level.summit.y;
    const expected = windVoice('metropolis', altitude, gustForecast(level, sim.hazardClockMs, sim.magno.view.position.y)).gain;
    const calm = windVoice('metropolis', altitude, 0).gain;
    const targets = fake.nodes
      .filter((n) => n.kind === 'gain')
      .map((n) => (n.gain as unknown as ParamStub).lastTarget)
      .filter((v): v is number => v !== null);
    expect(expected).toBeGreaterThan(calm);
    expect(targets.some((v) => Math.abs(v - expected) < 1e-6)).toBe(true);
  });
});

describe('voices of the reactive props', () => {
  /** Runs a scripted scene with the director bound and reports how many nodes each named event added. */
  async function listen(props: Parameters<typeof makeLevel>[0], spawn: { x: number; y: number }, names: string[], run: (d: Driver) => void) {
    const { engine, fake } = setup();
    engine.unlock();
    const sim = new Simulation(await loadRapier(), makeLevel(props, { spawn, killY: -80, bounds: { minX: -40, maxX: 40 } }));
    const director = new AudioDirector(engine);
    director.bind(sim);
    let last = fake.nodes.length;
    const added: Record<string, FakeNode[]> = {};
    for (const name of names) {
      sim.events.on(name as 'boing', () => {
        added[name] = fake.nodes.slice(last);
      });
    }
    const driver = new Driver(sim);
    const step = driver.tick.bind(driver);
    driver.tick = (n = 1) => {
      for (let i = 0; i < n; i++) {
        last = fake.nodes.length;
        step(1);
      }
      return driver;
    };
    run(driver);
    return { added };
  }

  const kinds = (nodes: FakeNode[], kind: string) => nodes.filter((n) => n.kind === kind);

  it('answers a boing with a rising spring voice and a soft thump', async () => {
    const { added } = await listen([floor(), { kind: 'boing-washer', x: 0, y: 1.15 }], { x: 0, y: 14 }, ['boing'], (d) =>
      d.start().until(() => false, 3000),
    );
    expect(kinds(added.boing!, 'oscillator').length).toBeGreaterThanOrEqual(4);
    expect(kinds(added.boing!, 'bufferSource').length).toBeGreaterThanOrEqual(1);
  });

  it('pitches the boing higher the harder MAGNO is thrown', async () => {
    const pitchOf = async (height: number) => {
      const { added } = await listen([floor(), { kind: 'boing-washer', x: 0, y: 1.15 }], { x: 0, y: height }, ['boing'], (d) =>
        d.start().until(() => false, 3000),
      );
      return Math.max(...kinds(added.boing!, 'oscillator').map((o) => (o.frequency as unknown as ParamStub).value));
    };
    expect(await pitchOf(18)).toBeGreaterThan(await pitchOf(7));
  });

  it('ticks a warning as a surface starts to give way, then crackles when it goes', async () => {
    const { added } = await listen([{ kind: 'rust-grate', x: 0, y: 0.14 }], { x: 0, y: 0.28 }, ['crumbleWarn', 'crumble'], (d) => d.until(() => false, 2500));
    expect(kinds(added.crumbleWarn!, 'oscillator').length).toBeGreaterThanOrEqual(4);
    expect(kinds(added.crumble!, 'bufferSource').length).toBeGreaterThanOrEqual(3);
  });

  it('gives frost a glassy voice: its warning is a bright ping where rust grinds', async () => {
    const warnWave = async (kind: string, y: number) => {
      const { added } = await listen([{ kind, x: 0, y }], { x: 0, y: y + 0.14 }, ['crumbleWarn'], (d) => d.until(() => false, 3000));
      return (kinds(added.crumbleWarn!, 'oscillator')[0] as unknown as { type: string }).type;
    };
    expect(await warnWave('frost-truss', 0.25)).toBe('sine');
    expect(await warnWave('rust-grate', 0.14)).toBe('sawtooth');
  });

  it('rasps a drawer out on its rails and plays a different rasp for the way back', async () => {
    const drawer = { kind: 'file-drawer', x: 0, y: 1.6, follow: { tag: 'f', dx: 1.5, dy: 0, extendMs: 600, retractMs: 1200, holdMs: 500 } };
    const { added } = await listen([floor(), { kind: 'filing-cabinet', x: -2, y: 1.35, tag: 'f' }, drawer], { x: -2, y: 2.7 }, ['followerMove'], (d) => d.until(() => false, 800));
    expect(kinds(added.followerMove!, 'bufferSource').length).toBeGreaterThanOrEqual(2);
  });
});

describe('wheel axle groan', () => {
  it('is silent for a wheel at rest and grows steadily with its speed, never past a whisper', () => {
    expect(axleGroan(0).gain).toBe(0);
    expect(axleGroan(0.05).gain).toBe(0);
    let last = axleGroan(0.1);
    for (const speed of [0.2, 0.4, 0.7, 1, 2, 6]) {
      const now = axleGroan(speed);
      expect(now.gain).toBeGreaterThanOrEqual(last.gain);
      expect(now.pitchHz).toBeGreaterThanOrEqual(last.pitchHz);
      expect(now.gain).toBeLessThanOrEqual(0.1);
      last = now;
    }
    expect(axleGroan(1).gain).toBeGreaterThan(0.05);
  });

  async function wheelLevel(spawn: { x: number; y: number }) {
    const { engine, fake } = setup();
    engine.unlock();
    const level = makeLevel(prop.drivenWheel(0, 10, 'w'), { spawn, killY: -600, bounds: { minX: -60, maxX: 60 } });
    const sim = new Simulation(await loadRapier(), level);
    const director = new AudioDirector(engine);
    director.bind(sim);
    const targets = (): number[] =>
      fake.nodes
        .filter((n) => n.kind === 'gain')
        .map((n) => (n.gain as unknown as ParamStub).lastTarget)
        .filter((v): v is number => v !== null);
    return { sim, director, fake, targets };
  }

  it('follows the wheel MAGNO sets turning', async () => {
    const { sim, director, fake, targets } = await wheelLevel({ x: 4.6, y: 8.5 });
    const driver = new Driver(sim);
    fake.raw.currentTime = 1;
    director.update({ running: true, timeScale: 1, dt: 0.016, slowMo: false });
    expect(sim.physics.axleSpeed()).toBeLessThan(1e-3);

    driver.ms(2500);
    expect(sim.physics.axleSpeed()).toBeGreaterThan(0.3);
    fake.raw.currentTime = 2;
    director.update({ running: true, timeScale: 1, dt: 0.016, slowMo: false });
    const expected = axleGroan(sim.physics.axleSpeed()).gain;
    expect(expected).toBeGreaterThan(0.01);
    expect(targets().some((v) => Math.abs(v - expected) < 1e-9)).toBe(true);
  });

  it('stays out of levels that have no wheel', async () => {
    const { engine, fake } = setup();
    engine.unlock();
    const sim = new Simulation(await loadRapier(), levelById('scrapyard-00'));
    const director = new AudioDirector(engine);
    director.bind(sim);
    fake.raw.currentTime = 1;
    director.update({ running: true, timeScale: 1, dt: 0.016, slowMo: false });
    expect(sim.physics.axleSpeed()).toBe(0);
  });
});

describe('the motif presence map (R-AU-01)', () => {
  const motifOf = (levelId: string): number[] => {
    const score = SCORES[levelById(levelId).biome];
    return MAGNO_MOTIF.map((d) => score.tonicHz * 4 * 2 ** (degreeSemitones(score.scale, d) / 12));
  };
  const freqsOf = (nodes: FakeNode[]): number[] => nodes.filter((n) => n.kind === 'oscillator').map((n) => (n.frequency as unknown as ParamStub).value);
  const sings = (freqs: number[], hz: number): boolean => freqs.some((f) => Math.abs(f - hz) < 0.6);

  async function boot(levelId: string) {
    const { engine, fake } = setup();
    engine.unlock();
    const director = new AudioDirector(engine);
    const sim = new Simulation(await loadRapier(), levelById(levelId));
    director.bind(sim);
    return { engine, fake, director, sim };
  }

  it('hums the motif from the boot: all five notes inside three seconds of the score starting', async () => {
    const { fake, director, sim } = await boot('scrapyard-00');
    const seen: number[] = [];
    for (let t = 1; t <= 4; t += 0.05) {
      fake.raw.currentTime = t;
      director.update({ running: true, timeScale: 1, dt: 0.05, slowMo: false });
      seen.push(...freqsOf(fake.nodes));
    }
    const motif = motifOf('scrapyard-00');
    for (const hz of motif) {
      expect(sings(seen, hz), `${hz} Hz of the motif never sounds`).toBe(true);
    }
    sim.dispose();
    director.unbind();
  });

  it('signs the clear card with the same five notes', async () => {
    const { fake, director, sim } = await boot('scrapyard-00');
    fake.raw.currentTime = 1;
    const before = fake.nodes.length;
    sim.events.emit('summit', { clearTimeMs: 9000, falls: 0, noFall: true, underPar: false, stars: 3 });
    const spoken = freqsOf(fake.nodes.slice(before));
    for (const hz of motifOf('scrapyard-00')) {
      expect(sings(spoken, hz), `${hz} Hz missing from the clear quote`).toBe(true);
    }
    sim.dispose();
    director.unbind();
  });

  it('announces a biome with the motif in that biome\u2019s own spelling (R-AU-03)', async () => {
    const { fake, director, sim } = await boot('suburbia-01');
    const before = fake.nodes.length;
    director.biomeCall();
    const spoken = freqsOf(fake.nodes.slice(before));
    for (const hz of motifOf('suburbia-01')) {
      expect(sings(spoken, hz), `${hz} Hz missing from the biome call`).toBe(true);
    }
    // The same shape, a different key: the harmonization is the spelling, not a rewrite.
    expect(motifOf('suburbia-01')).not.toEqual(motifOf('scrapyard-00'));
    sim.dispose();
    director.unbind();
  });

  it('resolves the ending on the motif (the credits sign the name)', async () => {
    const { fake, director, sim } = await boot('stratosphere-14');
    const before = fake.nodes.length;
    director.endingCue('credits');
    const spoken = freqsOf(fake.nodes.slice(before));
    for (const hz of motifOf('stratosphere-14')) {
      expect(sings(spoken, hz), `${hz} Hz missing from the resolve`).toBe(true);
    }
    sim.dispose();
    director.unbind();
  });
});

describe('the stinger grammar (R-AU-05)', () => {
  async function boot() {
    const { engine, fake } = setup();
    engine.unlock();
    const director = new AudioDirector(engine);
    const sim = new Simulation(await loadRapier(), levelById('scrapyard-00'));
    director.bind(sim);
    return { engine, fake, director, sim };
  }

  it('is the whole verdict map, every word inside its second and a half, every voice a real recipe', () => {
    expect(new Set(STINGERS.map((s) => s.kind)).size).toBe(STINGERS.length);
    for (const s of STINGERS) expect(s.maxS).toBeLessThanOrEqual(1.5);
    expect(STINGERS.map((s) => s.voice).sort()).toEqual([
      'playBiomeCall',
      'playFallTopper',
      'playFanfare',
      'playGhostSet',
      'playParCall',
      'playStarStamp',
    ]);
  });

  it('lets one word own the moment: a second stinger is refused, the stage clears, then it speaks', async () => {
    const { engine, fake, director, sim } = await boot();
    const music = engine.bus('music')!.gain as unknown as ParamStub;
    fake.raw.currentTime = 1;
    const before = fake.nodes.length;
    sim.events.emit('summit', { clearTimeMs: 9000, falls: 0, noFall: true, underPar: false, stars: 1 });
    expect(fake.nodes.length).toBeGreaterThan(before);
    // R-AU-07: the bed side-chains three under for the word's whole length.
    expect(music.lastTarget!).toBeCloseTo(fromDb(BUS_DB.music + STINGER_DUCK_DB), 5);
    const spoken = fake.nodes.length;
    director.biomeCall();
    expect(fake.nodes.length, 'a second word was spoken over the first').toBe(spoken);
    // The stage clears and the bed comes back up (R-AU-05/07).
    fake.raw.currentTime = 2.75;
    director.update({ running: true, timeScale: 1, dt: 0.016, slowMo: false });
    expect(music.lastTarget!).toBeCloseTo(fromDb(BUS_DB.music), 5);
    director.biomeCall();
    expect(fake.nodes.length).toBeGreaterThan(spoken);
    sim.dispose();
    director.unbind();
  });

  it('chains the verdict: the par coda and the ghost toast answer the last stamp, and only then', async () => {
    const { fake, director, sim } = await boot();
    const par = motifOf('scrapyard-00')[3]!;
    fake.raw.currentTime = 1;
    sim.events.emit('summit', { clearTimeMs: 8000, falls: 0, noFall: false, underPar: true, stars: 2 });
    director.ghostToast();
    fake.raw.currentTime = 2.75;
    director.update({ running: true, timeScale: 1, dt: 0.016, slowMo: false });
    const afterUpdate = fake.nodes.length;
    director.starStamp(0, 2);
    expect(sings(freqsOf(fake.nodes.slice(afterUpdate)), par), 'the par coda spoke a stamp early').toBe(false);
    director.starStamp(1, 2);
    expect(sings(freqsOf(fake.nodes.slice(afterUpdate)), par), 'the par coda never spoke').toBe(true);
    // And without a par or a ghost on record, the last stamp is only a stamp.
    fake.raw.currentTime = 4.6;
    director.update({ running: true, timeScale: 1, dt: 0.016, slowMo: false });
    sim.events.emit('summit', { clearTimeMs: 9000, falls: 0, noFall: true, underPar: false, stars: 2 });
    fake.raw.currentTime = 6.3;
    director.update({ running: true, timeScale: 1, dt: 0.016, slowMo: false });
    const beforeLast = fake.nodes.length;
    director.starStamp(0, 2);
    director.starStamp(1, 2);
    expect(sings(freqsOf(fake.nodes.slice(beforeLast)), par), 'a par coda without a par').toBe(false);
    sim.dispose();
    director.unbind();
  });

  it('gives the small falls the deadpan plop and the spectacular ones the stage (the silence is the sting)', async () => {
    const { fake, director, sim } = await boot();
    fake.raw.currentTime = 1;
    const before = fake.nodes.length;
    director.fallVerdict('A');
    director.fallVerdict('SSS');
    expect(fake.nodes.length, 'the spectacular fall was scored over MAGNO\u2019s own word').toBe(before);
    director.fallVerdict('C');
    expect(fake.nodes.length).toBeGreaterThan(before);
    sim.dispose();
    director.unbind();
  });

  const motifOf = (levelId: string): number[] => {
    const score = SCORES[levelById(levelId).biome];
    return MAGNO_MOTIF.map((d) => score.tonicHz * 4 * 2 ** (degreeSemitones(score.scale, d) / 12));
  };
  const sings = (freqs: number[], hz: number): boolean => freqs.some((f) => Math.abs(f - hz) < 0.6);
  const freqsOf = (nodes: FakeNode[]): number[] => nodes.filter((n) => n.kind === 'oscillator').map((n) => (n.frequency as unknown as ParamStub).value);
});

describe('the score keeps its own clock (R-AU-02)', () => {
  async function boot() {
    const { engine, fake } = setup();
    engine.unlock();
    const director = new AudioDirector(engine);
    const sim = new Simulation(await loadRapier(), levelById('scrapyard-00'));
    director.bind(sim);
    return { engine, fake, director, sim };
  }

  it('crossfades the stems as the run earns its tier, through the whole envelope path', async () => {
    const { fake, director, sim } = await boot();
    fake.raw.currentTime = 1;
    const targets = () =>
      fake.nodes
        .filter((n) => n.kind === 'gain')
        .map((n) => (n.gain as unknown as ParamStub).lastTarget)
        .filter((v): v is number => v !== null);
    for (let t = 0; t < 2; t += 0.1) director.update({ running: true, timeScale: 1, dt: 0.1, slowMo: false });
    const rest = targets();
    expect(rest).toContain(0.35);
    expect(rest).toContain(0.45);
    expect(rest).not.toContain(0.85);
    for (let i = 0; i < 3; i++) sim.events.emit('attach', { material: 'steel', point: { x: 0, y: 1 }, normal: { x: 0, y: 1 }, speed: 8, weak: false, viaSnap: true });
    director.update({ running: true, timeScale: 1, dt: 0.016, slowMo: false });
    const flight = targets();
    expect(flight).toContain(1);
    expect(flight).toContain(0.8);
    for (let t = 0; t < 14; t += 0.1) director.update({ running: true, timeScale: 1, dt: 0.1, slowMo: false });
    const settled = targets();
    expect(settled).toContain(0.35);
    expect(settled).not.toContain(0.85);
    sim.dispose();
    director.unbind();
  });

  it('rotates its cells through the session — the audit counter advances, every stem', async () => {
    const { fake, director, sim } = await boot();
    for (let t = 1; t <= 41; t += 0.05) {
      fake.raw.currentTime = t;
      director.update({ running: true, timeScale: 1, dt: 0.05, slowMo: false });
    }
    const played = director.music.cellsPlayed;
    expect(played.mel).toBeGreaterThanOrEqual(6);
    expect(played.bass).toBeGreaterThanOrEqual(6);
    expect(played.perc).toBeGreaterThanOrEqual(6);
    expect(played.air).toBeGreaterThanOrEqual(3);
    expect(played.mel).toBeGreaterThan(played.air);
    sim.dispose();
    director.unbind();
  });
});

describe('the performance take (R-AU-10)', () => {
  const signature = (fake: { nodes: FakeNode[] }, before: number): string =>
    fake.nodes
      .slice(before)
      .filter((n) => n.kind === 'oscillator')
      .map((n) => (n.frequency as unknown as ParamStub).value)
      .sort()
      .join('|');

  it('never machine-guns: five takes of the same voice inside two seconds are five different takes', () => {
    const { engine, fake } = setup();
    engine.unlock();
    const snapTakes = Array.from({ length: 5 }, () => {
      const before = fake.nodes.length;
      playSnapEngage(engine);
      return signature(fake, before);
    });
    expect(new Set(snapTakes).size, 'the snap\u2019s zip repeated identically').toBe(5);

    const chirpTakes = Array.from({ length: 5 }, () => {
      const before = fake.nodes.length;
      playChirp(engine, 'whee');
      return signature(fake, before);
    });
    expect(new Set(chirpTakes).size, 'the chirp repeated identically').toBe(5);

    const thunkTakes = Array.from({ length: 5 }, () => {
      const before = fake.nodes.length;
      playAttach(engine, 'beam', 1);
      return signature(fake, before);
    });
    expect(new Set(thunkTakes).size, 'the junk answered identically').toBe(5);
  });
});

describe('the published mix hierarchy (R-AU-07)', () => {
  it('is the code\u2019s own levels, buses and duck laws, exactly — the table cannot drift', () => {
    expect(new Set(MIX_HIERARCHY.buses.map((r) => r.bus))).toEqual(new Set(Object.keys(BUS_DB)));
    for (const row of MIX_HIERARCHY.buses) expect(row.targetDb).toBe(BUS_DB[row.bus]);
    expect(MIX_HIERARCHY.adDuck.db).toBe(AD_DUCK_DB);
    expect(MIX_HIERARCHY.stingerDuck.db).toBe(STINGER_DUCK_DB);
    expect(MIX_HIERARCHY.monitoring.gain).toBe(MASTER.gain);
  });
});
