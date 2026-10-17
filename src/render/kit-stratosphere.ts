import { GeometryBuilder, rgb } from './geometry';
import { HALF_D, PROP_DEPTH, boltRow, darker, hsl, lighter, type KitArgs, type KitBuilder } from './prop-kit';

const ALUMINIUM = hsl(215, 0.12, 0.74);
const STARLIGHT = hsl(200, 0.7, 0.78);
const CABIN_LIGHT = hsl(44, 0.85, 0.7);
const ALERT_RED = hsl(2, 0.85, 0.55);
const GOLD_FOIL = hsl(42, 0.75, 0.52);
const SILVER_FOIL = hsl(210, 0.16, 0.7);

/** Airliner fuselage section: polished skin, a row of lit windows, a cheat line and riveted seams. */
function fuselage({ parts, w, h, palette }: KitArgs): void {
  const b = parts.body;
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.94, rgb(ALUMINIUM));
  b.box(0, h * 0.36, 0, w, h * 0.28, PROP_DEPTH * 0.98, rgb(lighter(ALUMINIUM, 0.2)));
  b.box(0, -h * 0.4, 0, w, h * 0.2, PROP_DEPTH * 0.98, rgb(darker(ALUMINIUM, 0.76)));
  const z = HALF_D * 0.94 + 0.01;
  b.box(0, -h * 0.18, z, w, 0.16, 0.02, rgb(hsl(palette.accent.h, 0.7, 0.5)));
  const seam = rgb(darker(ALUMINIUM, 0.6));
  for (let x = -w / 2 + 1.6; x < w / 2; x += Math.max(1.6, w / 6)) b.box(x, 0, z, 0.05, h, 0.02, seam);
  boltRow(b, -w / 2 + 0.3, w / 2 - 0.3, h * 0.46, z + 0.01, darker(ALUMINIUM, 0.5), 0.5);
  for (let x = -w / 2 + 0.8; x < w / 2 - 0.4; x += Math.max(0.8, w / 9)) {
    b.box(x, h * 0.14, z, 0.4, 0.5, 0.02, rgb(darker(ALUMINIUM, 0.4)));
    parts.glow.box(x, h * 0.14, z + 0.01, 0.3, 0.38, 0.02, rgb(CABIN_LIGHT));
  }
}

/** Wing: tapered slab with flap seams and a navigation light at the tip. */
function wing({ parts, w, h }: KitArgs): void {
  const b = parts.body;
  b.taperedBox(0, 0, 0, w, w * 0.92, h, PROP_DEPTH * 0.9, rgb(ALUMINIUM));
  b.box(0, h / 2 - 0.03, 0, w * 0.96, 0.06, PROP_DEPTH * 0.94, rgb(lighter(ALUMINIUM, 0.3)));
  const seam = rgb(darker(ALUMINIUM, 0.58));
  for (let x = -w / 2 + 1.1; x < w / 2; x += 1.1) b.box(x, 0, HALF_D * 0.9 + 0.008, 0.04, h * 0.9, 0.016, seam);
  b.box(0, -h / 2 + 0.05, HALF_D * 0.9 + 0.01, w, 0.07, 0.016, rgb(ALERT_RED));
  parts.glow.disc(w / 2 - 0.12, 0, HALF_D * 0.9 + 0.03, 0.1, 0.03, 8, rgb(hsl(2, 0.95, 0.62)));
}

/** Skin torn from the airframe: crinkled aluminium with a paint stripe and ragged rivet lines. */
function fuselageSkin({ parts, w, h, rng, palette }: KitArgs): void {
  const b = parts.body;
  const segments = Math.max(3, Math.round(h / 0.55));
  const sh = h / segments;
  for (let i = 0; i < segments; i++) {
    const tone = darker(ALUMINIUM, 0.8 + rng.next() * 0.3);
    if (rng.next() < 0.2) tone.lerp(hsl(26, 0.45, 0.4), 0.45);
    b.box(0, -h / 2 + sh * (i + 0.5), 0, w, sh * 1.01, PROP_DEPTH * 0.6, rgb(tone));
  }
  b.displace((_x, y, z) => [Math.sin(y * 3.8 + z * 2) * 0.025, 0, 0]);
  b.box(0, 0, PROP_DEPTH * 0.3 + 0.012, w * 0.9, h * 0.5, 0.012, rgb(hsl(palette.accent.h, 0.55, 0.42)));
  for (let y = -h / 2 + 0.5; y < h / 2 - 0.2; y += 0.8) b.disc(0, y, PROP_DEPTH * 0.3 + 0.025, 0.05, 0.03, 6, rgb(darker(ALUMINIUM, 0.5)));
}

