import { GeometryBuilder, rgb } from './geometry';
import { HALF_D, PROP_DEPTH, boltRow, darker, hsl, lighter, type KitArgs, type KitBuilder } from './prop-kit';

const HAZARD = hsl(46, 0.9, 0.55);
const HAZARD_DARK = hsl(220, 0.12, 0.14);
const CHROME = hsl(210, 0.08, 0.72);

/** Washing machine on springs: a mustard cabinet, a deep porthole and a chrome zig-zag spring under the whole thing, so it looks ready to bounce. */
function boingWasher({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const coil = h * 0.22;
  const shell = hsl(46, 0.78, 0.62);
  const bodyH = h - coil;
  const midY = h / 2 - bodyH / 2;
  const front = HALF_D * 0.92;
  b.box(0, midY, 0, w, bodyH, PROP_DEPTH * 0.92, rgb(shell));
  b.box(0, h / 2 - 0.08, 0, w * 1.02, 0.16, PROP_DEPTH * 0.96, rgb(lighter(shell, 0.3)));
  b.disc(0, midY - 0.05, front + 0.02, w * 0.3, 0.06, 14, rgb(darker(shell, 0.5)));
  b.disc(0, midY - 0.05, front + 0.05, w * 0.23, 0.05, 14, rgb(hsl(205, 0.4, 0.28)));
  b.disc(-w * 0.07, midY + 0.03, front + 0.08, w * 0.07, 0.02, 6, rgb(hsl(205, 0.5, 0.6)));
  b.box(-w * 0.24, h / 2 - 0.28, front + 0.03, w * 0.28, 0.16, 0.05, rgb(lighter(shell, 0.45)));
  b.disc(w * 0.28, h / 2 - 0.28, front + 0.05, 0.1, 0.05, 8, rgb(darker(shell, 0.45)));
  b.box(0, -h / 2 + coil / 2, 0, w, coil, PROP_DEPTH * 0.6, rgb(darker(base, 0.45)));
  const turns = 6;
  const run = w / turns;
  const slant = Math.atan2(coil * 0.86, run * 0.7);
  const bar = Math.hypot(coil * 0.86, run * 0.7);
  for (let i = 0; i < turns; i++) {
    const strut = new GeometryBuilder();
    strut.box(0, 0, HALF_D * 0.6 + 0.05, bar, 0.09, 0.1, rgb(CHROME));
    parts.body.append(strut, -w / 2 + run * (i + 0.5), -h / 2 + coil / 2, i % 2 ? slant : -slant);
  }
  b.box(0, -h / 2 + 0.03, 0, w * 1.04, 0.06, PROP_DEPTH * 0.74, rgb(darker(base, 0.4)));
  b.box(0, -h / 2 + coil + 0.02, 0, w * 1.02, 0.05, PROP_DEPTH * 0.86, rgb(darker(shell, 0.6)));
}

/** Rusted floor grating: a steel frame holding crossbars with gaps, flaking through to bare orange. */
function rustGrate({ parts, w, h, base, rng }: KitArgs): void {
  const b = parts.body;
  const rust = hsl(rng.range(16, 26), 0.62, 0.34);
  const frame = rgb(darker(base, 0.9));
  b.box(0, 0, 0, w, h * 0.5, PROP_DEPTH * 0.4, rgb(darker(rust, 0.55)));
  b.box(0, h / 2 - 0.03, 0, w, 0.06, PROP_DEPTH * 0.82, frame);
  b.box(0, -h / 2 + 0.03, 0, w, 0.06, PROP_DEPTH * 0.82, frame);
  b.box(-w / 2 + 0.07, 0, 0, 0.14, h, PROP_DEPTH * 0.84, frame);
  b.box(w / 2 - 0.07, 0, 0, 0.14, h, PROP_DEPTH * 0.84, frame);
  for (let x = -w / 2 + 0.34; x < w / 2 - 0.2; x += 0.3) {
    const flake = rng.next() < 0.3 ? hsl(30, 0.8, 0.46) : rust;
    b.box(x, 0, 0, 0.12, h * 0.94, PROP_DEPTH * 0.78, rgb(flake));
  }
  boltRow(b, -w / 2 + 0.07, w / 2 - 0.07, 0, HALF_D * 0.84 + 0.01, darker(base, 0.4), w - 0.14, 0.05);
}

/** Office filing cabinet: three drawer fronts, big pull handles and a label slot on each. */
function filingCabinet({ parts, w, h, base, rng }: KitArgs): void {
  const b = parts.body;
  const paint = hsl(rng.range(84, 104), 0.2, 0.44);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.9, rgb(paint));
  const drawers = 3;
  const slot = h / drawers;
  const seam = rgb(darker(paint, 0.5));
  const z = HALF_D * 0.9;
  for (let i = 0; i < drawers; i++) {
    const y = -h / 2 + slot * (i + 0.5);
    b.box(0, y, z + 0.012, w * 0.9, slot * 0.86, 0.025, rgb(lighter(paint, 0.06)));
    b.box(0, y + slot * 0.2, z + 0.04, w * 0.34, 0.1, 0.03, rgb(lighter(paint, 0.6)));
    b.box(0, y - slot * 0.12, z + 0.08, w * 0.4, 0.14, 0.12, rgb(CHROME));
  }
  for (let i = 1; i < drawers; i++) b.box(0, -h / 2 + slot * i, z + 0.03, w * 0.96, 0.05, 0.02, seam);
  b.box(0, h / 2 - 0.05, 0, w * 1.03, 0.1, PROP_DEPTH * 0.95, rgb(darker(base, 0.7)));
}

