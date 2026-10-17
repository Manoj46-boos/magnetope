import { BufferAttribute, BufferGeometry, Color } from 'three';

type Rgb = readonly [number, number, number];

export const rgb = (c: Color): Rgb => [c.r, c.g, c.b];

const scale = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k];

/**
 * Accumulates flat-shaded triangles with per-vertex colour. Everything is
 * non-indexed so each face keeps its own normal, which is what gives the
 * low-poly diorama look and keeps the data trivially mergeable.
 */
export class GeometryBuilder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];

  get triangleCount(): number {
    return this.positions.length / 9;
  }

  tri(a: readonly number[], b: readonly number[], c: readonly number[], color: Rgb): void {
    this.positions.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!, c[0]!, c[1]!, c[2]!);
    for (let i = 0; i < 3; i++) this.colors.push(color[0], color[1], color[2]);
  }

  quad(a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], color: Rgb): void {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Axis-aligned box centred at (cx, cy, cz). */
  box(cx: number, cy: number, cz: number, w: number, h: number, d: number, color: Rgb): void {
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const y0 = cy - h / 2;
    const y1 = cy + h / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], scale(color, 1));
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], scale(color, 0.8));
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], scale(color, 1.08));
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], scale(color, 0.72));
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], scale(color, 0.9));
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], scale(color, 0.9));
  }

  /** Box with its top edge pulled in, used for crushed and tapered shapes. */
  taperedBox(cx: number, cy: number, cz: number, wBottom: number, wTop: number, h: number, d: number, color: Rgb): void {
    const yb = cy - h / 2;
    const yt = cy + h / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    const bl = cx - wBottom / 2;
    const br = cx + wBottom / 2;
    const tl = cx - wTop / 2;
    const tr = cx + wTop / 2;
    this.quad([bl, yb, z1], [br, yb, z1], [tr, yt, z1], [tl, yt, z1], color);
    this.quad([br, yb, z0], [bl, yb, z0], [tl, yt, z0], [tr, yt, z0], scale(color, 0.8));
    this.quad([tl, yt, z1], [tr, yt, z1], [tr, yt, z0], [tl, yt, z0], scale(color, 1.08));
    this.quad([br, yb, z1], [br, yb, z0], [tr, yt, z0], [tr, yt, z1], scale(color, 0.9));
    this.quad([bl, yb, z0], [bl, yb, z1], [tl, yt, z1], [tl, yt, z0], scale(color, 0.9));
  }

  /** Cylinder whose axis runs along Z, so it reads as a disc from the camera. */
  disc(cx: number, cy: number, cz: number, r: number, depth: number, segments: number, color: Rgb, rotation = 0): void {
    const z0 = cz - depth / 2;
    const z1 = cz + depth / 2;
    for (let i = 0; i < segments; i++) {
      const a0 = rotation + (i / segments) * Math.PI * 2;
      const a1 = rotation + ((i + 1) / segments) * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r];
      const p1 = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r];
      const shade = 0.78 + 0.28 * (0.5 + 0.5 * Math.sin((a0 + a1) / 2));
      this.quad([p0[0]!, p0[1]!, z0], [p1[0]!, p1[1]!, z0], [p1[0]!, p1[1]!, z1], [p0[0]!, p0[1]!, z1], scale(color, shade));
      this.tri([cx, cy, z1], [p0[0]!, p0[1]!, z1], [p1[0]!, p1[1]!, z1], scale(color, 1.02));
      this.tri([cx, cy, z0], [p1[0]!, p1[1]!, z0], [p0[0]!, p0[1]!, z0], scale(color, 0.72));
    }
  }

  /** Annulus extruded along Z. */
  ring(cx: number, cy: number, cz: number, rOuter: number, rInner: number, depth: number, segments: number, color: Rgb): void {
    const z0 = cz - depth / 2;
    const z1 = cz + depth / 2;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const o0 = [cx + Math.cos(a0) * rOuter, cy + Math.sin(a0) * rOuter];
      const o1 = [cx + Math.cos(a1) * rOuter, cy + Math.sin(a1) * rOuter];
      const i0 = [cx + Math.cos(a0) * rInner, cy + Math.sin(a0) * rInner];
      const i1 = [cx + Math.cos(a1) * rInner, cy + Math.sin(a1) * rInner];
      const shade = 0.8 + 0.25 * (0.5 + 0.5 * Math.sin((a0 + a1) / 2));
      this.quad([o0[0]!, o0[1]!, z0], [o1[0]!, o1[1]!, z0], [o1[0]!, o1[1]!, z1], [o0[0]!, o0[1]!, z1], scale(color, shade));
      this.quad([i1[0]!, i1[1]!, z0], [i0[0]!, i0[1]!, z0], [i0[0]!, i0[1]!, z1], [i1[0]!, i1[1]!, z1], scale(color, shade * 0.7));
      this.quad([o0[0]!, o0[1]!, z1], [o1[0]!, o1[1]!, z1], [i1[0]!, i1[1]!, z1], [i0[0]!, i0[1]!, z1], scale(color, 1.02));
      this.quad([o1[0]!, o1[1]!, z0], [o0[0]!, o0[1]!, z0], [i0[0]!, i0[1]!, z0], [i1[0]!, i1[1]!, z0], scale(color, 0.72));
    }
  }

  /** Flat wedge of a disc facing +Z, between angles `a0` and `a1`; wedges of different colours make beach balls and carousels. */
  sector(cx: number, cy: number, z: number, r: number, a0: number, a1: number, color: Rgb, steps = 3): void {
    for (let i = 0; i < steps; i++) {
      const s0 = a0 + ((a1 - a0) * i) / steps;
      const s1 = a0 + ((a1 - a0) * (i + 1)) / steps;
      this.tri([cx, cy, z], [cx + Math.cos(s0) * r, cy + Math.sin(s0) * r, z], [cx + Math.cos(s1) * r, cy + Math.sin(s1) * r, z], color);
    }
  }

  /** Darkens vertices toward the bottom and back of the shape: baked ambient occlusion. */
  bakeOcclusion(minY: number, maxY: number, minZ: number, strength = 0.24): void {
    const span = Math.max(1e-4, maxY - minY);
    for (let i = 0; i < this.positions.length; i += 3) {
      const y = this.positions[i + 1]!;
      const z = this.positions[i + 2]!;
      const t = (y - minY) / span;
      const fall = 1 - strength * (1 - Math.min(1, Math.max(0, t)));
      const back = z < minZ + 0.2 ? 0.9 : 1;
      const k = fall * back;
      this.colors[i] = this.colors[i]! * k;
      this.colors[i + 1] = this.colors[i + 1]! * k;
      this.colors[i + 2] = this.colors[i + 2]! * k;
    }
  }

  /** Moves vertices by a deterministic offset, for dented and crumpled metal. */
  displace(fn: (x: number, y: number, z: number) => [number, number, number]): void {
    for (let i = 0; i < this.positions.length; i += 3) {
      const [dx, dy, dz] = fn(this.positions[i]!, this.positions[i + 1]!, this.positions[i + 2]!);
      this.positions[i] = this.positions[i]! + dx;
      this.positions[i + 1] = this.positions[i + 1]! + dy;
      this.positions[i + 2] = this.positions[i + 2]! + dz;
    }
  }

  /** Appends another builder transformed by a planar rotation and translation. */
  append(other: GeometryBuilder, x: number, y: number, rot: number): void {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    for (let i = 0; i < other.positions.length; i += 3) {
      const px = other.positions[i]!;
      const py = other.positions[i + 1]!;
      this.positions.push(x + px * cos - py * sin, y + px * sin + py * cos, other.positions[i + 2]!);
    }
    this.colors.push(...other.colors);
  }

  toGeometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }
}
