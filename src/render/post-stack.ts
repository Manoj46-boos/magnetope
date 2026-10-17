import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Texture,
  type WebGLRenderer,
} from 'three';
import type { BiomeId } from '@/sim/types';
import { GRADES, LUT_SIZE, LUT_WIDTH, buildGradeLut } from './grade';
import { BLUR_FRAGMENT, BRIGHT_FRAGMENT, FINAL_FRAGMENT, FULLSCREEN_VERTEX } from './post-shaders';
import type { QualityProfile } from './quality';

/** PRD 8.5: threshold 0.85, strength 0.4 (the biome grade may lower it), 12% vignette. */
const BLOOM_THRESHOLD = 0.85;
const BLOOM_KNEE = 0.25;
const VIGNETTE = 0.12;
const BLOOM_LEVELS = 3;

interface BlurLevel {
  ping: WebGLRenderTarget;
  pong: WebGLRenderTarget;
}

const triangle = (): BufferGeometry => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return geometry;
};

/**
 * Renders the scene into a multisampled float target, blooms what is brighter
 * than the threshold, then resolves to the screen in one pass that tone maps,
 * grades by biome, vignettes and dithers.
 */
export class PostStack {
  private readonly quadScene = new Scene();
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad: Mesh;
  private readonly bright: ShaderMaterial;
  private readonly blur: ShaderMaterial;
  private readonly final: ShaderMaterial;
  private readonly size = new Vector2(1, 1);
  private readonly highPrecision: boolean;
  private scene: WebGLRenderTarget | null = null;
  private brightTarget: WebGLRenderTarget | null = null;
  private levels: BlurLevel[] = [];
  private lut: DataTexture | null = null;
  private frameIndex = 0;

  constructor(
    private readonly renderer: WebGLRenderer,
    private profile: QualityProfile,
  ) {
    this.highPrecision = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    this.quad = new Mesh(triangle());
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    const base = { vertexShader: FULLSCREEN_VERTEX, depthTest: false, depthWrite: false, toneMapped: false };
    this.bright = new ShaderMaterial({
      ...base,
      fragmentShader: BRIGHT_FRAGMENT,
      uniforms: { tSource: { value: null }, texel: { value: new Vector2() }, threshold: { value: BLOOM_THRESHOLD }, knee: { value: BLOOM_KNEE } },
    });
    this.blur = new ShaderMaterial({
      ...base,
      fragmentShader: BLUR_FRAGMENT,
      uniforms: { tSource: { value: null }, direction: { value: new Vector2() } },
    });
    this.final = new ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: FINAL_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: null },
        tBloomA: { value: null },
        tBloomB: { value: null },
        tBloomC: { value: null },
        tLut: { value: null },
        bloomStrength: { value: GRADES.scrapyard.bloom },
        vignette: { value: 0 },
        aspect: { value: 1 },
        seed: { value: 0 },
      },
    });
    this.applyProfile();
  }

  setProfile(profile: QualityProfile): void {
    this.profile = profile;
    this.applyProfile();
    this.allocate();
  }

  setBiome(biome: BiomeId): void {
    const grade = GRADES[biome];
    this.lut?.dispose();
    this.lut = new DataTexture(buildGradeLut(grade), LUT_WIDTH, LUT_SIZE, RGBAFormat, UnsignedByteType);
    this.lut.minFilter = this.lut.magFilter = LinearFilter;
    this.lut.generateMipmaps = false;
    this.lut.needsUpdate = true;
    this.final.uniforms.tLut!.value = this.lut;
    this.final.uniforms.bloomStrength!.value = grade.bloom;
  }

  /** Drawing-buffer size in device pixels. */
  setSize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (w === this.size.x && h === this.size.y && this.scene) return;
    this.size.set(w, h);
    this.final.uniforms.aspect!.value = w / h;
    this.allocate();
  }

  render(scene: Scene, camera: Camera): void {
    if (!this.scene) return;
    const renderer = this.renderer;
    renderer.setRenderTarget(this.scene);
    renderer.render(scene, camera);

    const bloom = this.profile.bloomDivisor > 0 && this.brightTarget !== null;
    if (bloom) this.renderBloom(this.scene.texture);

    this.final.uniforms.tScene!.value = this.scene.texture;
    this.final.uniforms.seed!.value = (this.frameIndex++ % 97) * 1.7;
    this.draw(this.final, null);
  }

  dispose(): void {
    this.release();
    this.lut?.dispose();
    this.quad.geometry.dispose();
    this.bright.dispose();
    this.blur.dispose();
    this.final.dispose();
  }

  private applyProfile(): void {
    const bloom = this.profile.bloomDivisor > 0;
    this.final.defines = bloom ? { BLOOM: '' } : {};
    this.final.uniforms.vignette!.value = this.profile.shaderVignette ? VIGNETTE : 0;
    this.final.needsUpdate = true;
  }

  private target(width: number, height: number, depth: boolean, samples = 0): WebGLRenderTarget {
    return new WebGLRenderTarget(width, height, {
      type: this.highPrecision ? HalfFloatType : UnsignedByteType,
      format: RGBAFormat,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: depth,
      samples,
    });
  }

  private allocate(): void {
    this.release();
    const { x: w, y: h } = this.size;
    this.scene = this.target(w, h, true, this.profile.msaa);
    const divisor = this.profile.bloomDivisor;
    if (divisor === 0) return;
    const bw = Math.max(1, Math.floor(w / divisor));
    const bh = Math.max(1, Math.floor(h / divisor));
    this.brightTarget = this.target(bw, bh, false);
    for (let level = 0; level < BLOOM_LEVELS; level++) {
      const lw = Math.max(1, bw >> level);
      const lh = Math.max(1, bh >> level);
      this.levels.push({ ping: this.target(lw, lh, false), pong: this.target(lw, lh, false) });
    }
    const slots = ['tBloomA', 'tBloomB', 'tBloomC'];
    this.levels.forEach((level, index) => (this.final.uniforms[slots[index]!]!.value = level.pong.texture));
  }

  private release(): void {
    this.scene?.dispose();
    this.brightTarget?.dispose();
    for (const level of this.levels) {
      level.ping.dispose();
      level.pong.dispose();
    }
    this.scene = null;
    this.brightTarget = null;
    this.levels = [];
  }

  private renderBloom(source: Texture): void {
    const bright = this.brightTarget!;
    this.bright.uniforms.tSource!.value = source;
    (this.bright.uniforms.texel!.value as Vector2).set(1 / this.size.x, 1 / this.size.y);
    this.draw(this.bright, bright);

    let input: Texture = bright.texture;
    for (const level of this.levels) {
      const { width, height } = level.ping;
      this.blurPass(input, level.ping, 1 / width, 0);
      this.blurPass(level.ping.texture, level.pong, 0, 1 / height);
      input = level.pong.texture;
    }
  }

  private blurPass(source: Texture, into: WebGLRenderTarget, dx: number, dy: number): void {
    this.blur.uniforms.tSource!.value = source;
    (this.blur.uniforms.direction!.value as Vector2).set(dx, dy);
    this.draw(this.blur, into);
  }

  private draw(material: ShaderMaterial, into: WebGLRenderTarget | null): void {
    this.quad.material = material;
    this.renderer.setRenderTarget(into);
    this.renderer.render(this.quadScene, this.quadCamera);
  }
}
