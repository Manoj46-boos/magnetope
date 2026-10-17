import type { LevelDef, PropCycle, PropMotion, PropPlacement } from '@/sim/types';
import { defineLevel, prop as p } from './author';

type Side = 'L' | 'R';

const WALL_W = 3;
const WALL_H = 8;
const REACH = 0.9;

const sign = (side: Side): number => (side === 'L' ? -1 : 1);

/** Distance from the centre line to the face of a hull wall. */
const faceOf = (halfWidth: number): number => halfWidth - WALL_W / 2;

/** A wall of foil-wrapped insulation. Fabric never holds a magnet, so only hardware bolted to it does. */
function thermalWall(x: number, height: number): PropPlacement[] {
  const panels: PropPlacement[] = [];
  for (let y = 0; y < height; y += WALL_H) panels.push(p.thermalWall(x, y + WALL_H / 2, WALL_H));
  return panels;
}

/** A steel launch cradle to start on and a wall of insulation either side. */
function shaft(halfWidth: number, height: number): PropPlacement[] {
  return [p.plate(0, -0.4, halfWidth * 2 + 6), ...thermalWall(-halfWidth, height), ...thermalWall(halfWidth, height)];
}

/** Span of a ledge that starts at a wall face and crosses the centre line by `reach`. */
function ledge(side: Side, halfWidth: number, reach: number): { x: number; len: number } {
  const len = faceOf(halfWidth) + reach;
  return { x: sign(side) * (faceOf(halfWidth) - len / 2), len };
}

/** Wing stub bolted to the hull wall: a long thin steel shelf. */
function wing(side: Side, y: number, halfWidth: number, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.wing(x, y, len);
}

/** A slab of fuselage with the windows still in it: chunky steel to land on. */
function fuselage(side: Side, y: number, halfWidth: number, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.fuselage(x, y, len);
}

/** Cargo pod clamped to the wall. */
function pod(side: Side, y: number, halfWidth: number): PropPlacement {
  return p.cargoPod(sign(side) * (faceOf(halfWidth) - 1.3), y);
}

/** Antenna mast bolted to a wall face: a steel rail to crawl. */
function mast(side: Side, y: number, halfWidth: number, h = 6): PropPlacement {
  return p.mast(sign(side) * (faceOf(halfWidth) - 0.25), y, h);
}

/** Aluminium skin torn off the airframe: it holds for a moment and lets go. */
function skin(side: Side, y: number, halfWidth: number, h = 4): PropPlacement {
  return p.skin(sign(side) * (faceOf(halfWidth) - 0.18), y, h);
}

/** Truss caked in frost: steel under ice, brittle with cold, so it gives way if MAGNO lingers. */
function frost(side: Side, y: number, halfWidth: number, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.frostTruss(x, y, len);
}

/** Warning strobe on a bracket that goes dark on a fixed beat. */
function strobe(side: Side, y: number, halfWidth: number, cycle: PropCycle, reach = REACH): PropPlacement {
  const { x, len } = ledge(side, halfWidth, reach);
  return p.strobe(x, y, cycle, { w: len });
}

const slideX = (dx: number, period: number, phase = 0): PropMotion => ({ type: 'slide', dx, dy: 0, period, phase, dwell: 0.12 });

/** Debris drifting back and forth across the shaft. */
function drift(x: number, y: number, dx: number, period: number, phase = 0): PropPlacement {
  return p.debris(x, y, slideX(dx, period, phase));
}

const PANEL_LEN = 4.2;
const PANEL_ORBIT = 3.9;

/** A satellite, which holds no magnet, with a solar panel on an arm that orbits it. The panel is the foothold. */
function orbiter(x: number, y: number, period: number, phase = 0, reverse = false): PropPlacement[] {
  const motion: PropMotion = { type: 'spin', pivot: { x, y }, period, phase, reverse };
  return [p.satellite(x, y), p.solarPanel(x + PANEL_ORBIT, y, motion, { w: PANEL_LEN })];
}

