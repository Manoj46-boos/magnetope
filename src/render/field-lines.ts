import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Mesh,
  ShaderMaterial,
} from 'three';
import { clamp, hypot2, lerp, type Vec2 } from '@/core/mathx';
import type { MagnoView } from '@/sim/magno';
import { fxTheme } from './palette';

const VERTEX = /* glsl */ `
  attribute float aT;
  attribute float aSide;
  attribute vec2 aTan;
  attribute float aLoop;
  uniform float uWidth;
  varying float vT;
  varying float vSide;
  varying float vLoop;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 tv = (modelViewMatrix * vec4(aTan, 0.0, 0.0)).xyz;
    vec2 dir = normalize(tv.xy + vec2(1e-5));
    vec2 n = vec2(-dir.y, dir.x);
    float taper = 0.3 + 0.7 * sin(3.14159265 * aT);
    mv.xy += n * aSide * uWidth * taper;
    vT = aT;
    vSide = aSide;
    vLoop = aLoop;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uFlow;
  uniform float uAlpha;
  uniform vec3 uColor;
  uniform vec3 uCore;
  varying float vT;
  varying float vSide;
  varying float vLoop;
  void main() {
    float dash = fract(vT * 2.2 - uTime * uFlow * 0.85 + vLoop * 0.37);
    float pulse = smoothstep(0.0, 0.18, dash) * smoothstep(1.0, 0.5, dash);
    float across = 1.0 - abs(vSide);
    float core = pow(across, 1.7);
    float ends = smoothstep(0.0, 0.14, vT) * smoothstep(1.0, 0.86, vT);
    vec3 col = mix(uColor, uCore, core);
    gl_FragColor = vec4(col, uAlpha * (0.22 + 0.78 * pulse) * ends * (0.3 + 0.7 * across));
  }
`;

interface Ribbon {
  mesh: Mesh;
  material: ShaderMaterial;
  position: BufferAttribute;
  tangent: BufferAttribute;
  curves: number;
  segments: number;
}

