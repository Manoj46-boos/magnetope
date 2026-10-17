import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GhostDirector } from '@/game/ghost-director';
import { ALL_LEVELS } from '@/levels';
import { loadParGhost } from '@/levels/par-ghosts';
import { GhostRecorder, decodeGhost, encodeGhost, guideDirection, sampleGhost } from '@/sim/ghost';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { loadRapier } from '@/sim/rapier';
import { Simulation } from '@/sim/simulation';

const record = (points: Array<[number, number]>) => {
  const r = new GhostRecorder();
  points.forEach(([x, y]) => r.push({ x, y }));
  return r;
};

describe('ghost tracks', () => {
  it('survives encode and decode within 2 cm', () => {
    const pts: Array<[number, number]> = Array.from({ length: 90 }, (_, i) => [Math.sin(i / 9) * 4, i * 0.13]);
    const track = record(pts).finish('lvl', 1500, { x: 0, y: 12 });
    const back = decodeGhost(encodeGhost(track), 'lvl')!;
    expect(back.durationMs).toBe(1500);
    for (const t of [0, 400, 900, 1400]) {
      const a = sampleGhost(track, t);
      const b = sampleGhost(back, t);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.02);
    }
  });

  it('interpolates between samples and parks at the end', () => {
    const track = record([[0, 0], [0, 0], [0, 0], [3, 0], [3, 0], [3, 0], [6, 0]]).finish('l', 300, { x: 6, y: 0 });
    expect(sampleGhost(track, 0).x).toBe(0);
    expect(sampleGhost(track, 25).x).toBeCloseTo(1.5, 1);
    const end = sampleGhost(track, 99_999);
    expect(end.finished).toBe(true);
    expect(end.x).toBe(6);
  });

  it('rejects corrupt, foreign or oversized ghosts instead of trusting them', () => {
    const good = encodeGhost(record([[0, 0], [1, 1], [2, 2], [3, 3]]).finish('a', 200, { x: 3, y: 3 }));
    expect(decodeGhost(good, 'b')).toBeNull();
    expect(decodeGhost('not json')).toBeNull();
    expect(decodeGhost(JSON.stringify({ v: 1, l: 'a', d: 10, x: [0, 1.5], y: [0, 1] }))).toBeNull();
    expect(decodeGhost(JSON.stringify({ v: 2, l: 'a', d: 10, x: [0, 1], y: [0, 1] }))).toBeNull();
    expect(decodeGhost(JSON.stringify({ v: 1, l: 'a', d: 10, x: [0, 1], y: [0] }))).toBeNull();
  });

  it('points the tutorial hand along the route from wherever the player stands', () => {
    const track = record(Array.from({ length: 60 }, (_, i): [number, number] => [i * 0.2, 0])).finish('l', 3000, { x: 12, y: 0 });
    const dir = guideDirection(track, { x: 1, y: 0.2 })!;
    expect(dir.x).toBeGreaterThan(0.95);
  });
});

describe('shipped par ghosts', () => {
  it.each(ALL_LEVELS.map((l) => [l.id, l] as const))('%s has a ghost that starts at the base and finishes at the summit within par', async (_id, level) => {
    const track = await loadParGhost(level.id);
    expect(track).not.toBeNull();
    const start = sampleGhost(track!, 0);
    expect(Math.hypot(start.x - level.spawn.x, start.y - level.spawn.y)).toBeLessThan(2);
    const end = sampleGhost(track!, track!.durationMs + 1);
    expect(Math.hypot(end.x - level.summit.x, end.y - level.summit.y)).toBeLessThanOrEqual(level.summit.radius + 0.5);
    expect(track!.durationMs / 1000).toBeLessThanOrEqual(level.parSeconds);
  });

  it('never teleports: consecutive samples stay within a physical speed', async () => {
    for (const level of ALL_LEVELS) {
      const t = (await loadParGhost(level.id))!;
      for (let i = 1; i < t.x.length; i++) {
        const metres = Math.hypot(t.x[i]! - t.x[i - 1]!, t.y[i]! - t.y[i - 1]!) / 50;
        expect(metres, level.id).toBeLessThan(2.5);
      }
    }
  });
});

describe('ghost director', () => {
  it('records a real run and replays the same path as a personal ghost', async () => {
    const level = ALL_LEVELS[1]!;
    const rapier = await loadRapier();
    const sim = new Simulation(rapier, level);
    const route = decodeRecording(readFileSync(resolve(__dirname, `../src/levels/routes/${level.id}.json`), 'utf8'));
    const player = new ReplayPlayer(route);
    const director = new GhostDirector(async () => null);
    director.begin(level.id, undefined);
    while (!player.done && !sim.run.cleared) {
      sim.step(player.next());
      director.capture(sim);
    }
    expect(sim.run.cleared).toBe(true);
    const stored = director.encodeRun(sim, level.id);
    director.begin(level.id, stored);
    expect(director.hasPersonal).toBe(true);
    const mid = sim.run.timeMs / 2;
    const pose = director.poses(mid, true).personal!;
    expect(pose.y).toBeGreaterThan(level.spawn.y);
    expect(pose.y).toBeLessThan(level.summit.y);
    sim.dispose();
  });

  it('hides ghosts when the setting is off and after they have lingered at the finish', () => {
    const director = new GhostDirector(async () => null);
    const stored = encodeGhost(record([[0, 0], [1, 1], [2, 2], [3, 3]]).finish('x', 200, { x: 3, y: 3 }));
    director.begin('x', stored);
    expect(director.poses(100, true).personal).not.toBeNull();
    expect(director.poses(100, false).personal).toBeNull();
    expect(director.poses(60_000, true).personal).toBeNull();
  });

  it('ignores a par ghost that arrives after the player moved to another level', async () => {
    let release: (v: Awaited<ReturnType<typeof loadParGhost>>) => void = () => {};
    const slow = new Promise<Awaited<ReturnType<typeof loadParGhost>>>((r) => (release = r));
    const director = new GhostDirector((id) => (id === 'old' ? slow : Promise.resolve(null)));
    director.begin('old', undefined);
    director.begin('new', undefined);
    release(record([[0, 0], [1, 1], [2, 2]]).finish('old', 100, { x: 2, y: 2 }));
    await slow;
    await Promise.resolve();
    expect(director.parTrack).toBeNull();
  });
});
