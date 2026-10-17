import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Points,
  RingGeometry,
  ShaderMaterial,
  type Scene,
} from 'three';
import { Rng } from '@/core/rng';

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aShape;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vShape;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, aSize * uScale / -mv.z);
    vAlpha = aAlpha;
    vColor = aColor;
    vShape = aShape;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vShape;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = vShape > 0.5 ? max(abs(p.x), abs(p.y)) : length(p);
    float edge = vShape > 0.5 ? 1.0 - smoothstep(0.82, 1.0, d) : 1.0 - smoothstep(0.35, 1.0, d);
    if (edge <= 0.01) discard;
    gl_FragColor = vec4(vColor, vAlpha * edge);
  }
`;

export interface EmitOptions {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  sizeEnd?: number;
  color: readonly [number, number, number];
  alpha?: number;
  gravity?: number;
  drag?: number;
  shape?: 0 | 1;
}

/** Fixed-capacity CPU particle pool rendered as one Points draw call. */
export class ParticleSystem {
  readonly points: Points;
  private readonly capacity: number;
  private ceiling: number;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size0: Float32Array;
  private readonly size1: Float32Array;
  private readonly baseAlpha: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private readonly position: BufferAttribute;
  private readonly sizeAttr: BufferAttribute;
  private readonly alphaAttr: BufferAttribute;
  private readonly colorAttr: BufferAttribute;
  private readonly shapeAttr: BufferAttribute;
  private readonly material: ShaderMaterial;
  private count = 0;

  constructor(capacity: number, additive: boolean, private readonly z: number) {
    this.capacity = capacity;
    this.ceiling = capacity;
    this.px = new Float32Array(capacity);
    this.py = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.baseAlpha = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);

    const geometry = new BufferGeometry();
    this.position = new BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
    this.sizeAttr = new BufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage);
    this.alphaAttr = new BufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage);
    this.colorAttr = new BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
    this.shapeAttr = new BufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', this.position);
    geometry.setAttribute('aSize', this.sizeAttr);
    geometry.setAttribute('aAlpha', this.alphaAttr);
    geometry.setAttribute('aColor', this.colorAttr);
    geometry.setAttribute('aShape', this.shapeAttr);
    geometry.setDrawRange(0, 0);

    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: additive ? AdditiveBlending : NormalBlending,
      uniforms: { uScale: { value: 600 } },
    });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 18 : 12;
  }

  get alive(): number {
    return this.count;
  }

  setAdditive(additive: boolean): void {
    this.material.blending = additive ? AdditiveBlending : NormalBlending;
    this.material.needsUpdate = true;
  }

  setCeiling(ceiling: number): void {
    this.ceiling = Math.min(this.capacity, ceiling);
  }

  setScale(viewportHeight: number, fovDegrees: number, pixelRatio: number): void {
    this.material.uniforms.uScale!.value = (viewportHeight * pixelRatio) / (2 * Math.tan((fovDegrees * Math.PI) / 360));
  }

  emit(o: EmitOptions): boolean {
    if (this.count >= this.ceiling) return false;
    const i = this.count++;
    this.px[i] = o.x;
    this.py[i] = o.y;
    this.vx[i] = o.vx;
    this.vy[i] = o.vy;
    this.life[i] = o.life;
    this.maxLife[i] = o.life;
    this.size0[i] = o.size;
    this.size1[i] = o.sizeEnd ?? o.size * 0.3;
    this.baseAlpha[i] = o.alpha ?? 1;
    this.gravity[i] = o.gravity ?? 0;
    this.drag[i] = o.drag ?? 0.5;
    this.colorAttr.setXYZ(i, o.color[0], o.color[1], o.color[2]);
    this.shapeAttr.setX(i, o.shape ?? 0);
    return true;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      this.life[i]! -= dt;
      if (this.life[i]! <= 0) {
        this.removeAt(i);
        continue;
      }
      const damp = Math.exp(-this.drag[i]! * dt);
      this.vx[i]! *= damp;
      this.vy[i]! = this.vy[i]! * damp + this.gravity[i]! * dt;
      this.px[i]! += this.vx[i]! * dt;
      this.py[i]! += this.vy[i]! * dt;
      const t = 1 - this.life[i]! / this.maxLife[i]!;
      this.position.setXYZ(i, this.px[i]!, this.py[i]!, this.z);
      this.sizeAttr.setX(i, this.size0[i]! + (this.size1[i]! - this.size0[i]!) * t);
      this.alphaAttr.setX(i, this.baseAlpha[i]! * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88));
      i++;
    }
    this.points.geometry.setDrawRange(0, this.count);
    this.position.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.shapeAttr.needsUpdate = true;
  }

  clear(): void {
    this.count = 0;
    this.points.geometry.setDrawRange(0, 0);
  }

  private removeAt(i: number): void {
    const last = --this.count;
    if (i === last) return;
    for (const arr of [this.px, this.py, this.vx, this.vy, this.life, this.maxLife, this.size0, this.size1, this.baseAlpha, this.gravity, this.drag]) {
      arr[i] = arr[last]!;
    }
    this.colorAttr.setXYZ(i, this.colorAttr.getX(last), this.colorAttr.getY(last), this.colorAttr.getZ(last));
    this.shapeAttr.setX(i, this.shapeAttr.getX(last));
    this.position.setXYZ(i, this.px[i]!, this.py[i]!, this.z);
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

interface RingInstance {
  mesh: Mesh;
  age: number;
  life: number;
  from: number;
  to: number;
  active: boolean;
}

/** Expanding shock rings: the attach wave, repel pulse, and landing dust ring. */
export class RingPool {
  private readonly rings: RingInstance[] = [];

  constructor(scene: Scene, size: number, private readonly z: number) {
    const geometry = new RingGeometry(0.86, 1, 36);
    for (let i = 0; i < size; i++) {
      const material = new MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        opacity: 0,
      });
      const mesh = new Mesh(geometry, material);
      mesh.visible = false;
      mesh.renderOrder = 16;
      scene.add(mesh);
      this.rings.push({ mesh, age: 0, life: 1, from: 0.1, to: 1, active: false });
    }
  }

  setBlending(blending: typeof AdditiveBlending | typeof NormalBlending): void {
    for (const ring of this.rings) {
      const material = ring.mesh.material as MeshBasicMaterial;
      material.blending = blending;
      material.needsUpdate = true;
    }
  }

  spawn(x: number, y: number, from: number, to: number, life: number, color: readonly [number, number, number], tiltAngle = 0, squash = 1): void {
    const ring = this.rings.find((r) => !r.active) ?? this.rings[0]!;
    ring.active = true;
    ring.age = 0;
    ring.life = life;
    ring.from = from;
    ring.to = to;
    ring.mesh.visible = true;
    ring.mesh.position.set(x, y, this.z);
    ring.mesh.rotation.z = tiltAngle;
    ring.mesh.userData.squash = squash;
    (ring.mesh.material as MeshBasicMaterial).color.setRGB(color[0], color[1], color[2]);
  }

  update(dt: number): void {
    for (const ring of this.rings) {
      if (!ring.active) continue;
      ring.age += dt;
      const t = ring.age / ring.life;
      if (t >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const eased = 1 - (1 - t) ** 3;
      const s = ring.from + (ring.to - ring.from) * eased;
      ring.mesh.scale.set(s, s * (ring.mesh.userData.squash as number), 1);
      (ring.mesh.material as MeshBasicMaterial).opacity = 0.9 * (1 - t) ** 1.5;
    }
  }

  clear(): void {
    for (const ring of this.rings) {
      ring.active = false;
      ring.mesh.visible = false;
    }
  }

  dispose(): void {
    this.rings[0]?.mesh.geometry.dispose();
    for (const ring of this.rings) (ring.mesh.material as MeshBasicMaterial).dispose();
  }
}

export const sparkRng = new Rng(7);
