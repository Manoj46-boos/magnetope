import type { LevelDef, PropCycle, PropMotion, PropPlacement } from '@/sim/types';
import { defineLevel, prop as p } from './author';

type Side = 'L' | 'R';

const WALL_W = 6;
const FACADE_H = 8;
const REACH = 0.9;

const sign = (side: Side): number => (side === 'L' ? -1 : 1);

/** Distance from the centre line to the face of a tower. */
const faceOf = (halfWidth: number): number => halfWidth - WALL_W / 2;

/** A tower wall: office floors stacked to `height`. Concrete never holds a magnet, so only hardware bolted to it does. */
function tower(x: number, height: number): PropPlacement[] {
  const blocks: PropPlacement[] = [];
  for (let y = 0; y < height; y += FACADE_H) blocks.push(p.facade(x, y + FACADE_H / 2, FACADE_H));
  return blocks;
}

/** The street, a steel manhole cover to start on, and a tower either side. */
function alley(halfWidth: number, height: number): PropPlacement[] {
  return [p.plate(0, -0.4, halfWidth * 2 + 6), ...tower(-halfWidth, height), ...tower(halfWidth, height)];
}

/** Span of a ledge that starts at a tower face and crosses the centre line by `reach`. */
function ledge(side: Side, halfWidth: number, reach: number): { x: number; len: number } {
  const len = faceOf(halfWidth) + reach;
  return { x: sign(side) * (faceOf(halfWidth) - len / 2), len };
}

function deck(side: Side, y: number, halfWidth: number, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.scaffoldDeck(x, y, len);
}

function unit(side: Side, y: number, halfWidth: number): PropPlacement {
  return p.acUnit(sign(side) * (faceOf(halfWidth) - 1.1), y);
}

/** Weak aluminium cladding peeling off a tower: a ladder that gives way under you. */
function cladding(side: Side, y: number, halfWidth: number, h = 4): PropPlacement {
  return p.cladding(sign(side) * (faceOf(halfWidth) - 0.18), y, h);
}

/** A neon sign that flickers, goes dark and comes back on a fixed beat. */
function neon(side: Side, y: number, halfWidth: number, cycle: PropCycle, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.neon(x, y, cycle, { w: len });
}

const rise = (dy: number, period: number, phase = 0, dwell = 0.2): PropMotion => ({ type: 'slide', dx: 0, dy, period, phase, dwell });

/** Window-washer gondola on cables, raising and lowering along a tower. */
function rig(side: Side, y: number, halfWidth: number, travel: number, period: number, phase = 0, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.washerRig(x, y, rise(travel, period, phase), { w: len });
}

/** Drawbridge leaf hinged at a tower face: it dips under MAGNO and springs back when he leaves. */
function bridge(side: Side, y: number, halfWidth: number, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  const hinge = { x: sign(side) * faceOf(halfWidth), y };
  return p.drawbridge(x, y, hinge, len);
}

/** Service lift that carries whoever stands on it up `travel` metres and sets them down again some time after they leave. */
function lift(side: Side, y: number, halfWidth: number, travel: number, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.serviceLift(x, y, { tag: `lift-${side}-${y}`, dx: 0, dy: travel, extendMs: 3600, retractMs: 4800, holdMs: 2200 }, len);
}

/**
 * A lift that answers only to its call box: clinging to the box brings it up, and it stays up for a
 * short while after MAGNO lets go, long enough to reach it but not to rest on it.
 */
function summoned(side: Side, y: number, halfWidth: number, travel: number, tag: string, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.serviceLift(x, y, { tag, dx: 0, dy: travel, extendMs: 3600, retractMs: 4800, holdMs: 2600, manual: true }, len);
}

/** Call box standing on a deck, in reach of a lift's button. */
function callBox(side: Side, deckY: number, halfWidth: number, tag: string, inset = 1.2, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.callBox(x + sign(side) * (len / 2 - inset), deckY + 0.175 + 0.6, tag);
}

/** Crane hook hanging `drop` metres below its pivot and swinging through `arc` radians. */
function hook(x: number, y: number, drop: number, arc: number, period: number, phase = 0): PropPlacement {
  return p.craneHook(x, y, { type: 'swing', pivot: { x, y: y + drop }, arc, period, phase });
}

/** Elevator car and its counterweight, always moving in opposition. */
function elevator(x: number, weightX: number, y: number, travel: number, period: number, phase = 0): PropPlacement[] {
  return [p.elevatorCab(x, y, rise(travel, period, phase)), p.counterweight(weightX, y + travel, rise(-travel, period, phase))];
}