/** A truss that turns about its middle like the arm of a space station. */
function turntable(x: number, y: number, w: number, period: number, phase = 0, reverse = false): PropPlacement {
  return p.truss(x, y, w, { motion: { type: 'spin', pivot: { x, y }, period, phase, reverse } });
}

const BEAT: PropCycle = { period: 7, on: 0.66, warn: 0.8 };

const jetWreck = defineLevel({
  id: 'stratosphere-01',
  biome: 'stratosphere',
  index: 1,
  name: 'Jet Wreck',
  parSeconds: 84,
  gravityScale: 0.66,
  bounds: { minX: -22, maxX: 22 },
  summit: { x: 0, y: 41.2 },
  checkpoints: [{ x: 0, y: 20.6 }],
  props: [
    ...shaft(9, 46),
    wing('L', 2.6, 9),
    wing('R', 11.6, 9),
    fuselage('L', 20.6, 9),
    wing('R', 29.6, 9),
    wing('L', 38.6, 9),
  ],
});

const satelliteGarden = defineLevel({
  id: 'stratosphere-02',
  biome: 'stratosphere',
  index: 2,
  name: 'Satellite Garden',
  parSeconds: 104,
  gravityScale: 0.62,
  bounds: { minX: -22, maxX: 22 },
  summit: { x: 0, y: 79.4 },
  checkpoints: [{ x: 0, y: 40.0 }],
  props: [
    ...shaft(9, 85),
    pod('L', 2.6, 9),
    ...orbiter(0, 14.0, 12),
    ...orbiter(0, 26.0, 12, 0.5, true),
    wing('R', 40.0, 9),
    ...orbiter(0, 51.0, 12, 0.25),
    ...orbiter(0, 63.0, 12, 0.75, true),
    wing('L', 77.0, 9),
  ],
});

const dishArray = defineLevel({
  id: 'stratosphere-03',
  biome: 'stratosphere',
  index: 3,
  name: 'Dish Array',
  parSeconds: 100,
  gravityScale: 0.58,
  wind: { strength: 1.4, gustPeriod: 7, fromY: 8 },
  bounds: { minX: -22, maxX: 22 },
  summit: { x: 0, y: 58.4 },
  checkpoints: [{ x: -4.7, y: 27.8 }],
  props: [
    ...shaft(9, 64),
    wing('L', 2.6, 9),
    p.radioDish(2.6, 12.0),
    mast('R', 20.4, 9),
    p.radioDish(-2.6, 28.2),
    wing('R', 36.6, 9),
    p.radioDish(2.6, 45.0),
    wing('L', 53.4, 9),
  ],
});

const debrisField = defineLevel({
  id: 'stratosphere-04',
  biome: 'stratosphere',
  index: 4,
  name: 'Debris Field',
  parSeconds: 116,
  gravityScale: 0.56,
  wind: { strength: -1.6, gustPeriod: 6, fromY: 8 },
  bounds: { minX: -22, maxX: 22 },
  summit: { x: 0, y: 85.4 },
  checkpoints: [{ x: 0, y: 43.0 }],
  props: [
    ...shaft(9, 90),
    pod('R', 2.6, 9),
    drift(-3.6, 14.0, 7.2, 9),
    drift(3.6, 25.5, -7.2, 9, 0.4),
    drift(-3.6, 37.0, 7.2, 9, 0.2),
    wing('L', 43.0, 9),
    drift(3.6, 54.0, -7.2, 9, 0.6),
    drift(-3.6, 65.0, 7.2, 9),
    drift(3.6, 76.0, -7.2, 9, 0.3),
    wing('R', 83.0, 9),
  ],
});

