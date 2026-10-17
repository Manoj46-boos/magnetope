import { GeometryBuilder, rgb } from './geometry';
import { HALF_D, PROP_DEPTH, darker, hsl, lighter, type KitArgs, type KitBuilder, type PropParts } from './prop-kit';

const NEON = hsl(315, 1, 0.62);
const NEON_CORE = hsl(315, 0.9, 0.86);
const WARM_WINDOW = hsl(44, 0.85, 0.68);
const COOL_WINDOW = hsl(196, 0.7, 0.62);
const HAZARD = hsl(46, 0.95, 0.56);

/** Alternating hazard chevrons along a strip, used on rigs and counterweights. */
function hazard(parts: PropParts, x0: number, x1: number, y: number, h: number, z: number): void {
  const step = h * 1.5;
  let flip = false;
  for (let x = x0; x < x1 - step * 0.5; x += step) {
    parts.body.box(x + step / 2, y, z, step * 0.9, h, 0.02, rgb(flip ? hsl(220, 0.1, 0.12) : HAZARD));
    flip = !flip;
  }
}

/** Tube-and-clamp scaffold board: galvanised planks with end brackets. */
function scaffoldDeck({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const zinc = lighter(base, 0.28);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.86, rgb(zinc));
  const joint = rgb(darker(zinc, 0.72));
  for (let x = -w / 2 + 0.55; x < w / 2; x += 0.55) b.box(x, 0, HALF_D * 0.86 + 0.008, 0.03, h, 0.016, joint);
  b.box(0, h / 2 - 0.03, 0, w, 0.06, PROP_DEPTH * 0.9, rgb(lighter(zinc, 0.2)));
  for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) b.box(x, -h / 2 - 0.05, 0, 0.16, 0.1, PROP_DEPTH * 0.7, rgb(darker(base, 0.55)));
}

/** Standard: a steel tube with clamp rings every metre. */
function scaffoldPole({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const tube = lighter(base, 0.22);
  b.box(0, 0, 0, w * 0.7, h, PROP_DEPTH * 0.4, rgb(tube));
  b.box(-w * 0.18, 0, PROP_DEPTH * 0.2 + 0.006, w * 0.14, h, 0.012, rgb(lighter(tube, 0.3)));
  const clamp = rgb(darker(base, 0.55));
  for (let y = -h / 2 + 0.6; y < h / 2 - 0.2; y += 1.1) b.box(0, y, 0, w * 1.2, 0.16, PROP_DEPTH * 0.5, clamp);
}

/** Rooftop air-conditioner: louvres on one side, a fan grille on the other. */
function acUnit({ parts, w, h, base, rng }: KitArgs): void {
  const b = parts.body;
  const shell = hsl(rng.range(205, 225), 0.1, 0.74);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.92, rgb(shell));
  const slat = rgb(darker(shell, 0.6));
  for (let i = 0; i < 6; i++) b.box(-w * 0.24, -h * 0.34 + i * h * 0.13, HALF_D * 0.92 + 0.01, w * 0.42, 0.05, 0.02, slat);
  b.ring(w * 0.24, 0, HALF_D * 0.92 + 0.014, h * 0.38, h * 0.3, 0.03, 14, rgb(darker(shell, 0.5)));
  b.disc(w * 0.24, 0, HALF_D * 0.92 + 0.02, h * 0.07, 0.04, 8, rgb(darker(shell, 0.45)));
  for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const spoke = new GeometryBuilder();
    spoke.box(0, 0, 0, h * 0.6, 0.035, 0.02, rgb(darker(shell, 0.5)));
    b.append(spoke, w * 0.24, 0, a);
  }
  b.box(0, h / 2 - 0.05, 0, w * 1.04, 0.1, PROP_DEPTH * 0.96, rgb(darker(base, 0.9)));
  b.box(-w / 2 - 0.08, -h * 0.2, 0, 0.16, 0.2, 0.3, rgb(darker(shell, 0.7)));
}

