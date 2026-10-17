import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
  type Object3D,
} from 'three';
import { lerp, type Vec2 } from '@/core/mathx';
import type { EndingFrame } from '@/game/ending';
import { MountainSilhouette, type MountainLayout } from './mountain';
import { fxTheme } from './palette';

/** Reach of the longest bloom line when fully grown, in metres. */
const BLOOM_REACH_M = 150;
const BLOOM_MIN_SCALE = 3;
const TUBE_RADIUS = 0.007;
const LINE_REACHES = [0.34, 0.52, 0.76, 1.05, 1.45, 2.0, 2.9];
const LITE_REACHES = [0.45, 1.0, 1.8, 2.9];
const LINE_SAMPLES = 72;
const BEAM_HEIGHT_M = 640;
const CORE_HUE = 0.5;
const CORE_REST_SCALE = 1;
const CORE_SEATED_SCALE = 0.13;
const MOUNTAIN_DEPTH = -34;

const TUBE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TUBE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uGrow;
  uniform float uAlpha;
  uniform float uPhase;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float along = vUv.x;
    float reveal = smoothstep(uGrow, uGrow - 0.14, along);
    float flow = fract(along * 3.0 - uTime * 0.35 + uPhase);
    float pulse = 0.45 + 0.55 * smoothstep(0.0, 0.2, flow) * smoothstep(1.0, 0.45, flow);
    float ends = smoothstep(0.0, 0.08, along) * smoothstep(1.0, 0.92, along);
    gl_FragColor = vec4(uColor, uAlpha * reveal * pulse * ends);
  }
`;

const HALO_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float falloff = pow(max(1.0 - d, 0.0), 2.4);
    gl_FragColor = vec4(uColor, uAlpha * falloff);
  }
`;

interface BloomLine {
  mesh: Mesh;
  material: ShaderMaterial;
  order: number;
}

export interface StageInputs {
  frame: EndingFrame;
  summit: Vec2;
  chest: Vec2;
  head: Vec2;
  axisAngle: number;
  /** Camera distance from the scene, so the star at MAGNO's chest stays a visible point of light. */
  cameraDistance: number;
  time: number;
  actorZ: number;
}

/** Points of a dipole field line around a vertical axis, in the plane, for the given reach. */
export function dipolePoints(reach: number, mirror: boolean, samples = LINE_SAMPLES): Vector3[] {
  const points: Vector3[] = [];
  const edge = 0.16;
  for (let i = 0; i < samples; i++) {
    const theta = lerp(edge, Math.PI - edge, i / (samples - 1));
    const r = reach * Math.sin(theta) ** 2;
    points.push(new Vector3((mirror ? -1 : 1) * r * Math.sin(theta), r * Math.cos(theta), 0));
  }
  return points;
}

