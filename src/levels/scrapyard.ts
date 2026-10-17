import type { LevelDef, PropPlacement } from '@/sim/types';
import { Rng } from '@/core/rng';
import { defineLevel, prop as p } from './author';

type Side = 'L' | 'R';
type FloorKind = 'plank' | 'tire' | 'sheet' | 'mattress' | 'pane' | 'girder' | 'grate';

interface Floor {
  y: number;
  side: Side;
  /** Length of the floor measured in from its wall. */
  len: number;
  kind?: FloorKind;
}

interface Shaft {
  /** Distance from the centre line to each wall of stacked junk. */
  halfWidth: number;
  seed: number;
  /** Height of the wooden layer between steel pieces. Taller layers force a bigger snap hop. */
  seam?: number;
  /** Height of the one wooden layer that no tap-flip can bridge. Defaults to LEAP_SEAM; 0 keeps every layer at `seam`. */
  leap?: number;
  height: number;
  floors: Floor[];
  /** Plates, vehicles and extras that decorate or complicate the climb. */
  extras?: PropPlacement[];
}

const WALL_WIDTH = 1.7;
/** The seam a player must charge a launch to cross: a bare tap carries 4.7 m, a short charge about 12. */
const LEAP_SEAM = 6;
/** Which seam, counting from the bottom, is the leap. */
const LEAP_AT = 1;

type SteelPiece = 'fridge' | 'washer' | 'locker' | 'cabinet';
const STEEL: SteelPiece[] = ['fridge', 'locker', 'washer', 'cabinet', 'fridge'];

/**
 * One wall of stacked junk. Steel pieces alternate with wooden layers, so a
 * player can crawl up a single appliance but must launch and snap to reach the
 * next one: the wall never becomes a free ladder.
 */
function junkWall(x: number, height: number, rng: Rng, seam: number, leap = LEAP_SEAM): PropPlacement[] {
  const props: PropPlacement[] = [];
  let y = 0;
  let seams = 0;
  let step = Math.floor(rng.range(0, STEEL.length));
  while (y < height) {
    const kind = STEEL[step % STEEL.length]!;
    const piece = { fridge: p.fridge, washer: p.washer, locker: p.locker, cabinet: p.cabinet }[kind];
    const h = kind === 'fridge' ? 3.7 : kind === 'washer' ? 2.3 : kind === 'locker' ? 3.2 : 2.4;
    const offset = rng.range(-0.18, 0.18);
    props.push(piece(x + offset, y + h / 2));
    y += h;
    if (y >= height) break;
    const seamHeight = leap > 0 && seams === LEAP_AT ? leap : seam * rng.range(0.9, 1.15);
    seams++;
    props.push(p.crate(x + rng.range(-0.15, 0.15), y + seamHeight / 2, { w: 2.1, h: seamHeight }));
    y += seamHeight;
    step++;
  }
  return props;
}

/**
 * A climb built as a shaft: two walls of stacked junk with floors that jut in
 * from alternating sides. What a floor is made of decides how it plays: wood
 * blocks, rubber bounces, sheet metal gives way, glass shatters.
 */
function shaft(spec: Shaft): PropPlacement[] {
  const rng = new Rng(spec.seed);
  const inner = spec.halfWidth - WALL_WIDTH / 2;
  const props: PropPlacement[] = [
    p.plate(0, -0.4, spec.halfWidth * 2 + 6),
    ...junkWall(-spec.halfWidth, spec.height, rng, spec.seam ?? 1.5, spec.leap ?? LEAP_SEAM),
    ...junkWall(spec.halfWidth, spec.height, rng, spec.seam ?? 1.5, spec.leap ?? LEAP_SEAM),
  ];
  for (const floor of spec.floors) {
    const x = (floor.side === 'L' ? -1 : 1) * (inner - floor.len / 2 + 0.5);
    switch (floor.kind ?? 'plank') {
      case 'plank':
        props.push(p.plank(x, floor.y, floor.len + 1));
        break;
      case 'tire': {
        const count = Math.max(1, Math.round(floor.len / 1.9));
        for (let i = 0; i < count; i++) {
          const tx = (floor.side === 'L' ? -1 : 1) * (inner - 0.95 - i * 1.9);
          props.push(p.tire(tx, floor.y, { r: 0.95 }));
        }
        break;
      }
      case 'sheet':
        props.push(p.sheet(x, floor.y, floor.len + 1));
        break;
      case 'mattress':
        props.push(p.mattress(x, floor.y, floor.len + 1));
        break;
      case 'pane':
        props.push(p.pane(x, floor.y, floor.len + 1));
        break;
      case 'girder':
        props.push(p.girder(x, floor.y, floor.len + 1));
        break;
      case 'grate':
        props.push(p.rustGrate(x, floor.y, floor.len + 1));
        break;
    }
  }
  return [...props, ...(spec.extras ?? [])];
}