/** Solar array: dark blue cells in a grid inside a pale frame, with a thin spar down the middle. */
function solarPanel({ parts, w, h }: KitArgs): void {
  const b = parts.body;
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.34, rgb(SILVER_FOIL));
  const cells = Math.max(4, Math.round(w / 0.9));
  const cw = (w - 0.2) / cells;
  for (let i = 0; i < cells; i++) {
    const tone = hsl(222 + (i % 2) * 6, 0.62, 0.26 + (i % 3) * 0.02);
    b.box(-w / 2 + 0.1 + cw * (i + 0.5), 0, PROP_DEPTH * 0.17 + 0.008, cw * 0.88, h * 0.78, 0.016, rgb(tone));
    parts.glow.box(-w / 2 + 0.1 + cw * (i + 0.5), h * 0.28, PROP_DEPTH * 0.17 + 0.02, cw * 0.5, 0.02, 0.01, rgb(hsl(205, 0.6, 0.5)));
  }
  b.box(0, 0, -PROP_DEPTH * 0.17, w, h * 0.3, 0.08, rgb(darker(SILVER_FOIL, 0.7)));
}

/** Satellite bus: gold foil body, a small dish on a boom, an antenna whip and a status light. */
function satellite({ parts, w, h }: KitArgs): void {
  const b = parts.body;
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.9, rgb(GOLD_FOIL));
  const facets = 4;
  for (let i = 0; i < facets; i++) {
    for (let j = 0; j < facets; j++) {
      const tone = (i + j) % 2 ? lighter(GOLD_FOIL, 0.14) : darker(GOLD_FOIL, 0.9);
      b.box(-w / 2 + (w * (i + 0.5)) / facets, -h / 2 + (h * (j + 0.5)) / facets, HALF_D * 0.9 + 0.01, (w / facets) * 0.94, (h / facets) * 0.94, 0.02, rgb(tone));
    }
  }
  b.box(0, h / 2 + 0.05, 0, w * 1.04, 0.1, PROP_DEPTH * 0.96, rgb(darker(GOLD_FOIL, 0.55)));
  b.box(0, h / 2 + 0.45, 0, 0.05, 0.8, 0.05, rgb(darker(ALUMINIUM, 0.6)));
  b.disc(0, h / 2 + 0.88, 0, 0.1, 0.1, 6, rgb(ALERT_RED));
  b.disc(w / 2 + 0.28, 0, -0.1, 0.36, 0.06, 12, rgb(ALUMINIUM));
  b.box(w / 2 + 0.1, 0, -0.1, 0.24, 0.05, 0.05, rgb(darker(ALUMINIUM, 0.6)));
  parts.glow.disc(-w / 2 + 0.3, h / 2 - 0.3, HALF_D * 0.9 + 0.04, 0.09, 0.03, 8, rgb(STARLIGHT));
}

