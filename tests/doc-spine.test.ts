import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as recipes from '@/audio/recipes';
import * as continuous from '@/audio/continuous';
import { AudioEngine, BUS_DB } from '@/audio/engine';
import { renderAudio, renderColorScript, renderEconomy, renderEvents, renderFeel, renderMagno, renderSpectacle } from '../tools/doc-spine';
import { FEEL_GAME_BEATS, FEEL_ROWS, SIM_EVENT_NAMES } from '@/game/feel-table';
import { SPECTACLE_BEATS } from '@/game/spectacle-table';
import { CHIRP_WORDS, MAGNO_EMOTIONS } from '@/game/magno-table';
import { EYE_STATES } from '@/render/magno-rig';
import { TUNING } from '@/config/tuning';
import { SPECTACLE_SPACING_MS } from '@/game/spectacle';
import { HIT_STOP_BAND_MS, HOLD_MS } from '@/game/hit-stop';
import { MAGNO_MOTIF, THIN_AIR_LEVEL } from '@/audio/score';
import { STINGERS } from '@/audio/stingers';
import { MIX_HIERARCHY } from '@/audio/engine';
import { MAX_QUEUE, AttemptRecorder, Telemetry } from '@/platform/telemetry';
import { ALL_LEVELS } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { Simulation } from '@/sim/simulation';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';

/**
 * The doc-drift spine (premium PRD W7): the seven spine docs are generated from
 * the code, and this suite holds them there. Each doc re-renders byte for
 * byte, every feel row names an event the simulation really emits and every
 * listener in the render, game and audio layers has a row, the audio map names
 * real exports, the quoted numbers are the code's own constants, and a real
 * route replay proves the feel table covers the events a run actually fires.
 * A doc that cannot answer to CI is deleted, not amended.
 */

const here = resolve(__dirname, '..');
const doc = (name: string): string => readFileSync(resolve(here, `docs/${name}`), 'utf8');
const srcFile = (rel: string): string => readFileSync(resolve(here, rel), 'utf8');

const ROW_EVENTS = new Set([...FEEL_ROWS, ...FEEL_GAME_BEATS].map((r) => r.event));

