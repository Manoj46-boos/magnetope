import { describe, expect, it } from 'vitest';
import { AudioDirector } from '@/audio/director';
import { AudioEngine, BUS_DB } from '@/audio/engine';
import { CHIRP_BAND_HZ, playChirp, type ChirpName } from '@/audio/recipes';
import { CHIRP_WORDS, MAGNO_EMOTIONS } from '@/game/magno-table';
import { EYE_STATES } from '@/render/magno-rig';
import { createSim, floor, makeLevel } from './helpers/harness';

/**
 * The chirp language (R-CH-06, R-AU-06): twelve words, each spoken through the
 * real recipe graph and measured the way the laws are written — the band the
 * voice lives in, the quarter second it must fit inside, the bus it must ride,
 * the stinger it must respect and the repeat guard that keeps it speech. The
 * triggers ride the real simulation bus with staged payloads, so what is under
 * test is the wiring a player actually reaches.
 */

class ParamStub {
  value = 0;
  history: number[] = [];
  setValueAtTime(v: number): void {
    this.value = v;
    this.history.push(v);
  }
  exponentialRampToValueAtTime(v: number): void {
    this.value = v;
    this.history.push(v);
  }
  linearRampToValueAtTime(v: number): void {
    this.value = v;
    this.history.push(v);
  }
  setTargetAtTime(v: number): void {
    this.value = v;
  }
}

const PARAMS = new Set(['gain', 'frequency', 'Q', 'detune', 'threshold', 'knee', 'ratio', 'attack', 'release']);

interface FakeNode {
  kind: string;
  connectedTo: FakeNode[];
  startedAt?: number;
  stoppedAt?: number;
  [key: string]: unknown;
}

function createFakeContext() {
  const nodes: FakeNode[] = [];
  const make = (kind: string): FakeNode => {
    const store: Record<string, unknown> = { kind, connectedTo: [] };
    const proxy = new Proxy(store, {
      get(target, prop: string) {
        if (prop === 'connect') {
          return (to: FakeNode) => {
            (target.connectedTo as FakeNode[]).push(to);
            return proxy;
          };
        }
        if (prop === 'disconnect') return () => proxy;
        if (prop === 'start') return (at: number) => {
          target.startedAt = at;
          return proxy;
        };
        if (prop === 'stop') return (at: number) => {
          target.stoppedAt = at;
          return proxy;
        };
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
          (target[prop] as ParamStub).history.push(value);
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
    resume() {
      this.state = 'running';
      return Promise.resolve();
    },
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    },
    createGain: () => make('gain'),
    createOscillator: () => make('oscillator'),
    createBiquadFilter: () => make('filter'),
    createBufferSource: () => make('bufferSource'),
    createConvolver: () => make('convolver'),
    createWaveShaper: () => make('waveShaper'),
    createDynamicsCompressor: () => make('compressor'),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }) as unknown as AudioBuffer,
  };
  return { ctx: ctx as unknown as AudioContext, raw: ctx, nodes };
}

const setup = () => {
  const fake = createFakeContext();
  const engine = new AudioEngine({ createContext: () => fake.ctx });
  engine.unlock();
  const director = new AudioDirector(engine);
  const chirpBus = engine.bus('chirp') as unknown as FakeNode;
  /** How many graphs feed the chirp bus — one per word spoken. */
  const spoken = (): number => fake.nodes.filter((n) => (n.connectedTo as FakeNode[]).includes(chirpBus)).length;
  return { engine, fake, director, spoken };
};

describe('the vocabulary', () => {
  it('is one row per word, and every word has a row', () => {
    expect(new Set(MAGNO_EMOTIONS.map((e) => e.word))).toEqual(new Set(CHIRP_WORDS));
    expect(MAGNO_EMOTIONS.length).toBe(12);
  });

  it('names only faces the rig performs, and the silent face is the settled one', () => {
    const faces = new Set(MAGNO_EMOTIONS.map((e) => e.face));
    for (const face of faces) expect(EYE_STATES, `${face} is not a rig face`).toContain(face);
    expect(EYE_STATES.filter((s) => !faces.has(s))).toEqual(['idle']);
  });
});

