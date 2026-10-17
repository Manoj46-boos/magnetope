import type { BiomeId, LevelDef, PropCycle, PropFollow, PropMotion, PropPlacement } from '@/sim/types';

type Opts = Partial<Omit<PropPlacement, 'kind' | 'x' | 'y'>>;

const place = (kind: string, x: number, y: number, opts: Opts = {}): PropPlacement => ({ kind, x, y, ...opts });

/** Short constructors so level files read as layouts rather than boilerplate. */
export const prop = {
  girder: (x: number, y: number, w = 5, o: Opts = {}) => place('girder', x, y, { w, ...o }),
  beam: (x: number, y: number, h = 4, o: Opts = {}) => place('beam', x, y, { h, ...o }),
  plate: (x: number, y: number, w = 8, o: Opts = {}) => place('plate', x, y, { w, ...o }),
  fridge: (x: number, y: number, o: Opts = {}) => place('fridge', x, y, o),
  washer: (x: number, y: number, o: Opts = {}) => place('washer', x, y, o),
  car: (x: number, y: number, o: Opts = {}) => place('car', x, y, o),
  locker: (x: number, y: number, o: Opts = {}) => place('locker', x, y, o),
  cabinet: (x: number, y: number, o: Opts = {}) => place('cabinet', x, y, o),
  sheet: (x: number, y: number, w = 3.2, o: Opts = {}) => place('sheet', x, y, { w, ...o }),
  can: (x: number, y: number, o: Opts = {}) => place('can', x, y, o),
  crate: (x: number, y: number, o: Opts = {}) => place('crate', x, y, o),
  plank: (x: number, y: number, w = 4, o: Opts = {}) => place('plank', x, y, { w, ...o }),
  tire: (x: number, y: number, o: Opts = {}) => place('tire', x, y, o),
  mattress: (x: number, y: number, w = 3.2, o: Opts = {}) => place('mattress', x, y, { w, ...o }),
  pane: (x: number, y: number, w = 2.6, o: Opts = {}) => place('pane', x, y, { w, ...o }),
  slab: (x: number, y: number, w = 12, o: Opts = {}) => place('slab', x, y, { w, ...o }),
  looseGirder: (x: number, y: number, o: Opts = {}) => place('loose-girder', x, y, o),
  barrel: (x: number, y: number, o: Opts = {}) => place('barrel', x, y, o),
  looseCrate: (x: number, y: number, o: Opts = {}) => place('loose-crate', x, y, o),
  drawerCabinet: (x: number, y: number, o: Opts = {}) => place('drawer-cabinet', x, y, o),
  boingWasher: (x: number, y: number, o: Opts = {}) => place('boing-washer', x, y, o),
  rustGrate: (x: number, y: number, w = 3.6, o: Opts = {}) => place('rust-grate', x, y, { w, ...o }),
  filingCabinet: (x: number, y: number, tag: string, o: Opts = {}) => place('filing-cabinet', x, y, { tag, ...o }),
  fileDrawer: (x: number, y: number, follow: PropFollow, o: Opts = {}) => place('file-drawer', x, y, { follow, ...o }),

  siding: (x: number, y: number, h = 4, o: Opts = {}) => place('siding', x, y, { h, ...o }),
  roof: (x: number, y: number, w = 6, o: Opts = {}) => place('roof', x, y, { w, ...o }),
  shed: (x: number, y: number, o: Opts = {}) => place('shed', x, y, o),
  gutter: (x: number, y: number, w = 4.2, o: Opts = {}) => place('gutter', x, y, { w, ...o }),
  mailbox: (x: number, y: number, o: Opts = {}) => place('mailbox', x, y, o),
  post: (x: number, y: number, h = 3, o: Opts = {}) => place('post', x, y, { h, ...o }),
  laundry: (x: number, y: number, w = 2.6, o: Opts = {}) => place('laundry', x, y, { w, ...o }),
  trampoline: (x: number, y: number, w = 3.6, o: Opts = {}) => place('trampoline', x, y, { w, ...o }),
  garageDoor: (x: number, y: number, o: Opts = {}) => place('garage-door', x, y, o),
  picket: (x: number, y: number, w = 4, o: Opts = {}) => place('picket', x, y, { w, ...o }),
  dish: (x: number, y: number, r = 1.5, o: Opts = {}) => place('dish', x, y, { r, ...o }),
  swingPlate: (x: number, y: number, hinge: { x: number; y: number }, o: Opts = {}) => place('swing-plate', x, y, { hinge, ...o }),
  awning: (x: number, y: number, w = 3.8, o: Opts = {}) => place('awning', x, y, { w, ...o }),

  scaffoldDeck: (x: number, y: number, w = 4.4, o: Opts = {}) => place('scaffold-deck', x, y, { w, ...o }),
  scaffoldPole: (x: number, y: number, h = 4.4, o: Opts = {}) => place('scaffold-pole', x, y, { h, ...o }),
  acUnit: (x: number, y: number, o: Opts = {}) => place('ac-unit', x, y, o),
  billboard: (x: number, y: number, o: Opts = {}) => place('billboard', x, y, o),
  neon: (x: number, y: number, cycle: PropCycle, o: Opts = {}) => place('neon-panel', x, y, { cycle, ...o }),
  washerRig: (x: number, y: number, motion: PropMotion, o: Opts = {}) => place('washer-rig', x, y, { motion, ...o }),
  craneHook: (x: number, y: number, motion: PropMotion, o: Opts = {}) => place('crane-hook', x, y, { motion, ...o }),
  counterweight: (x: number, y: number, motion: PropMotion, o: Opts = {}) => place('counterweight', x, y, { motion, ...o }),
  elevatorCab: (x: number, y: number, motion: PropMotion, o: Opts = {}) => place('elevator-cab', x, y, { motion, ...o }),
  facade: (x: number, y: number, h = 8, o: Opts = {}) => place('facade', x, y, { h, ...o }),
  callBox: (x: number, y: number, tag: string, o: Opts = {}) => place('call-box', x, y, { tag, ...o }),
  serviceLift: (x: number, y: number, follow: PropFollow, w = 3.2, o: Opts = {}) => place('service-lift', x, y, { follow, w, ...o }),
  drawbridge: (x: number, y: number, hinge: { x: number; y: number }, w = 6.2, o: Opts = {}) => place('drawbridge', x, y, { hinge, w, ...o }),
  cladding: (x: number, y: number, h = 4, o: Opts = {}) => place('cladding', x, y, { h, ...o }),

  slideRamp: (x: number, y: number, rot: number, w = 8, o: Opts = {}) => place('slide-ramp', x, y, { rot, w, ...o }),
  ferrisSpoke: (x: number, y: number, motion: PropMotion, o: Opts = {}) => place('ferris-spoke', x, y, { motion, ...o }),
  gondola: (x: number, y: number, motion: PropMotion, o: Opts = {}) => place('gondola', x, y, { motion, ...o }),
  wheelHub: (x: number, y: number, tag: string, o: Opts = {}) => place('wheel-hub', x, y, { hinge: { x, y }, tag, ...o }),
  wheelSpoke: (x: number, y: number, rot: number, w: number, weld: string, o: Opts = {}) => place('wheel-spoke', x, y, { rot, w, weld, ...o }),
  wheelCabin: (x: number, y: number, pin: { tag: string; at: { x: number; y: number } }, o: Opts = {}) => place('wheel-cabin', x, y, { pin, ...o }),
  drivenWheel,
  swingBeam: (x: number, y: number, w = 6, o: Opts = {}) => place('swing-beam', x, y, { w, ...o }),
  swingSeat: (x: number, y: number, hinge: { x: number; y: number }, o: Opts = {}) => place('swing-seat', x, y, { hinge, ...o }),
  seesaw: (x: number, y: number, o: Opts = {}) => place('seesaw', x, y, { hinge: { x, y }, ...o }),
  ballPit: (x: number, y: number, w = 5, o: Opts = {}) => place('ball-pit', x, y, { w, ...o }),
  monkeyBars: (x: number, y: number, w = 5.6, o: Opts = {}) => place('monkey-bars', x, y, { w, ...o }),
  carousel: (x: number, y: number, motion: PropMotion, o: Opts = {}) => place('carousel', x, y, { motion, ...o }),
  toyBlock: (x: number, y: number, o: Opts = {}) => place('toy-block', x, y, o),
  giantBall: (x: number, y: number, o: Opts = {}) => place('giant-ball', x, y, o),
  divingBoard: (x: number, y: number, hinge: { x: number; y: number }, w = 4.6, o: Opts = {}) => place('diving-board', x, y, { hinge, w, ...o }),
  bouncyCastle: (x: number, y: number, o: Opts = {}) => place('bouncy-castle', x, y, o),

  fuselage: (x: number, y: number, w = 8, o: Opts = {}) => place('fuselage', x, y, { w, ...o }),
  wing: (x: number, y: number, w = 7, o: Opts = {}) => place('wing', x, y, { w, ...o }),
  skin: (x: number, y: number, h = 4, o: Opts = {}) => place('fuselage-skin', x, y, { h, ...o }),
  solarPanel: (x: number, y: number, motion?: PropMotion, o: Opts = {}) => place('solar-panel', x, y, { motion, ...o }),
  satellite: (x: number, y: number, o: Opts = {}) => place('satellite', x, y, o),
  radioDish: (x: number, y: number, r = 2.2, o: Opts = {}) => place('radio-dish', x, y, { r, ...o }),
  mast: (x: number, y: number, h = 6, o: Opts = {}) => place('antenna-mast', x, y, { h, ...o }),
  truss: (x: number, y: number, w = 6, o: Opts = {}) => place('truss', x, y, { w, ...o }),
  debris: (x: number, y: number, motion?: PropMotion, o: Opts = {}) => place('debris', x, y, { motion, ...o }),
  cargoPod: (x: number, y: number, o: Opts = {}) => place('cargo-pod', x, y, o),
  strobe: (x: number, y: number, cycle: PropCycle, o: Opts = {}) => place('strobe-panel', x, y, { cycle, ...o }),
  thermalWall: (x: number, y: number, h = 8, o: Opts = {}) => place('thermal-wall', x, y, { h, ...o }),
  frostTruss: (x: number, y: number, w = 4.2, o: Opts = {}) => place('frost-truss', x, y, { w, ...o }),
};