const BEAT: PropCycle = { period: 7, on: 0.64, warn: 0.8 };

const scaffoldStairs = defineLevel({
  id: 'metropolis-01',
  biome: 'metropolis',
  index: 1,
  name: 'Scaffold Stairs',
  parSeconds: 72,
  summit: { x: 0, y: 34.6 },
  checkpoints: [{ x: -3.7, y: 17.6 }],
  props: [
    ...alley(7.5, 37),
    deck('L', 2.4, 7.5),
    deck('R', 10.4, 7.5),
    deck('L', 18.4, 7.5),
    deck('R', 26.4, 7.5),
    deck('L', 32.4, 7.5),
    unit('R', 10.4, 7.5),
  ],
});

const windowWashers = defineLevel({
  id: 'metropolis-02',
  biome: 'metropolis',
  index: 2,
  name: 'Window Washers',
  parSeconds: 80,
  summit: { x: 0, y: 39.2 },
  checkpoints: [{ x: 0, y: 19.4 }],
  props: [
    ...alley(7.5, 42),
    deck('L', 2.4, 7.5),
    rig('R', 6.0, 7.5, 7, 9),
    deck('L', 19.0, 7.5),
    rig('R', 22.6, 7.5, 7, 9, 0.5),
    deck('L', 35.6, 7.5),
  ],
});

const neonAlley = defineLevel({
  id: 'metropolis-03',
  biome: 'metropolis',
  index: 3,
  name: 'Neon Alley',
  parSeconds: 88,
  wind: { strength: 1.6, gustPeriod: 8, fromY: 6 },
  summit: { x: 0, y: 40.6 },
  checkpoints: [{ x: 0.1, y: 19.7 }],
  props: [
    ...alley(7, 44),
    neon('R', 4.6, 7, { ...BEAT, phase: 0 }),
    neon('L', 12.6, 7, { ...BEAT, phase: 0.34 }),
    neon('R', 20.6, 7, { ...BEAT, phase: 0.68 }),
    neon('L', 28.6, 7, { ...BEAT, phase: 0.02 }),
    neon('R', 36.6, 7, { ...BEAT, phase: 0.36 }),
  ],
});

const crosswinds = defineLevel({
  id: 'metropolis-04',
  biome: 'metropolis',
  index: 4,
  name: 'Crosswinds',
  parSeconds: 94,
  wind: { strength: -3.4, gustPeriod: 6, fromY: 3 },
  summit: { x: 0, y: 39.4 },
  bounds: { minX: -26, maxX: 26 },
  checkpoints: [{ x: -2.1, y: 15.6 }],
  props: [
    p.plate(0, -0.4, 22),
    ...tower(-12, 42),
    ...tower(12, 42),
    p.scaffoldDeck(-4.6, 3.0, 5),
    p.scaffoldDeck(4.6, 9.2, 5),
    p.scaffoldDeck(-4.6, 15.4, 5),
    p.scaffoldDeck(4.6, 21.6, 5),
    p.scaffoldDeck(-4.6, 27.8, 5),
    p.scaffoldDeck(4.6, 34.0, 5),
    p.billboard(-4.6, 18.6),
  ],
});

const craneYard = defineLevel({
  id: 'metropolis-05',
  biome: 'metropolis',
  index: 5,
  name: 'Crane Yard',
  parSeconds: 100,
  wind: { strength: 2.4, gustPeriod: 7, fromY: 8 },
  summit: { x: 0, y: 38.4 },
  bounds: { minX: -24, maxX: 24 },
  checkpoints: [{ x: 3.2, y: 19.2 }],
  props: [
    p.plate(0, -0.4, 22),
    ...tower(-11, 42),
    ...tower(11, 42),
    p.scaffoldDeck(-5.6, 3.0, 5),
    hook(0, 10.6, 7, 0.5, 6),
    p.scaffoldDeck(5.6, 19.0, 5),
    hook(0, 26.6, 7, 0.5, 6, 0.5),
    p.scaffoldDeck(-5.6, 35.0, 5),
  ],
});

const elevatorShaft = defineLevel({
  id: 'metropolis-06',
  biome: 'metropolis',
  index: 6,
  name: 'Elevator Shaft',
  parSeconds: 108,
  summit: { x: 0, y: 47.4 },
  checkpoints: [{ x: 0, y: 17.6 }, { x: -4.2, y: 31.5 }],
  props: [
    ...alley(7, 50),
    ...elevator(-0.6, 2.9, 3.4, 11.5, 13),
    deck('L', 17.6, 7),
    cladding('R', 20.4, 7),
    cladding('R', 24.2, 7),
    deck('R', 28.2, 7),
    ...elevator(0.6, -2.9, 31.0, 11.5, 13, 0.5),
    deck('L', 44.2, 7),
  ],
});