const frozenFuselage = defineLevel({
  id: 'stratosphere-05',
  biome: 'stratosphere',
  index: 5,
  name: 'Frozen Fuselage',
  parSeconds: 120,
  gravityScale: 0.55,
  wind: { strength: 1.8, gustPeriod: 6, fromY: 10 },
  bounds: { minX: -22, maxX: 22 },
  summit: { x: 0, y: 87.4 },
  checkpoints: [{ x: 0, y: 44.9 }],
  props: [
    ...shaft(9, 92),
    fuselage('L', 2.6, 9),
    strobe('R', 13.5, 9, { ...BEAT, phase: 0.1 }),
    strobe('L', 24.0, 9, { ...BEAT, phase: 0.5 }),
    strobe('R', 34.5, 9, { ...BEAT, phase: 0.3 }),
    fuselage('R', 44.5, 9),
    skin('L', 51.0, 9),
    skin('L', 56.5, 9),
    skin('L', 62.0, 9),
    skin('L', 67.5, 9),
    skin('L', 73.0, 9),
    skin('L', 78.5, 9),
    wing('R', 85.0, 9),
  ],
});

const orbitSpokes = defineLevel({
  id: 'stratosphere-06',
  biome: 'stratosphere',
  index: 6,
  name: 'Orbit Spokes',
  parSeconds: 134,
  gravityScale: 0.52,
  wind: { strength: -2.0, gustPeriod: 5, fromY: 12 },
  bounds: { minX: -24, maxX: 24 },
  summit: { x: 0, y: 93.6 },
  checkpoints: [{ x: 0, y: 46.0 }],
  props: [
    ...shaft(10, 98),
    wing('L', 2.6, 10),
    turntable(0, 14.0, 7.2, 12),
    turntable(0, 26.5, 7.2, 12, 0.5, true),
    turntable(0, 38.0, 7.2, 12, 0.25),
    wing('R', 46.0, 10),
    drift(-3.6, 57.0, 7.2, 9, 0.3),
    turntable(0, 68.5, 7.2, 12, 0.75, true),
    strobe('L', 80.0, 10, { ...BEAT, phase: 0.3 }),
    wing('L', 91.2, 10),
  ],
});

const coldFront = defineLevel({
  id: 'stratosphere-07',
  biome: 'stratosphere',
  index: 7,
  name: 'Cold Front',
  parSeconds: 160,
  gravityScale: 0.5,
  wind: { strength: 2.2, gustPeriod: 5, fromY: 14 },
  bounds: { minX: -24, maxX: 24 },
  summit: { x: 0, y: 105.4 },
  checkpoints: [
    { x: 0, y: 47.4 },
    { x: 0, y: 91.6 },
  ],
  props: [
    ...shaft(10, 110),
    fuselage('L', 2.6, 10),
    ...orbiter(0, 14.5, 12),
    strobe('R', 26.5, 10, { ...BEAT, phase: 0.4 }),
    strobe('L', 37.5, 10, { ...BEAT, phase: 0.1 }),
    wing('R', 47.0, 10),
    drift(-3.6, 58.0, 7.2, 9, 0.6),
    turntable(0, 69.5, 7.2, 12),
    strobe('R', 81.0, 10, { ...BEAT, phase: 0.5 }),
    wing('L', 91.2, 10),
    skin('R', 97.0, 10),
    skin('R', 102.0, 10),
  ],
});

const wreckAlley = defineLevel({
  id: 'stratosphere-08',
  biome: 'stratosphere',
  index: 8,
  name: 'Wreck Alley',
  parSeconds: 150,
  gravityScale: 0.5,
  wind: { strength: 1.6, gustPeriod: 7, fromY: 10 },
  bounds: { minX: -24, maxX: 24 },
  summit: { x: 0, y: 95.4 },
  checkpoints: [
    { x: 0, y: 32.0 },
    { x: 0, y: 63.0 },
  ],
  props: [
    ...shaft(10, 100),
    fuselage('L', 2.6, 10),
    skin('R', 9.0, 10),
    skin('R', 14.0, 10),
    drift(-3.6, 25.0, 7.2, 9),
    wing('R', 32.0, 10),
    drift(3.6, 44.0, -7.2, 9, 0.5),
    frost('L', 54.0, 10),
    wing('R', 63.0, 10),
    drift(-3.6, 75.0, 7.2, 9, 0.3),
    drift(3.6, 86.0, -7.2, 9, 0.8),
    wing('L', 93.0, 10),
  ],
});