/** Session zero: a short shaft taught by gesture alone. Wide gaps keep it forgiving. */
const tutorial = defineLevel({
  id: 'scrapyard-00',
  biome: 'scrapyard',
  index: 0,
  name: 'First Steps',
  parSeconds: 40,
  summit: { x: -0.4, y: 14.6, radius: 2.1 },
  props: shaft({
    leap: 0,
    seed: 20,
    seam: 1.0,
    halfWidth: 5.6,
    height: 17,
    floors: [
      { y: 4.2, side: 'L', len: 5.0 },
      { y: 8.2, side: 'R', len: 5.0 },
      { y: 12.2, side: 'L', len: 5.0 },
    ],
  }),
  guides: [
    { x: -4.7, y: 1.6 },
    { x: 4.7, y: 2.6 },
    { x: -4.7, y: 6.0 },
  ],
});

const chimney = defineLevel({
  id: 'scrapyard-01',
  biome: 'scrapyard',
  index: 1,
  name: 'Chimney',
  parSeconds: 55,
  summit: { x: 0.2, y: 20.8 },
  checkpoints: [{ x: -5, y: 9 }],
  props: shaft({
    leap: 0,
    seed: 37,
    halfWidth: 5.0,
    height: 23,
    floors: [
      { y: 4.4, side: 'L', len: 4.0 },
      { y: 8.8, side: 'R', len: 4.0 },
      { y: 13.2, side: 'L', len: 4.0 },
      { y: 17.6, side: 'R', len: 4.0 },
    ],
  }),
});

const tires = defineLevel({
  id: 'scrapyard-02',
  biome: 'scrapyard',
  index: 2,
  name: 'Tire Pile',
  parSeconds: 60,
  summit: { x: -0.4, y: 23.4 },
  checkpoints: [{ x: 0, y: 10 }],
  props: shaft({
    leap: 0,
    seed: 54,
    halfWidth: 5.2,
    height: 26,
    floors: [
      { y: 4.6, side: 'R', len: 5.7, kind: 'tire' },
      { y: 9.6, side: 'L', len: 5.7, kind: 'tire' },
      { y: 14.6, side: 'R', len: 5.7, kind: 'tire' },
      { y: 19.6, side: 'L', len: 5.7, kind: 'tire' },
    ],
  }),
});

const openAir = defineLevel({
  id: 'scrapyard-03',
  biome: 'scrapyard',
  index: 3,
  name: 'Long Jump',
  parSeconds: 60,
  summit: { x: 7.8, y: 22.4 },
  checkpoints: [{ x: 3.5, y: 9.2 }],
  bounds: { minX: -18, maxX: 28 },
  props: [
    p.plate(2.6, -0.4, 20),
    ...junkWall(-2.6, 12.4, new Rng(301), 1.4),
    ...junkWall(7.8, 20.6, new Rng(302), 1.4),
    p.plank(2.6, 9.0, 4.0),
    p.plank(2.6, 15.5, 4.0),
  ],
});

const tin = defineLevel({
  id: 'scrapyard-04',
  biome: 'scrapyard',
  index: 4,
  name: 'Tin Roof',
  parSeconds: 66,
  summit: { x: -0.4, y: 24.6 },
  checkpoints: [{ x: -5, y: 11.3 }],
  props: shaft({
    seed: 71,
    halfWidth: 5.2,
    height: 28,
    floors: [
      { y: 4.8, side: 'L', len: 5.8 },
      { y: 9.8, side: 'R', len: 4.6, kind: 'sheet' },
      { y: 14.2, side: 'L', len: 5.8 },
      { y: 19.2, side: 'R', len: 4.6, kind: 'sheet' },
    ],
    extras: [p.sheet(-4.4, 12, 3.4, { rot: Math.PI / 2 }), p.sheet(4.4, 21.6, 3.4, { rot: Math.PI / 2 }), p.boingWasher(3.1, 1.15)],
  }),
});

const glassHouse = defineLevel({
  id: 'scrapyard-05',
  biome: 'scrapyard',
  index: 5,
  name: 'Glasshouse',
  parSeconds: 70,
  summit: { x: 0, y: 27 },
  checkpoints: [{ x: 6.3, y: 11.3 }],
  props: shaft({
    leap: 5.2,
    seed: 88,
    halfWidth: 5.4,
    height: 30,
    floors: [
      { y: 5.0, side: 'R', len: 6.0 },
      { y: 10.0, side: 'L', len: 6.0, kind: 'mattress' },
      { y: 15.0, side: 'R', len: 6.0 },
      { y: 20.0, side: 'L', len: 6.0 },
      { y: 24.2, side: 'R', len: 6.0 },
    ],
    extras: [p.pane(-3.4, 12.6, 2.6)],
  }),
});

