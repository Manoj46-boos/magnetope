import type { LevelDef, PropMotion, PropPlacement } from '@/sim/types';
import { defineLevel, prop as p } from './author';

type Side = 'L' | 'R';

const WALL_W = 3;
const WALL_H = 8;
const REACH = 0.9;
const SLIDE_PITCH = 0.38;

const sign = (side: Side): number => (side === 'L' ? -1 : 1);

/** Distance from the centre line to the face of a wall. */
const faceOf = (halfWidth: number): number => halfWidth - WALL_W / 2;

/** A wall of oversized alphabet blocks. Painted wood never holds a magnet, so only equipment bolted to it does. */
function blockWall(x: number, height: number): PropPlacement[] {
  const blocks: PropPlacement[] = [];
  for (let y = 0; y < height; y += WALL_H) blocks.push(p.toyBlock(x, y + WALL_H / 2, { w: WALL_W, h: WALL_H }));
  return blocks;
}

/** The sandpit floor, a steel drain grate to start on, and a wall of blocks either side. */
function court(halfWidth: number, height: number): PropPlacement[] {
  return [p.plate(0, -0.4, halfWidth * 2 + 6), ...blockWall(-halfWidth, height), ...blockWall(halfWidth, height)];
}

/** Span of a ledge that starts at a wall face and crosses the centre line by `reach`. */
function ledge(side: Side, halfWidth: number, reach: number): { x: number; len: number } {
  const len = faceOf(halfWidth) + reach;
  return { x: sign(side) * (faceOf(halfWidth) - len / 2), len };
}

/** Monkey bars running out from a wall: a steel rail to land on and crawl. */
function bars(side: Side, y: number, halfWidth: number, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.monkeyBars(x, y, len);
}

/**
 * Slide leaning on a wall. Its high end meets the wall face and it falls away toward the
 * centre line; `y` is the middle of the slope.
 */
function slide(side: Side, y: number, halfWidth: number, reach = REACH, pitch = SLIDE_PITCH): PropPlacement {
  const run = faceOf(halfWidth) + reach;
  const length = run / Math.cos(pitch);
  return p.slideRamp(sign(side) * (faceOf(halfWidth) - run / 2), y, sign(side) * pitch, length);
}

/** Soft landing in the corner for anyone who comes down past it. */
function pit(side: Side, y: number, halfWidth: number, w = 5): PropPlacement {
  return p.ballPit(sign(side) * (faceOf(halfWidth) - w / 2), y, w);
}

/** Diving board bolted to a wall face, a spring that dips under MAGNO and gives back a flip timed with its rebound. */
function board(side: Side, y: number, halfWidth: number, w = 5.4): PropPlacement {
  const face = sign(side) * faceOf(halfWidth);
  return p.divingBoard(face - sign(side) * (w / 2), y, { x: face, y }, w);
}

/** Bouncy castle on the floor: it throws back anyone who lands hard, so a long fall ends in a few comic rebounds. */
function castle(side: Side, halfWidth: number): PropPlacement {
  return p.bouncyCastle(sign(side) * (faceOf(halfWidth) - 2.2), 0.9);
}

/** Swing seat on chains `drop` metres below its pivot. */
function seat(x: number, y: number, drop: number): PropPlacement {
  return p.swingSeat(x, y, { x, y: y + drop });
}

/**
 * Timber bracket jutting from a wall with a seat hung under its tip. The wood is not magnetic,
 * so the seat is the only thing to catch: nothing about the frame is a stepping stone.
 */
function swing(side: Side, y: number, halfWidth: number, seatX: number, drop = 3): PropPlacement[] {
  const reach = faceOf(halfWidth) - seatX * sign(side) + 0.6;
  const beamX = sign(side) * (faceOf(halfWidth) - reach / 2);
  return [p.swingBeam(beamX, y, reach, { material: 'wood' }), seat(seatX, y - 0.2 - drop, drop)];
}

const turn = (cx: number, cy: number, period: number, phase = 0, reverse = false): PropMotion => ({
  type: 'spin',
  pivot: { x: cx, y: cy },
  period,
  phase,
  reverse,
});

/**
 * Ferris wheel: six spokes turning as one, with a gondola floor at each tip that stays level
 * all the way round. The wheel never leaves the sweep circle of its own radius.
 */