/** Observatory dish: a deep reflector on three struts with a feed horn at its focus. */
function radioDish({ parts, w, base }: KitArgs): void {
  const b = parts.body;
  const r = w / 2;
  b.ring(0, 0, 0, r, r * 0.88, PROP_DEPTH * 0.56, 22, rgb(lighter(base, 0.12)));
  b.disc(0, 0, -PROP_DEPTH * 0.1, r * 0.88, PROP_DEPTH * 0.28, 22, rgb(darker(ALUMINIUM, 0.9)));
  b.ring(0, 0, 0, r * 0.62, r * 0.55, PROP_DEPTH * 0.4, 18, rgb(darker(ALUMINIUM, 0.7)));
  b.ring(0, 0, 0, r * 0.34, r * 0.28, PROP_DEPTH * 0.4, 14, rgb(darker(ALUMINIUM, 0.7)));
  b.disc(0, 0, PROP_DEPTH * 0.14, r * 0.14, PROP_DEPTH * 0.3, 8, rgb(darker(ALUMINIUM, 0.5)));
  for (const a of [Math.PI / 2, Math.PI / 2 + (Math.PI * 2) / 3, Math.PI / 2 + (Math.PI * 4) / 3]) {
    b.box(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, PROP_DEPTH * 0.1, 0.07, r * 0.98, 0.07, rgb(darker(ALUMINIUM, 0.55)));
  }
  parts.glow.disc(0, 0, PROP_DEPTH * 0.3, r * 0.05, 0.02, 6, rgb(ALERT_RED));
}

/** Antenna mast: a lattice tube banded red and white, with a beacon at the tip. */
function antennaMast({ parts, w, h }: KitArgs): void {
  const b = parts.body;
  const bands = Math.max(3, Math.round(h / 1.0));
  const bh = h / bands;
  for (let i = 0; i < bands; i++) b.box(0, -h / 2 + bh * (i + 0.5), 0, w, bh * 1.01, PROP_DEPTH * 0.34, rgb(i % 2 ? ALERT_RED : lighter(ALUMINIUM, 0.2)));
  for (let i = 0; i < bands; i++) b.box(0, -h / 2 + bh * i, 0, w * 1.7, 0.08, PROP_DEPTH * 0.44, rgb(darker(ALUMINIUM, 0.55)));
  parts.glow.disc(0, h / 2 + 0.12, 0, 0.1, 0.1, 8, rgb(hsl(2, 0.95, 0.62)));
}

/** Station truss: top and bottom chords joined by a zig-zag of braces, with hazard-orange end blocks. */
function truss({ parts, w, h }: KitArgs): void {
  const b = parts.body;
  const frame = lighter(ALUMINIUM, 0.1);
  b.box(0, h / 2 - 0.07, 0, w, 0.14, PROP_DEPTH * 0.6, rgb(frame));
  b.box(0, -h / 2 + 0.07, 0, w, 0.14, PROP_DEPTH * 0.6, rgb(darker(frame, 0.85)));
  const bays = Math.max(4, Math.round(w / 0.9));
  const bw = w / bays;
  const brace = rgb(darker(frame, 0.7));
  for (let i = 0; i < bays; i++) {
    const cx = -w / 2 + bw * (i + 0.5);
    const diagonal = Math.hypot(bw, h - 0.28);
    const angle = Math.atan2(h - 0.28, bw) * (i % 2 ? -1 : 1);
    const strut = new GeometryBuilder();
    strut.box(0, 0, 0, diagonal, 0.07, 0.07, brace);
    b.append(strut, cx, 0, angle);
  }
  for (const x of [-w / 2 + 0.18, w / 2 - 0.18]) b.box(x, 0, 0, 0.36, h * 1.1, PROP_DEPTH * 0.66, rgb(hsl(24, 0.9, 0.5)));
}

/** A slab of broken structure tumbling through the sky: scorched, bent and still holding its bolts. */
function debris({ parts, w, h, rng }: KitArgs): void {
  const b = parts.body;
  const panels = 3;
  for (let i = 0; i < panels; i++) {
    const tone = darker(rng.next() < 0.5 ? ALUMINIUM : GOLD_FOIL, 0.7 + rng.next() * 0.25);
    b.box(-w / 2 + (w * (i + 0.5)) / panels, 0, 0, (w / panels) * 1.01, h, PROP_DEPTH * 0.8, rgb(tone));
  }
  b.displace((x, y) => [0, Math.sin(x * 2.6) * 0.07 + (y > 0 ? 0.03 : 0), 0]);
  b.box(0, -h / 2 + 0.05, 0, w, 0.1, PROP_DEPTH * 0.84, rgb(hsl(15, 0.3, 0.14)));
  boltRow(b, -w / 2 + 0.3, w / 2 - 0.2, 0, HALF_D * 0.8 + 0.02, darker(ALUMINIUM, 0.5), 0.55);
}