const WHEEL_HUB_RADIUS = 0.9;
const CABIN_DROP = 1.7;

/**
 * Ferris wheel that nothing drives: a hub on a bearing, six spokes bolted to it and a cabin hung
 * under every tip. It stands still until MAGNO leans on it, hauls on it or repels off it, then
 * turns on whatever he gave it and coasts to a stop.
 */
function drivenWheel(cx: number, cy: number, tag: string, reach = 4.6): PropPlacement[] {
  const parts: PropPlacement[] = [prop.wheelHub(cx, cy, tag, { r: WHEEL_HUB_RADIUS })];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const mid = (reach + WHEEL_HUB_RADIUS) / 2;
    const spokeTag = `${tag}-${i}`;
    const tip = { x: cx + reach * cos, y: cy + reach * sin };
    parts.push(prop.wheelSpoke(cx + mid * cos, cy + mid * sin, a, reach - WHEEL_HUB_RADIUS, tag, { tag: spokeTag }));
    parts.push(prop.wheelCabin(tip.x, tip.y - CABIN_DROP, { tag: spokeTag, at: tip }));
  }
  return parts;
}

const BIOME_RAMP: Readonly<Record<BiomeId, readonly [number, number]>> = {
  scrapyard: [0.06, 0.24],
  suburbia: [0.18, 0.36],
  metropolis: [0.3, 0.48],
  playground: [0.42, 0.6],
  stratosphere: [0.54, 0.68],
};