const crane = defineLevel({
  id: 'scrapyard-06',
  biome: 'scrapyard',
  index: 6,
  name: 'Crusher Row',
  parSeconds: 75,
  summit: { x: 0.6, y: 31 },
  checkpoints: [{ x: 0, y: 10.4 }, { x: 6.3, y: 21.8 }],
  props: shaft({
    leap: 0,
    seed: 105,
    halfWidth: 6.0,
    height: 34,
    floors: [
      { y: 4.6, side: 'L', len: 5.6 },
      { y: 9.2, side: 'R', len: 5.6, kind: 'tire' },
      { y: 13.8, side: 'L', len: 5.6 },
      { y: 18.4, side: 'R', len: 5.0, kind: 'sheet' },
      { y: 23.0, side: 'L', len: 5.6, kind: 'tire' },
      { y: 27.4, side: 'R', len: 5.6 },
    ],
    extras: [p.car(-3.4, 0.8), p.crate(4.0, 1.0)],
  }),
});


/** Two fixed crates with a loose girder laid across them: a see-saw board that tips under whoever lands on an end. */
function board(x: number, y: number, len = 4): PropPlacement[] {
  return [p.crate(x - 0.9, y - 1.2), p.crate(x + 0.9, y - 1.2), p.looseGirder(x, y, { w: len })];
}

const looseEnds = defineLevel({
  id: 'scrapyard-07',
  biome: 'scrapyard',
  index: 7,
  name: 'Loose Ends',
  parSeconds: 62,
  summit: { x: 0, y: 28.6 },
  checkpoints: [{ x: 0, y: 14.2 }],
  props: [
    ...shaft({
      seed: 121,
      halfWidth: 5.4,
      height: 32,
      floors: [
        { y: 4.8, side: 'L', len: 5.6 },
      ],
    }),
    ...board(2.4, 9.6),
    ...board(-2.4, 14.4),
    ...board(2.4, 19.2),
    ...board(-2.4, 24.0),
  ],
});

const barrelRun = defineLevel({
  id: 'scrapyard-08',
  biome: 'scrapyard',
  index: 8,
  name: 'Barrel Run',
  parSeconds: 60,
  summit: { x: 0, y: 31 },
  checkpoints: [{ x: 0, y: 15.4 }],
  props: shaft({
    seed: 133,
    halfWidth: 5.6,
    height: 34,
    floors: [
      { y: 4.8, side: 'R', len: 5.8 },
      { y: 9.8, side: 'L', len: 5.8, kind: 'grate' },
      { y: 14.8, side: 'R', len: 5.8 },
      { y: 19.8, side: 'L', len: 5.8, kind: 'grate' },
      { y: 24.8, side: 'R', len: 5.8 },
    ],
    extras: [p.barrel(-0.6, 5.8), p.barrel(0.6, 10.8), p.barrel(-0.6, 15.8), p.barrel(0.6, 20.8)],
  }),
});

/** Two filing cabinets stacked against a wall; clinging to either one pulls out a drawer's worth of shelf toward the middle. */
function fileStack(x: number, tag: string): PropPlacement[] {
  const pull = { tag, dx: -1.5, dy: 0, extendMs: 650, retractMs: 1300, holdMs: 2600 };
  return [
    p.filingCabinet(x, 1.35, tag),
    p.filingCabinet(x, 4.05, tag),
    p.fileDrawer(x, 1.1, pull),
    p.fileDrawer(x, 3.8, pull),
  ];
}

const drawerTower = defineLevel({
  id: 'scrapyard-09',
  biome: 'scrapyard',
  index: 9,
  name: 'Drawer Tower',
  parSeconds: 84,
  summit: { x: 0, y: 32.4 },
  checkpoints: [{ x: 0, y: 16.4 }],
  props: [
    ...shaft({
      seed: 147,
      halfWidth: 5.4,
      height: 36,
      floors: [
        { y: 5.0, side: 'L', len: 5.6 },
        { y: 15.8, side: 'L', len: 5.6 },
        { y: 26.6, side: 'L', len: 5.6 },
      ],
    }),
    p.drawerCabinet(0.2, 6.05),
    p.drawerCabinet(0.2, 7.85),
    p.drawerCabinet(0.2, 16.85),
    p.drawerCabinet(0.2, 18.65),
    p.drawerCabinet(0.2, 27.65),
    p.drawerCabinet(0.2, 29.45),
    ...fileStack(3.5, 'tower-files'),
  ],
});

