import { Color } from 'three';
import type { MaterialId } from '@/config/materials';
import { Rng } from '@/core/rng';
import type { BuiltProp } from '@/sim/world';
import { GeometryBuilder, rgb } from './geometry';
import { METROPOLIS_KIT } from './kit-metropolis';
import { PLAYGROUND_KIT } from './kit-playground';
import { REACTIVE_KIT } from './kit-reactive';
import { STRATOSPHERE_KIT } from './kit-stratosphere';
import { SUBURBIA_KIT } from './kit-suburbia';
import type { BiomePalette } from './palette';
import { HALF_D, PROP_DEPTH, darker, hsl, lighter, newParts, type KitBuilder, type PropParts } from './prop-kit';

export { PROP_DEPTH, type PropParts };

const KITS: Readonly<Record<string, KitBuilder>> = { ...SUBURBIA_KIT, ...METROPOLIS_KIT, ...PLAYGROUND_KIT, ...STRATOSPHERE_KIT, ...REACTIVE_KIT };

const APPLIANCE_TINTS = [
  [40, 0.14, 0.8],
  [172, 0.3, 0.62],
  [14, 0.52, 0.66],
  [205, 0.18, 0.72],
  [52, 0.4, 0.74],
] as const;
const VEHICLE_TINTS = [
  [6, 0.58, 0.46],
  [208, 0.5, 0.42],
  [46, 0.62, 0.56],
  [150, 0.34, 0.4],
] as const;
const LOCKER_TINTS = [
  [190, 0.38, 0.44],
  [212, 0.3, 0.42],
  [96, 0.22, 0.46],
  [20, 0.42, 0.5],
] as const;

/** Base colour for a material, varied per prop so a pile never reads as copies. */
export function materialColor(id: MaterialId, palette: BiomePalette, rng: Rng): Color {
  const d = palette.dominant;
  const jitter = rng.range(-0.04, 0.04);
  switch (id) {
    case 'steel':
      return hsl(d.h - 8 + rng.range(-6, 5), 0.58 + rng.range(-0.06, 0.08), 0.22 + jitter);
    case 'appliance': {
      const [h, s, l] = rng.pick(APPLIANCE_TINTS);
      return hsl(h, s, l + jitter);
    }
    case 'vehicle': {
      const [h, s, l] = rng.pick(VEHICLE_TINTS);
      return hsl(h, s, l + jitter);
    }
    case 'locker': {
      const [h, s, l] = rng.pick(LOCKER_TINTS);
      return hsl(h, s, l + jitter);
    }
    case 'dish':
      return hsl(204, 0.1, 0.76 + jitter);
    case 'sheet':
      return hsl(30, 0.18, 0.58 + jitter);
    case 'can':
      return hsl(rng.pick([8, 44, 160, 210]), 0.42, 0.52 + jitter);
    case 'wood':
      return hsl(38, 0.5, 0.5 + jitter);
    case 'rubber':
      return hsl(220, 0.08, 0.17 + jitter / 2);
    case 'mattress':
      return hsl(rng.pick([340, 200, 46]), 0.4, 0.78);
    case 'glass':
      return hsl(196, 0.5, 0.74);
    case 'plastic':
      return hsl(rng.pick([4, 52, 200]), 0.7, 0.58);
    case 'fabric':
      return hsl(rng.pick([14, 280, 170]), 0.34, 0.62);
    case 'concrete':
      return hsl(34, 0.08, 0.6 + jitter);
    case 'trampoline':
      return hsl(palette.accent.h, 0.7, 0.62);
    case 'ballpit':
      return hsl(rng.pick([345, 48, 190, 12]), 0.5, 0.72);
  }
}

/** Local-space parts for one prop, centred on its body origin. */
export function buildPropParts(prop: BuiltProp, palette: BiomePalette, seed: number): PropParts {
  const parts = buildPropBody(prop, palette, seed);
  stampProvenance(parts, prop, palette, seed);
  return parts;
}

