import { Rng } from '@/core/rng';
import type { LevelDef, PropMotion, PropPlacement } from '@/sim/types';
import { defineLevel, prop as p } from './author';

type Side = 'L' | 'R';

const WALL_W = 2.4;
const SIDING_PANEL = 4;

const sign = (side: Side): number => (side === 'L' ? -1 : 1);

/** Distance from the centre line to the face of a house wall. */
const faceOf = (halfWidth: number): number => halfWidth - WALL_W / 2;

/** A house wall: clapboard panels stacked to `height`. Siding never holds a magnet, so only hardware on it does. */
function sidingWall(x: number, height: number, rng: Rng): PropPlacement[] {
  const panels: PropPlacement[] = [];
  for (let y = 0; y < height; y += SIDING_PANEL) panels.push(p.siding(x + rng.range(-0.08, 0.08), y + SIDING_PANEL / 2, SIDING_PANEL));
  return panels;
}

/** The base lawn, a steel drain cover to start on, and a house wall either side. */
function yard(halfWidth: number, height: number, seed: number): PropPlacement[] {
  const rng = new Rng(seed);
  return [p.plate(0, -0.4, halfWidth * 2 + 6), ...sidingWall(-halfWidth, height, rng), ...sidingWall(halfWidth, height, rng)];
}

/** How far a ledge reaches past the centre line. Ledges on opposite walls overlap, so no clear chimney runs up the middle. */
const REACH = 0.9;

/** Span of a ledge that starts at a wall face and crosses the centre line by `reach`. */
function ledge(side: Side, halfWidth: number, reach: number): { x: number; len: number } {
  const len = faceOf(halfWidth) + reach;
  return { x: sign(side) * (faceOf(halfWidth) - len / 2), len };
}

/** A tool shed jutting from a wall: steel and chunky. */
function shed(side: Side, y: number, halfWidth: number, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.shed(x, y, { w: len });
}

/** Mailbox bolted to a wall face: a small steel stepping stone on an otherwise dead wall. */
function mailbox(side: Side, y: number, halfWidth: number): PropPlacement {
  return p.mailbox(sign(side) * (faceOf(halfWidth) - 0.55), y);
}

/** Trampoline tucked against a wall, a soft net for whoever falls past. */
function net(side: Side, y: number, halfWidth: number, w = 3.6): PropPlacement {
  return p.trampoline(sign(side) * (faceOf(halfWidth) - w / 2), y, w);
}

/** Trampoline fixed upright to a wall: a bumper that throws MAGNO back across the yard. */
function bumper(side: Side, y: number, halfWidth: number, len = 3.6): PropPlacement {
  return p.trampoline(sign(side) * (faceOf(halfWidth) - 0.25), y, len, { rot: Math.PI / 2 });
}

/** Gutter strip on a wall: aluminium, so it holds for only a moment. */
function gutter(side: Side, y: number, halfWidth: number, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.gutter(x, y, len);
}

/** Washing on the line: soft cloth that never holds a magnet but never hurts either. */
function laundry(side: Side, y: number, halfWidth: number, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.laundry(x, y, len);
}

/** Shop awning on a wall: taut canvas that throws MAGNO back if he comes down hard and rests him if he lands light. */
function awning(side: Side, y: number, halfWidth: number, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.awning(x, y, len);
}

/** Steel garage door that rises and falls against a wall; ride it as a lift. */
function garageLift(side: Side, y: number, halfWidth: number, rise: number, period: number, phase = 0): PropPlacement {
  const motion: PropMotion = { type: 'slide', dx: 0, dy: rise, period, phase, dwell: 0.2 };
  return p.garageDoor(sign(side) * (faceOf(halfWidth) - 1.9), y, { motion });
}

/** Sign board on chains from `drop` metres above it; a pendulum that swings under MAGNO's weight. */
function swingPlate(x: number, y: number, drop: number): PropPlacement {
  return p.swingPlate(x, y, { x, y: y + drop });
}

const frontYard = defineLevel({
  id: 'suburbia-01',
  biome: 'suburbia',
  index: 1,
  name: 'Front Yard',
  parSeconds: 60,
  summit: { x: 0, y: 32.2 },
  checkpoints: [{ x: 4.8, y: 15 }],
  props: [
    ...yard(5.2, 35, 201),
    shed('L', 2.6, 5.2),
    shed('R', 10.8, 5.2),
    shed('L', 19.0, 5.2),
    shed('R', 27.2, 5.2),
    mailbox('L', 10.8, 5.2),
    mailbox('R', 19.0, 5.2),
  ],
});

const bounceYard = defineLevel({
  id: 'suburbia-02',
  biome: 'suburbia',
  index: 2,
  name: 'Bounce Yard',
  parSeconds: 66,
  summit: { x: 0, y: 36.0 },
  checkpoints: [{ x: -5, y: 13.5 }],
  props: [
    ...yard(5.8, 39, 202),
    shed('L', 3.0, 5.8),
    shed('R', 11.6, 5.8),
    shed('L', 20.2, 5.8),
    shed('R', 28.8, 5.8),
    net('R', 0.25, 5.8, 3.0),
    bumper('L', 11.6, 5.8),
    bumper('R', 28.8, 5.8),
  ],
});