/** Cargo pod: an orange transport box with a latch, hazard chevrons and corner reinforcements. */
function cargoPod({ parts, w, h }: KitArgs): void {
  const b = parts.body;
  const shell = hsl(24, 0.85, 0.52);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.94, rgb(shell));
  const z = HALF_D * 0.94 + 0.01;
  b.box(0, 0, z, w * 0.78, h * 0.72, 0.02, rgb(lighter(shell, 0.12)));
  b.box(0, 0, z + 0.01, 0.06, h * 0.72, 0.02, rgb(darker(shell, 0.6)));
  b.box(w * 0.12, 0, z + 0.06, 0.14, 0.4, 0.1, rgb(lighter(ALUMINIUM, 0.2)));
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.box(sx * (w / 2 - 0.12), sy * (h / 2 - 0.12), z, 0.24, 0.24, 0.03, rgb(darker(shell, 0.55)));
  const chevron = rgb(hsl(46, 0.95, 0.56));
  for (let x = -w * 0.3; x < w * 0.3; x += 0.4) b.box(x, -h * 0.34, z + 0.02, 0.18, 0.1, 0.01, chevron);
}

/** Strobe bracket: a dark housing with a strip of cold white lamps that the scene can pulse. */
function strobePanel({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.6, rgb(hsl(230, 0.2, 0.2)));
  b.box(0, h / 2 - 0.03, 0, w + 0.06, 0.06, PROP_DEPTH * 0.66, rgb(darker(base, 0.7)));
  b.box(0, -h / 2 + 0.03, 0, w + 0.06, 0.06, PROP_DEPTH * 0.66, rgb(darker(base, 0.7)));
  const z = PROP_DEPTH * 0.3 + 0.012;
  const lamps = Math.max(3, Math.round(w / 1.0));
  for (let i = 0; i < lamps; i++) {
    const x = -w / 2 + 0.3 + ((w - 0.6) * i) / (lamps - 1);
    parts.glow.disc(x, 0, z + 0.02, h * 0.3, 0.04, 6, rgb(STARLIGHT));
    parts.glow.disc(x, 0, z + 0.05, h * 0.14, 0.03, 6, rgb(hsl(190, 0.6, 0.95)));
  }
}

/** Insulation blanket: gold and silver foil facets crinkled over a frame, joined by tape seams. */
function thermalWall({ parts, w, h, rng }: KitArgs): void {
  const b = parts.body;
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.96, rgb(darker(SILVER_FOIL, 0.55)));
  const cols = Math.max(2, Math.round(w / 1.0));
  const rows = Math.max(2, Math.round(h / 1.0));
  const front = HALF_D * 0.96 + 0.01;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const foil = rng.next() < 0.5 ? GOLD_FOIL : SILVER_FOIL;
      const tone = darker(foil, 0.78 + rng.next() * 0.34);
      b.box(-w / 2 + (w * (i + 0.5)) / cols, -h / 2 + (h * (j + 0.5)) / rows, front, (w / cols) * 0.97, (h / rows) * 0.97, 0.02, rgb(tone));
    }
  }
  b.displace((x, y, z) => (z > 0 ? [0, 0, Math.sin(x * 4.1 + y * 2.3) * 0.03] : [0, 0, 0]));
  const tape = rgb(hsl(215, 0.1, 0.34));
  b.box(0, 0, front + 0.02, 0.1, h, 0.012, tape);
  for (let y = -h / 2 + 2; y < h / 2; y += 2) b.box(0, y, front + 0.02, w, 0.08, 0.012, tape);
}

export const STRATOSPHERE_KIT: Readonly<Record<string, KitBuilder>> = {
  fuselage,
  wing,
  'fuselage-skin': fuselageSkin,
  'solar-panel': solarPanel,
  satellite,
  'radio-dish': radioDish,
  'antenna-mast': antennaMast,
  truss,
  debris,
  'cargo-pod': cargoPod,
  'strobe-panel': strobePanel,
  'thermal-wall': thermalWall,
};