function buildPropBody(prop: BuiltProp, palette: BiomePalette, seed: number): PropParts {
  const rng = new Rng(seed * 7919 + prop.index * 104729 + 17);
  const base = materialColor(prop.material.id, palette, rng);
  const parts = newParts();
  const magnetic = prop.material.magnetic !== 'inert';
  const rimColor = rgb(new Color().setHSL(0.52, 0.85, 0.55));

  const { width: w, height: h, radius: r } = prop;
  const detail = prop.kind.detail ?? 'plain';
  const b = parts.body;

  const kit = KITS[prop.kind.id];
  if (kit) {
    kit({ parts, w, h, base, rng, palette });
    b.bakeOcclusion(-h / 2, h / 2, -HALF_D, 0.24);
    if (magnetic) {
      if (prop.kind.shape.type === 'disc') rimDisc(parts.rim, r, rimColor);
      else rimBox(parts.rim, w, h, rimColor);
    }
    return parts;
  }

  if (prop.kind.shape.type === 'disc') {
    buildDisc(parts, prop, base, rng);
    b.bakeOcclusion(-r, r, -HALF_D, 0.2);
    if (magnetic) rimDisc(parts.rim, r, rimColor);
    return parts;
  }

  switch (detail) {
    case 'rivets':
      buildIBeam(parts, w, h, base, rng);
      break;
    case 'handle':
      buildAppliance(parts, prop.kind.id, w, h, base, rng);
      break;
    case 'dents':
      if (prop.kind.id === 'car') buildCar(parts, w, h, base, rng);
      else buildSheet(parts, w, h, base, rng);
      break;
    case 'slats':
      buildLocker(parts, w, h, base);
      break;
    case 'planks':
      buildWood(parts, prop.kind.id, w, h, base);
      break;
    case 'panes':
      buildPane(parts, w, h, base);
      break;
    default:
      buildSlab(parts, prop.kind.id, w, h, base, rng);
  }

  b.bakeOcclusion(-h / 2, h / 2, -HALF_D, prop.kind.id === 'slab' ? 0.12 : 0.26);
  if (magnetic) rimBox(parts.rim, w, h, rimColor);
  return parts;
}

function rimBox(rim: GeometryBuilder, w: number, h: number, color: readonly [number, number, number]): void {
  const t = 0.07;
  const z = HALF_D + 0.012;
  rim.box(0, h / 2 - t / 2, z, w, t, 0.02, color);
  rim.box(0, -h / 2 + t / 2, z, w, t, 0.02, color);
  rim.box(-w / 2 + t / 2, 0, z, t, h, 0.02, color);
  rim.box(w / 2 - t / 2, 0, z, t, h, 0.02, color);
}

function rimDisc(rim: GeometryBuilder, r: number, color: readonly [number, number, number]): void {
  rim.ring(0, 0, HALF_D + 0.012, r, r - 0.07, 0.02, 20, color);
}

/**
 * The provenance stamp (R-AR-07): one small marker on every interactive prop,
 * drawn from its biome's vocabulary — a bolted patch plate in the Scrapyard, a
 * pale price sticker in Suburbia, a torn flyer in Metropolis, a crayon sticker
 * in the Playground, a foil patch in the Stratosphere. The world tells its
 * stories through wear, never through faces.
 */
