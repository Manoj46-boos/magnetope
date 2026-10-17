import { GeometryBuilder, rgb } from './geometry';
import { HALF_D, PROP_DEPTH, boltRow, darker, hsl, lighter, type KitArgs, type KitBuilder } from './prop-kit';

const CANDY = [
  [345, 0.42, 0.72],
  [48, 0.7, 0.7],
  [168, 0.36, 0.7],
  [205, 0.4, 0.72],
  [18, 0.6, 0.72],
] as const;

const FADED_PINK = hsl(345, 0.34, 0.7);
const FADED_YELLOW = hsl(48, 0.62, 0.72);
const RUST = hsl(18, 0.55, 0.34);
const BALL_TONES = [hsl(345, 0.7, 0.62), hsl(48, 0.9, 0.6), hsl(190, 0.6, 0.6), hsl(12, 0.78, 0.62), hsl(150, 0.45, 0.6)];

/** Blocky capital letters built from slabs, so a wall of toy blocks reads as a toy at a glance. */
const LETTERS: Readonly<Record<string, ReadonlyArray<readonly [number, number, number, number]>>> = {
  H: [[-0.3, 0, 0.16, 0.9], [0.3, 0, 0.16, 0.9], [0, 0, 0.5, 0.14]],
  T: [[0, 0.38, 0.8, 0.16], [0, -0.1, 0.16, 0.8]],
  L: [[-0.26, 0, 0.16, 0.9], [0, -0.38, 0.6, 0.16]],
  E: [[-0.28, 0, 0.16, 0.9], [0, 0.38, 0.56, 0.14], [0, 0, 0.4, 0.14], [0, -0.38, 0.56, 0.14]],
  I: [[0, 0, 0.18, 0.9], [0, 0.4, 0.5, 0.14], [0, -0.4, 0.5, 0.14]],
};

/** Oversized alphabet block: a painted face per 2.4 m cell with a raised letter on it. */
function toyBlock({ parts, w, h, rng }: KitArgs): void {
  const b = parts.body;
  const cell = Math.min(w, 2.4);
  const rows = Math.max(1, Math.round(h / cell));
  const rowH = h / rows;
  const front = HALF_D * 0.94;
  for (let r = 0; r < rows; r++) {
    const [hue, s, l] = rng.pick(CANDY);
    const face = hsl(hue, s, l);
    const y = -h / 2 + rowH * (r + 0.5);
    b.box(0, y, 0, w, rowH * 0.98, PROP_DEPTH * 0.94, rgb(face));
    b.box(0, y, front + 0.01, w * 0.84, rowH * 0.84, 0.02, rgb(lighter(face, 0.22)));
    const glyph = rng.pick(Object.keys(LETTERS));
    const ink = rgb(darker(face, 0.62));
    for (const [gx, gy, gw, gh] of LETTERS[glyph]!) b.box(gx * w * 0.62, y + gy * rowH * 0.62, front + 0.04, gw * w * 0.62, gh * rowH * 0.62, 0.05, ink);
    b.box(0, y + rowH / 2, 0, w * 1.02, 0.05, PROP_DEPTH * 0.98, rgb(darker(face, 0.7)));
  }
}

/** Mega-slide: a faded yellow chute with raised pink rails and rust blooming under the paint. */
function slideRamp({ parts, w, h, rng }: KitArgs): void {
  const b = parts.body;
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.8, rgb(FADED_YELLOW));
  b.box(0, h / 2 + 0.07, HALF_D * 0.8 - 0.06, w, 0.14, 0.12, rgb(FADED_PINK));
  b.box(0, h / 2 + 0.07, -HALF_D * 0.8 + 0.06, w, 0.14, 0.12, rgb(darker(FADED_PINK, 0.8)));
  const seam = rgb(darker(FADED_YELLOW, 0.74));
  for (let x = -w / 2 + 0.9; x < w / 2; x += 0.9) b.box(x, 0, HALF_D * 0.8 + 0.008, 0.04, h, 0.016, seam);
  for (let i = 0; i < Math.round(w / 1.4); i++) {
    b.box(rng.range(-w / 2, w / 2), rng.range(-h * 0.3, h * 0.3), HALF_D * 0.8 + 0.012, rng.range(0.3, 0.8), rng.range(0.08, 0.18), 0.012, rgb(RUST));
  }
  b.box(0, -h / 2 + 0.04, 0, w, 0.08, PROP_DEPTH * 0.84, rgb(darker(FADED_YELLOW, 0.6)));
  b.box(-w / 2 - 0.05, 0, 0, 0.1, h * 1.3, PROP_DEPTH * 0.84, rgb(darker(FADED_PINK, 0.7)));
}

