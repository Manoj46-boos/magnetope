import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GhostDirector } from '@/game/ghost-director';
import { GhostExchange } from '@/game/ghost-exchange';
import { ALL_LEVELS } from '@/levels';
import { loadParGhost } from '@/levels/par-ghosts';
import { MemoryBackend, SaveStore, sanitizeSave } from '@/platform/storage';
import { decodeGhost, encodeGhost, sampleGhost, type GhostTrack } from '@/sim/ghost';
import { cleanName, decodeGhostCode, encodeGhostCode } from '@/sim/ghost-code';
import { vetGhost } from '@/sim/ghost-vet';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';

const levelOf = (id: string) => ALL_LEVELS.find((l) => l.id === id)!;
const par = async (id: string): Promise<GhostTrack> => (await loadParGhost(id))!;
const store = () => new SaveStore(new MemoryBackend());
const clone = (t: GhostTrack): GhostTrack => ({ ...t, x: [...t.x], y: [...t.y] });

const deflateZeros = async (bytes: number): Promise<string> => {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const packed = new Uint8Array(await new Response(stream).arrayBuffer());
  return `MGH1.${Buffer.from(packed).toString('base64url')}`;
};

describe('ghost codes', () => {
  it('carry a level, a name and the whole route through a round trip', async () => {
    const track = await par('scrapyard-05');
    const result = await decodeGhostCode(await encodeGhostCode(track, 'Sam'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.name).toBe('Sam');
    expect(result.track).toEqual(track);
  });

  it('stay short enough to paste into a chat message, for every level in the game', async () => {
    let longest = 0;
    for (const level of ALL_LEVELS) {
      const code = await encodeGhostCode(await par(level.id), 'Somebody');
      longest = Math.max(longest, code.length);
      expect(code, level.id).toMatch(/^MGH1\.[A-Za-z0-9_-]+$/);
    }
    expect(longest).toBeLessThan(6000);
  });

  it('survive being wrapped, indented or padded by whatever chat app carried them', async () => {
    const code = await encodeGhostCode(await par('metropolis-03'), 'Ana');
    const wrapped = `  ${code.replace(/(.{60})/g, '$1\n')}\n\n`;
    const result = await decodeGhostCode(wrapped);
    expect(result.ok && result.name).toBe('Ana');
  });

  it('refuse anything that is not a code without throwing', async () => {
    const good = await encodeGhostCode(await par('scrapyard-02'), 'Kit');
    const failures = await Promise.all(
      ['', 'hello', 'MGH1.', 'MGH1.!!!!', 'MGH2.' + good.slice(5), 'MGH1.AAAA', '{"v":1}', good.slice(0, good.length >> 1)].map(decodeGhostCode),
    );
    for (const result of failures) expect(result.ok).toBe(false);
  });

  it('notice a single damaged character instead of replaying a corrupted route', async () => {
    const good = await encodeGhostCode(await par('scrapyard-03'), 'Kit');
    const at = Math.floor(good.length / 2);
    const swapped = good[at] === 'A' ? 'B' : 'A';
    const result = await decodeGhostCode(good.slice(0, at) + swapped + good.slice(at + 1));
    expect(result.ok).toBe(false);
  });

  it('cannot be used to inflate a tiny code into a huge allocation', async () => {
    const bomb = await deflateZeros(30_000_000);
    expect(bomb.length).toBeLessThan(48_000);
    const result = await decodeGhostCode(bomb);
    expect(result).toEqual({ ok: false, reason: 'too-large' });
    expect(await decodeGhostCode('MGH1.' + 'A'.repeat(60_000))).toEqual({ ok: false, reason: 'too-large' });
  });

  it('clean names to one short printable line', () => {
    expect(cleanName('  Sam\n\tthe   Great  ')).toBe('Sam the Great');
    expect(cleanName('', 'Friend')).toBe('Friend');
    expect(cleanName('x'.repeat(40))).toHaveLength(14);
    expect(cleanName('‮\u0000')).toBe('');
  });
});

describe('plausibility of a received ghost', () => {
  it('accepts the par ghost of every level as a possible run of that level', async () => {
    for (const level of ALL_LEVELS) expect(vetGhost(await par(level.id), level), level.id).toEqual({ ok: true });
  });

  it('accepts a run recorded from real play, not just shipped data', async () => {
    const level = ALL_LEVELS[1]!;
    const sim = new Simulation(await loadRapier(), level);
    const route = decodeRecording(readFileSync(resolve(__dirname, `../src/levels/routes/${level.id}.json`), 'utf8'));
    const player = new ReplayPlayer(route);
    const director = new GhostDirector(async () => null);
    director.begin(level.id, undefined);
    while (!player.done && !sim.run.cleared) {
      sim.step(player.next());
      director.capture(sim);
    }
    const track = decodeGhost(director.encodeRun(sim, level.id), level.id)!;
    sim.dispose();
    const back = await decodeGhostCode(await encodeGhostCode(track, 'Me'));
    expect(back.ok && vetGhost(back.track, level)).toEqual({ ok: true });
  });

  it('rejects a ghost recorded on another level', async () => {
    const track = await par('scrapyard-05');
    expect(vetGhost(track, levelOf('scrapyard-06'))).toEqual({ ok: false, reason: 'level' });
  });

  it('rejects a route that does not begin at the base or does not end at the summit', async () => {
    const level = levelOf('suburbia-04');
    const shifted = clone(await par(level.id));
    shifted.x = shifted.x.map((x) => x + 50 * 12);
    expect(vetGhost(shifted, level)).toMatchObject({ ok: false, reason: 'start' });

    const short = clone(await par(level.id));
    const keep = Math.floor(short.x.length * 0.6);
    short.x.length = short.y.length = keep;
    short.durationMs = Math.round(((keep - 1) / 20) * 1000);
    expect(vetGhost(short, level)).toEqual({ ok: false, reason: 'summit' });
  });

  it('rejects a teleport between two samples', async () => {
    const level = levelOf('metropolis-05');
    const jumped = clone(await par(level.id));
    const mid = Math.floor(jumped.y.length / 2);
    for (let i = mid; i < jumped.y.length - 1; i++) jumped.y[i] = jumped.y[i]! + 50 * 30;
    expect(vetGhost(jumped, level)).toMatchObject({ ok: false });
  });

  it('rejects a climb that finishes faster than a flip chain can carry anyone', async () => {
    const level = levelOf('stratosphere-10');
    const track = await par(level.id);
    const rushed = { ...clone(track), x: [track.x[0]!, track.x[track.x.length - 1]!], y: [track.y[0]!, track.y[track.y.length - 1]!], durationMs: 50 };
    expect(vetGhost(rushed, level)).toMatchObject({ ok: false });
  });

  it('rejects a recording whose length contradicts its stated duration', async () => {
    const level = levelOf('playground-07');
    const lying = { ...clone(await par(level.id)) };
    lying.durationMs = lying.durationMs * 3;
    expect(vetGhost(lying, level)).toEqual({ ok: false, reason: 'duration' });
  });

  it('rejects a route that leaves the level', async () => {
    const level = levelOf('scrapyard-08');
    const wandering = clone(await par(level.id));
    const mid = Math.floor(wandering.x.length / 2);
    wandering.x[mid] = (level.bounds.maxX + 40) * 50;
    expect(vetGhost(wandering, level)).toMatchObject({ ok: false });
  });
});

describe('the exchange between two players', () => {
  const ghostFor = async (id: string, owner: SaveStore) => {
    const track = await par(id);
    owner.update((s) => void (s.ghosts[id] = encodeGhost(track)));
    return track;
  };

  it('sends one player\'s best ghost to another, who then races it on that level', async () => {
    const alice = store();
    const bob = store();
    const track = await ghostFor('suburbia-03', alice);
    const code = await new GhostExchange(alice).exportCode('suburbia-03', 'Alice');
    expect(code).not.toBeNull();

    const changed: string[] = [];
    const outcome = await new GhostExchange(bob, (id) => changed.push(id)).importCode(code!);
    expect(outcome).toEqual({ ok: true, name: 'Alice', level: levelOf('suburbia-03').name });
    expect(changed).toEqual(['suburbia-03']);

    const director = new GhostDirector(async () => null);
    director.begin('suburbia-03', undefined, bob.data.friends['suburbia-03']);
    expect(director.race).toEqual({ name: 'Alice', durationMs: track.durationMs });
    const half = track.durationMs / 2;
    const expected = sampleGhost(track, half);
    const pose = director.poses(half, true).friend!;
    expect(Math.hypot(pose.x - expected.x, pose.y - expected.y)).toBeLessThan(0.02);
  });

  it('has nothing to send until the player owns a ghost for that level', async () => {
    expect(await new GhostExchange(store()).exportCode('scrapyard-01', 'Nobody')).toBeNull();
  });

  it('remembers the player\'s name for next time, trimmed to a short line', async () => {
    const owner = store();
    await ghostFor('scrapyard-04', owner);
    const exchange = new GhostExchange(owner);
    await exchange.exportCode('scrapyard-04', '  Captain\nMagnet  Pants ');
    expect(owner.data.alias).toBe('Captain Magnet');
    expect(exchange.view('scrapyard-04').alias).toBe('Captain Magnet');
  });

  it('names a friend whose code carried no name, and keeps one friend per level', async () => {
    const bob = store();
    const exchange = new GhostExchange(bob);
    const track = await par('playground-02');
    await exchange.importCode(await encodeGhostCode(track, ''));
    expect(bob.data.friends['playground-02']!.name).toBe('Friend');

    const faster = clone(track);
    await exchange.importCode(await encodeGhostCode(faster, 'Zed'));
    expect(Object.keys(bob.data.friends)).toEqual(['playground-02']);
    expect(bob.data.friends['playground-02']!.name).toBe('Zed');
  });

  it('files a ghost under its own level even when pasted while playing another', async () => {
    const bob = store();
    const outcome = await new GhostExchange(bob).importCode(await encodeGhostCode(await par('metropolis-09'), 'Ana'));
    expect(outcome.ok).toBe(true);
    expect(Object.keys(bob.data.friends)).toEqual(['metropolis-09']);
  });

  it('explains each failure in the player\'s terms and stores nothing', async () => {
    const bob = store();
    const exchange = new GhostExchange(bob);
    const bad = clone(await par('scrapyard-05'));
    bad.y = bad.y.map((y, i) => (i === 20 ? y + 50 * 60 : y));
    expect(await exchange.importCode('not a code')).toEqual({ ok: false, message: 'ghostErrFormat' });
    expect(await exchange.importCode(await encodeGhostCode(bad, 'Cheat'))).toEqual({ ok: false, message: 'ghostErrImplausible' });
    expect(await exchange.importCode(await deflateZeros(5_000_000))).toEqual({ ok: false, message: 'ghostErrTooLarge' });
    expect(bob.data.friends).toEqual({});
  });

  it('refuses a ghost for a level this game does not have', async () => {
    const track = { ...(await par('scrapyard-05')), levelId: 'nowhere-99' };
    const outcome = await new GhostExchange(store()).importCode(await encodeGhostCode(track, 'Lost'));
    expect(outcome).toEqual({ ok: false, message: 'ghostErrFormat' });
  });

  it('lets a player drop a friend ghost and tells the race to stop', async () => {
    const bob = store();
    const changed: string[] = [];
    const exchange = new GhostExchange(bob, (id) => changed.push(id));
    await exchange.importCode(await encodeGhostCode(await par('scrapyard-05'), 'Ana'));
    exchange.removeFriend('scrapyard-05');
    exchange.removeFriend('scrapyard-05');
    expect(bob.data.friends).toEqual({});
    expect(exchange.view('scrapyard-05').friend).toBeNull();
    expect(changed).toEqual(['scrapyard-05', 'scrapyard-05']);
  });

  it('describes the level for the exchange screen with the times of both ghosts', async () => {
    const bob = store();
    const own = await ghostFor('scrapyard-07', bob);
    const exchange = new GhostExchange(bob);
    await exchange.importCode(await encodeGhostCode(await par('scrapyard-07'), 'Ana'));
    const view = exchange.view('scrapyard-07');
    expect(view.levelName).toBe(levelOf('scrapyard-07').name);
    expect(view.personalMs).toBe(own.durationMs);
    expect(view.friend).toEqual({ name: 'Ana', durationMs: own.durationMs });
    expect(exchange.view('scrapyard-08')).toMatchObject({ personalMs: null, friend: null });
  });
});

describe('the ghost director with a friend', () => {
  const stored = async (name: string) => ({ name, ghost: encodeGhost(await par('scrapyard-06')) });

  it('swaps the friend mid-run without losing the run being recorded', async () => {
    const level = ALL_LEVELS[1]!;
    const sim = new Simulation(await loadRapier(), level);
    const route = decodeRecording(readFileSync(resolve(__dirname, `../src/levels/routes/${level.id}.json`), 'utf8'));
    const player = new ReplayPlayer(route);
    const director = new GhostDirector(async () => null);
    director.begin(level.id, undefined);
    let swapped = false;
    while (!player.done && !sim.run.cleared) {
      sim.step(player.next());
      director.capture(sim);
      if (!swapped && sim.run.timeMs > 3000) {
        swapped = true;
        director.setFriend(level.id, { name: 'Late', ghost: encodeGhost(await par(level.id)) });
      }
    }
    expect(director.race?.name).toBe('Late');
    const recorded = decodeGhost(director.encodeRun(sim, level.id), level.id)!;
    const runMs = sim.run.timeMs;
    sim.dispose();
    expect(recorded.x.length).toBeGreaterThan(runMs / 50 - 3);
  });

  it('hides the friend with the other ghosts when ghosts are switched off', async () => {
    const director = new GhostDirector(async () => null);
    director.begin('scrapyard-06', undefined, await stored('Ana'));
    expect(director.poses(1000, true).friend).not.toBeNull();
    expect(director.poses(1000, false)).toEqual({ par: null, personal: null, friend: null });
  });

  it('ignores a stored friend ghost that belongs to a different level or is damaged', async () => {
    const director = new GhostDirector(async () => null);
    director.begin('scrapyard-07', undefined, await stored('Ana'));
    expect(director.race).toBeNull();
    director.begin('scrapyard-06', undefined, { name: 'Broken', ghost: '{"v":1' });
    expect(director.race).toBeNull();
  });
});

describe('saved friends', () => {
  it('survive a reload through the save store', async () => {
    const backend = new MemoryBackend();
    const first = new SaveStore(backend);
    await new GhostExchange(first).importCode(await encodeGhostCode(await par('scrapyard-05'), 'Ana'));
    const second = new SaveStore(backend);
    expect(second.data.friends['scrapyard-05']).toMatchObject({ name: 'Ana' });
    expect(decodeGhost(second.data.friends['scrapyard-05']!.ghost, 'scrapyard-05')).not.toBeNull();
  });

  it('are dropped when the save file holds garbage in their place', () => {
    const save = sanitizeSave({
      friends: {
        a: { name: 'Ok', ghost: '{}' },
        b: 'nope',
        c: { name: 12, ghost: 7 },
        d: { name: '\n\n', ghost: 'x'.repeat(70_000) },
      },
      alias: { not: 'a string' },
    });
    expect(Object.keys(save.friends)).toEqual(['a']);
    expect(save.friends.a!.name).toBe('Ok');
    expect(save.alias).toBe('');
  });

  it('are absent from a save written before the exchange existed', () => {
    const save = sanitizeSave({ stars: { 'scrapyard-01': 3 } });
    expect(save.friends).toEqual({});
    expect(save.alias).toBe('');
    expect(save.stars['scrapyard-01']).toBe(3);
  });
});