const garageRow = defineLevel({
  id: 'suburbia-03',
  biome: 'suburbia',
  index: 3,
  name: 'Garage Row',
  parSeconds: 74,
  summit: { x: 0, y: 39.2 },
  checkpoints: [{ x: 0, y: 19.6 }],
  props: [
    ...yard(5.6, 42, 203),
    shed('L', 3.0, 5.6),
    garageLift('R', 7.6, 5.6, 6.5, 7),
    shed('L', 19.0, 5.6),
    garageLift('R', 23.6, 5.6, 6.5, 7, 0.5),
    shed('L', 35.0, 5.6),
    net('R', 0.25, 5.6, 3.0),
  ],
});

const swingSet = defineLevel({
  id: 'suburbia-04',
  biome: 'suburbia',
  index: 4,
  name: 'Swing Set',
  parSeconds: 80,
  summit: { x: 0, y: 39.2 },
  checkpoints: [{ x: 0, y: 19.6 }],
  props: [
    ...yard(6, 42, 204),
    shed('L', 3.0, 6),
    swingPlate(2.0, 10.6, 4.4),
    shed('L', 19.0, 6),
    swingPlate(2.0, 26.6, 4.4),
    shed('L', 35.0, 6),
    net('R', 0.25, 6, 3.0),
  ],
});

const gutterRun = defineLevel({
  id: 'suburbia-05',
  biome: 'suburbia',
  index: 5,
  name: 'Gutter Run',
  parSeconds: 86,
  summit: { x: 0, y: 37.0 },
  checkpoints: [{ x: 0, y: 17.4 }],
  props: [
    ...yard(5.4, 40, 205),
    shed('L', 3.0, 5.4),
    gutter('R', 10.0, 5.4, 0.4),
    gutter('L', 17.2, 5.4, 0.4),
    gutter('R', 24.4, 5.4, 0.4),
    gutter('L', 31.6, 5.4, 0.4),
    net('L', 0.25, 5.4, 3.0),
  ],
});

const clothesline = defineLevel({
  id: 'suburbia-06',
  biome: 'suburbia',
  index: 6,
  name: 'Clothesline',
  parSeconds: 92,
  summit: { x: 0, y: 36.2 },
  checkpoints: [{ x: 3.3, y: 12.8 }, { x: -0.8, y: 24.1 }],
  props: [
    ...yard(6.6, 40, 206),
    shed('L', 3.0, 6.6),
    shed('R', 9.6, 6.6),
    shed('L', 16.2, 6.6),
    shed('R', 22.8, 6.6),
    shed('L', 29.4, 6.6),
    awning('L', 6.3, 6.6, -2.2),
    laundry('R', 12.9, 6.6, -2.2),
    awning('L', 19.5, 6.6, -2.2),
    laundry('R', 26.1, 6.6, -2.2),
    net('R', 0.25, 6.6, 3.0),
  ],
});

const blockParty = defineLevel({
  id: 'suburbia-07',
  biome: 'suburbia',
  index: 7,
  name: 'Block Party',
  parSeconds: 100,
  summit: { x: 0, y: 40.2 },
  checkpoints: [{ x: 0, y: 14.4 }, { x: -1.3, y: 26.3 }],
  props: [
    ...yard(6.4, 43, 207),
    shed('L', 3.0, 6.4),
    garageLift('R', 6.0, 6.4, 5.0, 10),
    gutter('L', 14.4, 6.4),
    swingPlate(2.0, 19.0, 4.4),
    shed('L', 25.0, 6.4),
    garageLift('R', 27.4, 6.4, 5.0, 10, 0.5),
    gutter('L', 35.4, 6.4),
    laundry('R', 21.8, 6.4),
    net('R', 0.25, 6.4, 3.0),
  ],
});

/** Shingled roof jutting from a wall. Shingles are not magnetic, so a roof is a ceiling to climb around and never a step. */
function eave(side: Side, y: number, halfWidth: number, reach = 0.4): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.roof(x, y, len);
}

/** Satellite dish bolted to a wall face: a round steel pad, grippable from any side. */
function dish(side: Side, y: number, halfWidth: number, r = 1.5): PropPlacement {
  return p.dish(sign(side) * (faceOf(halfWidth) - r + 0.1), y, r);
}

const bounceCastle = defineLevel({
  id: 'suburbia-08',
  biome: 'suburbia',
  index: 8,
  name: 'Bounce Castle',
  parSeconds: 80,
  summit: { x: 0, y: 42.2 },
  checkpoints: [{ x: 1.8, y: 19.5 }],
  props: [
    ...yard(6.2, 46, 208),
    shed('L', 3.0, 6.2),
    net('R', 8.4, 6.2, 3.4),
    shed('L', 14.0, 6.2),
    net('R', 19.6, 6.2, 3.4),
    shed('L', 25.2, 6.2),
    net('R', 30.8, 6.2, 3.4),
    shed('L', 36.4, 6.2),
  ],
});