/** Ferris-wheel spoke: a lattice arm with a yellow stripe and a hub collar at the inner end. */
function ferrisSpoke({ parts, w, h }: KitArgs): void {
  const b = parts.body;
  const arm = FADED_PINK;
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.5, rgb(arm));
  b.box(0, h / 2 - 0.03, 0, w, 0.06, PROP_DEPTH * 0.56, rgb(lighter(arm, 0.28)));
  const stripe = rgb(FADED_YELLOW);
  for (let x = -w / 2 + 0.4; x < w / 2 - 0.3; x += 0.9) b.box(x, 0, PROP_DEPTH * 0.25 + 0.008, 0.34, h * 0.7, 0.016, stripe);
  b.box(-w / 2 + 0.2, 0, 0, 0.4, h * 1.7, PROP_DEPTH * 0.7, rgb(darker(arm, 0.6)));
  boltRow(b, -w / 2 + 0.7, w / 2 - 0.4, 0, PROP_DEPTH * 0.25 + 0.016, darker(arm, 0.5), 0.9);
}

/** Wheel hub: a bearing drum with a yellow cap and six bolts, so its turning is easy to read. */
function wheelHub({ parts, w }: KitArgs): void {
  const b = parts.body;
  const r = w / 2;
  const z = PROP_DEPTH * 0.3;
  b.disc(0, 0, 0, r, PROP_DEPTH * 0.7, 18, rgb(darker(FADED_PINK, 0.6)));
  b.ring(0, 0, 0, r, r * 0.86, PROP_DEPTH * 0.76, 18, rgb(darker(FADED_PINK, 0.4)));
  b.disc(0, 0, z + 0.04, r * 0.62, 0.08, 14, rgb(FADED_YELLOW));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.disc(Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74, z + 0.08, 0.06, 0.06, 6, rgb(darker(FADED_PINK, 0.5)));
  }
  b.disc(0, 0, z + 0.12, r * 0.2, 0.08, 8, rgb(lighter(FADED_PINK, 0.3)));
}

/** Gondola: a steel floor with an open cabin of two posts and a scalloped canopy above. */
function gondola({ parts, w, h, rng }: KitArgs): void {
  const b = parts.body;
  const paint = hsl(rng.pick([345, 48, 190, 12]), 0.55, 0.68);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.8, rgb(darker(paint, 0.8)));
  b.box(0, h / 2 - 0.03, 0, w, 0.06, PROP_DEPTH * 0.84, rgb(lighter(paint, 0.3)));
  const post = rgb(darker(paint, 0.7));
  const cabin = 0.72;
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) b.box(x, h / 2 + cabin / 2, -HALF_D * 0.5, 0.1, cabin, 0.1, post);
  b.box(0, h / 2 + cabin, -HALF_D * 0.5, w + 0.3, 0.14, 0.5, rgb(paint));
  for (let i = 0; i < 5; i++) b.disc(-w / 2 + (w * (i + 0.5)) / 5, h / 2 + cabin - 0.05, -HALF_D * 0.5 + 0.26, w / 10, 0.05, 8, rgb(i % 2 ? lighter(paint, 0.4) : paint));
  b.box(0, h / 2 + 0.45, -HALF_D * 0.5, w - 0.2, 0.06, 0.06, post);
}

/** Swing top bar: a yellow tube with two hanger eyes where the chains attach. */
function swingBeam({ parts, w, h }: KitArgs): void {
  const b = parts.body;
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.42, rgb(FADED_YELLOW));
  b.box(0, h / 2 - 0.03, 0, w, 0.06, PROP_DEPTH * 0.46, rgb(lighter(FADED_YELLOW, 0.3)));
  const iron = rgb(darker(FADED_YELLOW, 0.5));
  for (const x of [-w * 0.28, w * 0.28]) {
    b.box(x, -h / 2 - 0.08, 0, 0.2, 0.16, PROP_DEPTH * 0.3, iron);
    b.ring(x, -h / 2 - 0.2, 0, 0.1, 0.05, PROP_DEPTH * 0.2, 8, iron);
  }
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) b.box(x, 0, 0, 0.3, h * 1.5, PROP_DEPTH * 0.5, iron);
}