describe('every word of the language', () => {
  it.each(CHIRP_WORDS)('%s lives inside its band and its quarter second, on its own bus', (name: ChirpName) => {
    const { engine, fake, spoken } = setup();
    expect(spoken()).toBe(0);
    playChirp(engine, name);
    expect(spoken()).toBe(1);

    const oscillators = fake.nodes.filter((n) => n.kind === 'oscillator');
    expect(oscillators.length).toBeGreaterThan(0);
    for (const osc of oscillators) {
      for (const hz of (osc.frequency as ParamStub).history) {
        expect(hz, `${name}: ${hz} Hz is outside the voice's band`).toBeGreaterThanOrEqual(CHIRP_BAND_HZ[0]);
        expect(hz, `${name}: ${hz} Hz is outside the voice's band`).toBeLessThanOrEqual(CHIRP_BAND_HZ[1]);
      }
      // R-AU-06: voice and tail inside a quarter second.
      expect(osc.stoppedAt!, `${name} outlasts its quarter second`).toBeLessThanOrEqual(0.25);
      expect(osc.startedAt!).toBeGreaterThanOrEqual(0);
    }

    // The band limit rides the chain itself: a highpass at the floor, a lowpass at the ceiling.
    const cuts = fake.nodes.filter((n) => n.kind === 'filter').map((f) => (f.frequency as ParamStub).value);
    expect(cuts).toContain(CHIRP_BAND_HZ[0]);
    expect(cuts).toContain(CHIRP_BAND_HZ[1]);
  });

  it('sits at least six under the music bed, by the bus it rides (R-AU-06)', () => {
    expect(BUS_DB.chirp).toBeLessThanOrEqual(BUS_DB.music - 6);
  });
});

describe('the stinger gate and the repeat guard', () => {
  it('holds its tongue while a stinger owns the moment, and speaks again after', () => {
    const { fake, director, spoken } = setup();
    expect(spoken()).toBe(0);
    director.chirp('curious');
    expect(spoken()).toBe(1);

    director.endingCue('seat');
    fake.raw.currentTime = 0.5;
    director.chirp('whee');
    expect(spoken()).toBe(1);

    fake.raw.currentTime = 2.5;
    director.chirp('whee');
    expect(spoken()).toBe(2);
  });

  it('never says the same word twice inside two seconds', () => {
    const { director, spoken } = setup();
    director.chirp('whee');
    director.chirp('whee');
    expect(spoken()).toBe(1);
    director.chirp('ouch');
    expect(spoken()).toBe(2);
  });

  it('says the ta-da only for the full verdict', () => {
    const { director, spoken } = setup();
    director.starStamp(0, 3);
    director.starStamp(1, 3);
    expect(spoken()).toBe(0);
    director.starStamp(2, 3);
    expect(spoken()).toBe(1);
    director.starStamp(2);
    director.starStamp(2, 2);
    expect(spoken()).toBe(1);
  });
});

describe('the triggers, on the real simulation bus', () => {
  it('answers the moments the emotion table names', async () => {
    const sim = await createSim(makeLevel([floor(), { kind: 'beam', x: 3, y: 4 }]));
    const { director, spoken } = setup();
    director.bind(sim);

    let before = spoken();
    sim.events.emit('slowMo', { reason: 'height', heightMeters: 12 });
    expect(spoken()).toBe(before + 1);

    // A tap is not a whee: the full-power release is the same bar that earns the freeze.
    before = spoken();
    sim.events.emit('repel', { power: 0.6, speed: 9, normal: { x: 0, y: 1 }, point: { x: 0, y: 1 }, direction: { x: 0, y: 1 } });
    expect(spoken()).toBe(before);
    sim.events.emit('repel', { power: 1, speed: 14, normal: { x: 0, y: 1 }, point: { x: 0, y: 1 }, direction: { x: 0, y: 1 } });
    expect(spoken()).toBe(before + 1);

    before = spoken();
    sim.events.emit('chargeLevel', { level: 3 });
    expect(spoken()).toBe(before + 1);

    before = spoken();
    sim.events.emit('limp', {});
    expect(spoken()).toBe(before + 1);

    before = spoken();
    sim.events.emit('recoverBegin', {});
    expect(spoken()).toBe(before + 1);

    before = spoken();
    sim.events.emit('saved', { heightMeters: 8 });
    expect(spoken()).toBe(before + 1);

    before = spoken();
    sim.events.emit('crumbleWarn', { propIndex: 1 });
    expect(spoken()).toBe(before + 1);

    before = spoken();
    sim.events.emit('snapWhiff', {});
    expect(spoken()).toBe(before + 1);

    director.unbind();
    sim.dispose();
  });
});