function stampProvenance(parts: PropParts, prop: BuiltProp, palette: BiomePalette, seed: number): void {
  const rng = new Rng(seed * 7919 + prop.index * 104729 + 101);
  const b = parts.body;
  const w = prop.radius ? prop.radius * 2 : prop.width;
  const h = prop.radius ? prop.radius * 2 : prop.height;
  const size = Math.min(0.18, Math.max(0.07, Math.min(w, h) * 0.16));
  const x = rng.range(-w * 0.28, w * 0.28);
  const y = rng.range(-h * 0.28, h * 0.28);
  const z = HALF_D + 0.014;
  switch (palette.biome) {
    case 'scrapyard':
      b.box(x, y, z, size, size * 0.78, 0.012, rgb(hsl(28, 0.24, 0.3)));
      for (const dx of [-size * 0.3, size * 0.3]) b.disc(x + dx, y - size * 0.28, z + 0.004, size * 0.12, 0.012, 6, rgb(hsl(18, 0.32, 0.22)));
      break;
    case 'suburbia':
      b.box(x, y, z, size * 0.9, size * 0.68, 0.01, rgb(hsl(48, 0.3, 0.86)));
      b.box(x - size * 0.18, y + size * 0.1, z + 0.004, size * 0.4, size * 0.16, 0.01, rgb(hsl(330, 0.4, 0.72)));
      break;
    case 'metropolis':
      b.box(x, y, z, size * 0.95, size * 0.75, 0.01, rgb(hsl(210, 0.14, 0.78)));
      b.box(x + size * 0.3, y - size * 0.3, z + 0.004, size * 0.34, size * 0.2, 0.01, rgb(hsl(256, 0.3, 0.32)));
      break;
    case 'playground':
      b.box(x, y, z, size, size * 0.72, 0.01, rgb(hsl(52, 0.72, 0.6)));
      b.box(x + size * 0.12, y - size * 0.18, z + 0.004, size * 0.44, size * 0.3, 0.01, rgb(hsl(190, 0.68, 0.56)));
      break;
    default:
      b.box(x, y, z, size * 1.1, size * 0.8, 0.01, rgb(hsl(210, 0.08, 0.72)));
      b.box(x, y + size * 0.32, z + 0.004, size * 1.1, size * 0.07, 0.01, rgb(hsl(210, 0.1, 0.5)));
  }
  parts.wear++;
}

function buildIBeam(parts: PropParts, w: number, h: number, base: Color, rng: Rng): void {
  const b = parts.body;
  const flange = rgb(lighter(base, 0.06));
  const web = rgb(darker(base, 0.88));
  const rivet = rgb(darker(base, 0.6));
  if (h > w * 1.2) {
    const f = Math.max(0.12, w * 0.3);
    b.box(-w / 2 + f / 2, 0, 0, f, h, PROP_DEPTH, flange);
    b.box(w / 2 - f / 2, 0, 0, f, h, PROP_DEPTH, flange);
    b.box(0, 0, 0, w - 2 * f, h, PROP_DEPTH * 0.46, web);
    for (let y = -h / 2 + 0.5; y < h / 2 - 0.3; y += 0.7) b.disc(0, y, PROP_DEPTH * 0.23 + 0.02, 0.07, 0.05, 6, rivet);
  } else {
    const f = Math.max(0.1, h * 0.3);
    b.box(0, h / 2 - f / 2, 0, w, f, PROP_DEPTH, flange);
    b.box(0, -h / 2 + f / 2, 0, w, f, PROP_DEPTH, flange);
    b.box(0, 0, 0, w, h - 2 * f, PROP_DEPTH * 0.46, web);
    const spacing = Math.max(w > 6 ? 0.8 : 0.6, w / 18);
    for (let x = -w / 2 + 0.45; x < w / 2 - 0.3; x += spacing) b.disc(x, 0, PROP_DEPTH * 0.23 + 0.02, h * 0.1, 0.05, 6, rivet);
  }
  // Streaks of rust: a few darker patches on the flanges.
  for (let i = 0; i < Math.round(w / 1.6); i++) {
    const px = rng.range(-w / 2, w / 2);
    const pw = rng.range(0.3, 0.9);
    b.box(px, h > w ? rng.range(-h / 2, h / 2) : h / 2 - 0.02, HALF_D + 0.005, pw, 0.04, 0.01, rgb(darker(base, 0.5)));
  }
  parts.wear++;
}