/** Swing seat: a black rubber sling in a steel frame; the chains are drawn from the hinge by the scene. */
function swingSeat({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.46, rgb(darker(base, 0.9)));
  b.box(0, h / 2 - 0.05, 0, w - 0.1, 0.1, PROP_DEPTH * 0.5, rgb(hsl(225, 0.1, 0.16)));
  b.box(0, -h / 2 + 0.03, 0, w, 0.06, PROP_DEPTH * 0.5, rgb(lighter(base, 0.2)));
  for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) {
    b.disc(x, h / 2 + 0.02, PROP_DEPTH * 0.23 + 0.02, 0.07, 0.04, 8, rgb(darker(base, 0.5)));
  }
}

/** See-saw: a long plank with a grab bar and rubber bumper at each end and a fulcrum cap at the middle. */
function seesaw({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const plank = hsl(48, 0.62, 0.7);
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.66, rgb(plank));
  b.box(0, h / 2 - 0.03, 0, w, 0.06, PROP_DEPTH * 0.7, rgb(lighter(plank, 0.3)));
  b.box(0, -h / 2 + 0.03, 0, w, 0.06, PROP_DEPTH * 0.7, rgb(darker(plank, 0.7)));
  const iron = rgb(darker(base, 0.7));
  for (const x of [-w / 2 + 0.5, w / 2 - 0.5]) {
    b.box(x, h / 2 + 0.28, 0, 0.1, 0.56, 0.1, iron);
    b.box(x, h / 2 + 0.56, 0, 0.36, 0.08, 0.1, rgb(FADED_PINK));
    b.box(x + (x < 0 ? -0.5 : 0.5) * 0.4, -h / 2 - 0.07, 0, 0.5, 0.14, PROP_DEPTH * 0.6, rgb(hsl(225, 0.1, 0.16)));
  }
  b.disc(0, 0, PROP_DEPTH * 0.33 + 0.02, 0.3, 0.06, 12, rgb(FADED_PINK));
  b.disc(0, 0, PROP_DEPTH * 0.33 + 0.05, 0.1, 0.05, 8, iron);
  const stripe = rgb(FADED_PINK);
  for (let x = -w / 2 + 1.2; x < w / 2 - 0.8; x += 0.8) if (Math.abs(x) > 0.5) b.box(x, 0, PROP_DEPTH * 0.33 + 0.01, 0.3, h * 0.6, 0.012, stripe);
}

/** Ball pit: a bright plastic tub brimming with balls. */
function ballPit({ parts, w, h, rng }: KitArgs): void {
  const b = parts.body;
  const tub = hsl(205, 0.42, 0.62);
  b.box(0, -h * 0.18, 0, w, h * 0.64, PROP_DEPTH * 0.9, rgb(tub));
  b.box(0, -h * 0.18, HALF_D * 0.9 + 0.01, w * 0.94, 0.05, 0.02, rgb(darker(tub, 0.7)));
  const radius = 0.27;
  for (let row = 0; row < 2; row++) {
    const y = h * 0.14 + row * radius * 1.4;
    const inset = row * radius;
    for (let x = -w / 2 + radius + inset; x < w / 2 - radius - inset + 1e-6; x += radius * 2.05) {
      const tone = rng.pick(BALL_TONES);
      const cx = x + rng.range(-0.04, 0.04);
      b.disc(cx, y, HALF_D * 0.7 + row * 0.02, radius, 0.3, 7, rgb(tone));
      if (Math.round((x + w) / (radius * 2.05)) % 2 === 0) {
        b.disc(cx - radius * 0.3, y + radius * 0.3, HALF_D * 0.7 + row * 0.02 + 0.17, radius * 0.28, 0.02, 4, rgb(lighter(tone, 0.55)));
      }
    }
  }
  b.box(0, h / 2 - 0.04, -HALF_D * 0.5, w * 1.04, 0.08, 0.12, rgb(darker(tub, 0.8)));
}