const rooftopRush = defineLevel({
  id: 'metropolis-07',
  biome: 'metropolis',
  index: 7,
  name: 'Rooftop Rush',
  parSeconds: 116,
  wind: { strength: 3.6, gustPeriod: 5, fromY: 10 },
  summit: { x: 0, y: 56.4 },
  bounds: { minX: -24, maxX: 24 },
  checkpoints: [{ x: 0, y: 27.8 }, { x: -1.2, y: 36.6 }],
  props: [
    p.plate(0, -0.4, 22),
    ...tower(-11, 60),
    ...tower(11, 60),
    deck('L', 2.6, 11, 0.6),
    rig('R', 6.4, 11, 7, 9, 0, 0.6),
    neon('L', 20.0, 11, { ...BEAT, phase: 0.1 }, 0.6),
    neon('R', 28.0, 11, { ...BEAT, phase: 0.44 }, 0.6),
    deck('L', 36.4, 11, 0.6),
    hook(0, 43.0, 7, 0.5, 6),
    neon('R', 52.0, 11, { ...BEAT, phase: 0.2 }, 0.6),
  ],
});

const SPRINT: PropCycle = { period: 6.4, on: 0.64, warn: 0.8 };

const billboardBack = defineLevel({
  id: 'metropolis-08',
  biome: 'metropolis',
  index: 8,
  name: 'Billboard Back',
  parSeconds: 80,
  summit: { x: 0, y: 44.4 },
  checkpoints: [{ x: 0, y: 21.0 }],
  props: [
    ...alley(7.5, 48),
    deck('L', 2.4, 7.5),
    deck('R', 8.2, 7.5),
    p.billboard(-0.6, 12.0),
    deck('L', 15.4, 7.5),
    bridge('R', 21.0, 7.5),
    p.billboard(0.6, 24.8),
    deck('L', 28.2, 7.5),
    deck('R', 33.8, 7.5),
    p.billboard(-0.6, 37.6),
    deck('L', 41.0, 7.5),
  ],
});

const neonChain = defineLevel({
  id: 'metropolis-09',
  biome: 'metropolis',
  index: 9,
  name: 'Neon Chain',
  parSeconds: 70,
  wind: { strength: 1.8, gustPeriod: 8, fromY: 8 },
  summit: { x: 0, y: 55.0 },
  checkpoints: [{ x: -0.8, y: 27.2 }, { x: 0, y: 39.2 }],
  props: [
    ...alley(7, 58),
    deck('L', 2.4, 7),
    neon('R', 8.6, 7, { ...SPRINT, phase: 0 }),
    neon('L', 14.8, 7, { ...SPRINT, phase: 0.3 }),
    neon('R', 21.0, 7, { ...SPRINT, phase: 0.6 }),
    deck('L', 27.2, 7),
    neon('R', 33.4, 7, { ...SPRINT, phase: 0.1 }),
    neon('L', 39.6, 7, { ...SPRINT, phase: 0.4 }),
    neon('R', 45.8, 7, { ...SPRINT, phase: 0.7 }),
    deck('L', 52.0, 7),
  ],
});

const galeForce = defineLevel({
  id: 'metropolis-10',
  biome: 'metropolis',
  index: 10,
  name: 'Gale Force',
  parSeconds: 62,
  wind: { strength: -3.6, gustPeriod: 5, fromY: 3 },
  summit: { x: 0, y: 46.4 },
  bounds: { minX: -28, maxX: 28 },
  checkpoints: [{ x: 5.7, y: 17.2 }],
  props: [
    p.plate(0, -0.4, 24),
    ...tower(-13, 50),
    ...tower(13, 50),
    p.scaffoldDeck(-5.6, 3.0, 5),
    hook(0, 10.2, 7, 0.4, 6),
    p.scaffoldDeck(5.6, 17.0, 5),
    p.billboard(-5.8, 21.6),
    hook(0, 26.0, 7, 0.4, 6, 0.5),
    p.scaffoldDeck(-5.6, 32.6, 5),
    hook(0, 38.0, 7, 0.4, 6),
    p.scaffoldDeck(5.6, 44.0, 5),
  ],
});