/** Advertising board: dark frame, a sunset panel and neon lettering on the glow channel. */
function billboard({ parts, w, h, palette }: KitArgs): void {
  const b = parts.body;
  const frame = hsl(palette.dominant.h, 0.2, 0.18);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.34, rgb(frame));
  const inset = 0.2;
  const iw = w - inset * 2;
  const ih = h - inset * 2;
  const z = PROP_DEPTH * 0.17 + 0.012;
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    b.box(0, ih / 2 - (ih * (i + 0.5)) / bands, z, iw, ih / bands + 0.01, 0.014, rgb(hsl(262 + t * 70, 0.6, 0.2 + t * 0.16)));
  }
  const g = parts.glow;
  g.box(-iw * 0.12, ih * 0.14, z + 0.03, iw * 0.56, 0.2, 0.02, rgb(NEON));
  g.box(-iw * 0.12, ih * 0.14, z + 0.05, iw * 0.5, 0.07, 0.02, rgb(NEON_CORE));
  g.box(-iw * 0.2, -ih * 0.12, z + 0.03, iw * 0.38, 0.14, 0.02, rgb(COOL_WINDOW));
  g.disc(iw * 0.32, -ih * 0.02, z + 0.03, ih * 0.2, 0.02, 14, rgb(NEON));
  g.disc(iw * 0.32, -ih * 0.02, z + 0.05, ih * 0.11, 0.02, 14, rgb(NEON_CORE));
  b.box(0, -h / 2 - 0.05, -0.1, 0.5, 0.1, 0.4, rgb(darker(frame, 0.7)));
}

/** Flickering sign housing. The tube lives on the glow channel so the scene can pulse it with the cycle. */
function neonPanel({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const housing = hsl(222, 0.18, 0.2);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.6, rgb(housing));
  b.box(0, h / 2 - 0.03, 0, w + 0.06, 0.06, PROP_DEPTH * 0.66, rgb(darker(base, 0.7)));
  b.box(0, -h / 2 + 0.03, 0, w + 0.06, 0.06, PROP_DEPTH * 0.66, rgb(darker(base, 0.7)));
  const z = PROP_DEPTH * 0.3 + 0.012;
  parts.glow.box(0, 0, z, w - 0.36, h * 0.34, 0.03, rgb(NEON));
  parts.glow.box(0, 0, z + 0.025, w - 0.5, h * 0.12, 0.02, rgb(NEON_CORE));
  for (const x of [-w / 2 + 0.14, w / 2 - 0.14]) parts.glow.box(x, 0, z, 0.1, h * 0.7, 0.03, rgb(NEON));
}

/** Window-washer gondola: hazard-striped deck, hanger brackets and a motor housing. */
function washerRig({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const deck = lighter(base, 0.12);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.8, rgb(deck));
  hazard(parts, -w / 2 + 0.05, w / 2 - 0.05, -h / 2 + 0.09, 0.12, HALF_D * 0.8 + 0.01);
  b.box(0, h / 2 - 0.04, 0, w, 0.08, PROP_DEPTH * 0.84, rgb(lighter(deck, 0.25)));
  for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) {
    b.box(x, h / 2 + 0.2, 0, 0.14, 0.4, 0.2, rgb(darker(base, 0.55)));
    b.disc(x, h / 2 + 0.42, 0, 0.12, 0.12, 8, rgb(darker(base, 0.4)));
  }
  b.box(0, h / 2 + 0.16, 0, 0.9, 0.32, 0.5, rgb(hsl(46, 0.8, 0.5)));
}