/** Monkey bars: a steel top rail on brackets with rungs hanging below it. */
function monkeyBars({ parts, w, h, base }: KitArgs): void {
  const b = parts.body;
  const tube = hsl(48, 0.6, 0.66);
  b.box(0, h / 2 - 0.09, 0, w, 0.18, PROP_DEPTH * 0.5, rgb(tube));
  b.box(0, h / 2 - 0.02, 0, w, 0.04, PROP_DEPTH * 0.54, rgb(lighter(tube, 0.32)));
  b.box(0, -h / 2 + 0.05, 0, w, 0.1, PROP_DEPTH * 0.5, rgb(darker(tube, 0.84)));
  const rung = rgb(darker(tube, 0.74));
  for (let x = -w / 2 + 0.3; x < w / 2; x += 0.46) b.box(x, 0, 0, 0.07, h, PROP_DEPTH * 0.44, rung);
  const bracket = rgb(darker(base, 0.65));
  for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) b.box(x, 0, 0, 0.2, h * 1.5, PROP_DEPTH * 0.6, bracket);
}

/** Roundabout seen edge-on from above: striped wedges, a rim of grab bars and a centre cap. It spins, so the stripes show the turn. */
function carousel({ parts, w, base }: KitArgs): void {
  const b = parts.body;
  const r = w / 2;
  const z = PROP_DEPTH * 0.3;
  b.disc(0, 0, 0, r, PROP_DEPTH * 0.6, 20, rgb(darker(base, 0.9)));
  const wedges = 8;
  for (let i = 0; i < wedges; i++) {
    const a0 = (i / wedges) * Math.PI * 2;
    b.sector(0, 0, z + 0.012, r * 0.92, a0, a0 + (Math.PI * 2) / wedges, rgb(i % 2 ? FADED_PINK : FADED_YELLOW), 3);
  }
  b.ring(0, 0, 0, r, r * 0.9, PROP_DEPTH * 0.66, 20, rgb(darker(base, 0.65)));
  for (let i = 0; i < wedges; i++) {
    const a = ((i + 0.5) / wedges) * Math.PI * 2;
    b.disc(Math.cos(a) * r * 0.76, Math.sin(a) * r * 0.76, z + 0.05, 0.1, 0.1, 6, rgb(darker(base, 0.5)));
  }
  b.disc(0, 0, z + 0.06, r * 0.18, 0.1, 10, rgb(darker(base, 0.55)));
  b.disc(0, 0, z + 0.12, r * 0.07, 0.06, 8, rgb(lighter(base, 0.3)));
}

/** Giant beach ball: six wedges around a white cap. Rubber, so it bounces. */
function giantBall({ parts, w, rng }: KitArgs): void {
  const b = parts.body;
  const r = w / 2;
  const z = PROP_DEPTH * 0.3;
  b.disc(0, 0, 0, r, PROP_DEPTH * 0.6, 18, rgb(hsl(0, 0, 0.9)));
  const start = rng.range(0, Math.PI);
  const wedges = 6;
  for (let i = 0; i < wedges; i++) {
    const a0 = start + (i / wedges) * Math.PI * 2;
    b.sector(0, 0, z + 0.012, r * 0.97, a0, a0 + (Math.PI * 2) / wedges, rgb(i % 2 ? hsl(0, 0, 0.94) : BALL_TONES[i % BALL_TONES.length]!), 3);
  }
  b.disc(0, 0, z + 0.05, r * 0.14, 0.06, 8, rgb(hsl(0, 0, 0.98)));
  const shine = new GeometryBuilder();
  shine.disc(0, 0, z + 0.07, r * 0.16, 0.02, 8, rgb(hsl(0, 0, 1)));
  b.append(shine, -r * 0.45, r * 0.45, 0);
}

export const PLAYGROUND_KIT: Readonly<Record<string, KitBuilder>> = {
  'toy-block': toyBlock,
  'slide-ramp': slideRamp,
  'ferris-spoke': ferrisSpoke,
  gondola,
  'wheel-hub': wheelHub,
  'wheel-spoke': ferrisSpoke,
  'wheel-cabin': gondola,
  'swing-beam': swingBeam,
  'swing-seat': swingSeat,
  seesaw,
  'ball-pit': ballPit,
  'monkey-bars': monkeyBars,
  carousel,
  'giant-ball': giantBall,
};