const crateCascade = defineLevel({
  id: 'scrapyard-10',
  biome: 'scrapyard',
  index: 10,
  name: 'Crate Cascade',
  parSeconds: 74,
  summit: { x: 0, y: 33.8 },
  checkpoints: [{ x: -6.5, y: 16.9 }],
  props: shaft({
    seed: 159,
    halfWidth: 5.6,
    height: 36,
    floors: [
      { y: 5.2, side: 'R', len: 5.6 },
      { y: 10.6, side: 'L', len: 4.6, kind: 'sheet' },
      { y: 16.0, side: 'R', len: 5.6 },
      { y: 21.4, side: 'L', len: 4.6, kind: 'sheet' },
      { y: 26.8, side: 'R', len: 5.6 },
    ],
    extras: [p.looseCrate(-1.2, 0.7), p.looseCrate(0.4, 0.7), p.looseCrate(-0.4, 2.1), p.looseCrate(-2.4, 11.4), p.looseCrate(1.8, 22.2)],
  }),
});

const girderYard = defineLevel({
  id: 'scrapyard-11',
  biome: 'scrapyard',
  index: 11,
  name: 'Girder Yard',
  parSeconds: 64,
  summit: { x: 10.4, y: 25.4 },
  checkpoints: [{ x: -1.5, y: 12.5 }],
  bounds: { minX: -18, maxX: 28 },
  props: [
    p.plate(3, -0.4, 22),
    ...junkWall(-3.2, 14, new Rng(401), 1.4),
    ...junkWall(10.4, 23.4, new Rng(402), 1.4),
    p.looseGirder(3.4, 9.4, { w: 4.4 }),
    p.crate(1.6, 8.0),
    p.crate(5.4, 8.0),
    p.plank(-1.0, 12.4, 3.0),
    p.looseGirder(3.6, 17.6, { w: 4.4 }),
    p.crate(1.8, 16.2),
    p.crate(5.6, 16.2),
  ],
});

const compactor = defineLevel({
  id: 'scrapyard-12',
  biome: 'scrapyard',
  index: 12,
  name: 'Compactor',
  parSeconds: 74,
  summit: { x: 0, y: 37.6 },
  checkpoints: [{ x: 0, y: 13.4 }, { x: 3.3, y: 27.4 }],
  props: shaft({
    seed: 205,
    halfWidth: 5.4,
    height: 40,
    floors: [
      { y: 4.4, side: 'L', len: 5.6 },
      { y: 8.8, side: 'R', len: 4.6, kind: 'sheet' },
      { y: 13.4, side: 'L', len: 5.6 },
      { y: 18.0, side: 'R', len: 5.6 },
      { y: 22.6, side: 'L', len: 4.6, kind: 'sheet' },
      { y: 27.2, side: 'R', len: 5.6 },
      { y: 31.8, side: 'L', len: 5.6, kind: 'mattress' },
    ],
    extras: [p.sheet(3.8, 29.6, 3.2, { rot: Math.PI / 2 })],
  }),
});

const theHeap = defineLevel({
  id: 'scrapyard-13',
  biome: 'scrapyard',
  index: 13,
  name: 'The Heap',
  parSeconds: 120,
  summit: { x: 0, y: 42.4 },
  checkpoints: [
    { x: 0, y: 14.8 },
    { x: 0, y: 29.0 },
  ],
  props: shaft({
    seed: 183,
    halfWidth: 6.0,
    height: 46,
    floors: [
      { y: 4.8, side: 'R', len: 6.0 },
      { y: 9.8, side: 'L', len: 5.0, kind: 'sheet' },
      { y: 14.8, side: 'R', len: 6.0 },
      { y: 19.6, side: 'L', len: 6.0, kind: 'tire' },
      { y: 24.4, side: 'R', len: 6.0, kind: 'mattress' },
      { y: 29.2, side: 'L', len: 6.0 },
      { y: 34.0, side: 'R', len: 5.0, kind: 'sheet' },
      { y: 38.4, side: 'L', len: 6.0 },
    ],
    extras: [p.looseGirder(1.6, 5.4, { w: 3.6 }), p.barrel(-1.0, 10.9), p.drawerCabinet(0.8, 15.8), p.looseGirder(-1.6, 30.0, { w: 3.6 }), p.pane(2.6, 21.6, 2.6)],
  }),
});

export const SCRAPYARD_LEVELS: LevelDef[] = [
  tutorial,
  chimney,
  tires,
  openAir,
  tin,
  glassHouse,
  crane,
  looseEnds,
  barrelRun,
  drawerTower,
  crateCascade,
  girderYard,
  compactor,
  theHeap,
];