describe('the feel bible (R-GF-14)', () => {
  it('is the generated file, byte for byte', () => {
    expect(doc('FEEL.md')).toBe(renderFeel());
  });

  it('covers the simulation\u2019s whole event vocabulary and the game beats, exactly', () => {
    expect(ROW_EVENTS).toEqual(new Set([...SIM_EVENT_NAMES, ...FEEL_GAME_BEATS.map((r) => r.event)]));
  });

  it('carries a row for every event the feel layers listen to', () => {
    const consumers = ['src/render/vfx.ts', 'src/game/game.ts', 'src/audio/director.ts'];
    const heard = new Set<string>();
    for (const file of consumers) {
      for (const [, name] of srcFile(file).matchAll(/\bon\('([a-zA-Z]+)'/g)) {
        if ((SIM_EVENT_NAMES as readonly string[]).includes(name!)) heard.add(name!);
      }
    }
    expect(heard.size).toBeGreaterThan(0);
    for (const name of heard) expect(ROW_EVENTS, `${name} is listened to but has no row`).toContain(name);
  });

  it('names audio that really exists', () => {
    const voices = new Set<string>([...Object.keys(recipes), ...Object.keys(continuous), ...Object.getOwnPropertyNames(AudioEngine.prototype)]);
    for (const row of [...FEEL_ROWS, ...FEEL_GAME_BEATS]) {
      for (const name of row.audio) expect(voices, `${row.event} names ${name}`).toContain(name);
    }
  });

  it('quotes the code\u2019s own numbers', () => {
    const text = doc('FEEL.md');
    expect(text).toContain(`coyote ${TUNING.windows.coyoteMs} ms, buffer ${TUNING.windows.bufferMs} ms`);
    expect(text).toContain(`holds ${HOLD_MS} ms inside the ${HIT_STOP_BAND_MS[0]}\u2013${HIT_STOP_BAND_MS[1]} ms band`);
    expect(text).toContain(`inside ${(SPECTACLE_SPACING_MS / 1000).toFixed(0)} s`);
  });

  it('covers every event a real run fires', async () => {
    const rapier = await loadRapier();
    const fired = new Set<string>();
    for (const id of ['scrapyard-00', 'playground-08', 'stratosphere-14']) {
      const level = ALL_LEVELS.find((l) => l.id === id)!;
      const sim = new Simulation(rapier, level);
      for (const name of SIM_EVENT_NAMES) sim.events.on(name, () => fired.add(name));
      const player = new ReplayPlayer(decodeRecording(readFileSync(resolve(here, `src/levels/routes/${id}.json`), 'utf8')));
      while (!player.done && !sim.run.cleared) sim.step(player.next());
      sim.dispose();
    }
    expect(fired.size).toBeGreaterThan(0);
    for (const name of fired) expect(ROW_EVENTS, `${name} fires in play but has no row`).toContain(name);
  }, 120_000);
});

describe('the spectacle table (R-SM-07)', () => {
  it('is the generated file, byte for byte', () => {
    expect(doc('SPECTACLE.md')).toBe(renderSpectacle());
  });

  it('carries every beat kind the ledger knows', () => {
    const ledgerKinds = ['establish', 'first-catch', 'slow-mo', 'ending'] as const;
    const carried = new Set(SPECTACLE_BEATS.map((b) => b.kind));
    for (const kind of ledgerKinds) expect(carried, `${kind} has no beat row`).toContain(kind);
  });

  it('names tests that exist', () => {
    for (const beat of SPECTACLE_BEATS) expect(existsSync(resolve(here, beat.test)), `${beat.kind}: ${beat.test}`).toBe(true);
  });
});

describe('the colour script (R-AR-05)', () => {
  it('is the generated file, byte for byte', () => {
    expect(doc('COLOR_SCRIPT.md')).toBe(renderColorScript());
  });

  it('carries a row for every biome', () => {
    const text = doc('COLOR_SCRIPT.md');
    for (const biome of new Set(ALL_LEVELS.map((l) => l.biome))) expect(text).toContain(`| ${biome} |`);
  });
});

describe('the economy (R-EC-07)', () => {
  it('is the generated file, byte for byte', () => {
    expect(doc('ECONOMY.md')).toBe(renderEconomy());
  });
});

describe('the event vocabulary (R-AN-01)', () => {
  const CATEGORIES = new Set(['level', 'retry', 'fall', 'attempt', 'session', 'ending']);
  const sourceFiles = (): string[] => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = resolve(dir, entry.name);
        return entry.isDirectory() ? walk(full) : entry.name.endsWith('.ts') ? [full] : [];
      });
    return walk(resolve(here, 'src'));
  };

  it('is the generated file, byte for byte', () => {
    expect(doc('EVENTS.md')).toBe(renderEvents());
  });

  it('carries every category the code records', () => {
    const recorded = new Set<string>();
    for (const file of sourceFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const [, name] of text.matchAll(/\.record\(\s*'([a-z]+)'/g)) recorded.add(name!);
      for (const [, name] of text.matchAll(/category:\s*'([a-z]+)'/g)) recorded.add(name!);
    }
    expect(recorded.size).toBeGreaterThan(0);
    for (const name of recorded) expect(CATEGORIES, `${name} is recorded but has no row`).toContain(name);
  });

  it('holds a real attempt to the payload grammar', () => {
    const sent: Array<{ category: string; what: string; action: string }> = [];
    const telemetry = new Telemetry({ send: (batch) => sent.push(...batch), canFlush: () => true, now: () => 0 });
    const recorder = new AttemptRecorder(telemetry, () => 0);
    recorder.begin('scrapyard-00');
    recorder.stick();
    recorder.flip({ x: 3, y: 7 });
    recorder.snap();
    recorder.fall(9.5, { x: 4, y: 2 }, 'B');
    recorder.begin('scrapyard-00');
    recorder.stick();
    recorder.snap();
    recorder.finish('clear', 41_307, 2);
    telemetry.record('ending', 'watched', '61');
    expect(telemetry.flush(), 'a natural stop flushes').toBe(true);

    const records = sent;
    expect(records.length).toBeGreaterThanOrEqual(7);
    const fields = (action: string): string[] => action.split(';').map((f) => f.split('=')[0]!);
    for (const record of records) {
      expect(CATEGORIES, `${record.category} is emitted but has no row`).toContain(record.category);
      if (record.category === 'fall') expect(fields(record.action)).toEqual(['h', 'c', 'g']);
      if (record.category === 'attempt') expect(fields(record.action)).toEqual(['o', 'ms', 'st', 'stick', 'flip', 'snap', 'fall', 'hot']);
      if (record.category === 'retry') expect(record.action).toMatch(/^\d+$/);
    }
    expect(sent.some((r) => r.category === 'session')).toBe(true);
    expect(MAX_QUEUE).toBe(200);
  });
});