/** A drawer pulled out of the cabinet: a shallow tray, a face plate and a handle, with papers sticking out at the back. */
function fileDrawer({ parts, w, h, rng }: KitArgs): void {
  const b = parts.body;
  const paint = hsl(rng.range(84, 104), 0.2, 0.5);
  b.box(0, -h * 0.1, 0, w, h * 0.8, PROP_DEPTH * 0.62, rgb(darker(paint, 0.8)));
  b.box(0, h / 2 - 0.04, 0, w, 0.08, PROP_DEPTH * 0.66, rgb(lighter(paint, 0.2)));
  b.box(w / 2 - 0.07, 0, 0, 0.14, h, PROP_DEPTH * 0.7, rgb(lighter(paint, 0.05)));
  for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) b.box(x, 0, HALF_D * 0.62 + 0.05, 0.08, h * 0.3, 0.14, rgb(CHROME));
  b.box(-w / 2 + 0.07, 0, 0, 0.14, h, PROP_DEPTH * 0.7, rgb(lighter(paint, 0.05)));
  const paper = rgb(hsl(48, 0.3, 0.9));
  for (let x = -w / 2 + 0.2; x < w / 2 - 0.4; x += 0.28) b.box(x, h / 2 - 0.02, rng.range(-0.15, 0.15), 0.18, 0.1, 0.02, paper);
}

/** Shop awning: striped canvas pulled taut over arms, with a scalloped fringe. */
function awning({ parts, w, h, palette }: KitArgs): void {
  const b = parts.body;
  const stripes = Math.max(4, Math.round(w / 0.5));
  const sw = w / stripes;
  const a = hsl(palette.accent.h, 0.78, 0.62);
  const c = hsl(48, 0.5, 0.94);
  for (let i = 0; i < stripes; i++) {
    b.box(-w / 2 + sw * (i + 0.5), 0, 0, sw * 1.01, h * 0.8, PROP_DEPTH * 0.56, rgb(i % 2 ? c : a));
    b.taperedBox(-w / 2 + sw * (i + 0.5), -h / 2 - 0.02, HALF_D * 0.56 - 0.08, sw, sw * 0.3, h * 0.5, 0.1, rgb(i % 2 ? darker(c, 0.9) : darker(a, 0.9)));
  }
  b.displace((x, _y, z) => [0, z > 0 ? Math.sin(x * 2.6) * 0.012 : 0, 0]);
  const arm = rgb(hsl(215, 0.1, 0.34));
  for (const x of [-w / 2 + 0.18, w / 2 - 0.18]) b.box(x, -h / 2 - 0.25, -HALF_D * 0.56 + 0.04, 0.07, 0.5, 0.07, arm);
}

/** Call box on a post: a grey housing with a fat red button and a hazard band, the sort of thing that begs to be pressed. */
function callBox({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const housing = rgb(darker(base, 0.9));
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.7, housing);
  b.box(0, h / 2 - 0.05, 0, w * 1.06, 0.1, PROP_DEPTH * 0.76, rgb(lighter(base, 0.12)));
  b.box(0, -h * 0.34, HALF_D * 0.7 + 0.01, w * 0.9, 0.12, 0.02, rgb(HAZARD));
  b.disc(0, h * 0.06, HALF_D * 0.7 + 0.04, w * 0.3, 0.07, 10, rgb(darker(base, 0.5)));
  b.disc(0, h * 0.06, HALF_D * 0.7 + 0.1, w * 0.23, 0.08, 10, rgb(hsl(4, 0.85, 0.52)));
  b.disc(0, h * 0.06 + 0.05, HALF_D * 0.7 + 0.15, w * 0.1, 0.02, 6, rgb(hsl(4, 0.85, 0.78)));
  b.box(0, h * 0.38, HALF_D * 0.7 + 0.02, w * 0.5, 0.1, 0.02, rgb(lighter(base, 0.55)));
}