function buildAppliance(parts: PropParts, kind: string, w: number, h: number, base: Color, rng: Rng): void {
  const b = parts.body;
  const body = rgb(base);
  const seam = rgb(darker(base, 0.55));
  const handle = rgb(lighter(base, 0.35));
  const z = HALF_D;
  b.box(0, 0, 0, w, h, PROP_DEPTH, body);
  b.box(0, -h / 2 + 0.12, z * 0.05, w * 1.02, 0.24, PROP_DEPTH * 1.02, rgb(darker(base, 0.7)));

  if (kind === 'fridge') {
    const split = h * 0.16;
    b.box(0, split, z + 0.01, w * 0.94, 0.05, 0.02, seam);
    b.box(w * 0.34, split + h * 0.2, z + 0.06, 0.14, h * 0.2, 0.14, handle);
    b.box(w * 0.34, split - h * 0.16, z + 0.06, 0.14, h * 0.14, 0.14, handle);
    b.box(0, h / 2 - 0.1, z + 0.01, w * 0.9, 0.04, 0.02, seam);
  } else if (kind === 'washer') {
    b.disc(0, -h * 0.06, z + 0.02, w * 0.32, 0.05, 14, seam);
    b.disc(0, -h * 0.06, z + 0.05, w * 0.25, 0.04, 14, rgb(darker(base, 0.35)));
    b.box(-w * 0.24, h / 2 - 0.3, z + 0.03, w * 0.26, 0.18, 0.05, handle);
    b.disc(w * 0.28, h / 2 - 0.3, z + 0.05, 0.09, 0.05, 8, seam);
  } else {
    b.box(0, h * 0.18, z + 0.01, w * 0.86, 0.04, 0.02, seam);
    b.box(0, -h * 0.18, z + 0.01, w * 0.86, 0.04, 0.02, seam);
    b.box(0, h * 0.34, z + 0.06, w * 0.34, 0.12, 0.12, handle);
    b.box(0, -h * 0.02, z + 0.06, w * 0.34, 0.12, 0.12, handle);
    b.box(0, -h * 0.38, z + 0.06, w * 0.34, 0.12, 0.12, handle);
  }
  // A dent or two so no appliance looks factory fresh.
  const dx = rng.range(-w * 0.3, w * 0.3);
  b.displace((x, y, zz) => (zz > 0 && Math.hypot(x - dx, y - h * 0.3) < 0.18 ? [0, 0, -0.04] : [0, 0, 0]));
  parts.wear++;
}

function buildCar(parts: PropParts, w: number, h: number, base: Color, rng: Rng): void {
  const b = parts.body;
  const paint = rgb(base);
  const glass = rgb(hsl(205, 0.25, 0.22));
  const tire = rgb(hsl(220, 0.08, 0.12));
  const lowerH = h * 0.56;
  b.box(0, -h / 2 + lowerH / 2, 0, w, lowerH, PROP_DEPTH * 0.92, paint);
  const cabinH = h - lowerH;
  b.taperedBox(w * 0.02, h / 2 - cabinH / 2, 0, w * 0.56, w * 0.4, cabinH, PROP_DEPTH * 0.82, rgb(darker(base, 0.94)));
  b.taperedBox(w * 0.02, h / 2 - cabinH / 2, PROP_DEPTH * 0.411, w * 0.46, w * 0.32, cabinH * 0.62, 0.02, glass);
  for (const wx of [-w * 0.3, w * 0.3]) {
    b.disc(wx, -h / 2 + 0.05, PROP_DEPTH * 0.42, h * 0.3, 0.3, 10, tire);
    b.disc(wx, -h / 2 + 0.05, PROP_DEPTH * 0.58, h * 0.14, 0.08, 8, rgb(hsl(210, 0.06, 0.5)));
  }
  b.box(w / 2 - 0.1, -h * 0.18, PROP_DEPTH * 0.47, 0.2, 0.2, 0.05, rgb(hsl(48, 0.9, 0.7)));
  b.box(-w / 2 + 0.1, -h * 0.18, PROP_DEPTH * 0.47, 0.2, 0.2, 0.05, rgb(hsl(2, 0.8, 0.45)));
  // Crush the roof and one corner.
  const crushX = rng.range(-w * 0.2, w * 0.25);
  b.displace((x, y) => (y > h * 0.12 && Math.abs(x - crushX) < 0.7 ? [0, -0.1 * (1 - Math.abs(x - crushX) / 0.7), 0] : [0, 0, 0]));
  parts.wear++;
}