function createRibbon(curves: number, segments: number): Ribbon {
  const points = curves * segments;
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(new Float32Array(points * 2 * 3), 3);
  const tangent = new BufferAttribute(new Float32Array(points * 2 * 2), 2);
  position.setUsage(DynamicDrawUsage);
  tangent.setUsage(DynamicDrawUsage);
  const t = new Float32Array(points * 2);
  const side = new Float32Array(points * 2);
  const loop = new Float32Array(points * 2);
  const index: number[] = [];

  for (let c = 0; c < curves; c++) {
    for (let s = 0; s < segments; s++) {
      const p = c * segments + s;
      for (let k = 0; k < 2; k++) {
        t[p * 2 + k] = s / (segments - 1);
        side[p * 2 + k] = k === 0 ? -1 : 1;
        loop[p * 2 + k] = c;
      }
      if (s < segments - 1) {
        const a = p * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  geometry.setAttribute('position', position);
  geometry.setAttribute('aTan', tangent);
  geometry.setAttribute('aT', new BufferAttribute(t, 1));
  geometry.setAttribute('aSide', new BufferAttribute(side, 1));
  geometry.setAttribute('aLoop', new BufferAttribute(loop, 1));
  geometry.setIndex(index);

  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFlow: { value: 1 },
      uAlpha: { value: 0 },
      uWidth: { value: 0.05 },
      uColor: { value: new Color() },
      uCore: { value: new Color() },
    },
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  return { mesh, material, position, tangent, curves, segments };
}

function writePoint(r: Ribbon, curve: number, seg: number, x: number, y: number, z: number, tx: number, ty: number): void {
  const p = (curve * r.segments + seg) * 2;
  const l = hypot2(tx, ty) || 1;
  for (let k = 0; k < 2; k++) {
    r.position.setXYZ(p + k, x, y, z);
    r.tangent.setXY(p + k, tx / l, ty / l);
  }
}

/**
 * Magnetism made visible: dipole loops around MAGNO's head plus a pull beam
 * toward the snap target. Colour, flow direction and loop shape all change with
 * polarity, so the state reads without relying on hue alone.
 */
export class FieldLines {
  private readonly loops: Ribbon;
  private readonly beam: Ribbon;
  private time = 0;
  private pulse = 0;
  private shape = 0;

  constructor(
    readonly segments: number,
    private readonly z: number,
  ) {
    this.loops = createRibbon(4, segments);
    this.beam = createRibbon(1, segments);
  }

  get objects(): [Mesh, Mesh] {
    return [this.loops.mesh, this.beam.mesh];
  }

  /** 120 ms radial pulse when polarity flips. */
  flipPulse(): void {
    this.pulse = 0.12;
  }

  update(view: MagnoView, head: Vec2, axisAngle: number, dt: number): void {
    this.time += dt;
    this.pulse = Math.max(0, this.pulse - dt);
    const repel = view.polarity === 'repel';
    this.shape = lerp(this.shape, repel ? 1 : 0, 1 - Math.exp(-18 * dt));

    const charge = view.state === 'charging' ? view.charge01 : 0;
    const base = view.limp ? 0.35 : view.state === 'recovering' ? 0.45 : 0.62;
    const intensity = clamp(base + charge * 0.5 + (this.pulse > 0 ? 0.5 : 0) + (view.snapEngaged ? 0.25 : 0), 0, 1.1);
    const expand = 1 + charge * 0.7 + (this.pulse > 0 ? (0.12 - this.pulse) * 5 : 0);

    this.writeLoops(head, axisAngle, expand);
    const m = this.loops.material.uniforms;
    (m.uTime as { value: number }).value = this.time;
    (m.uFlow as { value: number }).value = repel ? -1 : 1;
    (m.uAlpha as { value: number }).value = intensity * 0.9;
    (m.uWidth as { value: number }).value = 0.034 + charge * 0.02;
    (m.uColor as { value: Color }).value.copy(repel ? fxTheme.repel : fxTheme.attract);
    (m.uCore as { value: Color }).value.copy(repel ? fxTheme.repelCore : fxTheme.attractCore);
    this.loops.material.blending = fxTheme.blending;
    this.beam.material.blending = fxTheme.blending;

    this.writeBeam(view, head);
  }

  private writeLoops(head: Vec2, axis: number, expand: number): void {
    const { segments } = this;
    const cos = Math.cos(axis);
    const sin = Math.sin(axis);
    const flare = lerp(0.82, 1.28, this.shape);
    for (let c = 0; c < 4; c++) {
      const upper = c < 2;
      const level = (c % 2) + 1;
      const w = (0.17 + level * 0.19) * expand * flare;
      const h = (0.2 + level * 0.3) * expand * (upper ? 1 : 0.62) * flare;
      for (let s = 0; s < segments; s++) {
        const u = s / (segments - 1);
        const phi = Math.PI * (1 - u);
        const wobble = 1 + 0.05 * Math.sin(this.time * 6 + c * 1.7 + u * 6);
        const lx = Math.cos(phi) * w * wobble;
        const ly = (upper ? 1 : -1) * Math.sin(phi) * h * wobble + (upper ? 0.04 : -0.1);
        const tx = -Math.sin(phi) * w * wobble;
        const ty = (upper ? 1 : -1) * Math.cos(phi) * h * wobble;
        const wx = head.x + lx * cos - ly * sin;
        const wy = head.y + lx * sin + ly * cos;
        writePoint(this.loops, c, s, wx, wy, this.z, tx * cos - ty * sin, tx * sin + ty * cos);
      }
    }
    this.loops.position.needsUpdate = true;
    this.loops.tangent.needsUpdate = true;
  }

  private writeBeam(view: MagnoView, head: Vec2): void {
    const active = view.snapArmed || view.snapEngaged;
    const uniforms = this.beam.material.uniforms;
    if (!active || !view.snapTarget) {
      (uniforms.uAlpha as { value: number }).value = 0;
      return;
    }
    const { segments } = this;
    const tx = view.snapTarget.x;
    const ty = view.snapTarget.y;
    const dx = tx - head.x;
    const dy = ty - head.y;
    const dist = hypot2(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    const bend = (view.snapEngaged ? 0.22 : 0.1) * dist * Math.sin(this.time * 7);
    for (let s = 0; s < segments; s++) {
      const u = s / (segments - 1);
      const arc = Math.sin(Math.PI * u) * bend * 0.4;
      const x = head.x + dx * u + nx * arc;
      const y = head.y + dy * u + ny * arc;
      const du = 0.02;
      const arc2 = Math.sin(Math.PI * Math.min(1, u + du)) * bend * 0.4;
      const x2 = head.x + dx * Math.min(1, u + du) + nx * arc2;
      const y2 = head.y + dy * Math.min(1, u + du) + ny * arc2;
      writePoint(this.beam, 0, s, x, y, this.z, x2 - x || dx * 0.01, y2 - y || dy * 0.01);
    }
    this.beam.position.needsUpdate = true;
    this.beam.tangent.needsUpdate = true;
    (uniforms.uTime as { value: number }).value = this.time;
    (uniforms.uFlow as { value: number }).value = view.snapEngaged ? 2.6 : 0.6;
    (uniforms.uAlpha as { value: number }).value = view.snapEngaged ? 1 : 0.55;
    (uniforms.uWidth as { value: number }).value = view.snapEngaged ? 0.05 : 0.026;
    (uniforms.uColor as { value: Color }).value.copy(fxTheme.attract);
    (uniforms.uCore as { value: Color }).value.copy(fxTheme.attractCore);
  }

  dispose(): void {
    for (const r of [this.loops, this.beam]) {
      r.mesh.geometry.dispose();
      r.material.dispose();
    }
  }
}