/** Service lift: a hazard-striped deck with side rails and a cable bracket. The scene draws the cable up to its housing. */
function serviceLift({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.8, rgb(darker(base, 0.9)));
  b.box(0, h / 2 - 0.04, 0, w, 0.08, PROP_DEPTH * 0.84, rgb(lighter(base, 0.2)));
  const bands = Math.round(w / 0.4);
  for (let i = 0; i < bands; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / bands;
    b.box(x, -0.02, HALF_D * 0.8 + 0.008, w / bands, h * 0.52, 0.016, rgb(i % 2 ? HAZARD : HAZARD_DARK));
  }
  const rail = rgb(darker(base, 0.65));
  for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) {
    b.box(x, h / 2 + 0.28, 0, 0.1, 0.56, 0.1, rail);
    b.box(x, h / 2 + 0.56, 0, 0.3, 0.08, 0.1, rgb(HAZARD));
  }
  b.box(0, -h / 2 - 0.06, 0, w * 0.5, 0.12, PROP_DEPTH * 0.5, rail);
  boltRow(b, -w / 2 + 0.3, w / 2 - 0.2, h / 2 - 0.12, HALF_D * 0.8 + 0.02, darker(base, 0.4), 0.55);
}

/** Drawbridge leaf: heavy timber planking on a steel frame, with counterweight eyes at the free end. */
function drawbridge({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const timber = hsl(32, 0.4, 0.34);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.82, rgb(darker(base, 0.9)));
  b.box(0, h * 0.16, 0, w, h * 0.7, PROP_DEPTH * 0.9, rgb(timber));
  const plank = rgb(darker(timber, 0.7));
  for (let x = -w / 2 + 0.5; x < w / 2; x += 0.5) b.box(x, h * 0.16, HALF_D * 0.9 + 0.008, 0.04, h * 0.7, 0.016, plank);
  b.box(0, h / 2 - 0.03, 0, w, 0.06, PROP_DEPTH * 0.94, rgb(lighter(timber, 0.15)));
  b.box(0, -h / 2 + 0.05, 0, w, 0.1, PROP_DEPTH * 0.9, rgb(darker(base, 0.7)));
  boltRow(b, -w / 2 + 0.3, w / 2 - 0.2, -h * 0.22, HALF_D * 0.9 + 0.02, darker(base, 0.4), 0.7, 0.05);
  b.ring(w / 2 - 0.2, h / 2 + 0.08, 0, 0.13, 0.06, PROP_DEPTH * 0.4, 8, rgb(darker(base, 0.55)));
  b.box(-w / 2 + 0.2, 0, 0, 0.4, h * 1.4, PROP_DEPTH * 0.96, rgb(darker(base, 0.55)));
}

/** Diving board: a glossy aqua deck with grip dots, a rubber tip and a pivot housing at the fixed end. */
function divingBoard({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const deck = hsl(190, 0.55, 0.62);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.58, rgb(deck));
  b.box(0, h / 2 - 0.025, 0, w, 0.05, PROP_DEPTH * 0.62, rgb(lighter(deck, 0.4)));
  b.box(0, -h / 2 + 0.03, 0, w, 0.06, PROP_DEPTH * 0.6, rgb(darker(deck, 0.62)));
  const grip = rgb(darker(deck, 0.66));
  for (let x = -w / 2 + 0.6; x < w / 2 - 0.4; x += 0.3) b.disc(x, 0, HALF_D * 0.58 + 0.01, 0.045, 0.02, 5, grip);
  b.box(w / 2 - 0.2, 0, 0, 0.4, h * 1.2, PROP_DEPTH * 0.64, rgb(hsl(345, 0.5, 0.62)));
  b.box(-w / 2 + 0.3, 0, 0, 0.6, h * 1.5, PROP_DEPTH * 0.7, rgb(darker(base, 0.6)));
  b.disc(-w / 2 + 0.3, 0, HALF_D * 0.7 + 0.02, 0.08, 0.05, 6, rgb(CHROME));
}

