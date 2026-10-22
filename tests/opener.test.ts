import { describe, expect, it } from 'vitest';
import { Opener, type OpenerEffects, type OpenerLevel } from '@/game/opener';
import { SlowMoDirector } from '@/game/slowmo';

const level = (over: Partial<OpenerLevel> = {}): OpenerLevel => ({
  establish: false,
  beat: true,
  spawn: { x: 0, y: 0 },
  summit: { x: 4, y: 30 },
  follow: { x: 0, y: 0.6 },
  followHeight: 11,
  ...over,
});

interface Rig {
  opener: Opener;
  fired: string[];
}

function rig(over: Partial<OpenerLevel> = {}): Rig {
  const fired: string[] = [];
  const effects: OpenerEffects = {
    hop: () => fired.push('hop'),
    firstCatch: () => fired.push('firstCatch'),
    hudReveal: () => fired.push('hudReveal'),
    interruptBeat: () => fired.push('interruptBeat'),
  };
  const opener = new Opener(effects);
  opener.beginLevel(level(over));
  return { opener, fired };
}

/** Runs the opener for `seconds` of game time, collecting the last directed framing. */
function run(opener: Opener, seconds: number, runStarted = false) {
  let framing = null as ReturnType<Opener['update']>['framing'];
  for (let ms = 0; ms < seconds * 1000; ms += 1000 / 60) {
    framing = opener.update(1000 / 60, runStarted).framing;
  }
  return framing;
}

/** Runs exactly `n` frames; the shot durations are frame-counted, so this avoids drift at the seams. */
function frames(opener: Opener, n: number, runStarted = false) {
  let framing = null as ReturnType<Opener['update']>['framing'];
  for (let i = 0; i < n; i++) framing = opener.update(1000 / 60, runStarted).framing;
  return framing;
}

const at = (log: readonly string[], what: string): number | null => {
  const hit = log.find((entry) => entry.startsWith(`${what}@`));
  return hit ? Number(hit.split('@')[1]) : null;
};

describe('the establishing shot that opens a biome', () => {
  it('opens on a character portrait so the first frame sells MAGNO himself', () => {
    const { opener } = rig({ establish: true });
    const hero = run(opener, 0.1)!;
    const lvl = level();
    // At the follow camera's long lens, 2.2 visible metres is the portrait scale:
    // MAGNO's body, head and eye carry the frame instead of drowning in it.
    expect(hero.visibleHeight).toBeLessThan(4);
    expect(Math.abs(hero.center.y - lvl.follow.y)).toBeLessThan(0.01);
  });

  it('pulls out to a vista that holds the whole climb, then settles home by 2.4 seconds', () => {
    const { opener } = rig({ establish: true });
    const lvl = level();
    const vista = run(opener, 1.55)!;
    const bottom = vista.center.y - vista.visibleHeight / 2;
    const top = vista.center.y + vista.visibleHeight / 2;
    expect(vista.visibleHeight).toBeGreaterThan(lvl.followHeight * 2);
    // MAGNO stays inside the frame with ground beneath him, and the summit is
    // in frame: the vista answers "what" and "why" in one composed image.
    expect(bottom).toBeLessThan(lvl.spawn.y - 1);
    expect(top).toBeGreaterThanOrEqual(lvl.summit.y);
    expect(vista.visibleHeight).toBeLessThan(lvl.followHeight * 4.3);

    // The move ends on update 144 (2400 ms); 93 frames reach 1.55 s, so the
    // last directed frame is 143 = 93 + 50.
    const home = frames(opener, 50);
    expect(home).not.toBeNull();
    expect(Math.abs(home!.center.y - lvl.follow.y)).toBeLessThan(0.1);
    expect(Math.abs(home!.visibleHeight - lvl.followHeight)).toBeLessThan(0.1);
    expect(frames(opener, 1)).toBeNull();
  });

  it('keeps the coach hand off the stage while the shot owns the camera', () => {
    const { opener } = rig({ establish: true });
    run(opener, 1.2);
    expect(opener.presenting).toBe(true);
    frames(opener, 72);
    expect(opener.presenting).toBe(false);
  });

  it('is skipped the instant the player touches anything', () => {
    const { opener } = rig({ establish: true });
    run(opener, 0.4);
    opener.noteInput();
    expect(opener.update(1000 / 60, false).framing).toBeNull();
  });

  it('yields the camera when suspended mid-move, and does not come back', () => {
    const { opener } = rig({ establish: true });
    run(opener, 0.6);
    opener.suspend();
    expect(opener.update(1000 / 60, false).framing).toBeNull();
    run(opener, 2);
    expect(opener.update(1000 / 60, false).framing).toBeNull();
  });

  it('never plays on a level that is not the first of its biome', () => {
    const { opener } = rig({ establish: false });
    expect(run(opener, 3)).toBeNull();
  });
});

