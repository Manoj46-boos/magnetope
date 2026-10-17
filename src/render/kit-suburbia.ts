import { rgb } from './geometry';
import { HALF_D, PROP_DEPTH, darker, hsl, lighter, type KitArgs, type KitBuilder } from './prop-kit';

const SIDING_TONES = [
  [152, 0.3, 0.78],
  [46, 0.55, 0.82],
  [200, 0.42, 0.8],
  [12, 0.55, 0.83],
] as const;

const CLOTH_TONES = [
  [12, 0.7, 0.66],
  [48, 0.8, 0.7],
  [190, 0.55, 0.7],
  [320, 0.5, 0.74],
  [100, 0.45, 0.66],
] as const;

/** Clapboard wall of a house: a pastel face, horizontal shadow lines and light corner trim. */
function siding({ parts, w, h, rng }: KitArgs): void {
  const [hue, s, l] = rng.pick(SIDING_TONES);
  const face = hsl(hue, s, l);
  const b = parts.body;
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.94, rgb(face));
  const line = rgb(darker(face, 0.8));
  for (let y = -h / 2 + 0.34; y < h / 2 - 0.1; y += 0.34) b.box(0, y, HALF_D * 0.94 + 0.008, w, 0.035, 0.016, line);
  const trim = rgb(lighter(face, 0.5));
  b.box(-w / 2 + 0.06, 0, HALF_D * 0.94 + 0.014, 0.12, h, 0.03, trim);
  b.box(w / 2 - 0.06, 0, HALF_D * 0.94 + 0.014, 0.12, h, 0.03, trim);
}

/** Roof deck: staggered shingle courses under a pale ridge cap. */
function shingles({ parts, w, h, rng }: KitArgs): void {
  const tile = hsl(rng.range(8, 20), 0.42, 0.44);
  const b = parts.body;
  b.box(0, 0, 0, w, h, PROP_DEPTH, rgb(tile));
  const course = rgb(darker(tile, 0.78));
  const rows = 2;
  for (let r = 0; r < rows; r++) {
    const y = -h / 2 + (h * (r + 0.5)) / rows;
    b.box(0, y, HALF_D + 0.008, w, 0.035, 0.016, course);
    const offset = r % 2 === 0 ? 0 : 0.3;
    for (let x = -w / 2 + 0.3 + offset; x < w / 2 - 0.2; x += 0.6) b.box(x, y + h / (rows * 4), HALF_D + 0.008, 0.03, h / (rows * 2.2), 0.016, course);
  }
  b.box(0, h / 2 - 0.05, 0, w, 0.12, PROP_DEPTH * 1.04, rgb(lighter(tile, 0.18)));
}

/** Garden shed: corrugated steel walls, a door with an oversized handle and a darker roof lip. */
function shed({ parts, w, h, base, rng }: KitArgs): void {
  const b = parts.body;
  const wall = hsl(rng.range(150, 175), 0.2, 0.52);
  b.box(0, 0, 0, w, h, PROP_DEPTH, rgb(wall));
  const rib = rgb(darker(wall, 0.84));
  for (let x = -w / 2 + 0.16; x < w / 2; x += 0.22) b.box(x, -0.05, HALF_D + 0.008, 0.07, h - 0.4, 0.016, rib);
  b.box(0, h / 2 - 0.1, 0, w * 1.04, 0.2, PROP_DEPTH * 1.05, rgb(darker(base, 0.6)));
  b.box(0, -h / 2 + 0.07, 0, w * 1.02, 0.14, PROP_DEPTH * 1.02, rgb(darker(wall, 0.6)));
  const door = rgb(lighter(wall, 0.1));
  b.box(w * 0.12, -0.12, HALF_D + 0.02, w * 0.4, h * 0.72, 0.03, door);
  b.box(w * 0.12, -0.12, HALF_D + 0.04, w * 0.42, 0.05, 0.02, rib);
  b.box(w * 0.3, -0.1, HALF_D + 0.09, 0.14, 0.55, 0.14, rgb(lighter(wall, 0.45)));
  b.box(-w * 0.32, 0.12, HALF_D + 0.02, w * 0.18, h * 0.22, 0.03, rgb(hsl(205, 0.3, 0.3)));
}

