import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MATERIALS } from '@/config/materials';
import { propKind } from '@/config/props';
import { ALL_LEVELS, levelById } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';
import type { LevelDef, PropPlacement } from '@/sim/types';

/**
 * A bare tap-flip carries MAGNO 4.1 m and a snap catches a ledge 4.7 m up at full gravity
 * (`npm run reach -- 1 --hold=0`); lighter gravity stretches both. A level whose every step is
 * shorter than that can be taken with taps alone, which makes the game a climbing game.
 */
const tapCatch = (gravityScale: number): number => 4.7 * gravityScale ** -0.87;
const MARGIN = 1;

/**
 * Levels still to be re-laid so that charging is required (see docs/ROADMAP.md, "Magnet-first").
 * The list may only shrink: a level that passes must be removed, and no new level may join it.
 */
const OPEN: readonly string[] = [
  'scrapyard-00', 'scrapyard-01', 'scrapyard-02', 'scrapyard-04', 'scrapyard-06',
  'scrapyard-07', 'scrapyard-08', 'scrapyard-10', 'scrapyard-13',
  'stratosphere-12',
];

const topOf = (p: PropPlacement): number => {
  const kind = propKind(p.kind);
  const w = kind.shape.type === 'box' ? (p.w ?? kind.shape.w) : (p.r ?? kind.shape.r) * 2;
  const h = kind.shape.type === 'box' ? (p.h ?? kind.shape.h) : w;
  const rot = p.rot ?? 0;
  return p.y + (w * Math.abs(Math.sin(rot)) + h * Math.abs(Math.cos(rot))) / 2;
};

/** The largest step between magnetic surfaces, bottom to summit, wherever they stand. */
function largestStep(level: LevelDef): number {
  const tops = level.props
    .filter((p) => MATERIALS[p.material ?? propKind(p.kind).material].magnetic !== 'inert')
    .map(topOf)
    .sort((a, b) => a - b);
  let step = level.summit.y - tops[tops.length - 1]!;
  for (let i = 1; i < tops.length; i++) step = Math.max(step, tops[i]! - tops[i - 1]!);
  return step;
}

describe('magnet-first levels', () => {
  const failing = ALL_LEVELS.filter((l) => largestStep(l) < tapCatch(l.gravityScale ?? 1) + MARGIN).map((l) => l.id);

  it('has no level whose every step a bare tap-flip can make, apart from the ones still to be re-laid', () => {
    const unexpected = failing.filter((id) => !OPEN.includes(id));
    expect(unexpected, `tap-climbable: ${unexpected.join(', ')}`).toEqual([]);
  });

  it('keeps the open list honest: nothing on it already passes', () => {
    const stale = OPEN.filter((id) => !failing.includes(id));
    expect(stale, `already fixed, remove from OPEN: ${stale.join(', ')}`).toEqual([]);
  });
});

/** Levels re-laid in session 10 after a tap-only bot cleared them. */
const RELAID = ['suburbia-01', 'suburbia-02', 'suburbia-09', 'suburbia-10', 'metropolis-01', 'metropolis-11'];
const CHARGED = 0.5;

describe('re-laid levels in play', () => {
  for (const id of RELAID) {
    it(`${id}: the stored route reaches the summit and leans on charged launches to do it`, async () => {
      const level = levelById(id);
      const recording = decodeRecording(readFileSync(resolve(__dirname, `../src/levels/routes/${id}.json`), 'utf8'));
      const sim = new Simulation(await loadRapier(), level);
      const powers: number[] = [];
      sim.magno.events.on('repel', (e) => powers.push(e.power));
      const player = new ReplayPlayer(recording);
      while (!player.done && !sim.run.cleared) sim.step(player.next());
      sim.dispose();
      expect(sim.run.cleared).toBe(true);
      const charged = powers.filter((power) => power >= CHARGED).length;
      expect(charged, `launches: ${powers.map((x) => x.toFixed(2)).join(' ')}`).toBeGreaterThanOrEqual(1);
    });
  }
});