const roofline = defineLevel({
  id: 'suburbia-09',
  biome: 'suburbia',
  index: 9,
  name: 'Roofline',
  parSeconds: 118,
  summit: { x: 0, y: 45.4 },
  checkpoints: [{ x: 0, y: 21.0 }],
  props: [
    ...yard(6.0, 49, 209),
    shed('L', 3.0, 6.0),
    shed('R', 10.4, 6.0),
    eave('R', 13.8, 6.0),
    shed('L', 17.8, 6.0),
    eave('L', 21.2, 6.0),
    shed('R', 25.2, 6.0),
    eave('R', 28.6, 6.0),
    shed('L', 32.6, 6.0),
    eave('L', 36.0, 6.0),
    shed('R', 40.0, 6.0),
  ],
});

const liftWall = defineLevel({
  id: 'suburbia-10',
  biome: 'suburbia',
  index: 10,
  name: 'Lift Wall',
  parSeconds: 90,
  summit: { x: 0, y: 53.8 },
  checkpoints: [{ x: 0.8, y: 26.1 }],
  props: [
    ...yard(6.8, 57, 210),
    shed('L', 3.0, 6.8),
    garageLift('R', 6.0, 6.8, 6.0, 9),
    garageLift('L', 17.0, 6.8, 6.0, 9, 0.5),
    shed('R', 28.0, 6.8),
    garageLift('L', 31.0, 6.8, 6.0, 9),
    garageLift('R', 42.0, 6.8, 6.0, 9, 0.5),
    shed('L', 52.0, 6.8),
  ],
});

const doubleSwing = defineLevel({
  id: 'suburbia-11',
  biome: 'suburbia',
  index: 11,
  name: 'Double Swing',
  parSeconds: 60,
  summit: { x: 0, y: 40.2 },
  checkpoints: [{ x: 0, y: 19.6 }],
  props: [
    ...yard(6.4, 44, 211),
    shed('L', 3.0, 6.4),
    swingPlate(-2.2, 10.6, 4.4),
    swingPlate(2.4, 14.2, 4.4),
    shed('R', 19.6, 6.4),
    swingPlate(2.2, 26.6, 4.4),
    swingPlate(-2.4, 30.2, 4.4),
    shed('L', 36.0, 6.4),
  ],
});

const gutterChain = defineLevel({
  id: 'suburbia-12',
  biome: 'suburbia',
  index: 12,
  name: 'Gutter Chain',
  parSeconds: 114,
  summit: { x: 0, y: 42.4 },
  checkpoints: [{ x: 4.8, y: 15.8 }, { x: 4.8, y: 27.8 }],
  props: [
    ...yard(5.6, 46, 212),
    shed('L', 3.0, 5.6),
    gutter('R', 9.0, 5.6, 0.4),
    gutter('L', 14.6, 5.6, 0.4),
    bumper('R', 15.8, 5.6),
    gutter('R', 20.2, 5.6, 0.4),
    shed('L', 26.4, 5.6),
    gutter('R', 32.0, 5.6, 0.4),
    gutter('L', 37.6, 5.6, 0.4),
  ],
});

const dishDash = defineLevel({
  id: 'suburbia-13',
  biome: 'suburbia',
  index: 13,
  name: 'Dish Dash',
  parSeconds: 78,
  summit: { x: 0, y: 41.4 },
  checkpoints: [{ x: -3.5, y: 14.3 }, { x: -4.2, y: 28 }],
  props: [
    ...yard(6.4, 45, 213),
    shed('L', 3.0, 6.4),
    dish('R', 8.6, 6.4),
    dish('L', 14.6, 6.4),
    shed('R', 20.6, 6.4),
    dish('L', 26.6, 6.4),
    dish('R', 32.6, 6.4),
    shed('L', 38.0, 6.4),
  ],
});

const culDeSac = defineLevel({
  id: 'suburbia-14',
  biome: 'suburbia',
  index: 14,
  name: 'Cul-de-Sac',
  parSeconds: 114,
  summit: { x: 0, y: 49.6 },
  checkpoints: [{ x: -0.4, y: 17 }, { x: -2.7, y: 33 }],
  props: [
    ...yard(6.6, 54, 214),
    shed('L', 3.0, 6.6),
    garageLift('R', 5.8, 6.6, 5.6, 10),
    net('L', 11.6, 6.6, 3.2),
    gutter('L', 17.8, 6.6),
    swingPlate(2.0, 22.0, 4.4),
    shed('R', 28.0, 6.6),
    dish('L', 33.0, 6.6),
    garageLift('R', 33.4, 6.6, 5.6, 10, 0.5),
    shed('L', 40.0, 6.6),
    gutter('R', 45.4, 6.6),
  ],
});

export const SUBURBIA_LEVELS: LevelDef[] = [
  frontYard,
  bounceYard,
  garageRow,
  swingSet,
  gutterRun,
  clothesline,
  blockParty,
  bounceCastle,
  roofline,
  liftWall,
  doubleSwing,
  gutterChain,
  dishDash,
  culDeSac,
];