function buildSheet(parts: PropParts, w: number, h: number, base: Color, rng: Rng): void {
  const b = parts.body;
  const segments = Math.max(3, Math.round(w / 0.55));
  const sw = w / segments;
  for (let i = 0; i < segments; i++) {
    const tone = darker(base, 0.82 + rng.next() * 0.3);
    if (rng.next() < 0.25) tone.lerp(hsl(18, 0.55, 0.38), 0.55);
    b.box(-w / 2 + sw * (i + 0.5), 0, 0, sw * 1.01, h, PROP_DEPTH * 0.86, rgb(tone));
  }
  b.displace((x, _y, z) => [0, Math.sin(x * 3.1) * 0.035 + Math.sin(x * 7.3 + z) * 0.012, 0]);
  for (let i = 0; i < 3; i++) {
    b.disc(-w / 2 + (w * (i + 0.5)) / 3, 0, HALF_D * 0.86 + 0.02, 0.05, 0.04, 6, rgb(darker(base, 0.5)));
  }
  parts.wear++;
}

function buildLocker(parts: PropParts, w: number, h: number, base: Color): void {
  const b = parts.body;
  const seam = rgb(darker(base, 0.5));
  b.box(0, 0, 0, w, h, PROP_DEPTH, rgb(base));
  b.box(0, 0, HALF_D + 0.01, 0.05, h * 0.98, 0.02, seam);
  for (let i = 0; i < 4; i++) b.box(-w * 0.22, h * 0.36 - i * 0.12, HALF_D + 0.012, w * 0.3, 0.04, 0.02, seam);
  for (let i = 0; i < 4; i++) b.box(w * 0.22, h * 0.36 - i * 0.12, HALF_D + 0.012, w * 0.3, 0.04, 0.02, seam);
  b.box(-w * 0.12, -h * 0.02, HALF_D + 0.06, 0.12, 0.28, 0.12, rgb(lighter(base, 0.4)));
  b.box(w * 0.12, -h * 0.02, HALF_D + 0.06, 0.12, 0.28, 0.12, rgb(lighter(base, 0.4)));
}

function buildWood(parts: PropParts, kind: string, w: number, h: number, base: Color): void {
  const b = parts.body;
  const groove = rgb(darker(base, 0.62));
  if (kind === 'plank') {
    b.box(0, 0, 0, w, h, PROP_DEPTH * 0.9, rgb(base));
    for (let i = 0; i < 3; i++) b.box(0, h / 2 - 0.05, -HALF_D * 0.9 + (i + 1) * (PROP_DEPTH * 0.9 / 4), w, 0.02, 0.05, groove);
    for (let x = -w / 2 + 0.5; x < w / 2; x += 0.9) b.disc(x, 0, PROP_DEPTH * 0.45 + 0.01, h * 0.1, 0.04, 6, rgb(hsl(220, 0.08, 0.3)));
    return;
  }
  b.box(0, 0, 0, w, h, PROP_DEPTH * 0.9, rgb(darker(base, 0.9)));
  const f = 0.14;
  const z = PROP_DEPTH * 0.45 + 0.02;
  b.box(0, h / 2 - f / 2, z, w, f, 0.06, rgb(base));
  b.box(0, -h / 2 + f / 2, z, w, f, 0.06, rgb(base));
  b.box(-w / 2 + f / 2, 0, z, f, h, 0.06, rgb(base));
  b.box(w / 2 - f / 2, 0, z, f, h, 0.06, rgb(base));
  const diag = Math.hypot(w, h) * 0.92;
  const angle = Math.atan2(h, w);
  const brace = new GeometryBuilder();
  brace.box(0, 0, 0, diag, 0.12, 0.05, rgb(base));
  b.append(brace, 0, 0, angle);
}

function buildPane(parts: PropParts, w: number, h: number, base: Color): void {
  const glass = rgb(base);
  parts.glass.box(0, 0, 0, w, h, PROP_DEPTH * 0.7, glass);
  const frame = rgb(hsl(215, 0.1, 0.35));
  parts.body.box(-w / 2 + 0.05, 0, 0, 0.1, h * 1.3, PROP_DEPTH * 0.76, frame);
  parts.body.box(w / 2 - 0.05, 0, 0, 0.1, h * 1.3, PROP_DEPTH * 0.76, frame);
}