function halo(): Mesh {
  const material = new ShaderMaterial({
    vertexShader: HALO_VERTEX,
    fragmentShader: HALO_FRAGMENT,
    uniforms: { uColor: { value: new Color() }, uAlpha: { value: 0 } },
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.renderOrder = 20;
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}

const haloMaterial = (mesh: Mesh): ShaderMaterial => mesh.material as ShaderMaterial;

/**
 * Scenery and actors of the ending: the loose power core, the field-line bloom,
 * the lighthouse beam, the star at MAGNO's chest and the whole mountain behind.
 */
export class EndingStage {
  readonly group = new Group();
  readonly mountain: MountainSilhouette;
  private readonly core: Mesh;
  private readonly coreMaterial: MeshStandardMaterial;
  private readonly coreHalo = halo();
  private readonly star = halo();
  private readonly beam: Mesh;
  private readonly bloom = new Group();
  private readonly lines: BloomLine[] = [];
  private readonly coreColor = new Color().setHSL(CORE_HUE, 0.95, 0.58);
  private readonly longestReach: number;

  constructor(layout: MountainLayout, lite: boolean) {
    this.mountain = new MountainSilhouette(layout, MOUNTAIN_DEPTH);

    this.coreMaterial = new MeshStandardMaterial({
      color: this.coreColor,
      emissive: this.coreColor,
      emissiveIntensity: 0.55,
      flatShading: true,
      roughness: 0.2,
      metalness: 0.4,
    });
    this.core = new Mesh(new IcosahedronGeometry(0.8, 0), this.coreMaterial);
    haloMaterial(this.coreHalo).uniforms.uColor!.value = this.coreColor.clone().lerp(new Color(1, 1, 1), 0.35);
    haloMaterial(this.star).uniforms.uColor!.value = new Color(0.82, 0.96, 1);

    this.beam = new Mesh(
      new CylinderGeometry(0.28, 1.2, BEAM_HEIGHT_M, 14, 1, true),
      new MeshBasicMaterial({ color: this.coreColor, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }),
    );
    this.beam.visible = false;

    const reaches = lite ? LITE_REACHES : LINE_REACHES;
    this.longestReach = Math.max(...reaches);
    this.buildBloom(reaches);
    this.group.add(...this.mountain.layers, this.beam, this.bloom, this.core, this.coreHalo, this.star);
    this.core.visible = false;
  }

  private buildBloom(reaches: readonly number[]): void {
    let order = 0;
    for (const reach of reaches) {
      for (const mirror of [false, true]) {
        const curve = new CatmullRomCurve3(dipolePoints(reach, mirror));
        const material = new ShaderMaterial({
          vertexShader: TUBE_VERTEX,
          fragmentShader: TUBE_FRAGMENT,
          uniforms: {
            uTime: { value: 0 },
            uGrow: { value: 0 },
            uAlpha: { value: 0 },
            uPhase: { value: order * 0.31 },
            uColor: { value: new Color() },
          },
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
          fog: false,
        });
        const mesh = new Mesh(new TubeGeometry(curve, LINE_SAMPLES * 2, TUBE_RADIUS, 4, false), material);
        mesh.frustumCulled = false;
        mesh.renderOrder = 18;
        this.bloom.add(mesh);
        this.lines.push({ mesh, material, order });
        order++;
      }
    }
    this.bloom.visible = false;
  }

  get bloomLineCount(): number {
    return this.lines.length;
  }

  get coreObject(): Object3D {
    return this.core;
  }

  get beamObject(): Object3D {
    return this.beam;
  }

  get bloomObject(): Object3D {
    return this.bloom;
  }

  get starObject(): Object3D {
    return this.star;
  }

  /** Poses every element for one instant of the film. */
  apply(input: StageInputs): void {
    const { frame, chest, head, axisAngle, cameraDistance, time, actorZ } = input;
    this.mountain.setOpacity(frame.mountain);
    this.poseCore(input);

    this.bloom.visible = frame.bloomAlpha > 0.001;
    if (this.bloom.visible) {
      this.bloom.position.set(head.x, head.y, actorZ - 0.1);
      this.bloom.rotation.z = axisAngle;
      this.bloom.scale.setScalar(lerp(BLOOM_MIN_SCALE, BLOOM_REACH_M / this.longestReach, frame.bloom));
      for (const line of this.lines) {
        const stagger = line.order / Math.max(1, this.lines.length - 1);
        const uniforms = line.material.uniforms;
        uniforms.uTime!.value = time;
        uniforms.uGrow!.value = Math.min(1.1, frame.bloom * 1.5 + 0.1 - stagger * 0.5);
        uniforms.uAlpha!.value = frame.bloomAlpha * 0.9;
        (uniforms.uColor!.value as Color).copy(line.order % 2 === 0 ? fxTheme.attract : fxTheme.repel);
      }
    }

    const beamLevel = frame.beam * frame.chestGlow;
    this.beam.visible = beamLevel > 0.001;
    if (this.beam.visible) {
      this.beam.position.set(chest.x, chest.y + BEAM_HEIGHT_M / 2, actorZ - 0.3);
      (this.beam.material as MeshBasicMaterial).opacity = 0.16 * beamLevel * (0.85 + 0.15 * Math.sin(time * 2.4));
    }

    const starAlpha = frame.chestGlow * (0.55 + 0.1 * Math.sin(time * 3));
    this.star.visible = starAlpha > 0.001;
    if (this.star.visible) {
      this.star.position.set(chest.x, chest.y, actorZ + 0.35);
      this.star.scale.setScalar(Math.max(1.4, cameraDistance * 0.045));
      haloMaterial(this.star).uniforms.uAlpha!.value = starAlpha;
    }
  }

  private poseCore({ frame, summit, chest, time, actorZ }: StageInputs): void {
    this.core.visible = frame.coreLoose;
    this.coreHalo.visible = frame.coreLoose;
    if (!frame.coreLoose) return;

    const x = lerp(summit.x, chest.x, frame.corePath);
    const y = lerp(summit.y, chest.y, frame.corePath) + frame.coreLift + Math.sin(time * 2.2) * 0.07 * (1 - frame.corePath);
    this.core.position.set(x, y, actorZ + 0.3);
    this.core.rotation.y = time * (1.4 + frame.corePath * 5);
    this.core.rotation.x = time * 0.6;
    this.core.scale.setScalar(lerp(CORE_REST_SCALE, CORE_SEATED_SCALE, frame.corePath));

    this.coreHalo.position.set(x, y, actorZ + 0.25);
    this.coreHalo.scale.setScalar(lerp(3.4, 0.9, frame.corePath));
    haloMaterial(this.coreHalo).uniforms.uAlpha!.value = 0.28 + 0.1 * Math.sin(time * 3.1);
  }

  dispose(): void {
    this.mountain.dispose();
    this.group.traverse((o) => {
      if (!(o instanceof Mesh) || this.mountain.layers.includes(o)) return;
      o.geometry.dispose();
      (o.material as { dispose(): void }).dispose();
    });
  }
}
