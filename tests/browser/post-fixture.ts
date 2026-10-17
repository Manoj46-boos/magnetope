import {
  Color,
  DoubleSide,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { PostStack } from '@/render/post-stack';
import { PROFILES, type QualityTier } from '@/render/quality';
import type { BiomeId } from '@/sim/types';

/**
 * A bare page that drives the real post stack with scenes made of flat quads, so
 * the shader maths can be measured pixel by pixel. Not part of the game bundle.
 */

export interface QuadSpec {
  /** Pixel rectangle, origin top left. */
  rect: [x: number, y: number, w: number, h: number];
  /** Linear light, so values above 1 are the HDR a glow would carry. */
  color: [number, number, number];
  /** Writes NaN instead of a colour: a divide that went wrong in a material. */
  broken?: boolean;
}

export interface ProbeSpec {
  tier: QualityTier;
  biome: BiomeId;
  /** Display (sRGB) background, 0 to 1. */
  background: [number, number, number];
  quads?: QuadSpec[];
  /** Pixels to read back, origin top left. */
  samples: Array<[number, number]>;
}

const SIZE = 400;
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: false });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = NoToneMapping;

const camera = new OrthographicCamera(0, SIZE, 0, SIZE, -10, 10);
const stack = new PostStack(renderer, PROFILES.high);
stack.setSize(SIZE, SIZE);

const brokenMaterial = new ShaderMaterial({
  uniforms: { zero: { value: 0 } },
  vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  side: DoubleSide,
  fragmentShader: 'uniform float zero; void main() { float v = zero / zero; gl_FragColor = vec4(v, v, v, 1.0); }',
});

function probe(spec: ProbeSpec): number[][] {
  const scene = new Scene();
  scene.background = new Color().setRGB(...spec.background, SRGBColorSpace);
  for (const quad of spec.quads ?? []) {
    const [x, y, w, h] = quad.rect;
    const material = quad.broken ? brokenMaterial : new MeshBasicMaterial({ color: new Color().setRGB(...quad.color, LinearSRGBColorSpace), toneMapped: false, side: DoubleSide });
    const mesh = new Mesh(new PlaneGeometry(w, h), material);
    mesh.position.set(x + w / 2, y + h / 2, 0);
    scene.add(mesh);
  }

  stack.setProfile(PROFILES[spec.tier]);
  stack.setBiome(spec.biome);
  stack.render(scene, camera);

  const gl = renderer.getContext();
  return spec.samples.map(([px, py]) => {
    const out = new Uint8Array(4);
    gl.readPixels(px, SIZE - 1 - py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return [out[0]!, out[1]!, out[2]!];
  });
}

(window as unknown as { probe: typeof probe; ready: boolean }).probe = probe;
(window as unknown as { ready: boolean }).ready = true;
