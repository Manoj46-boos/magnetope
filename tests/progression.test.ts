import { describe, expect, it } from 'vitest';
import { Coach } from '@/game/coach';
import { HighlightStrip } from '@/game/highlights';
import { FLAG, HudReveal } from '@/game/hud-reveal';
import { buildMap, isPlayable, nextPlayableId, resumeLevelId } from '@/game/map-model';
import { ALL_LEVELS } from '@/levels';
import { AttemptRecorder, Telemetry, type TelemetryRecord } from '@/platform/telemetry';

const save = (stars: Record<string, number> = {}) => ({ stars, bestMs: {}, bestGrade: {} as Record<string, never> });
const fall = (score: number) => ({ levelId: 'l', levelName: 'L', biome: 'scrapyard' as const, heightMeters: score, bounces: 0, junk: 0, grade: 'C', score });

describe('level map', () => {
  it('opens only the tutorial on a fresh save and marks it as the next level to play', () => {
    const [scrapyard] = buildMap(ALL_LEVELS, save());
    expect(scrapyard!.nodes.map((n) => n.state)).toEqual(['open', ...Array(scrapyard!.nodes.length - 1).fill('locked')]);
    expect(scrapyard!.nodes[0]!.frontier).toBe(true);
  });

  it('opens each level as the one before it is cleared and keeps cleared levels open', () => {
    const [scrapyard] = buildMap(ALL_LEVELS, save({ 'scrapyard-00': 1, 'scrapyard-01': 2 }));
    const states = Object.fromEntries(scrapyard!.nodes.map((n) => [n.id, n.state]));
    expect(states['scrapyard-00']).toBe('cleared');
    expect(states['scrapyard-01']).toBe('cleared');
    expect(states['scrapyard-02']).toBe('open');
    expect(states['scrapyard-03']).toBe('locked');
    expect(scrapyard!.nodes.find((n) => n.frontier)!.id).toBe('scrapyard-02');
  });

  it('opens each biome on its star gate: 15, 34, 57 and 80', () => {
    const gates = (stars: number) => buildMap(ALL_LEVELS, save({ x: stars })).map((b) => b.unlocked);
    expect(gates(0)).toEqual([true, false, false, false, false]);
    expect(gates(15)).toEqual([true, true, false, false, false]);
    expect(gates(57)).toEqual([true, true, true, true, false]);
    expect(gates(80)).toEqual([true, true, true, true, true]);
    expect(buildMap(ALL_LEVELS, save({ x: 5 }))[1]!.starsToGo).toBe(10);
  });

  it('maps all five biomes with the fourteen levels each one ships', () => {
    const counts = Object.fromEntries(buildMap(ALL_LEVELS, save()).map((b) => [b.id, b.nodes.length]));
    expect(counts).toEqual({ scrapyard: 14, suburbia: 14, metropolis: 14, playground: 14, stratosphere: 14 });
  });

  it('leaves every gate within reach: the stars available below a biome comfortably exceed its price', () => {
    buildMap(ALL_LEVELS, save()).forEach((biome, i) => {
      if (i === 0) return;
      const available = i * 14 * 3;
      expect(biome.gate, biome.id).toBeLessThan(available * 0.6);
      expect(biome.gate, biome.id).toBeGreaterThan(available * 0.3);
    });
  });

  it('opens the first Suburbia level the moment its star gate is passed, and the rest one by one', () => {
    const open = (stars: Record<string, number>) =>
      Object.fromEntries(buildMap(ALL_LEVELS, save(stars))[1]!.nodes.map((n) => [n.id, n.state]));
    expect(open({ x: 14 })['suburbia-01']).toBe('locked');
    expect(open({ x: 15 })['suburbia-01']).toBe('open');
    expect(open({ x: 15 })['suburbia-02']).toBe('locked');
    expect(open({ x: 15, 'suburbia-01': 1 })['suburbia-02']).toBe('open');
  });

  it('keeps Metropolis sealed until 34 stars however much of Suburbia is cleared', () => {
    const cleared = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`suburbia-${String(i + 1).padStart(2, '0')}`, 1]));
    const [, , metropolis] = buildMap(ALL_LEVELS, save(cleared));
    expect(metropolis!.unlocked).toBe(false);
    expect(metropolis!.starsToGo).toBe(34 - 14);
    expect(metropolis!.nodes.every((n) => n.state === 'locked')).toBe(true);
    const [, , open] = buildMap(ALL_LEVELS, save({ ...cleared, x: 20 }));
    expect(open!.nodes[0]!.state).toBe('open');
  });

  it('lets a player who has cleared Metropolis straight on into the Playground once its gate is earned', () => {
    const cleared = Object.fromEntries(ALL_LEVELS.filter((l) => l.biome === 'metropolis').map((l) => [l.id, 3]));
    const biomes = buildMap(ALL_LEVELS, save({ ...cleared, x: 15 }));
    expect(biomes[3]!.unlocked).toBe(true);
    expect(biomes[3]!.nodes[0]!.state).toBe('open');
    expect(biomes[4]!.unlocked).toBe(false);
  });

  it('moves the frontier on into the following biome once the gate is earned', () => {
    const scrapyardDone = Object.fromEntries(ALL_LEVELS.filter((l) => l.biome === 'scrapyard').map((l) => [l.id, 3]));
    expect(resumeLevelId(ALL_LEVELS, save(scrapyardDone))).toBe('suburbia-01');
    expect(nextPlayableId(ALL_LEVELS, save(scrapyardDone), 'scrapyard-13')).toBe('suburbia-01');
  });

  it('refuses to start a locked level and an unknown one', () => {
    expect(isPlayable(ALL_LEVELS, save(), 'scrapyard-00')).toBe(true);
    expect(isPlayable(ALL_LEVELS, save(), 'scrapyard-04')).toBe(false);
    expect(isPlayable(ALL_LEVELS, save(), 'nope')).toBe(false);
  });
});