/** Inflatable castle: a puffed two-tone body, corner turrets with pennants, a row of battlement bumps and a dark doorway. */
function bouncyCastle({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const hue = { h: 0, s: 0, l: 0 };
  base.getHSL(hue);
  const body = hsl(hue.h * 360, 0.62, 0.64);
  const trim = hsl(hue.h * 360 + 165, 0.6, 0.7);
  const front = HALF_D * 0.9;
  b.box(0, -h * 0.12, 0, w, h * 0.7, PROP_DEPTH * 0.9, rgb(body));
  b.box(0, h * 0.24, 0, w * 0.72, h * 0.22, PROP_DEPTH * 0.86, rgb(lighter(body, 0.12)));
  b.box(0, -h * 0.4, front + 0.01, w, h * 0.12, 0.03, rgb(trim));
  const bumps = Math.max(3, Math.round((w * 0.72) / 0.5));
  for (let i = 0; i < bumps; i++) b.box(-w * 0.36 + (w * 0.72 * (i + 0.5)) / bumps, h * 0.4, 0, (w * 0.72) / bumps * 0.62, h * 0.12, PROP_DEPTH * 0.7, rgb(trim));
  for (const side of [-1, 1]) {
    const x = side * (w / 2 - w * 0.12);
    b.box(x, 0, 0, w * 0.24, h, PROP_DEPTH * 0.94, rgb(darker(body, 0.94)));
    b.box(x, -h * 0.1, front + 0.015, w * 0.24, h * 0.1, 0.03, rgb(trim));
    b.taperedBox(x, h / 2 - h * 0.06, 0, w * 0.24, w * 0.16, h * 0.16, PROP_DEPTH * 0.9, rgb(trim));
    b.box(x, h / 2 + 0.2, 0, 0.04, 0.4, 0.04, rgb(CHROME));
    b.taperedBox(x + 0.14, h / 2 + 0.3, 0, 0.26, 0.04, 0.16, 0.02, rgb(hsl(48, 0.9, 0.6)));
  }
  const door = rgb(darker(body, 0.32));
  b.box(0, -h * 0.28, front + 0.012, w * 0.24, h * 0.42, 0.025, door);
  b.taperedBox(0, -h * 0.02, front + 0.012, w * 0.24, w * 0.12, h * 0.14, 0.025, door);
  b.displace((x, y, z) => [0, 0, z > 0 ? Math.sin(x * 2.2 + y * 3) * 0.035 : 0]);
}

/** Frost-caked truss: steel under a faceted shell of blue ice, with hairline cracks and icicles hanging below. Brittle with cold. */
function frostTruss({ parts, w, h, rng }: KitArgs): void {
  const b = parts.body;
  const base = hsl(196, 0.5, 0.86);
  const steel = rgb(hsl(215, 0.14, 0.3));
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.56, steel);
  b.box(0, h * 0.14, 0, w * 0.98, h * 0.72, PROP_DEPTH * 0.88, rgb(base));
  b.box(0, h / 2 - 0.05, 0, w, 0.1, PROP_DEPTH * 0.9, rgb(lighter(base, 0.5)));
  b.box(0, -h / 2 + 0.05, 0, w, 0.1, PROP_DEPTH * 0.7, steel);
  const facet = rgb(lighter(base, 0.22));
  for (let x = -w / 2 + 0.5; x < w / 2 - 0.3; x += rng.range(0.7, 1.2)) {
    b.taperedBox(x, 0, PROP_DEPTH * 0.44 + 0.006, 0.5, 0.2, h * 0.7, 0.012, facet);
  }
  const crack = rgb(darker(base, 0.55));
  for (let i = 0; i < 3; i++) b.box(rng.range(-w * 0.4, w * 0.4), rng.range(-h * 0.1, h * 0.1), PROP_DEPTH * 0.44 + 0.012, 0.03, h * 0.6, 0.012, crack);
  for (let x = -w / 2 + 0.4; x < w / 2 - 0.2; x += rng.range(0.55, 0.95)) {
    const len = rng.range(0.16, 0.38);
    b.taperedBox(x, -h / 2 - len / 2 + 0.02, 0, 0.16, 0.02, len, PROP_DEPTH * 0.26, rgb(lighter(base, 0.5)));
  }
}

export const REACTIVE_KIT: Readonly<Record<string, KitBuilder>> = {
  'boing-washer': boingWasher,
  'rust-grate': rustGrate,
  'filing-cabinet': filingCabinet,
  'file-drawer': fileDrawer,
  awning,
  'call-box': callBox,
  'service-lift': serviceLift,
  drawbridge,
  'diving-board': divingBoard,
  'bouncy-castle': bouncyCastle,
  'frost-truss': frostTruss,
};