describe('the idle ladder', () => {
  it('offers the hand at three seconds, not before', () => {
    const { opener } = rig();
    run(opener, 2.9);
    expect(opener.hand).toBe(false);
    run(opener, 0.2);
    expect(opener.hand).toBe(true);
  });

  it('hops at eight seconds and pans to the goal at fifteen, once each', () => {
    const { opener, fired } = rig();
    run(opener, 7.9);
    expect(fired).not.toContain('hop');
    run(opener, 0.3);
    expect(fired.filter((e) => e === 'hop')).toHaveLength(1);
    run(opener, 7);
    expect(fired.filter((e) => e === 'hop')).toHaveLength(1);
    run(opener, 0.2);
    expect(at(opener.log, 'pan')).toBeGreaterThanOrEqual(14900);
    expect(opener.update(1000 / 60, false).framing).not.toBeNull();
  });

  it('brings the camera home when the pan finishes', () => {
    const { opener } = rig();
    frames(opener, 880);
    let last: { center: { y: number } } | null = null;
    for (let i = 0; i < 400; i++) {
      const framing = opener.update(1000 / 60, false).framing;
      if (framing) last = framing;
      else if (last) break;
    }
    expect(last).not.toBeNull();
    expect(last!.center.y).toBeCloseTo(level().follow.y, 1);
    expect(opener.update(1000 / 60, false).framing).toBeNull();
  });

  it('climbs at most twice, then leaves a stalled player in peace', () => {
    const { opener } = rig();
    run(opener, 16.8);
    run(opener, 16.8);
    expect(opener.log.filter((e) => e.startsWith('pan@'))).toHaveLength(2);
    run(opener, 17);
    expect(opener.log.filter((e) => e.startsWith('pan@'))).toHaveLength(2);
    expect(opener.hand).toBe(false);
  });

  it('yields to the first input and burns a cycle only if a rung had fired', () => {
    const { opener } = rig();
    run(opener, 3.2);
    opener.noteInput();
    expect(opener.hand).toBe(false);
    run(opener, 17);
    run(opener, 17);
    // The hand-only cycle plus one full climb is two appearances; the ladder then retires.
    expect(opener.log.filter((e) => e.startsWith('pan@'))).toHaveLength(1);
    expect(opener.hand).toBe(false);

    const early = rig();
    run(early.opener, 0.5);
    early.opener.noteInput();
    run(early.opener, 17);
    run(early.opener, 17);
    expect(early.opener.log.filter((e) => e.startsWith('pan@'))).toHaveLength(2);
  });

  it('goes quiet the moment the run starts', () => {
    const { opener, fired } = rig();
    run(opener, 2);
    for (let ms = 0; ms < 30 * 1000; ms += 1000 / 60) opener.update(1000 / 60, true);
    expect(fired).toEqual([]);
    expect(opener.hand).toBe(false);
  });

  it('completes the staged HUD at ten seconds without a first input', () => {
    const { opener, fired } = rig();
    run(opener, 9.9);
    expect(fired).not.toContain('hudReveal');
    run(opener, 0.2);
    expect(fired.filter((e) => e === 'hudReveal')).toHaveLength(1);
  });
});

describe('the first-catch beat', () => {
  it('waits for a launch before a catch can trigger it', () => {
    const { opener, fired } = rig();
    opener.onCatch();
    expect(fired).toEqual([]);
    opener.onLaunch();
    opener.onCatch();
    opener.onCatch();
    expect(fired.filter((e) => e === 'firstCatch')).toHaveLength(1);
  });

  it('does not fire on a level the save has already celebrated', () => {
    const { opener, fired } = rig({ beat: false });
    opener.onLaunch();
    opener.onCatch();
    expect(fired).toEqual([]);
  });

  it('releases the beat when the player acts inside its window, and not after', () => {
    const { opener, fired } = rig();
    opener.onLaunch();
    opener.onCatch();
    opener.noteInput();
    expect(fired).toContain('interruptBeat');

    const settled = rig();
    settled.opener.onLaunch();
    settled.opener.onCatch();
    run(settled.opener, 1.7);
    settled.opener.noteInput();
    expect(settled.fired).not.toContain('interruptBeat');
  });

  it('marks gameplay moments on the session timeline', () => {
    const { opener } = rig();
    run(opener, 1.5);
    opener.mark('snap');
    expect(at(opener.log, 'snap')).toBeGreaterThanOrEqual(1400);
  });
});

describe('the slow-motion beat underneath the first catch', () => {
  const runMs = (director: SlowMoDirector, ms: number) => {
    for (let t = 0; t < ms; t += 1000 / 60) director.update(1000 / 60);
  };

  it('slows the world, holds it briefly, and recovers on its own', () => {
    const director = new SlowMoDirector();
    expect(director.beat(0.5, 900)).toBe(true);
    runMs(director, 250);
    expect(director.scale).toBeLessThan(1);
    let deepest = 1;
    for (let t = 0; t < 2000; t += 1000 / 60) {
      director.update(1000 / 60);
      deepest = Math.min(deepest, director.scale);
    }
    expect(deepest).toBeCloseTo(0.5, 5);
    expect(director.scale).toBe(1);
    expect(director.active).toBe(false);
  });

  it('refuses a fall that tries to take the clock mid-beat, and costs no fall budget slot', () => {
    const director = new SlowMoDirector();
    director.beat(0.5, 900);
    expect(director.request(20)).toBe(false);
    runMs(director, 2000);
    expect(director.request(20)).toBe(true);
  });

  it('ends early when interrupted, exactly like a saved fall', () => {
    const director = new SlowMoDirector();
    director.beat(0.5, 900);
    runMs(director, 300);
    director.release();
    runMs(director, 600);
    expect(director.scale).toBe(1);
  });

  it('stays silent for reduced motion', () => {
    const director = new SlowMoDirector();
    director.disabled = true;
    expect(director.beat(0.5, 900)).toBe(false);
    expect(director.scale).toBe(1);
  });
});