/** Crane hook block: a yellow sheave housing over a heavy hook. The cable is drawn by the scene. */
function craneHook({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const shell = HAZARD;
  b.box(0, h * 0.16, 0, w, h * 0.68, PROP_DEPTH * 0.7, rgb(shell));
  hazard(parts, -w / 2 + 0.05, w / 2 - 0.05, h * 0.36, 0.14, PROP_DEPTH * 0.35 + 0.01);
  b.disc(0, h * 0.18, PROP_DEPTH * 0.35 + 0.03, h * 0.2, 0.05, 10, rgb(darker(base, 0.5)));
  const iron = rgb(darker(base, 0.45));
  b.box(0, -h * 0.28, 0, w * 0.2, h * 0.3, PROP_DEPTH * 0.34, iron);
  b.ring(0, -h * 0.4, 0, w * 0.26, w * 0.14, PROP_DEPTH * 0.3, 10, iron);
  b.box(0, h / 2, 0, w * 0.26, 0.14, PROP_DEPTH * 0.4, iron);
}

/** Elevator counterweight: stacked cast slabs with a lifting eye. */
function counterweight({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const cast = darker(base, 0.8);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.86, rgb(cast));
  const seam = rgb(darker(cast, 0.5));
  for (let i = 1; i < 4; i++) b.box(0, -h / 2 + (h * i) / 4, HALF_D * 0.86 + 0.01, w, 0.05, 0.02, seam);
  hazard(parts, -w / 2 + 0.05, w / 2 - 0.05, h / 2 - 0.12, 0.14, HALF_D * 0.86 + 0.02);
  b.ring(0, h / 2 + 0.16, 0, 0.2, 0.1, PROP_DEPTH * 0.3, 8, rgb(darker(base, 0.45)));
  b.box(0, 0, HALF_D * 0.86 + 0.02, w * 0.3, h * 0.2, 0.02, rgb(lighter(cast, 0.2)));
}

/** Elevator cab floor: a stout deck with chamfered ends and a light strip. */
function elevatorCab({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const floor = lighter(base, 0.18);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.88, rgb(floor));
  b.taperedBox(-w / 2 - 0.1, 0, 0, h * 0.9, h * 0.4, h, PROP_DEPTH * 0.88, rgb(darker(floor, 0.8)));
  b.taperedBox(w / 2 + 0.1, 0, 0, h * 0.9, h * 0.4, h, PROP_DEPTH * 0.88, rgb(darker(floor, 0.8)));
  b.box(0, h / 2 - 0.04, 0, w, 0.08, PROP_DEPTH * 0.92, rgb(lighter(floor, 0.3)));
  parts.glow.box(0, -h / 2 + 0.07, HALF_D * 0.88 + 0.01, w * 0.8, 0.06, 0.02, rgb(COOL_WINDOW));
}

/** Office-block wall: window grid with a share of lit rooms on the glow channel. */
function facade({ parts, w, h, base, rng }: KitArgs): void {
  const b = parts.body;
  const wall = hsl(rng.range(214, 232), 0.18, 0.3);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.96, rgb(wall));
  const z = HALF_D * 0.96 + 0.01;
  const dark = rgb(hsl(222, 0.3, 0.12));
  const floorH = 1.6;
  const colW = 1.5;
  const rows = Math.max(1, Math.floor((h - 0.4) / floorH));
  const cols = Math.max(1, Math.floor((w - 0.2) / colW));
  for (let r = 0; r < rows; r++) {
    const y = -h / 2 + 0.5 + r * floorH + floorH * 0.3;
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + ((w - cols * colW) / 2 + colW * (c + 0.5));
      const ww = colW * 0.62;
      const wh = floorH * 0.52;
      const lit = rng.next() < 0.3;
      const pane = lit ? rgb(rng.next() < 0.75 ? WARM_WINDOW : COOL_WINDOW) : dark;
      const target = lit ? parts.glow : b;
      target.quad([x - ww / 2, y - wh / 2, z], [x + ww / 2, y - wh / 2, z], [x + ww / 2, y + wh / 2, z], [x - ww / 2, y + wh / 2, z], pane);
    }
    b.box(0, -h / 2 + 0.5 + r * floorH - 0.02, z, w, 0.07, 0.02, rgb(darker(wall, 0.7)));
  }
  b.box(0, h / 2 - 0.08, 0, w * 1.03, 0.16, PROP_DEPTH, rgb(darker(base, 0.9)));
}

/** Corrugated aluminium cladding that is already peeling off. */
function cladding({ parts, w, h, rng }: KitArgs): void {
  const b = parts.body;
  const alu = hsl(205, 0.1, 0.6);
  const segments = Math.max(3, Math.round(h / 0.55));
  const sh = h / segments;
  for (let i = 0; i < segments; i++) {
    const tone = darker(alu, 0.82 + rng.next() * 0.3);
    if (rng.next() < 0.25) tone.lerp(hsl(20, 0.5, 0.4), 0.5);
    b.box(0, -h / 2 + sh * (i + 0.5), 0, w, sh * 1.01, PROP_DEPTH * 0.6, rgb(tone));
  }
  b.displace((_x, y, z) => [Math.sin(y * 3.4 + z) * 0.02, 0, 0]);
  for (let y = -h / 2 + 0.5; y < h / 2 - 0.2; y += 0.9) b.disc(0, y, PROP_DEPTH * 0.3 + 0.02, 0.05, 0.04, 6, rgb(darker(alu, 0.5)));
}

export const METROPOLIS_KIT: Readonly<Record<string, KitBuilder>> = {
  'scaffold-deck': scaffoldDeck,
  'scaffold-pole': scaffoldPole,
  'ac-unit': acUnit,
  billboard,
  'neon-panel': neonPanel,
  'washer-rig': washerRig,
  'crane-hook': craneHook,
  counterweight,
  'elevator-cab': elevatorCab,
  facade,
  cladding,
};
