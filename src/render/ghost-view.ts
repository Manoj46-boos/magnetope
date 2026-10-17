import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import { clamp, damp, type Vec2 } from '@/core/mathx';

const BODY_OPACITY = 0.34;
const HEAD_OPACITY = 0.46;

/**
 * A translucent MAGNO that replays a recorded run. It is a silhouette rather
 * than a second full rig: eight shapes, no lighting, drawn over the level so a
 * player can read where the ghost is at a glance without it hiding the route.
 */
export class GhostView {
  readonly group = new Group();
  private readonly materials: MeshBasicMaterial[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private previous: Vec2 | null = null;
  private lean = 0;

  constructor(tint: Color, z: number) {
    const body = this.shape(new SphereGeometry(0.225, 9, 7), tint, BODY_OPACITY);
    body.scale.set(1, 1.28, 0.7);

    const head = new Group();
    head.position.set(0, 0.34, 0);
    head.rotation.z = -0.14;
    const arch = this.shape(new TorusGeometry(0.15, 0.058, 4, 10, Math.PI), tint, HEAD_OPACITY);
    arch.position.y = 0.02;
    head.add(arch);
    for (const side of [-1, 1]) {
      const leg = this.shape(new SphereGeometry(0.07, 5, 4), tint, HEAD_OPACITY);
      leg.scale.set(0.9, 1.6, 0.9);
      leg.position.set(side * 0.15, -0.07, 0);
      head.add(leg);
    }

    this.group.add(body, head);
    this.group.position.z = z;
    this.group.visible = false;
  }

  private shape(geometry: BufferGeometry, tint: Color, opacity: number): Mesh {
    const material = new MeshBasicMaterial({ color: tint, transparent: true, opacity, depthWrite: false, fog: false });
    this.materials.push(material);
    this.geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 14;
    return mesh;
  }

  /** Moves the ghost to `pose`, or hides it when there is nothing to show. */
  update(pose: Vec2 | null, dt: number): void {
    if (!pose) {
      this.group.visible = false;
      this.previous = null;
      return;
    }
    this.group.visible = true;
    const velocityX = this.previous && dt > 0 ? (pose.x - this.previous.x) / dt : 0;
    this.lean = damp(this.lean, clamp(-velocityX * 0.03, -0.3, 0.3), 10, Math.max(dt, 1e-4));
    this.previous = { ...pose };
    this.group.position.x = pose.x;
    this.group.position.y = pose.y;
    this.group.rotation.z = this.lean;
  }

  dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
