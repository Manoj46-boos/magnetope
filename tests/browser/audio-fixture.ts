import { AudioDirector } from '@/audio/director';
import { AudioEngine, FLAT_MASTER, type BusName } from '@/audio/engine';
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
  | { kind: 'ending' };

export interface RenderSpec {
  scenario: Scenario;
  seconds: number;
  /** Buses to silence, to hear the others on their own. */
  mute?: BusName[];
  /** Skip the mastering stage, to compare the buses as the mix sets them. */
  flatMaster?: boolean;
  /** An ad plays between these two times, in seconds; the game ducks its music around it. */
  adBetween?: [from: number, to: number];
}

export interface RenderReport extends Loudness {
  seconds: number;
  /** RMS level of each second of the left channel, in dBFS, to find where a mix gets loud. */
  perSecondDb: number[];
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
  const player = spec.scenario.kind === 'ending' ? null : await loadRoute(levelId);
  const fallAt = spec.scenario.kind === 'tumble' ? spec.scenario.fallAtSeconds : Infinity;

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
    director.update({ running: true, timeScale: 1, dt: SLICE_SECONDS, slowMo: false });
    ctx.resume();
  }

  const buffer = await rendered;
  const left = buffer.getChannelData(0);
  return { seconds: spec.seconds, ...measure([left, buffer.getChannelData(1)]), perSecondDb: secondsProfile(left) };
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

const hooks = window as unknown as { renderAudio: typeof render; ready: boolean };
hooks.renderAudio = render;
hooks.ready = true;