/** Rain gutter: a thin dented trough on bracket hangers. Reads as flimsy on purpose. */
function gutter({ parts, w, h, base, rng }: KitArgs): void {
  const b = parts.body;
  const alu = hsl(210, 0.08, 0.7);
  const segments = Math.max(3, Math.round(w / 0.7));
  const sw = w / segments;
  for (let i = 0; i < segments; i++) {
    const tone = darker(alu, 0.85 + rng.next() * 0.25);
    if (rng.next() < 0.3) tone.lerp(hsl(22, 0.5, 0.4), 0.5);
    b.box(-w / 2 + sw * (i + 0.5), 0, 0, sw * 1.01, h, PROP_DEPTH * 0.7, rgb(tone));
  }
  b.box(0, h / 2 - 0.03, HALF_D * 0.7 - 0.02, w, 0.06, 0.05, rgb(lighter(alu, 0.25)));
  b.displace((x, _y, z) => [0, Math.sin(x * 4.3 + z) * 0.018, 0]);
  const hanger = rgb(darker(base, 0.5));
  for (let x = -w / 2 + 0.4; x < w / 2; x += 1.0) b.box(x, -h / 2 + 0.02, HALF_D * 0.7 + 0.01, 0.07, h * 0.9, 0.03, hanger);
}

/** Letterbox with an arched lid and a raised flag in the biome accent. */
function mailbox({ parts, w, h, base, palette }: KitArgs): void {
  const b = parts.body;
  const paint = hsl(palette.accent.h + 190, 0.5, 0.48);
  b.box(0, -h * 0.16, 0, w, h * 0.68, PROP_DEPTH * 0.8, rgb(paint));
  b.taperedBox(0, h * 0.34, 0, w, w * 0.62, h * 0.34, PROP_DEPTH * 0.8, rgb(lighter(paint, 0.06)));
  b.box(w * 0.5 + 0.06, h * 0.08, 0, 0.1, h * 0.55, 0.16, rgb(darker(base, 0.5)));
  b.box(w * 0.5 + 0.2, h * 0.28, 0, 0.3, 0.16, 0.14, rgb(hsl(palette.accent.h, 0.78, 0.6)));
  b.box(0, -h * 0.16, HALF_D * 0.8 + 0.012, w * 0.82, 0.04, 0.02, rgb(darker(paint, 0.55)));
  b.box(0, -h * 0.02, HALF_D * 0.8 + 0.06, 0.34, 0.1, 0.1, rgb(lighter(paint, 0.5)));
}

/** Fence or mailbox post: weathered wood with a capped top. */
function post({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.5, rgb(base));
  b.box(0, h / 2 - 0.05, 0, w * 1.5, 0.1, PROP_DEPTH * 0.58, rgb(lighter(base, 0.12)));
  for (let y = -h / 2 + 0.5; y < h / 2 - 0.3; y += 0.8) b.box(0, y, PROP_DEPTH * 0.25 + 0.006, w * 0.8, 0.025, 0.012, rgb(darker(base, 0.7)));
}

/** A sheet on the line: soft folds, a pale hem and two pegs. */
function laundry({ parts, w, h, rng }: KitArgs): void {
  const [hue, s, l] = rng.pick(CLOTH_TONES);
  const cloth = hsl(hue, s, l);
  const b = parts.body;
  const folds = Math.max(4, Math.round(w / 0.5));
  const fw = w / folds;
  for (let i = 0; i < folds; i++) {
    b.box(-w / 2 + fw * (i + 0.5), 0, 0, fw * 1.01, h, PROP_DEPTH * 0.3, rgb(darker(cloth, i % 2 ? 0.93 : 1.04)));
  }
  b.displace((x, y, z) => [0, 0, Math.sin(x * 3.3 + y) * 0.06 * (z > 0 ? 1 : -1)]);
  b.box(0, -h / 2 + 0.04, 0, w, 0.08, PROP_DEPTH * 0.32, rgb(lighter(cloth, 0.4)));
  b.box(0, h / 2 + 0.01, 0, w * 1.04, 0.04, 0.05, rgb(hsl(210, 0.1, 0.5)));
  for (const px of [-w * 0.36, w * 0.36]) b.box(px, h / 2 - 0.1, PROP_DEPTH * 0.16, 0.08, 0.22, 0.06, rgb(hsl(48, 0.8, 0.6)));
}