const dishGarden = defineLevel({
  id: 'stratosphere-09',
  biome: 'stratosphere',
  index: 9,
  name: 'Dish Garden',
  parSeconds: 122,
  gravityScale: 0.5,
  wind: { strength: -2.0, gustPeriod: 6, fromY: 10 },
  bounds: { minX: -24, maxX: 24 },
  summit: { x: 0, y: 97.4 },
  checkpoints: [
    { x: 0, y: 34.0 },
    { x: 0, y: 66.0 },
  ],
  props: [
    ...shaft(10, 102),
    wing('L', 2.6, 10),
    p.radioDish(2.8, 13.0),
    p.radioDish(-2.8, 22.0),
    mast('R', 31.0, 10),
    wing('R', 34.0, 10),
    p.radioDish(2.8, 46.0),
    p.radioDish(-2.8, 56.0),
    wing('L', 66.0, 10),
    p.radioDish(2.8, 78.0),
    p.radioDish(-2.8, 88.0),
    wing('R', 95.0, 10),
  ],
});

const solarStorm = defineLevel({
  id: 'stratosphere-10',
  biome: 'stratosphere',
  index: 10,
  name: 'Solar Storm',
  parSeconds: 152,
  gravityScale: 0.48,
  wind: { strength: 2.4, gustPeriod: 5, fromY: 12 },
  bounds: { minX: -24, maxX: 24 },
  summit: { x: 0, y: 99.4 },
  checkpoints: [
    { x: 0, y: 36.0 },
    { x: 0, y: 70.0 },
  ],
  props: [
    ...shaft(10, 104),
    wing('L', 2.6, 10),
    ...orbiter(0, 14.0, 12),
    ...orbiter(0, 26.0, 12, 0.5, true),
    wing('R', 36.0, 10),
    ...orbiter(0, 48.0, 12, 0.25, true),
    ...orbiter(0, 60.0, 12, 0.75),
    wing('L', 70.0, 10),
    ...orbiter(0, 82.0, 12, 0.1),
    wing('R', 97.0, 10),
  ],
});

const strobeRun = defineLevel({
  id: 'stratosphere-11',
  biome: 'stratosphere',
  index: 11,
  name: 'Strobe Run',
  parSeconds: 108,
  gravityScale: 0.48,
  wind: { strength: 2.0, gustPeriod: 6, fromY: 12 },
  bounds: { minX: -24, maxX: 24 },
  summit: { x: 0, y: 101.4 },
  checkpoints: [
    { x: 0, y: 39.0 },
    { x: 0, y: 72.0 },
  ],
  props: [
    ...shaft(10, 106),
    fuselage('L', 2.6, 10),
    strobe('R', 13.0, 10, { ...BEAT, phase: 0.0 }),
    strobe('L', 23.5, 10, { ...BEAT, phase: 0.3 }),
    strobe('R', 34.0, 10, { ...BEAT, phase: 0.6 }),
    frost('L', 39.0, 10),
    strobe('R', 49.5, 10, { ...BEAT, phase: 0.1 }),
    strobe('L', 60.0, 10, { ...BEAT, phase: 0.4 }),
    wing('R', 72.0, 10),
    strobe('L', 82.5, 10, { ...BEAT, phase: 0.7 }),
    strobe('R', 93.0, 10, { ...BEAT, phase: 0.2 }),
    wing('L', 99.0, 10),
  ],
});

