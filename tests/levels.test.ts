import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MATERIALS } from '@/config/materials';
import { TUNING } from '@/config/tuning';
import { PROPS, propKind } from '@/config/props';
import { BIOME_ORDER } from '@/game/progress';
import { ALL_LEVELS } from '@/levels';
import { decodeGhost } from '@/sim/ghost';
import { cycleState, poseAt } from '@/sim/motion';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording, type Recording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';
import type { LevelDef, PropCycle, PropPlacement } from '@/sim/types';
import { Driver, createSim } from './helpers/harness';

const routesDir = resolve(__dirname, '../src/levels/routes');

interface Report {
  clearSeconds: number;
  macros: number;
  slipRate: number;
  worstHop: number;
}

const report: Record<string, Report> = existsSync(resolve(routesDir, 'report.json'))
  ? JSON.parse(readFileSync(resolve(routesDir, 'report.json'), 'utf8'))
  : {};

const recordingFor = (level: LevelDef): Recording => decodeRecording(readFileSync(resolve(routesDir, `${level.id}.json`), 'utf8'));

async function replayToEnd(level: LevelDef, recording: Recording) {
  const sim = new Simulation(await loadRapier(), level);
  const player = new ReplayPlayer(recording);
  const falls: number[] = [];
  sim.events.on('fall', (f) => falls.push(f.heightMeters));
  while (!player.done && !sim.run.cleared) sim.step(player.next());
  return { sim, falls };
}

describe('level data', () => {
  it('ships levels with unique ids, grouped by biome in progression order and ascending inside each', () => {
    const ids = ALL_LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const biomes = ALL_LEVELS.map((l) => BIOME_ORDER.indexOf(l.biome));
    expect(biomes).toEqual([...biomes].sort((a, b) => a - b));
    for (const biome of BIOME_ORDER) {
      const indexes = ALL_LEVELS.filter((l) => l.biome === biome).map((l) => l.index);
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    }
  });

  it('names each level after its biome and position so ids can never collide', () => {
    for (const level of ALL_LEVELS) {
      expect(level.id).toBe(`${level.biome}-${String(level.index).padStart(2, '0')}`);
    }
  });

  for (const level of ALL_LEVELS) {
    describe(level.id, () => {
      it('only references known props and stays within the physics body cap', () => {
        for (const prop of level.props) expect(() => propKind(prop.kind)).not.toThrow();
        expect(level.props.length).toBeLessThanOrEqual(260);
      });

      it('has a summit above the spawn and inside the play bounds', () => {
        expect(level.summit.y).toBeGreaterThan(level.spawn.y + 8);
        expect(level.summit.x).toBeGreaterThan(level.bounds.minX);
        expect(level.summit.x).toBeLessThan(level.bounds.maxX);
      });

      it('orders checkpoints upward and keeps them below the summit', () => {
        const ys = level.checkpoints.map((c) => c.y);
        expect(ys).toEqual([...ys].sort((a, b) => a - b));
        for (const y of ys) expect(y).toBeLessThan(level.summit.y);
      });

      it('places the kill plane below everything', () => {
        const lowest = Math.min(...level.props.map((p) => p.y));
        expect(level.killY).toBeLessThan(lowest);
      });

      it('lets MAGNO settle safely on the base platform at spawn', async () => {
        const sim = await createSim(level);
        const d = new Driver(sim).ms(1500);
        expect(d.view.state).toBe('attached');
        expect(Math.abs(d.view.position.x - level.spawn.x)).toBeLessThan(0.4);
        expect(sim.run.fallCount).toBe(0);
      });

      it('keeps the run clock stopped until the player acts', async () => {
        const sim = await createSim(level);
        new Driver(sim).ms(3000);
        expect(sim.run.timeMs).toBe(0);
      });
    });
  }
});