/** Bouncy mat in the accent colour, a ring of springs and a steel frame on two legs. */
function trampoline({ parts, w, h, base, palette }: KitArgs): void {
  const b = parts.body;
  const mat = hsl(palette.accent.h + 205, 0.45, 0.34);
  b.box(0, h * 0.28, 0, w, h * 0.38, PROP_DEPTH * 0.9, rgb(mat));
  b.box(0, h * 0.5 - 0.03, 0, w, 0.06, PROP_DEPTH * 0.95, rgb(hsl(palette.accent.h, 0.72, 0.62)));
  const spring = rgb(hsl(210, 0.1, 0.62));
  for (let x = -w / 2 + 0.25; x < w / 2; x += 0.3) b.box(x, -h * 0.12, 0, 0.05, h * 0.46, PROP_DEPTH * 0.82, spring);
  const frame = rgb(darker(base, 0.9));
  b.box(0, -h / 2 + 0.04, 0, w, 0.08, PROP_DEPTH * 0.84, frame);
  for (const lx of [-w / 2 + 0.2, w / 2 - 0.2]) b.box(lx, -h * 0.22, 0, 0.12, h * 0.56, PROP_DEPTH * 0.84, frame);
}

/** Sectional garage door: four panels, a window strip and a big pull handle. */
function garage({ parts, w, h, base, rng }: KitArgs): void {
  const b = parts.body;
  const door = hsl(rng.pick([40, 18, 200, 150]), 0.14, 0.8);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.7, rgb(door));
  const seam = rgb(darker(door, 0.6));
  const panel = h / 4;
  for (let i = 1; i < 4; i++) b.box(0, -h / 2 + panel * i, PROP_DEPTH * 0.35 + 0.012, w, 0.05, 0.024, seam);
  for (let i = 0; i < 4; i++) {
    const y = -h / 2 + panel * (i + 0.5);
    b.box(0, y, PROP_DEPTH * 0.35 + 0.01, w * 0.86, panel * 0.62, 0.016, rgb(darker(door, 0.94)));
  }
  const window = rgb(hsl(205, 0.35, 0.32));
  for (let x = -w * 0.3; x <= w * 0.31; x += w * 0.2) b.box(x, h / 2 - panel * 0.5, PROP_DEPTH * 0.35 + 0.03, w * 0.14, panel * 0.42, 0.02, window);
  const rail = rgb(darker(base, 0.55));
  b.box(-w / 2 + 0.08, 0, 0, 0.16, h * 1.02, PROP_DEPTH * 0.85, rail);
  b.box(w / 2 - 0.08, 0, 0, 0.16, h * 1.02, PROP_DEPTH * 0.85, rail);
  b.box(0, -h / 2 + 0.34, PROP_DEPTH * 0.35 + 0.08, w * 0.34, 0.14, 0.14, rgb(lighter(door, 0.1)));
}

/** Picket fence section: pointed boards on two rails. */
function picket({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const board = lighter(base, 0.4);
  const rail = rgb(darker(base, 0.7));
  b.box(0, h * 0.28, -HALF_D * 0.3, w, 0.12, 0.12, rail);
  b.box(0, -h * 0.28, -HALF_D * 0.3, w, 0.12, 0.12, rail);
  const step = 0.42;
  for (let x = -w / 2 + step / 2; x < w / 2; x += step) {
    b.box(x, -0.07, 0, 0.3, h - 0.28, PROP_DEPTH * 0.2, rgb(board));
    b.taperedBox(x, h / 2 - 0.14, 0, 0.3, 0.04, 0.28, PROP_DEPTH * 0.2, rgb(lighter(board, 0.08)));
  }
}

/** Hanging sign board: painted steel with eye bolts. The chains are drawn by the scene from the hinge. */
function swingPlate({ parts, w, h, base, palette }: KitArgs): void {
  const b = parts.body;
  const paint = hsl(palette.accent.h, 0.6, 0.55);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.5, rgb(darker(base, 0.9)));
  b.box(0, 0, PROP_DEPTH * 0.25 + 0.01, w - 0.16, h - 0.14, 0.02, rgb(paint));
  b.box(0, 0, PROP_DEPTH * 0.25 + 0.03, w - 0.5, 0.05, 0.02, rgb(lighter(paint, 0.55)));
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) {
    b.disc(x, h / 2 + 0.04, 0, 0.1, 0.1, 8, rgb(darker(base, 0.5)));
    b.disc(x, 0, PROP_DEPTH * 0.25 + 0.04, 0.05, 0.04, 6, rgb(darker(base, 0.45)));
  }
}

export const SUBURBIA_KIT: Readonly<Record<string, KitBuilder>> = {
  siding,
  roof: shingles,
  shed,
  gutter,
  mailbox,
  post,
  laundry,
  trampoline,
  'garage-door': garage,
  picket,
  'swing-plate': swingPlate,
};