const skinDeep = defineLevel({
  id: 'stratosphere-12',
  biome: 'stratosphere',
  index: 12,
  name: 'Skin Deep',
  parSeconds: 152,
  gravityScale: 0.46,
  wind: { strength: -2.2, gustPeriod: 5, fromY: 12 },
  bounds: { minX: -24, maxX: 24 },
  summit: { x: 0, y: 103.4 },
  checkpoints: [
    { x: 0, y: 40.0 },
    { x: 0, y: 74.0 },
  ],
  props: [
    ...shaft(10, 108),
    fuselage('L', 2.6, 10),
    skin('R', 9.0, 10),
    skin('R', 14.5, 10),
    skin('R', 20.0, 10),
    skin('R', 25.5, 10),
    skin('R', 31.0, 10),
    wing('L', 40.0, 10),
    skin('R', 46.0, 10),
    skin('R', 51.5, 10),
    drift(-3.6, 61.0, 7.2, 9, 0.4),
    skin('L', 67.0, 10),
    wing('R', 74.0, 10),
    skin('L', 80.0, 10),
    skin('L', 85.5, 10),
    skin('L', 91.0, 10),
    skin('L', 96.5, 10),
    wing('R', 101.0, 10),
  ],
});

const stationSpin = defineLevel({
  id: 'stratosphere-13',
  biome: 'stratosphere',
  index: 13,
  name: 'Station Spin',
  parSeconds: 128,
  gravityScale: 0.46,
  wind: { strength: 2.2, gustPeriod: 5, fromY: 14 },
  bounds: { minX: -26, maxX: 26 },
  summit: { x: 0, y: 111.4 },
  checkpoints: [{ x: 0.3, y: 39.8 }, { x: 0, y: 78 }],
  props: [
    ...shaft(11, 116),
    wing('L', 2.6, 11),
    turntable(0, 14.0, 8.0, 12),
    turntable(0, 26.5, 8.0, 12, 0.5, true),
    turntable(0, 39.0, 8.0, 12, 0.25),
    wing('R', 48.0, 11),
    ...orbiter(0, 60.0, 12, 0.3, true),
    drift(-3.6, 70.0, 7.2, 9, 0.6),
    wing('L', 78.0, 11),
    turntable(0, 90.0, 8.0, 12, 0.75, true),
    turntable(0, 102.0, 8.0, 12, 0.1),
    wing('R', 109.0, 11),
  ],
});

const theCore = defineLevel({
  id: 'stratosphere-14',
  biome: 'stratosphere',
  index: 14,
  name: 'The Core',
  parSeconds: 192,
  gravityScale: 0.45,
  finale: true,
  wind: { strength: 2.4, gustPeriod: 5, fromY: 14 },
  bounds: { minX: -26, maxX: 26 },
  summit: { x: 0, y: 125.4 },
  checkpoints: [
    { x: 0, y: 44.0 },
    { x: 0, y: 84.0 },
    { x: 0, y: 108.0 },
  ],
  props: [
    ...shaft(11, 130),
    fuselage('L', 2.6, 11),
    ...orbiter(0, 14.5, 12),
    strobe('R', 27.0, 11, { ...BEAT, phase: 0.4 }),
    strobe('L', 38.0, 11, { ...BEAT, phase: 0.1 }),
    wing('R', 44.0, 11),
    drift(-3.6, 56.0, 7.2, 9, 0.6),
    turntable(0, 68.0, 8.0, 12),
    skin('L', 74.0, 11),
    skin('L', 79.5, 11),
    wing('R', 84.0, 11),
    strobe('L', 95.0, 11, { ...BEAT, phase: 0.5 }),
    wing('R', 108.0, 11),
    ...orbiter(0, 117.0, 12, 0.5, true),
    skin('R', 121.0, 11),
  ],
});

export const STRATOSPHERE_LEVELS: LevelDef[] = [
  jetWreck,
  satelliteGarden,
  dishArray,
  debrisField,
  frozenFuselage,
  orbitSpokes,
  coldFront,
  wreckAlley,
  dishGarden,
  solarStorm,
  strobeRun,
  skinDeep,
  stationSpin,
  theCore,
];