function buildSlab(parts: PropParts, kind: string, w: number, h: number, base: Color, rng: Rng): void {
  const b = parts.body;
  if (kind === 'mattress') {
    b.box(0, 0, 0, w, h, PROP_DEPTH * 0.95, rgb(base));
    const stripe = rgb(darker(base, 0.88));
    const n = Math.max(3, Math.round(w / 0.8));
    for (let i = 0; i < n; i += 2) b.box(-w / 2 + (w * (i + 0.5)) / n, 0, HALF_D * 0.95 + 0.01, w / n, h * 0.96, 0.02, stripe);
    for (let i = 0; i < Math.round(w / 0.9); i++) b.disc(-w / 2 + 0.45 + i * 0.9, 0, HALF_D * 0.95 + 0.03, 0.06, 0.05, 6, rgb(darker(base, 0.55)));
    parts.wear++;
    return;
  }
  b.box(0, 0, 0, w, h, PROP_DEPTH, rgb(base));
  const seamTone = rgb(darker(base, 0.78));
  for (let x = -w / 2 + 2; x < w / 2; x += rng.range(2.2, 3.4)) b.box(x, 0, HALF_D + 0.008, 0.04, h, 0.02, seamTone);
  b.box(0, h / 2 - 0.05, 0, w, 0.1, PROP_DEPTH * 1.01, rgb(lighter(base, 0.08)));
  parts.wear++;
}

function buildDisc(parts: PropParts, prop: BuiltProp, base: Color, rng: Rng): void {
  const b = parts.body;
  const r = prop.radius;
  switch (prop.kind.id) {
    case 'tire': {
      b.disc(0, 0, 0, r, PROP_DEPTH * 0.7, 14, rgb(base));
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        b.box(Math.cos(a) * (r + 0.03), Math.sin(a) * (r + 0.03), 0, 0.16, 0.16, PROP_DEPTH * 0.72, rgb(darker(base, 0.8)));
      }
      b.ring(0, 0, PROP_DEPTH * 0.35 + 0.01, r * 0.62, r * 0.36, 0.04, 14, rgb(hsl(210, 0.08, 0.34)));
      b.disc(0, 0, PROP_DEPTH * 0.35 + 0.03, r * 0.3, 0.05, 10, rgb(hsl(215, 0.1, 0.5)));
      break;
    }
    case 'dish': {
      const rim = rgb(hsl(204, 0.1, 0.82));
      b.ring(0, 0, 0, r, r * 0.86, PROP_DEPTH * 0.5, 18, rim);
      b.disc(0, 0, -PROP_DEPTH * 0.08, r * 0.86, PROP_DEPTH * 0.3, 18, rgb(hsl(204, 0.08, 0.66)));
      b.disc(0, 0, PROP_DEPTH * 0.1, r * 0.2, PROP_DEPTH * 0.3, 8, rgb(hsl(204, 0.1, 0.4)));
      b.box(0, -r * 0.5, 0, 0.1, r, 0.1, rgb(hsl(204, 0.1, 0.4)));
      break;
    }
    case 'barrel': {
      b.disc(0, 0, 0, r, PROP_DEPTH * 0.8, 12, rgb(base));
      b.ring(0, 0, PROP_DEPTH * 0.4 + 0.015, r * 0.98, r * 0.78, 0.03, 12, rgb(darker(base, 0.6)));
      b.ring(0, 0, 0, r * 1.01, r * 0.96, PROP_DEPTH * 0.82, 12, rgb(darker(base, 0.65)));
      b.disc(0, 0, PROP_DEPTH * 0.4 + 0.03, r * 0.34, 0.04, 8, rgb(darker(base, 0.5)));
      break;
    }
    default: {
      b.disc(0, 0, 0, r, PROP_DEPTH * 0.7, 12, rgb(base));
      b.ring(0, 0, PROP_DEPTH * 0.35 + 0.01, r * 0.96, r * 0.8, 0.03, 12, rgb(darker(base, 0.7)));
      b.ring(0, 0, 0, r * 1.01, r * 0.9, PROP_DEPTH * 0.3, 12, rgb(lighter(base, 0.18)));
      if (prop.kind.id === 'can') b.box(0, 0, PROP_DEPTH * 0.35 + 0.02, r * 1.3, r * 0.5, 0.02, rgb(hsl(rng.pick([8, 44, 200]), 0.5, 0.7)));
    }
  }
}