describe('completability (bot-verified routes)', () => {
  for (const level of ALL_LEVELS) {
    describe(level.id, () => {
      it('has a recorded route', () => {
        expect(existsSync(resolve(routesDir, `${level.id}.json`))).toBe(true);
        expect(report[level.id]).toBeDefined();
      });

      it('is cleared by replaying its recorded route with no falls', async () => {
        const { sim, falls } = await replayToEnd(level, recordingFor(level));
        expect(sim.run.cleared).toBe(true);
        expect(falls).toHaveLength(0);
        sim.dispose();
      });

      it('replays to the identical clear time every run', async () => {
        const a = await replayToEnd(level, recordingFor(level));
        const b = await replayToEnd(level, recordingFor(level));
        expect(a.sim.run.timeMs).toBe(b.sim.run.timeMs);
        a.sim.dispose();
        b.sim.dispose();
      });

      it('is clearable well inside the 90 second budget and under par for a skilled run', async () => {
        const { sim } = await replayToEnd(level, recordingFor(level));
        expect(sim.run.timeMs / 1000).toBeLessThan(90);
        expect(sim.run.timeMs / 1000).toBeLessThan(level.parSeconds * 0.6);
        sim.dispose();
      });

      it('keeps every hop of the route achievable for a sloppy player', () => {
        const entry = report[level.id]!;
        expect(entry.worstHop).toBeGreaterThanOrEqual(0.2);
        expect(entry.slipRate).toBeLessThanOrEqual(0.95);
      });
    });
  }
});

describe('no shortcuts', () => {
  for (const level of ALL_LEVELS) {
    it(`${level.id}: a single full-charge flip from the base does not clear it`, async () => {
      const sim = await createSim(level);
      const d = new Driver(sim).ms(700);
      for (const tilt of [[0, 1], [0.7, 0.7], [-0.7, 0.7]] as const) {
        d.press().ms(950).tilt(tilt[0], tilt[1]).release().ms(4500).tilt(0, 0);
        expect(sim.run.cleared).toBe(false);
        d.ms(4000);
      }
    });

    it(`${level.id}: crawling upward alone cannot reach the summit`, async () => {
      const sim = await createSim(level);
      const d = new Driver(sim).ms(700);
      d.tilt(0, 1).ms(25_000);
      expect(sim.run.cleared).toBe(false);
    });

    it(`${level.id}: doing nothing never clears the level`, async () => {
      const sim = await createSim(level);
      new Driver(sim).ms(20_000);
      expect(sim.run.cleared).toBe(false);
    });
  }
});

describe('fairness grammar', () => {
  it('never drops MAGNO into the void while replaying a verified route', async () => {
    for (const level of ALL_LEVELS) {
      const { sim } = await replayToEnd(level, recordingFor(level));
      expect(sim.run.fallCount).toBe(0);
      sim.dispose();
    }
  });

  it('keeps first-clear fall allowance for the opening levels generous', () => {
    const early = ALL_LEVELS.filter((l) => l.biome === 'scrapyard' && l.index <= 2);
    for (const level of early) expect(level.fallRateTarget).toBeLessThanOrEqual(0.1);
  });

  it('keeps authored fall-rate targets inside the design curve band and climbing through each biome', () => {
    for (const level of ALL_LEVELS) {
      expect(level.fallRateTarget).toBeGreaterThanOrEqual(0.05);
      expect(level.fallRateTarget).toBeLessThanOrEqual(0.68);
    }
    for (const biome of BIOME_ORDER) {
      const targets = ALL_LEVELS.filter((l) => l.biome === biome).map((l) => l.fallRateTarget);
      expect(targets).toEqual([...targets].sort((a, b) => a - b));
    }
  });

  it('follows the design curve from 6% at the first level to 68% at the seventieth', () => {
    expect(ALL_LEVELS[0]!.fallRateTarget).toBe(0.06);
    expect(ALL_LEVELS[ALL_LEVELS.length - 1]!.fallRateTarget).toBe(0.68);
    const all = ALL_LEVELS.map((l) => l.fallRateTarget);
    for (let i = 1; i < all.length; i++) {
      if (ALL_LEVELS[i]!.biome === ALL_LEVELS[i - 1]!.biome) expect(all[i]!, ALL_LEVELS[i]!.id).toBeGreaterThan(all[i - 1]!);
    }
  });

  it('steps the difficulty down 4 to 10 points as each new biome opens, for a breather', () => {
    for (let i = 1; i < BIOME_ORDER.length; i++) {
      const previous = ALL_LEVELS.filter((l) => l.biome === BIOME_ORDER[i - 1]);
      const current = ALL_LEVELS.filter((l) => l.biome === BIOME_ORDER[i]);
      if (previous.length === 0 || current.length === 0) continue;
      const drop = previous[previous.length - 1]!.fallRateTarget - current[0]!.fallRateTarget;
      expect(drop, BIOME_ORDER[i]).toBeGreaterThanOrEqual(0.04);
      expect(drop, BIOME_ORDER[i]).toBeLessThanOrEqual(0.1);
    }
  });

  it('gives the tutorial a base camp that is flat, wide and free of threats', () => {
    const tutorial = ALL_LEVELS[0]!;
    const base = tutorial.props.find((p) => p.kind === 'plate');
    expect(base).toBeDefined();
    expect(base!.w ?? 0).toBeGreaterThanOrEqual(10);
    expect(TUNING.fall.minFallHeight).toBeGreaterThan(0);
  });
});