describe('best-falls strip', () => {
  it('keeps the five funniest falls, best first', () => {
    const strip = new HighlightStrip();
    [4, 30, 12, 9, 50, 2, 21].forEach((s) => strip.add(fall(s)));
    expect(strip.list.map((h) => h.score)).toEqual([50, 30, 21, 12, 9]);
  });
});

describe('staged HUD', () => {
  const make = () => {
    const persisted: string[] = [];
    return { persisted, reveal: new HudReveal(new Set(), (f) => persisted.push(f)) };
  };

  it('shows the altitude rail only after real vertical gain', () => {
    const { reveal } = make();
    expect(reveal.railVisible(0.5)).toBe(false);
    expect(reveal.railVisible(3)).toBe(true);
  });

  it('keeps the charge meter hidden on early levels until the player holds a charge', () => {
    const { reveal, persisted } = make();
    const early = { biome: 'scrapyard' as const, index: 1 };
    expect(reveal.chargeMeterVisible(early, 0)).toBe(false);
    expect(reveal.chargeMeterVisible(early, 400)).toBe(true);
    expect(persisted).toEqual([FLAG.charge]);
    expect(reveal.chargeMeterVisible(early, 0)).toBe(true);
  });

  it('reveals the charge meter on level 3, where it is taught', () => {
    expect(make().reveal.chargeMeterVisible({ biome: 'scrapyard', index: 3 }, 0)).toBe(true);
  });

  it('shows the star tracker only after a first clear', () => {
    const { reveal } = make();
    expect(reveal.starTrackerVisible({ stars: {} })).toBe(false);
    expect(reveal.starTrackerVisible({ stars: { a: 1 } })).toBe(true);
  });
});

describe('ghost-hand coach', () => {
  it('demonstrates a launch while MAGNO hangs, steps aside while charging, then teaches the snap in the air', () => {
    const coach = new Coach(true, () => undefined);
    expect(coach.update(16, 'attached')).toBe('launch');
    expect(coach.update(16, 'charging')).toBeNull();
    coach.onRepel();
    expect(coach.update(100, 'airborne')).toBeNull();
    expect(coach.update(300, 'airborne')).toBe('snap');
    expect(coach.update(5000, 'airborne')).toBeNull();
  });

  it('retires for good after two launches that each ended in a catch', () => {
    let finished = 0;
    const coach = new Coach(true, () => finished++);
    coach.onAttach();
    expect(coach.active).toBe(true);
    for (let i = 0; i < 2; i++) {
      coach.onRepel();
      coach.onAttach();
    }
    expect(finished).toBe(1);
    expect(coach.update(16, 'attached')).toBeNull();
  });

  it('never appears for a player who has already been taught', () => {
    const coach = new Coach(false, () => undefined);
    expect(coach.update(16, 'attached')).toBeNull();
  });
});

describe('telemetry', () => {
  const rig = (allowed = true) => {
    const sent: TelemetryRecord[][] = [];
    let ok = allowed;
    let clock = 0;
    const telemetry = new Telemetry({ send: (b) => sent.push(b), canFlush: () => ok, now: () => clock });
    return { sent, telemetry, allow: (v: boolean) => (ok = v), tick: (ms: number) => (clock += ms) };
  };

  it('holds events through a run and sends them in one batch at a natural stop', () => {
    const { telemetry, sent, allow } = rig(false);
    telemetry.record('level', 'a', 'enter');
    expect(telemetry.flush()).toBe(false);
    expect(sent).toHaveLength(0);
    allow(true);
    expect(telemetry.flush()).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.map((r) => r.category)).toEqual(['level', 'session']);
    expect(telemetry.pending).toBe(0);
  });

  it('sends nothing when there is nothing to say', () => {
    expect(rig().telemetry.flush()).toBe(false);
  });

  it('bounds memory by dropping the oldest events', () => {
    const t = new Telemetry({ send: () => undefined, canFlush: () => true, maxQueue: 5 });
    for (let i = 0; i < 20; i++) t.record('c', 'w', String(i));
    expect(t.pending).toBe(5);
  });

  it('never lets a failing sink disturb play', () => {
    const t = new Telemetry({
      send: () => {
        throw new Error('blocked');
      },
      canFlush: () => true,
    });
    t.record('c', 'w', 'a');
    expect(() => t.flush()).not.toThrow();
  });

  it('summarises an attempt with its outcome, its stars, its falls and the retry latency', () => {
    const { telemetry, sent, tick } = rig();
    let now = 0;
    const attempts = new AttemptRecorder(telemetry, () => now);
    attempts.begin('scrapyard-01');
    attempts.fall(14.26, { x: 1, y: 9 }, 'A');
    now = 900;
    attempts.finish('clear', 41_307, 3);
    attempts.begin('scrapyard-01');
    tick(1000);
    telemetry.flush();

    const records = sent[0]!;
    expect(records.find((r) => r.category === 'attempt')!.action).toBe('clear');
    expect(records.find((r) => r.category === 'stars')!.action).toBe('3');
    expect(records.find((r) => r.category === 'time')!.action).toBe('41');
    expect(records.find((r) => r.category === 'fall')!.action).toBe('h-14 g-A');
    expect(records.find((r) => r.category === 'fallcount')!.action).toBe('1');
    expect(records.find((r) => r.category === 'retry')!.action).toBe('900');
  });
});