const expressLine = defineLevel({
  id: 'metropolis-11',
  biome: 'metropolis',
  index: 11,
  name: 'Express Line',
  parSeconds: 98,
  summit: { x: 0, y: 75.4 },
  checkpoints: [{ x: -1.2, y: 22 }, { x: 4, y: 45.8 }],
  props: [
    ...alley(7, 79),
    ...elevator(-0.6, 2.9, 3.4, 11.5, 12),
    deck('L', 21.8, 7),
    ...elevator(0.6, -2.9, 27.6, 11.0, 10, 0.5),
    deck('R', 45.0, 7),
    lift('L', 48.0, 7, 7),
    ...elevator(-0.6, 2.9, 54.6, 11.0, 14, 0.25),
    deck('L', 72.0, 7),
  ],
});

const peelingTower = defineLevel({
  id: 'metropolis-12',
  biome: 'metropolis',
  index: 12,
  name: 'Peeling Tower',
  parSeconds: 132,
  summit: { x: 0, y: 57.4 },
  checkpoints: [
    { x: 0, y: 30.4 },
  ],
  props: [
    ...alley(7, 61),
    deck('L', 2.4, 7),
    cladding('R', 6.4, 7),
    cladding('R', 10.4, 7),
    cladding('R', 14.4, 7),
    cladding('R', 18.4, 7),
    cladding('R', 22.4, 7),
    cladding('R', 26.4, 7),
    deck('L', 30.4, 7),
    cladding('R', 34.4, 7),
    cladding('R', 38.4, 7),
    cladding('R', 42.4, 7),
    cladding('R', 46.4, 7),
    cladding('R', 50.4, 7),
    deck('L', 54.4, 7),
  ],
});

const skylineSprint = defineLevel({
  id: 'metropolis-13',
  biome: 'metropolis',
  index: 13,
  name: 'Skyline Sprint',
  parSeconds: 136,
  wind: { strength: 3.0, gustPeriod: 5, fromY: 10 },
  summit: { x: 0, y: 63.4 },
  bounds: { minX: -24, maxX: 24 },
  checkpoints: [{ x: -0.3, y: 28.6 }, { x: 0, y: 46 }],
  props: [
    p.plate(0, -0.4, 22),
    ...tower(-11, 68),
    ...tower(11, 68),
    deck('L', 2.6, 11, 0.6),
    callBox('L', 2.6, 11, 'sprint-lift', 2.6, 0.6),
    summoned('R', 6.4, 11, 7, 'sprint-lift', 0.6),
    neon('L', 20.0, 11, { ...SPRINT, phase: 0.1 }, 0.6),
    hook(0, 28.0, 7, 0.5, 6),
    neon('R', 36.0, 11, { ...SPRINT, phase: 0.44 }, 0.6),
    deck('L', 46.0, 11, 0.6),
    rig('R', 49.6, 11, 7, 9, 0.5, 0.6),
    neon('L', 60.0, 11, { ...SPRINT, phase: 0.2 }, 0.6),
  ],
});

const penthouse = defineLevel({
  id: 'metropolis-14',
  biome: 'metropolis',
  index: 14,
  name: 'Penthouse',
  parSeconds: 94,
  wind: { strength: 3.6, gustPeriod: 5, fromY: 12 },
  summit: { x: 0, y: 73.4 },
  bounds: { minX: -24, maxX: 24 },
  checkpoints: [{ x: 3.8, y: 20.2 }, { x: -9, y: 47.3 }],
  props: [
    p.plate(0, -0.4, 22),
    ...tower(-11, 78),
    ...tower(11, 78),
    deck('L', 2.6, 11, 0.6),
    ...elevator(-0.6, 2.9, 5.0, 11.5, 13),
    deck('R', 20.0, 11, 0.6),
    cladding('L', 24.0, 11),
    cladding('L', 28.0, 11),
    neon('R', 34.0, 11, { ...SPRINT, phase: 0.2 }, 0.6),
    hook(0, 42.0, 7, 0.5, 6),
    deck('L', 50.0, 11, 0.6),
    rig('R', 53.6, 11, 7, 9, 0.5, 0.6),
    neon('L', 66.0, 11, { ...SPRINT, phase: 0.5 }, 0.6),
    deck('R', 70.0, 11, 0.6),
  ],
});

export const METROPOLIS_LEVELS: LevelDef[] = [
  scaffoldStairs,
  windowWashers,
  neonAlley,
  crosswinds,
  craneYard,
  elevatorShaft,
  rooftopRush,
  billboardBack,
  neonChain,
  galeForce,
  expressLine,
  peelingTower,
  skylineSprint,
  penthouse,
];