const AABB_MARGIN = 0.05;

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Axis-aligned bounds of a placement's collider at a pose; rotation is covered by the box corners. */
function boundsOf(placement: PropPlacement, x: number, y: number, rot: number): Box {
  const kind = propKind(placement.kind);
  const w = kind.shape.type === 'box' ? (placement.w ?? kind.shape.w) : (placement.r ?? kind.shape.r) * 2;
  const h = kind.shape.type === 'box' ? (placement.h ?? kind.shape.h) : w;
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  const hw = (w * c + h * s) / 2;
  const hh = (w * s + h * c) / 2;
  return { x0: x - hw, x1: x + hw, y0: y - hh, y1: y + hh };
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x0 < b.x1 - AABB_MARGIN && a.x1 > b.x0 + AABB_MARGIN && a.y0 < b.y1 - AABB_MARGIN && a.y1 > b.y0 + AABB_MARGIN;

describe('par honesty (R-LD-17)', () => {
  it('paces the author demo to the +20% buffer on every level', () => {
    for (const level of ALL_LEVELS) {
      const ghost = decodeGhost(readFileSync(resolve(routesDir, '..', 'ghosts', `${level.id}.json`), 'utf8'), level.id);
      expect(ghost, `${level.id}: par ghost`).not.toBeNull();
      const author = ghost!.durationMs / 1000;
      expect(author, `${level.id}: the demo stays inside par`).toBeLessThanOrEqual(level.parSeconds);
      expect(level.parSeconds, `${level.id}: par carries at least the author + 20% buffer`).toBeGreaterThanOrEqual(author * 1.2);
      expect(author, `${level.id}: the demo never runs past the pacing target`).toBeLessThanOrEqual(level.parSeconds / 1.2 + 0.6);
    }
  });
});

describe('scripted hazards', () => {
  const hazardous = ALL_LEVELS.filter((l) => l.props.some((p) => p.motion));

  it('ships every later biome with moving surfaces', () => {
    for (const biome of ['suburbia', 'metropolis', 'playground', 'stratosphere']) {
      expect(hazardous.some((l) => l.biome === biome), biome).toBe(true);
    }
  });

  for (const level of hazardous) {
    it(`${level.id}: no moving prop ever passes through fixed geometry`, () => {
      const fixed = level.props.filter((p) => !p.motion && !p.hinge && propKind(p.kind).mass === undefined);
      for (const mover of level.props.filter((p) => p.motion)) {
        const motion = mover.motion!;
        const steps = 48;
        for (let i = 0; i <= steps; i++) {
          const pose = poseAt(mover, (i / steps) * motion.period * 1000);
          const swept = boundsOf(mover, pose.x, pose.y, pose.rot);
          for (const other of fixed) {
            const box = boundsOf(other, other.x, other.y, other.rot ?? 0);
            expect(overlaps(swept, box), `${mover.kind} at ${i}/${steps} hits ${other.kind} (${other.x}, ${other.y})`).toBe(false);
          }
        }
      }
    });

    it(`${level.id}: every mover keeps a period slow enough to read and ride`, () => {
      for (const mover of level.props.filter((p) => p.motion)) {
        expect(mover.motion!.period).toBeGreaterThanOrEqual(4);
        expect(mover.motion!.period).toBeLessThanOrEqual(16);
      }
    });
  }

  const overlapMs = (a: PropCycle, b: PropCycle): number => {
    const span = Math.max(a.period, b.period) * 12 * 1000;
    let lit = 0;
    for (let t = 0; t < span; t += 20) if (cycleState(a, t) !== 'off' && cycleState(b, t) !== 'off') lit += 20;
    return lit / 12;
  };

  for (const level of ALL_LEVELS.filter((l) => l.props.some((p) => p.cycle))) {
    it(`${level.id}: consecutive flickering signs overlap long enough to chain a hop`, () => {
      const signs = level.props.filter((p) => p.cycle).sort((a, b) => a.y - b.y);
      for (let i = 1; i < signs.length; i++) {
        const gap = signs[i]!.y - signs[i - 1]!.y;
        if (gap > 8) continue;
        expect(overlapMs(signs[i - 1]!.cycle!, signs[i]!.cycle!), `${signs[i - 1]!.y} -> ${signs[i]!.y}`).toBeGreaterThanOrEqual(1400);
      }
    });

    it(`${level.id}: each sign is lit long enough to land on and warns before it goes dark`, () => {
      for (const sign of level.props.filter((p) => p.cycle)) {
        const c = sign.cycle!;
        expect(c.period * c.on).toBeGreaterThanOrEqual(3.5);
        expect(c.warn ?? 0.7).toBeGreaterThanOrEqual(0.6);
      }
    });
  }

  for (const level of ALL_LEVELS.filter((l) => l.wind)) {
    it(`${level.id}: wind gusts are strong enough to feel and never strong enough to pin MAGNO`, () => {
      const wind = level.wind!;
      expect(Math.abs(wind.strength)).toBeGreaterThanOrEqual(1);
      expect(Math.abs(wind.strength)).toBeLessThanOrEqual(4);
      expect(wind.gustPeriod).toBeGreaterThanOrEqual(4);
      expect(wind.fromY ?? 0).toBeLessThan(level.summit.y / 2);
    });
  }
});

describe('biome content', () => {
  it('ships fourteen levels in every biome: the Scrapyard counts from its tutorial, the rest from one', () => {
    expect(ALL_LEVELS).toHaveLength(70);
    const indexes = (biome: string) => ALL_LEVELS.filter((l) => l.biome === biome).map((l) => l.index);
    expect(indexes('scrapyard')).toEqual(Array.from({ length: 14 }, (_, i) => i));
    for (const biome of ['suburbia', 'metropolis', 'playground', 'stratosphere']) {
      expect(indexes(biome)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    }
  });

  it('brings dynamic props into the Scrapyard at the eighth level, as the design asks', () => {
    const dynamic = (kind: string) => kind === 'loose-girder' || kind === 'barrel' || kind === 'loose-crate' || kind === 'drawer-cabinet';
    const scrapyard = ALL_LEVELS.filter((l) => l.biome === 'scrapyard');
    expect(scrapyard.slice(0, 7).some((l) => l.props.some((p) => dynamic(p.kind)))).toBe(false);
    expect(scrapyard[7]!.props.some((p) => p.kind === 'loose-girder')).toBe(true);
    for (const kind of ['loose-girder', 'barrel', 'loose-crate', 'drawer-cabinet']) {
      expect(scrapyard.slice(7).some((l) => l.props.some((p) => p.kind === kind)), kind).toBe(true);
    }
  });

  it('introduces the Suburbia curriculum: bounce, moving surface, dynamic anchor, weak metal', () => {
    const suburbia = ALL_LEVELS.filter((l) => l.biome === 'suburbia');
    const uses = (kind: string) => suburbia.some((l) => l.props.some((p) => p.kind === kind));
    expect(uses('trampoline')).toBe(true);
    expect(suburbia.some((l) => l.props.some((p) => p.kind === 'garage-door' && p.motion))).toBe(true);
    expect(suburbia.some((l) => l.props.some((p) => p.hinge))).toBe(true);
    expect(uses('gutter')).toBe(true);
  });

  it('introduces the Metropolis curriculum: timed signs, wind, moving rigs, swinging hooks, elevators', () => {
    const city = ALL_LEVELS.filter((l) => l.biome === 'metropolis');
    expect(city.some((l) => l.props.some((p) => p.cycle))).toBe(true);
    expect(city.some((l) => l.wind)).toBe(true);
    expect(city.some((l) => l.props.some((p) => p.kind === 'washer-rig' && p.motion))).toBe(true);
    expect(city.some((l) => l.props.some((p) => p.kind === 'crane-hook' && p.motion?.type === 'swing'))).toBe(true);
    expect(city.some((l) => l.props.some((p) => p.kind === 'counterweight'))).toBe(true);
    expect(city.some((l) => l.props.some((p) => p.kind === 'cladding'))).toBe(true);
  });

  it('keeps wind out of the lower Metropolis levels so the biome opens gently', () => {
    const [first, second] = ALL_LEVELS.filter((l) => l.biome === 'metropolis');
    expect(first!.wind).toBeUndefined();
    expect(second!.wind).toBeUndefined();
  });

  it('introduces the Playground curriculum: turning wheels, swings, see-saws, slides and a soft landing', () => {
    const yard = ALL_LEVELS.filter((l) => l.biome === 'playground');
    const uses = (kind: string) => yard.some((l) => l.props.some((p) => p.kind === kind));
    expect(yard.some((l) => l.props.some((p) => p.motion?.type === 'spin'))).toBe(true);
    for (const kind of ['ferris-spoke', 'gondola', 'carousel', 'swing-seat', 'seesaw', 'slide-ramp', 'ball-pit', 'monkey-bars']) {
      expect(uses(kind), kind).toBe(true);
    }
    expect(yard.every((l) => l.wind === undefined && l.gravityScale === undefined)).toBe(true);
  });

  it('turns every ferris wheel as one rigid piece with its gondolas kept level', () => {
    for (const level of ALL_LEVELS.filter((l) => l.props.some((p) => p.kind === 'ferris-spoke'))) {
      const spokes = level.props.filter((p) => p.kind === 'ferris-spoke');
      const gondolas = level.props.filter((p) => p.kind === 'gondola');
      expect(spokes.length % 6, level.id).toBe(0);
      expect(gondolas.length, level.id).toBe(spokes.length);
      for (let wheel = 0; wheel < spokes.length; wheel += 6) {
        const first = spokes[wheel]!.motion;
        for (const spoke of spokes.slice(wheel, wheel + 6)) expect(spoke.motion, level.id).toEqual(first);
      }
      for (const gondola of gondolas) {
        expect(gondola.motion?.type).toBe('spin');
        expect(gondola.motion && 'upright' in gondola.motion && gondola.motion.upright, level.id).toBe(true);
      }
    }
  });

  it('introduces the Stratosphere as lighter gravity every level, then wind, with the earlier verbs returning', () => {
    const sky = ALL_LEVELS.filter((l) => l.biome === 'stratosphere');
    for (const level of sky) {
      expect(level.gravityScale, level.id).toBeGreaterThanOrEqual(0.45);
      expect(level.gravityScale, level.id).toBeLessThanOrEqual(0.7);
    }
    const gravity = sky.map((l) => l.gravityScale!);
    expect(gravity).toEqual([...gravity].sort((a, b) => b - a));
    expect(sky[0]!.wind).toBeUndefined();
    expect(sky.slice(2).every((l) => l.wind)).toBe(true);
    const uses = (test: (p: PropPlacement) => boolean) => sky.some((l) => l.props.some(test));
    expect(uses((p) => p.motion?.type === 'spin')).toBe(true);
    expect(uses((p) => p.motion?.type === 'slide')).toBe(true);
    expect(uses((p) => p.cycle !== undefined)).toBe(true);
    expect(uses((p) => p.kind === 'fuselage-skin')).toBe(true);
    expect(uses((p) => p.kind === 'radio-dish')).toBe(true);
  });

  it('keeps Stratosphere wind gentle enough for long low-gravity flights, where drift grows with the square of flight time', () => {
    for (const level of ALL_LEVELS.filter((l) => l.biome === 'stratosphere' && l.wind)) {
      expect(Math.abs(level.wind!.strength), level.id).toBeLessThanOrEqual(2.4);
    }
  });

  it('ends the climb on one finale, the last level of the last biome', () => {
    const finales = ALL_LEVELS.filter((l) => l.finale);
    expect(finales.map((l) => l.id)).toEqual(['stratosphere-14']);
    expect(ALL_LEVELS[ALL_LEVELS.length - 1]).toBe(finales[0]);
  });
});

describe('reactive props in the levels', () => {
  const placed = (kind: string) => ALL_LEVELS.filter((l) => l.props.some((p) => p.kind === kind));
  const NEW_KINDS = [
    'boing-washer',
    'rust-grate',
    'filing-cabinet',
    'file-drawer',
    'awning',
    'service-lift',
    'drawbridge',
    'diving-board',
    'bouncy-castle',
    'frost-truss',
  ];

  it('puts every reactive kind in at least one shipping level, so no prop is built and never met', () => {
    for (const kind of NEW_KINDS) expect(placed(kind).length, kind).toBeGreaterThanOrEqual(1);
  });

  it('keeps each kind in the biome whose palette and story it belongs to', () => {
    const home: Record<string, string> = {
      'boing-washer': 'scrapyard',
      'rust-grate': 'scrapyard',
      'filing-cabinet': 'scrapyard',
      'file-drawer': 'scrapyard',
      awning: 'suburbia',
      'service-lift': 'metropolis',
      drawbridge: 'metropolis',
      'diving-board': 'playground',
      'bouncy-castle': 'playground',
      'frost-truss': 'stratosphere',
    };
    for (const [kind, biome] of Object.entries(home)) {
      for (const level of placed(kind)) expect(level.biome, `${kind} in ${level.id}`).toBe(biome);
    }
  });

  it('counts at least twenty dynamic or reactive identities in the prop library, as the design asks', () => {
    const movers = new Set<string>();
    for (const level of ALL_LEVELS) {
      for (const p of level.props) if (p.motion || p.cycle || p.follow || p.hinge) movers.add(p.kind);
    }
    const reactive = Object.values(PROPS).filter((kind) => {
      const material = MATERIALS[kind.material];
      return (
        kind.mass !== undefined ||
        kind.reaction !== undefined ||
        movers.has(kind.id) ||
        material.breakable ||
        material.cushion ||
        material.restitution >= 0.85 ||
        material.magnetic === 'weak'
      );
    });
    expect(reactive.length).toBeGreaterThanOrEqual(20);
  });

  it('gives every follower a switch it can hear: a tagged prop in the same level, unless the follower is its own button', () => {
    for (const level of ALL_LEVELS) {
      const tags = new Set(level.props.map((p) => p.tag).filter(Boolean));
      for (const p of level.props.filter((q) => q.follow)) {
        if (p.follow!.manual) expect(tags.has(p.follow!.tag), `${level.id} ${p.kind}`).toBe(true);
        expect(p.follow!.extendMs).toBeGreaterThanOrEqual(500);
        expect(p.follow!.holdMs).toBeGreaterThanOrEqual(1500);
      }
    }
  });

  it('keeps a follower out of fixed scenery along its whole travel, apart from the cabinet it slides out of', () => {
    for (const level of ALL_LEVELS) {
      const fixed = level.props.filter((q) => !q.motion && !q.hinge && !q.follow && propKind(q.kind).mass === undefined);
      for (const f of level.props.filter((q) => q.follow)) {
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          const swept = boundsOf(f, f.x + f.follow!.dx * t, f.y + f.follow!.dy * t, f.rot ?? 0);
          for (const other of fixed) {
            if (other.tag === f.follow!.tag) continue;
            expect(overlaps(swept, boundsOf(other, other.x, other.y, other.rot ?? 0)), `${level.id}: ${f.kind} at ${i}/12 hits ${other.kind} (${other.x}, ${other.y})`).toBe(false);
          }
        }
      }
    }
  });

  it('lets a crumbling ledge give way and come back without ever stranding the route: the replay clears with the grates in place', async () => {
    for (const level of ALL_LEVELS.filter((l) => l.props.some((q) => propKind(q.kind).reaction?.type === 'crumble'))) {
      const { sim } = await replayToEnd(level, recordingFor(level));
      expect(sim.run.cleared, level.id).toBe(true);
      sim.dispose();
    }
  });

  for (const id of ['metropolis-08', 'playground-10', 'playground-12']) {
    it(`${id}: a hinged board bolted to the wall still dips under MAGNO and holds him`, async () => {
      const level = ALL_LEVELS.find((l) => l.id === id)!;
      const board = level.props.find((q) => q.hinge && (q.kind === 'drawbridge' || q.kind === 'diving-board'))!;
      const sim = await createSim({ ...level, spawn: { x: board.x - Math.sign(board.hinge!.x - board.x) * ((board.w ?? 5) / 2 - 0.5), y: board.y + 0.4 }, props: [board] });
      const body = sim.physics.world.getRigidBody(sim.physics.props[0]!.bodyHandle);
      const d = new Driver(sim).ms(3500);
      const q = body.rotation();
      const dipped = Math.abs(2 * Math.atan2(q.z, q.w));
      expect(d.view.state).toBe('attached');
      expect(dipped).toBeGreaterThan(0.08);
      expect(dipped).toBeLessThanOrEqual(propKind(board.kind).tilt!.limit + 0.08);
    });
  }
});

/**
 * Where one flip and a snap can land with the stick held up, measured with `npm run reach`:
 * 21.4 m at full gravity, 32 m at x0.62 and 39 m at x0.5. The planner finds hops a little past that.
 */
const flipReach = (gravityScale: number): number => 21.4 * gravityScale ** -0.87;
const PLANNER_MARGIN = 3.5;
/** A gap this small is a staircase step, not a leap. */
const STAIR_STEP = 9;

function topOf(placement: PropPlacement): number {
  const kind = propKind(placement.kind);
  const w = kind.shape.type === 'box' ? (placement.w ?? kind.shape.w) : (placement.r ?? kind.shape.r) * 2;
  const h = kind.shape.type === 'box' ? (placement.h ?? kind.shape.h) : w;
  const rot = placement.rot ?? 0;
  return placement.y + (w * Math.abs(Math.sin(rot)) + h * Math.abs(Math.cos(rot))) / 2;
}

const isTwist = (p: PropPlacement): boolean => Boolean(p.motion || p.hinge || p.cycle || p.follow || p.weld || p.pin);

/** Surfaces that hold a magnet and never move: the footholds a player could use without any twist. */
const fixedFootholds = (level: LevelDef): PropPlacement[] =>
  level.props
    .filter((p) => !isTwist(p))
    .filter((p) => propKind(p.kind).mass === undefined && !propKind(p.kind).reaction)
    .filter((p) => MATERIALS[p.material ?? propKind(p.kind).material].magnetic !== 'inert')
    .sort((a, b) => a.y - b.y);

const GATED = [
  'playground-02',
  'playground-03',
  'playground-04',
  'playground-05',
  'playground-07',
  'playground-08',
  'stratosphere-02',
  'stratosphere-04',
  'stratosphere-05',
  'stratosphere-06',
  'stratosphere-07',
];

describe('twist gating', () => {
  it('keeps every leap between fixed footholds out of reach of a single flip, so the moving prop in between is required', () => {
    for (const id of GATED) {
      const level = ALL_LEVELS.find((l) => l.id === id)!;
      const needed = flipReach(level.gravityScale ?? 1) + PLANNER_MARGIN;
      const footholds = fixedFootholds(level);
      let top = topOf(footholds[0]!);
      let leaps = 0;
      for (const next of footholds.slice(1)) {
        const gap = next.y - top;
        if (gap >= STAIR_STEP) {
          expect(gap, `${id}: ${next.kind} at y=${next.y}`).toBeGreaterThanOrEqual(needed);
          leaps++;
        }
        top = Math.max(top, topOf(next));
      }
      expect(leaps, id).toBeGreaterThanOrEqual(1);
    }
  });

  it('puts a moving, tilting, hung or blinking foothold inside every leap', () => {
    for (const id of GATED) {
      const level = ALL_LEVELS.find((l) => l.id === id)!;
      const footholds = fixedFootholds(level);
      const twists = level.props.filter(isTwist);
      let top = topOf(footholds[0]!);
      for (const next of footholds.slice(1)) {
        if (next.y - top >= STAIR_STEP) {
          const between = twists.filter((t) => t.y > top && t.y < next.y);
          expect(between.length, `${id}: between y=${top.toFixed(1)} and y=${next.y}`).toBeGreaterThanOrEqual(2);
        }
        top = Math.max(top, topOf(next));
      }
    }
  });

  it('leaves no hole in the climb: from foothold to foothold, every step is one a player can make', () => {
    for (const id of GATED) {
      const level = ALL_LEVELS.find((l) => l.id === id)!;
      const reach = flipReach(level.gravityScale ?? 1);
      const rungs = level.props
        .filter((p) => MATERIALS[p.material ?? propKind(p.kind).material].magnetic !== 'inert')
        .map((p) => p.y)
        .sort((a, b) => a - b);
      for (let i = 1; i < rungs.length; i++) {
        expect(rungs[i]! - rungs[i - 1]!, `${id} rung ${i}`).toBeLessThanOrEqual(reach * 0.6);
      }
      expect(level.summit.y - rungs[rungs.length - 1]!, `${id} summit`).toBeLessThanOrEqual(reach * 0.6);
    }
  });
});