function wheel(cx: number, cy: number, spokeLen: number, period: number, phase = 0, reverse = false): PropPlacement[] {
  const parts: PropPlacement[] = [];
  const spin = turn(cx, cy, period, phase, reverse);
  const upright: PropMotion = { ...spin, upright: true } as PropMotion;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    parts.push(p.ferrisSpoke(cx + (spokeLen / 2) * Math.cos(a), cy + (spokeLen / 2) * Math.sin(a), spin, { w: spokeLen, rot: a }));
    parts.push(p.gondola(cx + (spokeLen + 0.3) * Math.cos(a), cy + (spokeLen + 0.3) * Math.sin(a), upright));
  }
  return parts;
}

function carousel(x: number, y: number, period: number, phase = 0, reverse = false): PropPlacement {
  return p.carousel(x, y, turn(x, y, period, phase, reverse));
}

const slideSwitchback = defineLevel({
  id: 'playground-01',
  biome: 'playground',
  index: 1,
  name: 'Slide Switchback',
  parSeconds: 72,
  summit: { x: 0, y: 36.6 },
  checkpoints: [{ x: 7, y: 16.5 }],
  props: [
    ...court(6.5, 40),
    bars('L', 2.6, 6.5),
    slide('R', 8.4, 6.5),
    slide('L', 14.2, 6.5),
    bars('R', 20.0, 6.5),
    slide('L', 25.8, 6.5),
    slide('R', 31.6, 6.5),
  ],
});

const swingSetAlley = defineLevel({
  id: 'playground-02',
  biome: 'playground',
  index: 2,
  name: 'Swing Set Alley',
  parSeconds: 84,
  summit: { x: 0, y: 56.0 },
  checkpoints: [{ x: 0, y: 28.0 }],
  props: [
    ...court(7.5, 60),
    bars('L', 2.6, 7.5),
    ...swing('R', 14.2, 7.5, 2.0),
    ...swing('L', 22.7, 7.5, -2.0),
    bars('L', 28.0, 7.5),
    ...swing('R', 39.7, 7.5, 2.0),
    ...swing('L', 48.2, 7.5, -2.0),
    bars('R', 53.5, 7.5),
  ],
});

const seesawRidge = defineLevel({
  id: 'playground-03',
  biome: 'playground',
  index: 3,
  name: 'See-Saw Ridge',
  parSeconds: 98,
  summit: { x: 0, y: 58.0 },
  checkpoints: [{ x: 0, y: 29.0 }],
  props: [
    ...court(7.5, 62),
    pit('R', 0.6, 7.5),
    bars('L', 2.6, 7.5),
    p.seesaw(1.6, 9.2),
    p.seesaw(-1.6, 16.0),
    p.seesaw(1.6, 22.8),
    bars('R', 29.0, 7.5),
    p.seesaw(-1.6, 35.6),
    p.seesaw(1.6, 42.4),
    p.seesaw(-1.6, 49.2),
    bars('L', 55.6, 7.5),
  ],
});

const ferrisWheel = defineLevel({
  id: 'playground-04',
  biome: 'playground',
  index: 4,
  name: 'Ferris Wheel',
  parSeconds: 104,
  summit: { x: 0, y: 44.2 },
  checkpoints: [{ x: 3.8, y: 21.6 }],
  props: [
    ...court(10, 48),
    pit('L', 0.6, 10),
    bars('L', 2.6, 10),
    bars('R', 8.2, 10),
    ...wheel(0, 22, 4.6, 14),
    bars('L', 36.0, 10),
    bars('R', 41.6, 10),
  ],
});

const carouselClimb = defineLevel({
  id: 'playground-05',
  biome: 'playground',
  index: 5,
  name: 'Carousel Climb',
  parSeconds: 112,
  summit: { x: 0, y: 61.2 },
  checkpoints: [{ x: 0, y: 31.0 }],
  props: [
    ...court(8, 64),
    bars('L', 2.6, 8),
    carousel(-1.8, 10.0, 8),
    carousel(1.8, 17.4, 8, 0.25, true),
    carousel(-1.8, 24.8, 8, 0.5),
    bars('R', 31.0, 8),
    p.giantBall(5.2, 44.0),
    carousel(1.8, 38.2, 8, 0.75, true),
    carousel(-1.8, 45.4, 8),
    carousel(1.8, 52.6, 8, 0.25, true),
    bars('L', 58.8, 8),
    castle('R', 8),
  ],
});