describe('the MAGNO bible (R-CH-04)', () => {
  it('is the generated file, byte for byte', () => {
    expect(doc('MAGNO.md')).toBe(renderMagno());
  });

  it('carries one row per word of the language, exactly', () => {
    expect(new Set(MAGNO_EMOTIONS.map((e) => e.word))).toEqual(new Set(CHIRP_WORDS));
    expect(MAGNO_EMOTIONS.length).toBe(CHIRP_WORDS.length);
  });

  it('names only faces the rig performs, and the silent face is the settled one', () => {
    const faces = new Set(MAGNO_EMOTIONS.map((e) => e.face));
    for (const face of faces) expect(EYE_STATES, `${face} is not a rig face`).toContain(face);
    expect(EYE_STATES.filter((s) => !faces.has(s))).toEqual(['idle']);
  });

  it('quotes the code\u2019s own numbers', () => {
    const text = doc('MAGNO.md');
    expect(text).toContain(`band-limited ${recipes.CHIRP_BAND_HZ[0]}\u2013${recipes.CHIRP_BAND_HZ[1]} Hz`);
    expect(text).toContain(`${BUS_DB.music - BUS_DB.chirp} under the music bed`);
    expect(text).toContain(`by ${TUNING.character.headLagMs} ms and the hands by ${TUNING.character.handLagMs} ms`);
    expect(text).toContain(`every ${(TUNING.character.beatMs / 1000).toFixed(0)}`);
    expect(text).toContain(`deeper than ${TUNING.character.dazeMeters} m`);
  });
});

describe('the audio bible (R-AU-07)', () => {
  it('is the generated file, byte for byte', () => {
    expect(doc('AUDIO.md')).toBe(renderAudio());
  });

  it('carries the whole stinger grammar, and every voice it names is a real recipe', () => {
    for (const s of STINGERS) {
      expect(recipes, `${s.kind} names ${s.voice}`).toHaveProperty(s.voice);
      expect(s.maxS, `${s.kind} outlasts its second and a half`).toBeLessThanOrEqual(1.5);
    }
  });

  it('quotes the code\u2019s own numbers', () => {
    const text = doc('AUDIO.md');
    expect(text).toContain(`\`${MAGNO_MOTIF.map((d) => `\u2022${d}`).join(' ')}\``);
    expect(text).toContain(`\`${THIN_AIR_LEVEL}\``);
    expect(text).toContain(`the bed ducks ${MIX_HIERARCHY.adDuck.db} dB (to a floor of ${MIX_HIERARCHY.adDuck.floorDb} dB)`);
    expect(text).toContain(`side-chain the bed ${MIX_HIERARCHY.stingerDuck.db} dB`);
    expect(text).toContain(`the true-peak ceiling ${MIX_HIERARCHY.monitoring.ceilingDb} dBTP`);
  });
});
