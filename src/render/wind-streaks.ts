import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  type Scene,
} from 'three';
import { Rng } from '@/core/rng';
import { clamp } from '@/core/mathx';

/** Peak concurrent streaks (PRD 8.1: wind gusts, 18). */
export const MAX_STREAKS = 18;
const POINTS = 6;
const VERTS_PER_STREAK = POINTS * 2;

interface Streak {
  x: number;
  y: number;
  speed: number;
  length: number;
  bend: number;
  width: number;
  age: number;
  life: number;
  alive: boolean;
}

export interface WindView {
  /** Camera centre in world units. */
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
}

export interface WindFrame {
  /** Gust share, 0 calm to 1 peak. */
  intensity: number;
  /** +1 blows right, -1 blows left. */
  direction: 1 | -1;
}

/**
 * Bent-line gust streaks that sweep across the view. They are the visual twin of
 * the wind voice: the same gust value drives both, so a gust can be seen coming
 * as well as heard.
 */
export class WindStreaks {
  readonly mesh: Mesh;
  private readonly streaks: Streak[] = [];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly geometry = new BufferGeometry();
  private readonly material: MeshBasicMaterial;
  private readonly rng = new Rng(88);
  private tint: readonly [number, number, number] = [0.8, 0.9, 1];
  private ceiling = MAX_STREAKS;

  constructor(scene: Scene, z: number) {
    this.positions = new Float32Array(MAX_STREAKS * VERTS_PER_STREAK * 3);
    this.colors = new Float32Array(MAX_STREAKS * VERTS_PER_STREAK * 4);
    const index: number[] = [];
    for (let s = 0; s < MAX_STREAKS; s++) {
      const base = s * VERTS_PER_STREAK;
      for (let p = 0; p < POINTS - 1; p++) {
        const a = base + p * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geometry.setIndex(index);
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage));
    this.geometry.setAttribute('color', new BufferAttribute(this.colors, 4).setUsage(DynamicDrawUsage));
    this.material = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
      blending: AdditiveBlending,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 17;
    this.mesh.position.z = z;
    this.mesh.visible = false;
    for (let i = 0; i < MAX_STREAKS; i++) {
      this.streaks.push({ x: 0, y: 0, speed: 0, length: 0, bend: 0, width: 0, age: 0, life: 1, alive: false });
    }
    scene.add(this.mesh);
  }

  get alive(): number {
    return this.streaks.reduce((n, s) => n + (s.alive ? 1 : 0), 0);
  }

  setTint(rgb: readonly [number, number, number], bright: boolean): void {
    this.tint = rgb;
    this.material.blending = bright ? NormalBlending : AdditiveBlending;
    this.material.needsUpdate = true;
  }

  /** Lowest tiers draw fewer streaks. */
  setCeiling(count: number): void {
    this.ceiling = clamp(Math.floor(count), 0, MAX_STREAKS);
  }

  clear(): void {
    for (const s of this.streaks) s.alive = false;
    this.mesh.visible = false;
  }

  update(dt: number, view: WindView, wind: WindFrame): void {
    const want = Math.round(this.ceiling * clamp(wind.intensity, 0, 1));
    let alive = 0;
    for (const s of this.streaks) {
      if (!s.alive) continue;
      s.age += dt;
      s.x += wind.direction * s.speed * dt;
      if (s.age >= s.life) s.alive = false;
      else alive++;
    }
    for (const s of this.streaks) {
      if (alive >= want) break;
      if (s.alive) continue;
      this.spawn(s, view, wind);
      alive++;
    }
    this.mesh.visible = alive > 0;
    if (alive === 0) return;
    this.write(wind);
  }

  private spawn(s: Streak, view: WindView, wind: WindFrame): void {
    const r = this.rng;
    s.length = r.range(3.5, 7);
    s.speed = r.range(16, 30) * (0.6 + 0.6 * wind.intensity);
    s.bend = r.range(0.35, 0.9) * (r.next() < 0.5 ? -1 : 1);
    s.width = r.range(0.05, 0.1);
    s.life = (2 * (view.halfW + s.length)) / s.speed;
    s.age = r.range(0, 0.35) * s.life;
    s.x = view.cx - wind.direction * (view.halfW + s.length) + wind.direction * s.speed * s.age;
    s.y = view.cy + r.range(-view.halfH, view.halfH);
    s.alive = true;
  }

  private write(wind: WindFrame): void {
    const [tr, tg, tb] = this.tint;
    const dir = wind.direction;
    this.streaks.forEach((s, i) => {
      const base = i * VERTS_PER_STREAK;
      if (!s.alive) {
        for (let v = 0; v < VERTS_PER_STREAK; v++) this.colors[(base + v) * 4 + 3] = 0;
        return;
      }
      const u = s.age / s.life;
      const envelope = Math.sin(clamp(u, 0, 1) * Math.PI) ** 0.8;
      for (let p = 0; p < POINTS; p++) {
        const t = p / (POINTS - 1);
        const px = s.x - dir * s.length * t;
        const py = s.y + s.bend * Math.sin(t * Math.PI) * 0.6;
        const half = s.width * (1 - t * 0.85);
        const alpha = clamp(wind.intensity, 0, 1) * envelope * (1 - t) ** 1.3 * 0.7;
        for (let side = 0; side < 2; side++) {
          const v = base + p * 2 + side;
          this.positions[v * 3] = px;
          this.positions[v * 3 + 1] = py + (side ? half : -half);
          this.positions[v * 3 + 2] = 0;
          this.colors[v * 4] = tr;
          this.colors[v * 4 + 1] = tg;
          this.colors[v * 4 + 2] = tb;
          this.colors[v * 4 + 3] = alpha;
        }
      }
    });
    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.color!.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
