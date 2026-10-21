import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type PerspectiveCamera,
} from 'three';
import { Rng } from '@/core/rng';
import { clamp } from '@/core/mathx';
import type { BiomeId } from '@/sim/types';
import { PALETTES, mixHsl, toColor } from './palette';

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uStars;
  uniform float uAltitude;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float k = smoothstep(-0.02, 0.2, vDir.y + uAltitude * 0.35);
    vec3 col = mix(uHorizon, uTop, k);
    col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.35, vDir.y) * 0.6);
    float sun = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(sun, 380.0) * 1.4 + pow(sun, 18.0) * 0.28);
    if (uStars > 0.0) {
      vec2 cell = floor(gl_FragCoord.xy / 3.0);
      float s = step(0.9972, hash(cell));
      col += vec3(s) * uStars * (0.4 + 0.6 * hash(cell + 3.0));
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

const AURORA_VERTEX = /* glsl */ `
  attribute float aHeight;
  uniform float uTime;
  varying float vHeight;
  varying float vWave;
  void main() {
    vHeight = aHeight;
    vec3 p = position;
    float wave = sin(p.x * 0.045 + uTime * 0.35 + aHeight * 1.7);
    p.x += wave * 6.0 * aHeight;
    p.y += sin(p.x * 0.03 + uTime * 0.2) * 4.0;
    vWave = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const AURORA_FRAGMENT = /* glsl */ `
  uniform vec3 uLow;
  uniform vec3 uHigh;
  uniform float uTime;
  varying float vHeight;
  varying float vWave;
  void main() {
    float fade = smoothstep(0.0, 0.14, vHeight) * (1.0 - smoothstep(0.5, 1.0, vHeight));
    float shimmer = 0.78 + 0.22 * sin(vWave * 3.0 + uTime * 0.8);
    gl_FragColor = vec4(mix(uLow, uHigh, vHeight) * shimmer, fade * 0.42);
  }
`;

const AURORA_RIBBONS = 4;
const AURORA_COLUMNS = 36;

interface Layer {
  mesh: Mesh;
  /** 0 pins the layer to the world, 1 pins it to the camera. */
  parallax: number;
  baseY: number;
}

interface LayerSpec {
  z: number;
  scale: number;
  height: number;
  parallax: number;
}

interface Lights {
  positions: number[];
  colors: number[];
}

interface Skyline {
  ridge: Array<[number, number]>;
  lights: Lights;
  /** Free-standing silhouettes the ridge cannot express, as flat triangles: six numbers each. */
  shapes?: number[];
}

const WINDOW_TONES: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0.82, 0.5],
  [1, 0.82, 0.5],
  [0.55, 0.9, 1],
  [1, 0.45, 0.85],
];

/** Piled cars and fridges: flat-topped stacks with the odd spike. */
function junkRidge(spec: LayerSpec, rng: Rng): Array<[number, number]> {
  const x0 = -260;
  const x1 = 260;
  let x = x0;
  let y = rng.range(0.3, 0.7) * spec.height;
  const ridge: Array<[number, number]> = [[x0, -2]];
  while (x < x1) {
    const step = rng.range(2.5, 7) * spec.scale * 0.6;
    x += step;
    y = clamp(y + rng.range(-0.28, 0.28) * spec.height, spec.height * 0.15, spec.height);
    ridge.push([x, y * (0.65 + 0.35 * Math.sin(x * 0.011 + spec.z))]);
    if (rng.next() < 0.45) ridge.push([x + step * 0.5, ridge[ridge.length - 1]![1]]);
  }
  ridge.push([x1, -2]);
  return ridge;
}

/** Gabled houses and round trees on a gentle rise. */
function suburbRidge(spec: LayerSpec, rng: Rng): Array<[number, number]> {
  const x1 = 260;
  const ridge: Array<[number, number]> = [[-260, -2]];
  let x = -260;
  const ground = spec.height * 0.12;
  while (x < x1) {
    const swell = ground * (0.6 + 0.4 * Math.sin(x * 0.015 + spec.z));
    if (rng.next() < 0.72) {
      const w = rng.range(6, 11) * spec.scale * 0.55;
      const wall = spec.height * rng.range(0.22, 0.4);
      const peak = wall + spec.height * rng.range(0.14, 0.26);
      ridge.push([x, swell], [x, swell + wall], [x + w / 2, swell + peak], [x + w, swell + wall], [x + w, swell]);
      x += w;
    } else {
      const r = rng.range(1.6, 3) * spec.scale * 0.6;
      const top = swell + r * 2.4;
      ridge.push([x, swell], [x + r * 0.2, swell + r], [x + r * 0.8, top - r * 0.3], [x + r, top], [x + r * 1.2, top - r * 0.3], [x + r * 1.8, swell + r], [x + r * 2, swell]);
      x += r * 2;
    }
    x += rng.range(0.4, 2.2) * spec.scale * 0.5;
  }
  ridge.push([x1, -2]);
  return ridge;
}

/** Towers with setbacks and antennas, plus lit windows for the lights mesh. */
function cityRidge(spec: LayerSpec, rng: Rng): Skyline {
  const x1 = 260;
  const ridge: Array<[number, number]> = [[-260, -2]];
  const lights: Lights = { positions: [], colors: [] };
  const budget = 520;
  let x = -260;
  let lit = 0;
  while (x < x1) {
    const w = rng.range(5, 12) * spec.scale * 0.55;
    const h = spec.height * rng.range(0.35, 1.25);
    ridge.push([x, -2], [x, h]);
    const step = rng.next() < 0.4;
    if (step) ridge.push([x + w * 0.2, h], [x + w * 0.2, h + spec.height * 0.12], [x + w * 0.8, h + spec.height * 0.12], [x + w * 0.8, h]);
    if (rng.next() < 0.3) ridge.push([x + w / 2 - 0.15 * spec.scale, h], [x + w / 2, h + spec.height * 0.3], [x + w / 2 + 0.15 * spec.scale, h]);
    ridge.push([x + w, h], [x + w, -2]);

    const cell = 1.1 * spec.scale;
    for (let wx = x + cell * 0.6; wx < x + w - cell * 0.4 && lit < budget; wx += cell) {
      for (let wy = cell * 1.2; wy < h - cell * 0.5 && lit < budget; wy += cell * 1.3) {
        if (rng.next() > 0.22) continue;
        const [r, g, b] = rng.pick(WINDOW_TONES);
        const hw = cell * 0.2;
        const hh = cell * 0.28;
        lights.positions.push(wx - hw, wy - hh, wx + hw, wy - hh, wx + hw, wy + hh, wx - hw, wy - hh, wx + hw, wy + hh, wx - hw, wy + hh);
        for (let v = 0; v < 6; v++) lights.colors.push(r, g, b);
        lit++;
      }
    }
    x += w + rng.range(0.2, 1.4) * spec.scale * 0.5;
  }
  ridge.push([x1, -2]);
  return { ridge, lights };
}

/** A line of thickness `t` from (x0, y0) to (x1, y1), as two triangles. */
function bar(out: number[], x0: number, y0: number, x1: number, y1: number, t: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = (-(y1 - y0) / len) * (t / 2);
  const ny = ((x1 - x0) / len) * (t / 2);
  out.push(x0 + nx, y0 + ny, x0 - nx, y0 - ny, x1 - nx, y1 - ny, x0 + nx, y0 + ny, x1 - nx, y1 - ny, x1 + nx, y1 + ny);
}

function blob(out: number[], cx: number, cy: number, r: number, segments = 10): void {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    out.push(cx, cy, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
  }
}

function annulus(out: number[], cx: number, cy: number, outer: number, inner: number, segments = 28): void {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const o0: [number, number] = [cx + Math.cos(a0) * outer, cy + Math.sin(a0) * outer];
    const o1: [number, number] = [cx + Math.cos(a1) * outer, cy + Math.sin(a1) * outer];
    const i0: [number, number] = [cx + Math.cos(a0) * inner, cy + Math.sin(a0) * inner];
    const i1: [number, number] = [cx + Math.cos(a1) * inner, cy + Math.sin(a1) * inner];
    out.push(...o0, ...o1, ...i1, ...o0, ...i1, ...i0);
  }
}

/** Giant ferris wheel: a rim, spokes, a cabin at every tip and an A-frame to stand on. */
function ferrisWheel(out: number[], cx: number, base: number, radius: number, unit: number): void {
  const hubY = base + radius * 1.12;
  annulus(out, cx, hubY, radius, radius - unit * 0.5);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    bar(out, cx, hubY, cx + Math.cos(a) * radius, hubY + Math.sin(a) * radius, unit * 0.3);
    blob(out, cx + Math.cos(a) * radius, hubY + Math.sin(a) * radius, unit * 0.9, 6);
  }
  bar(out, cx, hubY, cx - radius * 0.55, base, unit * 0.7);
  bar(out, cx, hubY, cx + radius * 0.55, base, unit * 0.7);
}

/** Swing set: slanted legs, a top bar and two seats on chains. */
function swingFrame(out: number[], cx: number, base: number, height: number, unit: number): void {
  const half = height * 0.6;
  const top = base + height;
  bar(out, cx - half, top, cx - half - height * 0.22, base, unit * 0.8);
  bar(out, cx + half, top, cx + half + height * 0.22, base, unit * 0.8);
  bar(out, cx - half, top, cx + half, top, unit * 0.8);
  for (const sx of [-half * 0.35, half * 0.35]) {
    bar(out, cx + sx, top, cx + sx, base + height * 0.22, unit * 0.18);
    bar(out, cx + sx - unit * 1.2, base + height * 0.2, cx + sx + unit * 1.2, base + height * 0.2, unit * 0.5);
  }
}

/** Slide: a ladder tower and a long ramp running to the ground. */
function slideTower(out: number[], cx: number, base: number, height: number, unit: number): void {
  bar(out, cx, base, cx, base + height, unit * 1.1);
  blob(out, cx, base + height + unit * 0.4, unit * 1.1, 5);
  bar(out, cx, base + height, cx + height * 1.5, base + unit * 0.3, unit * 0.8);
  bar(out, cx + height * 1.5, base, cx + height * 1.5, base + unit, unit * 0.8);
}

/** See-saw: a plank tilted on a small trestle. */
function seesawTrestle(out: number[], cx: number, base: number, height: number, unit: number): void {
  const span = height * 1.3;
  bar(out, cx - span, base + height * 0.1, cx + span, base + height * 0.5, unit * 0.7);
  bar(out, cx - unit, base, cx, base + height * 0.3, unit * 0.7);
  bar(out, cx + unit, base, cx, base + height * 0.3, unit * 0.7);
}

const PLAYGROUND_PIECES = [ferrisWheel, swingFrame, slideTower, seesawTrestle] as const;

/** Rolling sandpit dunes with oversized equipment standing in the haze. */
function playgroundSkyline(spec: LayerSpec, rng: Rng): Skyline {
  const x1 = 260;
  const ridge: Array<[number, number]> = [[-260, -2]];
  for (let x = -260; x <= x1; x += 8 * spec.scale) {
    ridge.push([x, spec.height * (0.05 + 0.04 * Math.sin(x * 0.02 + spec.z) + 0.02 * Math.sin(x * 0.07))]);
  }
  ridge.push([x1, -2]);
  const shapes: number[] = [];
  const unit = spec.scale * 0.42;
  for (let x = -250 + rng.range(0, 30); x < x1; x += rng.range(34, 74) * spec.scale * 0.5) {
    const piece = rng.pick(PLAYGROUND_PIECES);
    const height = spec.height * rng.range(0.5, 0.95);
    piece(shapes, x, spec.height * 0.06, piece === ferrisWheel ? height * 0.5 : height, unit);
  }
  return { ridge, lights: { positions: [], colors: [] }, shapes };
}

const SPACE_PIECES = [
  (out: number[], x: number, y: number, s: number): void => {
    blob(out, x, y, s * 0.5, 6);
    bar(out, x - s * 1.8, y, x + s * 1.8, y, s * 0.55);
  },
  (out: number[], x: number, y: number, s: number): void => {
    annulus(out, x, y, s * 1.1, s * 0.82, 14);
    bar(out, x, y, x, y - s * 1.6, s * 0.12);
  },
  (out: number[], x: number, y: number, s: number): void => {
    bar(out, x - s, y, x + s, y + s * 0.3, s * 0.7);
    blob(out, x + s, y + s * 0.3, s * 0.38, 6);
  },
  (out: number[], x: number, y: number, s: number): void => {
    annulus(out, x, y, s * 1.5, s * 1.3, 18);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      bar(out, x, y, x + Math.cos(a) * s * 1.4, y + Math.sin(a) * s * 1.4, s * 0.1);
    }
  },
] as const;

/** Almost no ground: a faint cloud deck far below and spent hardware drifting at every height. */
function spaceSkyline(spec: LayerSpec, rng: Rng): Skyline {
  const ridge: Array<[number, number]> = [[-260, -2]];
  for (let x = -260; x <= 260; x += 10 * spec.scale) ridge.push([x, spec.height * (0.03 + 0.025 * Math.sin(x * 0.03 + spec.z))]);
  ridge.push([260, -2]);
  const shapes: number[] = [];
  const pieces = 22;
  for (let i = 0; i < pieces; i++) {
    const piece = rng.pick(SPACE_PIECES);
    piece(shapes, rng.range(-250, 250), rng.range(spec.height * 0.4, spec.height * 3.4), rng.range(0.6, 1.5) * spec.scale);
  }
  return { ridge, lights: { positions: [], colors: [] }, shapes };
}

function skylineFor(biome: BiomeId, spec: LayerSpec, rng: Rng): Skyline {
  const none: Lights = { positions: [], colors: [] };
  switch (biome) {
    case 'suburbia':
      return { ridge: suburbRidge(spec, rng), lights: none };
    case 'metropolis':
      return cityRidge(spec, rng);
    case 'playground':
      return playgroundSkyline(spec, rng);
    case 'stratosphere':
      return spaceSkyline(spec, rng);
    default:
      return { ridge: junkRidge(spec, rng), lights: none };
  }
}

/** Lit windows as one unshaded mesh pinned to its skyline layer. */
function lightsMesh(lights: Lights, z: number): Mesh {
  const positions: number[] = [];
  for (let i = 0; i < lights.positions.length; i += 2) positions.push(lights.positions[i]!, lights.positions[i + 1]!, z + 0.4);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(lights.colors, 3));
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.85 }));
  mesh.renderOrder = -7;
  mesh.frustumCulled = false;
  return mesh;
}

/** Skyline, junk-mountain silhouettes and drifting clouds behind the play plane. */
export class Backdrop {
  readonly group = new Group();
  private readonly sky: Mesh;
  private readonly skyMaterial: ShaderMaterial;
  private readonly layers: Layer[] = [];
  private readonly clouds: Array<{ mesh: Mesh; speed: number; baseX: number }> = [];
  private readonly aurora: Array<{ mesh: Mesh; material: ShaderMaterial }> = [];
  private readonly ground: Mesh;
  private time = 0;

  constructor(biome: BiomeId, seed: number) {
    this.skyMaterial = new ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new Color() },
        uHorizon: { value: new Color() },
        uSunDir: { value: new Vector3(-0.5, 0.4, -0.7) },
        uSunColor: { value: new Color() },
        uStars: { value: 0 },
        uAltitude: { value: 0 },
      },
    });
    this.sky = new Mesh(new SphereGeometry(300, 20, 14), this.skyMaterial);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);

    this.ground = new Mesh(
      new BufferGeometry(),
      new MeshBasicMaterial({ color: 0x000000, fog: true }),
    );
    this.buildGround();
    this.buildSilhouettes(biome, new Rng(seed));
    if (biome === 'stratosphere') this.buildAurora(new Rng(seed + 23));
    else this.buildClouds(new Rng(seed + 11));
    this.applyBiome(biome);
  }

  applyBiome(biome: BiomeId): void {
    const p = PALETTES[biome];
    const u = this.skyMaterial.uniforms;
    toColor(p.skyTop, u.uTop!.value as Color);
    toColor(p.skyHorizon, u.uHorizon!.value as Color);
    toColor(p.sunColor, u.uSunColor!.value as Color);
    const el = (p.sunElevation * Math.PI) / 180;
    (u.uSunDir!.value as Vector3).set(-0.55 * Math.cos(el), Math.sin(el), -0.8 * Math.cos(el));
    (u.uStars!.value as number) = biome === 'stratosphere' ? 1 : biome === 'metropolis' ? 0.35 : 0;

    // Background silhouettes are darker than the sky so they read as depth, not as
    // washed-out colour blocks. The far layer drops well below the sky horizon; the
    // near layer approaches a near-silhouette so the player's eye reads the layering
    // without thinking about it. The values were tightened after the first renewal
    // pass: the previous 55/38/22% was still too warm against the sky and read as
    // flat colour rather than as distance. Sparth's atmospheric-perspective cue.
    const far = toColor(mixHsl(p.fog, p.dominant, 0.32)).multiplyScalar(0.32);
    const mid = toColor(mixHsl(p.fog, p.dominant, 0.5)).multiplyScalar(0.2);
    const near = toColor(mixHsl(p.fog, p.dominant, 0.7)).multiplyScalar(0.11);
    const tints = [far, mid, near];
    this.layers.forEach((layer, i) => (layer.mesh.material as MeshBasicMaterial).color.copy(tints[i % 3]!));
    const groundDim = biome === 'stratosphere' ? 0.4 : 0.62;
    (this.ground.material as MeshBasicMaterial).color.copy(toColor(mixHsl(p.fog, p.dominant, 0.7)).multiplyScalar(groundDim));
    for (const cloud of this.clouds) {
      (cloud.mesh.material as MeshBasicMaterial).color.copy(toColor(mixHsl(p.skyHorizon, { h: 0, s: 0, l: 100 }, 0.55)));
    }
    for (const { material } of this.aurora) {
      toColor({ h: p.accent.h, s: 85, l: 56 }, material.uniforms.uLow!.value as Color);
      toColor({ h: p.accent.h + 95, s: 80, l: 60 }, material.uniforms.uHigh!.value as Color);
    }
  }

  /** Curtains of light hung far behind the climb: additive ribbons that sway with the shared clock. */
  private buildAurora(rng: Rng): void {
    for (let r = 0; r < AURORA_RIBBONS; r++) {
      const positions: number[] = [];
      const heights: number[] = [];
      const indices: number[] = [];
      const width = rng.range(180, 300);
      const x0 = rng.range(-260, 60);
      const base = rng.range(6, 40);
      const tall = rng.range(50, 90);
      for (let c = 0; c <= AURORA_COLUMNS; c++) {
        const x = x0 + (width * c) / AURORA_COLUMNS;
        const sag = Math.sin(c * 0.5 + r) * 8;
        positions.push(x, base + sag, 0, x, base + sag + tall, 0);
        heights.push(0, 1);
        if (c < AURORA_COLUMNS) {
          const i = c * 2;
          indices.push(i, i + 1, i + 3, i, i + 3, i + 2);
        }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute('aHeight', new Float32BufferAttribute(heights, 1));
      geometry.setIndex(indices);
      const material = new ShaderMaterial({
        vertexShader: AURORA_VERTEX,
        fragmentShader: AURORA_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        fog: false,
        uniforms: { uTime: { value: 0 }, uLow: { value: new Color() }, uHigh: { value: new Color() } },
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.z = -210 - r * 14;
      mesh.renderOrder = -9;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.aurora.push({ mesh, material });
    }
  }

  private buildGround(): void {
    const geometry = new BufferGeometry();
    const s = 400;
    geometry.setAttribute('position', new Float32BufferAttribute([-s, -0.8, 60, s, -0.8, 60, s, -0.8, -300, -s, -0.8, -300], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.ground.geometry = geometry;
    this.ground.renderOrder = -5;
    this.group.add(this.ground);
  }

  private buildSilhouettes(biome: BiomeId, rng: Rng): void {
    const specs = [
      { z: -150, scale: 3.2, height: 70, parallax: 0.12 },
      { z: -90, scale: 2.2, height: 46, parallax: 0.07 },
      { z: -52, scale: 1.5, height: 28, parallax: 0.03 },
    ];
    for (const spec of specs) {
      const skyline = skylineFor(biome, spec, rng);
      const positions: number[] = [];
      const ridge = skyline.ridge;
      for (let i = 0; i < ridge.length - 1; i++) {
        const [ax, ay] = ridge[i]!;
        const [bx, by] = ridge[i + 1]!;
        positions.push(ax, -2, spec.z, bx, -2, spec.z, bx, by, spec.z, ax, -2, spec.z, bx, by, spec.z, ax, ay, spec.z);
      }
      const shapes = skyline.shapes ?? [];
      for (let i = 0; i < shapes.length; i += 2) positions.push(shapes[i]!, shapes[i + 1]!, spec.z);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      const mesh = new Mesh(geometry, new MeshBasicMaterial({ color: 0x888888, fog: true }));
      mesh.renderOrder = -8;
      mesh.frustumCulled = false;
      if (skyline.lights.positions.length > 0) mesh.add(lightsMesh(skyline.lights, spec.z));
      this.group.add(mesh);
      this.layers.push({ mesh, parallax: spec.parallax, baseY: 0 });
    }
  }

  private buildClouds(rng: Rng): void {
    for (let i = 0; i < 14; i++) {
      const geometry = new BufferGeometry();
      const positions: number[] = [];
      const w = rng.range(7, 16);
      const h = rng.range(1.4, 2.8);
      const puffs = 5;
      for (let p = 0; p < puffs; p++) {
        const cx = (p / (puffs - 1) - 0.5) * w;
        const r = h * (0.7 + 0.5 * Math.sin((p / (puffs - 1)) * Math.PI));
        const n = 7;
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI;
          const a1 = ((k + 1) / n) * Math.PI;
          positions.push(cx, 0, 0, cx + Math.cos(a0) * r * 1.6, Math.sin(a0) * r, 0, cx + Math.cos(a1) * r * 1.6, Math.sin(a1) * r, 0);
        }
      }
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      const mesh = new Mesh(
        geometry,
        new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: rng.range(0.35, 0.6), depthWrite: false, fog: true }),
      );
      mesh.position.set(rng.range(-120, 120), rng.range(8, 140), rng.range(-120, -40));
      mesh.renderOrder = -7;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.clouds.push({ mesh, speed: rng.range(0.15, 0.5), baseX: mesh.position.x });
    }
  }

  update(camera: PerspectiveCamera, dt: number, altitudeFrac = 0): void {
    this.time += dt;
    this.skyMaterial.uniforms.uAltitude!.value = altitudeFrac;
    this.sky.position.copy(camera.position);
    for (const layer of this.layers) {
      layer.mesh.position.x = camera.position.x * layer.parallax;
      layer.mesh.position.y = camera.position.y * layer.parallax * 0.4;
    }
    for (const { mesh, material } of this.aurora) {
      material.uniforms.uTime!.value = this.time;
      mesh.position.x = camera.position.x * 0.05;
      mesh.position.y = camera.position.y * 0.7;
    }
    for (const cloud of this.clouds) {
      cloud.mesh.position.x = cloud.baseX + this.time * cloud.speed + camera.position.x * 0.04;
      if (cloud.mesh.position.x > 160) cloud.baseX -= 320;
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        (o.material as { dispose(): void }).dispose();
      }
    });
  }
}