/**
 * Median fall rate a level is designed for (PRD 5.4): 6% at the first level to 68% at the last, rising
 * through each biome's fourteen levels, with every new biome opening six points below the last one closed.
 */
export function difficultyTarget(biome: BiomeId, index: number): number {
  const [start, end] = BIOME_RAMP[biome];
  const step = biome === 'scrapyard' ? index : index - 1;
  return Math.round((start + ((end - start) * Math.min(Math.max(step, 0), 13)) / 13) * 100) / 100;
}

interface LevelSpec {
  id: string;
  biome: BiomeId;
  index: number;
  name: string;
  parSeconds: number;
  summit: { x: number; y: number; radius?: number };
  checkpoints?: Array<{ x: number; y: number }>;
  spawn?: { x: number; y: number };
  bounds?: { minX: number; maxX: number };
  props: PropPlacement[];
  gravityScale?: number;
  wind?: LevelDef['wind'];
  finale?: boolean;
  guides?: LevelDef['guides'];
}

/** Fills the fields every level shares so each file only states what is unique to it. */
export function defineLevel(spec: LevelSpec): LevelDef {
  const lowest = spec.props.reduce((m, p) => Math.min(m, p.y), 0);
  return {
    id: spec.id,
    biome: spec.biome,
    index: spec.index,
    name: spec.name,
    parSeconds: spec.parSeconds,
    spawn: spec.spawn ?? { x: 0, y: 0 },
    summit: { x: spec.summit.x, y: spec.summit.y, radius: spec.summit.radius ?? 1.5 },
    checkpoints: spec.checkpoints ?? [],
    killY: lowest - 40,
    bounds: spec.bounds ?? { minX: -20, maxX: 20 },
    fallRateTarget: difficultyTarget(spec.biome, spec.index),
    props: spec.props,
    gravityScale: spec.gravityScale,
    wind: spec.wind,
    finale: spec.finale,
    guides: spec.guides,
  };
}