const playgroundPeak = defineLevel({
  id: 'playground-06',
  biome: 'playground',
  index: 6,
  name: 'Playground Peak',
  parSeconds: 112,
  summit: { x: 0, y: 55.6 },
  checkpoints: [{ x: 0, y: 20 }, { x: -0.5, y: 39.8 }],
  props: [
    ...court(8, 58),
    pit('R', 0.6, 8),
    bars('L', 2.6, 8),
    slide('R', 8.4, 8),
    p.seesaw(-1.6, 15.4),
    slide('L', 21.6, 8),
    ...swing('R', 29.6, 8, 1.4),
    carousel(-1.4, 33.6, 8, 0.3),
    bars('R', 40.0, 8),
    slide('L', 46.0, 8),
    p.seesaw(1.6, 51.4),
  ],
});

const giantsPlayground = defineLevel({
  id: 'playground-07',
  biome: 'playground',
  index: 7,
  name: "Giant's Playground",
  parSeconds: 130,
  summit: { x: 0, y: 68.6 },
  bounds: { minX: -26, maxX: 26 },
  checkpoints: [{ x: 1.1, y: 22.3 }, { x: 1.8, y: 44 }],
  props: [
    ...court(10, 72),
    pit('L', 0.6, 10),
    bars('L', 2.6, 10),
    slide('R', 8.4, 10),
    ...wheel(0, 22, 4.6, 14),
    bars('L', 36.0, 10),
    ...swing('R', 47.0, 10, 2.4),
    p.seesaw(-2.4, 50.4),
    carousel(2.0, 57.0, 8, 0.5, true),
    carousel(-2.0, 62.2, 8),
    bars('R', 66.0, 10),
  ],
});

const twinWheels = defineLevel({
  id: 'playground-08',
  biome: 'playground',
  index: 8,
  name: 'Twin Wheels',
  parSeconds: 150,
  summit: { x: 0, y: 78.6 },
  bounds: { minX: -26, maxX: 26 },
  checkpoints: [
    { x: 0, y: 22.0 },
    { x: 0, y: 56.0 },
  ],
  props: [
    ...court(10, 82),
    pit('L', 0.6, 10),
    bars('L', 2.6, 10),
    bars('R', 8.2, 10),
    ...p.drivenWheel(0, 22, 'low'),
    bars('L', 36.0, 10),
    bars('R', 41.6, 10),
    ...p.drivenWheel(0, 56, 'high'),
    bars('L', 70.0, 10),
    bars('R', 75.6, 10),
  ],
});

const swingRelay = defineLevel({
  id: 'playground-09',
  biome: 'playground',
  index: 9,
  name: 'Swing Relay',
  parSeconds: 142,
  summit: { x: 0, y: 72.0 },
  checkpoints: [{ x: 0, y: 36.0 }],
  props: [
    ...court(7.5, 76),
    pit('R', 0.6, 7.5),
    bars('L', 2.6, 7.5),
    ...swing('R', 13.6, 7.5, 2.0, 3.4),
    ...swing('L', 22.0, 7.5, -2.0, 3.4),
    ...swing('R', 30.4, 7.5, 2.0, 3.4),
    bars('L', 36.6, 7.5),
    ...swing('R', 47.6, 7.5, 2.0, 3.4),
    ...swing('L', 56.0, 7.5, -2.0, 3.4),
    ...swing('R', 64.4, 7.5, 2.0, 3.4),
    bars('L', 70.0, 7.5),
  ],
});

const seesawStairs = defineLevel({
  id: 'playground-10',
  biome: 'playground',
  index: 10,
  name: 'See-Saw Stairs',
  parSeconds: 100,
  summit: { x: 0, y: 66.0 },
  checkpoints: [{ x: 3, y: 32 }],
  props: [
    ...court(8, 70),
    pit('L', 0.6, 8),
    bars('L', 2.6, 8),
    p.seesaw(1.6, 9.0),
    slide('L', 14.6, 8),
    p.seesaw(-1.6, 20.4),
    p.seesaw(1.6, 26.8),
    board('R', 32.0, 8),
    p.seesaw(-1.6, 38.6),
    slide('R', 44.2, 8),
    p.seesaw(1.6, 50.0),
    p.seesaw(-1.6, 56.4),
    bars('L', 62.6, 8),
  ],
});

