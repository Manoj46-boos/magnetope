import { PerspectiveCamera } from 'three';
import { SecondOrder, noise1 } from '@/core/dynamics';
import { DEG, clamp, damp, type Vec2 } from '@/core/mathx';
import { cameraDistance, type StageLayout } from './stage';

export const CAMERA_FOV = 24;
const DEFAULT_FAR = 600;

/** Shake grammar from PRD 8.4: amplitude as a share of visible height, plus duration. */
export const SHAKE = {
  micro: { amplitude: 0.003, duration: 0.08 },
  small: { amplitude: 0.0066, duration: 0.12 },
  big: { amplitude: 0.0114, duration: 0.18 },
} as const;

export type ShakeKind = keyof typeof SHAKE;

const SHAKE_HZ = 10;
const MAX_ROLL = 1.2 * DEG;

interface ActiveShake {
  amplitude: number;
  duration: number;
  age: number;
  seed: number;
}

/**
 * Follow camera with a long lens for the toy-diorama look. Handles look-ahead,
 * the long-fall pull back, the slow-motion dolly, and the shake grammar.
 */
export class CameraRig {
  readonly camera = new PerspectiveCamera(CAMERA_FOV, 16 / 9, 0.5, DEFAULT_FAR);
  private baseDistance = 28;
  private readonly fx = new SecondOrder(1.7, 1, 0);
  private readonly fy = new SecondOrder(1.5, 1, 0);
  private readonly zoom = new SecondOrder(1.1, 1, 0, 1);
  private lookAhead: Vec2 = { x: 0, y: 0 };
  private shakes: ActiveShake[] = [];
  private shakeSeed = 0;
  private ready = false;
  private time = 0;
  /** Smoothed pull back for the cinematic fall framing. */
  private widen = 0;
  private dolly = 0;
  private visibleHeight = 11;
  private directedRoll = 0;
  reducedMotion = false;

  /** Height of the view at the standard follow distance, in metres. */
  get baseVisibleHeight(): number {
    return 2 * this.baseDistance * Math.tan((CAMERA_FOV * Math.PI) / 360);
  }

  /** Where the follow camera currently looks. */
  get focus(): Vec2 {
    return { x: this.fx.value, y: this.fy.value };
  }

  setLayout(layout: StageLayout): void {
    this.camera.aspect = layout.cssWidth / layout.cssHeight;
    this.baseDistance = cameraDistance(layout, CAMERA_FOV);
    this.camera.updateProjectionMatrix();
  }

  /** The player's feet plane maps to this screen height fraction (0 bottom, 1 top). */
  private readonly framingBias = 0.38;

  snapTo(target: Vec2): void {
    this.fx.snap(target.x);
    this.fy.snap(target.y);
    this.zoom.snap(1);
    this.widen = 0;
    this.dolly = 0;
    this.lookAhead = { x: 0, y: 0 };
    this.shakes = [];
    this.ready = true;
    this.directedRoll = 0;
    if (this.camera.far !== DEFAULT_FAR) {
      this.camera.far = DEFAULT_FAR;
      this.camera.updateProjectionMatrix();
    }
    this.place(target.x, target.y);
  }

  /** Cinematic placement that bypasses the follow logic: look at `center` from far enough to see `visibleHeight` metres. */
  direct(center: Vec2, visibleHeight: number, rollDeg = 0): void {
    const zoom = visibleHeight / this.baseVisibleHeight;
    this.fx.snap(center.x);
    this.fy.snap(center.y);
    this.zoom.snap(zoom);
    this.widen = 0;
    this.dolly = 0;
    this.ready = true;
    this.directedRoll = rollDeg * DEG;
    const reach = this.baseDistance * zoom * 1.6 + 200;
    if (this.camera.far < reach) {
      this.camera.far = reach;
      this.camera.updateProjectionMatrix();
    }
    this.place(center.x, center.y);
  }

  /** Request a shake. Ignored while an input-critical window is open. */
  shake(kind: ShakeKind, inputCritical: boolean): void {
    if (inputCritical) return;
    const def = SHAKE[kind];
    const scale = this.reducedMotion ? 0.3 : 1;
    this.shakes.push({ amplitude: def.amplitude * scale, duration: def.duration, age: 0, seed: ++this.shakeSeed * 13.37 });
    if (this.shakes.length > 6) this.shakes.shift();
  }

  update(target: Vec2, velocity: Vec2, dt: number, opts: { falling: boolean; slowMo: number; bounds: { minX: number; maxX: number } }): void {
    if (!this.ready) this.snapTo(target);
    this.time += dt;

    const ahead = this.reducedMotion ? 0.05 : 0.2;
    this.lookAhead.x = damp(this.lookAhead.x, clamp(velocity.x * ahead, -2.4, 2.4), 2.5, dt);
    this.lookAhead.y = damp(this.lookAhead.y, clamp(velocity.y * ahead, -3, 3), 2.5, dt);

    const wantWiden = opts.falling ? 0.45 : 0;
    this.widen = damp(this.widen, wantWiden, opts.falling ? 2.4 : 1.2, dt);
    this.dolly = damp(this.dolly, opts.slowMo, 5, dt);
    const zoomTarget = 1 + this.widen + (this.reducedMotion ? 0 : this.dolly * 0.22);
    this.zoom.update(zoomTarget, dt);

    const half = this.visibleHeight / 2;
    this.fx.update(clamp(target.x + this.lookAhead.x, opts.bounds.minX + 6, opts.bounds.maxX - 6), dt);
    this.fy.update(target.y + this.lookAhead.y + half * (0.5 - this.framingBias) * 0.9, dt);
    this.place(this.fx.value, this.fy.value, dt);
  }

  private place(cx: number, cy: number, dt = 0): void {
    const distance = this.baseDistance * this.zoom.value;
    const tan = Math.tan((CAMERA_FOV * Math.PI) / 360);
    this.visibleHeight = 2 * distance * tan;

    let sx = 0;
    let sy = 0;
    let roll = 0;
    const alive: ActiveShake[] = [];
    for (const s of this.shakes) {
      s.age += dt;
      if (s.age >= s.duration * 3) continue;
      alive.push(s);
      const decay = Math.exp((-s.age / s.duration) * 2.2);
      const amp = s.amplitude * this.visibleHeight * decay;
      sx += noise1(this.time * SHAKE_HZ, s.seed) * amp;
      sy += noise1(this.time * SHAKE_HZ, s.seed + 5) * amp;
      roll += this.reducedMotion ? 0 : noise1(this.time * SHAKE_HZ, s.seed + 9) * MAX_ROLL * decay;
    }
    this.shakes = alive;

    const offsetX = 3.4 + this.zoom.value * 0.4;
    this.camera.position.set(cx + offsetX + sx, cy + 1.4 + sy, distance);
    this.camera.lookAt(cx + sx, cy + sy, 0);
    this.camera.rotateZ(clamp(roll, -MAX_ROLL, MAX_ROLL) + this.directedRoll);
  }

  get verticalExtent(): number {
    return this.visibleHeight;
  }
}