const merryGoRound = defineLevel({
  id: 'playground-11',
  biome: 'playground',
  index: 11,
  name: 'Merry-Go-Round',
  parSeconds: 128,
  summit: { x: 0, y: 70.0 },
  checkpoints: [{ x: 0, y: 34.0 }],
  props: [
    ...court(8.5, 74),
    bars('L', 2.6, 8.5),
    carousel(-3.0, 10.0, 8),
    carousel(3.0, 15.6, 8, 0.5, true),
    carousel(-3.0, 21.2, 8, 0.25),
    carousel(3.0, 26.8, 8, 0.75, true),
    bars('R', 34.0, 8.5),
    p.giantBall(-6.2, 44.0),
    carousel(-1.8, 42.4, 10, 0.2),
    carousel(1.8, 49.6, 10, 0.7, true),
    carousel(-1.8, 56.8, 10, 0.45),
    carousel(1.8, 64.0, 10, 0.95, true),
    bars('L', 67.6, 8.5),
    castle('R', 8.5),
  ],
});

const slideSpiral = defineLevel({
  id: 'playground-12',
  biome: 'playground',
  index: 12,
  name: 'Slide Spiral',
  parSeconds: 132,
  summit: { x: 0, y: 64.6 },
  checkpoints: [{ x: 0.2, y: 23.5 }, { x: 0, y: 43 }],
  props: [
    ...court(7.5, 68),
    pit('R', 0.6, 7.5),
    bars('L', 2.6, 7.5),
    slide('R', 8.0, 7.5),
    slide('L', 13.4, 7.5),
    slide('R', 18.8, 7.5),
    bars('L', 24.4, 7.5),
    carousel(-1.6, 33.0, 8),
    slide('R', 38.6, 7.5),
    slide('L', 44.0, 7.5),
    board('R', 49.8, 7.5),
    p.seesaw(1.6, 56.0),
    bars('L', 61.8, 7.5),
  ],
});

const giantsGym = defineLevel({
  id: 'playground-13',
  biome: 'playground',
  index: 13,
  name: "Giant's Gym",
  parSeconds: 148,
  summit: { x: 0, y: 76.6 },
  bounds: { minX: -26, maxX: 26 },
  checkpoints: [{ x: -2.7, y: 23.2 }, { x: 0.2, y: 52.7 }],
  props: [
    ...court(10, 80),
    pit('L', 0.6, 10),
    bars('L', 2.6, 10),
    bars('R', 8.0, 10),
    ...swing('R', 15.0, 10, 2.4, 3.2),
    p.giantBall(-6.0, 22.0),
    ...swing('L', 23.0, 10, -2.4, 3.2),
    bars('R', 29.0, 10),
    carousel(0, 40.0, 9),
    p.seesaw(-2.4, 47.0),
    bars('L', 53.6, 10),
    ...wheel(0, 66.0, 4.6, 14, 0.25),
    bars('R', 74.4, 10),
  ],
});

const bigTop = defineLevel({
  id: 'playground-14',
  biome: 'playground',
  index: 14,
  name: 'Big Top',
  parSeconds: 146,
  summit: { x: 0, y: 92.0 },
  bounds: { minX: -28, maxX: 28 },
  checkpoints: [{ x: 3.5, y: 26.1 }, { x: 1.2, y: 53.8 }, { x: 0.9, y: 72.3 }],
  props: [
    ...court(11, 96),
    pit('R', 0.6, 11),
    bars('L', 2.6, 11),
    slide('R', 8.4, 11),
    bars('L', 14.0, 11),
    ...wheel(0, 26.0, 4.6, 14),
    bars('R', 40.0, 11),
    ...swing('L', 47.0, 11, -2.4, 3.2),
    p.seesaw(2.4, 53.4),
    carousel(-2.0, 61.0, 8, 0.5, true),
    carousel(2.0, 66.4, 8),
    bars('L', 72.0, 11),
    ...wheel(0, 84.0, 4.6, 12, 0.25, true),
    bars('R', 90.4, 11),
  ],
});

export const PLAYGROUND_LEVELS: LevelDef[] = [
  slideSwitchback,
  swingSetAlley,
  seesawRidge,
  ferrisWheel,
  carouselClimb,
  playgroundPeak,
  giantsPlayground,
  twinWheels,
  swingRelay,
  seesawStairs,
  merryGoRound,
  slideSpiral,
  giantsGym,
  bigTop,
];
