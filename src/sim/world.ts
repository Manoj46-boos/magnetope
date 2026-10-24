import type RAPIER from '@dimforge/rapier3d-compat';
import { TUNING } from '@/config/tuning';
import { MATERIALS, isMagnetic, type MaterialDef } from '@/config/materials';
import { propKind, type PropKind } from '@/config/props';
import { clamp, len2, type Vec2 } from '@/core/mathx';
import { cycleState, poseAt, poseVelocity, toBodyFrame } from './motion';
import type { LevelDef, PropPlacement } from './types';

type Rapier = typeof RAPIER;

/** Half-depth of every collider. MAGNO is locked to z=0, so the slab only needs to span it. */
const PLANE_HALF_DEPTH = 1.5;
/** How far beyond MAGNO's skin the contact probe looks. Wider than the capture gap. */
const PROBE_REACH = 0.45;
/** A hung prop should keep swinging long enough to read as a pendulum. */
const HINGE_ANGULAR_DAMPING = 0.05;

export interface Surface {
  colliderHandle: number;
  bodyHandle: number;
  material: MaterialDef;
  kind: PropKind;
  propIndex: number;
  dynamic: boolean;
  /** Follows a scripted path rather than the solver. */
  moving: boolean;
  live: boolean;
}

export interface SurfaceContact {
  surface: Surface;
  point: Vec2;
  /** Unit normal pointing from the surface toward the probing sphere. */
  normal: Vec2;
  /** Distance between the sphere's skin and the surface; <= 0 means touching. */
  gap: number;
}

export interface SnapCandidate {
  surface: Surface;
  point: Vec2;
  distance: number;
}

export interface BuiltProp {
  index: number;
  placement: PropPlacement;
  kind: PropKind;
  material: MaterialDef;
  width: number;
  height: number;
  radius: number;
  colliderHandle: number;
  bodyHandle: number;
  dynamic: boolean;
  moving: boolean;
}

const quatZ = (angle: number) => ({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) });
const ZERO3 = { x: 0, y: 0, z: 0 };
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

/** Owns the Rapier world and every spatial query MAGNO and the level rules need. */
export class PhysicsWorld {
  world: RAPIER.World;
  magnoBodyHandle = -1;
  magnoColliderHandle = -1;
  readonly gravity: number;
  /** This level's gravity as a share of the standard, so effects that must scale with weight can follow it. */
  readonly gravityScale: number;
  readonly surfaces = new Map<number, Surface>();
  /** Every surface the level was built with, so a restored snapshot can bring back what has since broken. */
  private readonly catalog = new Map<number, Surface>();
  readonly props: BuiltProp[] = [];
  /** Props whose pose or solidity is a function of time. */
  private readonly scripted: BuiltProp[] = [];
  private readonly motionByBody = new Map<number, PropPlacement>();
  /** Velocity of each follower over the tick it is travelling, so MAGNO rides it like any other mover. */
  private readonly followerVelocity = new Map<number, Vec2>();
  private clockMs = 0;
  private readonly probeShape: RAPIER.Ball;
  private readonly snapShape: RAPIER.Ball;
  /** The capture radius this level plays with: the base, widened by the on-ramp (R-LD-14). */
  readonly snapRadius: number;

  constructor(
    private readonly rapier: Rapier,
    readonly level: LevelDef,
  ) {
    this.gravityScale = level.gravityScale ?? 1;
    const g = TUNING.sim.gravity * this.gravityScale;
    this.gravity = g;
    this.world = new rapier.World({ x: 0, y: -g, z: 0 });
    this.world.timestep = 1 / TUNING.sim.hz;
    this.probeShape = new rapier.Ball(TUNING.body.radius + PROBE_REACH);
    this.snapRadius = TUNING.snap.radius * (level.onRamp?.catchWindow ?? 1);
    this.snapShape = new rapier.Ball(this.snapRadius);
    this.buildLevel();
    this.buildMagno();
  }

  get magnoBody(): RAPIER.RigidBody {
    return this.world.getRigidBody(this.magnoBodyHandle);
  }

  get magnoCollider(): RAPIER.Collider {
    return this.world.getCollider(this.magnoColliderHandle);
  }

  /** How fast the quickest free-turning prop (a wheel on its bearing) is turning, in radians a second. */
  axleSpeed(): number {
    let fastest = 0;
    for (const prop of this.props) {
      if (prop.kind.bearing === undefined) continue;
      fastest = Math.max(fastest, Math.abs(this.world.getRigidBody(prop.bodyHandle).angvel().z));
    }
    return fastest;
  }

  get dynamicProps(): BuiltProp[] {
    return this.props.filter((p) => p.dynamic);
  }

  step(): void {
    this.world.step();
  }

  /** Rapier forces persist until reset, so every tick starts from a clean slate. */
  clearForces(): void {
    const clear = (body: RAPIER.RigidBody) => {
      body.resetForces(false);
      body.resetTorques(false);
    };
    clear(this.magnoBody);
    for (const prop of this.props) {
      if (prop.dynamic) clear(this.world.getRigidBody(prop.bodyHandle));
    }
  }

  snapshot(): Uint8Array {
    return this.world.takeSnapshot();
  }

  restore(data: Uint8Array): void {
    this.world.free();
    this.world = this.rapier.World.restoreSnapshot(data);
    this.surfaces.clear();
    for (const [handle, surface] of this.catalog) {
      if (this.world.getCollider(handle)) this.surfaces.set(handle, surface);
    }
  }

  dispose(): void {
    this.world.free();
  }

  private buildLevel(): void {
    const { rapier, world } = this;
    const compounds = this.compoundGroups();
    this.level.props.forEach((placement, index) => {
      const kind = propKind(placement.kind);
      const material = MATERIALS[placement.material ?? kind.material];
      const dynamic = kind.mass !== undefined;
      const follows = placement.follow !== undefined;
      const moving = placement.motion !== undefined || follows;
      if (dynamic && moving) throw new Error(`Prop ${index} (${kind.id}) cannot be both dynamic and scripted`);
      if (placement.motion && follows) throw new Error(`Prop ${index} (${kind.id}) cannot follow a switch and run a script`);
      if (placement.hinge && !dynamic) throw new Error(`Prop ${index} (${kind.id}) needs a mass to hang from a hinge`);
      if ((placement.weld || placement.pin) && !dynamic) throw new Error(`Prop ${index} (${kind.id}) needs a mass to be joined to another prop`);

      const start = poseAt(placement, 0);
      const base = dynamic ? rapier.RigidBodyDesc.dynamic() : moving ? rapier.RigidBodyDesc.kinematicPositionBased() : rapier.RigidBodyDesc.fixed();
      const bodyDesc = base.setTranslation(start.x, start.y, 0).setRotation(quatZ(start.rot));
      if (dynamic) {
        const hungDamping = kind.swingDamping ?? HINGE_ANGULAR_DAMPING;
        const jointed = Boolean(placement.hinge || placement.weld || placement.pin);
        bodyDesc.setLinearDamping(0.05).setAngularDamping(jointed ? hungDamping : 0.4).setCcdEnabled(true);
        // The revolute joint already confines a hung prop to the plane; locking axes on top of it destabilises the solver.
        if (!jointed) bodyDesc.enabledTranslations(true, true, false).enabledRotations(false, false, true);
      }
      const body = world.createRigidBody(bodyDesc);
      if (placement.hinge) this.hang(body, placement, placement.hinge, kind);

      let width = 0;
      let height = 0;
      let radius = 0;
      let colliderDesc: RAPIER.ColliderDesc;
      if (kind.shape.type === 'box') {
        width = placement.w ?? kind.shape.w;
        height = placement.h ?? kind.shape.h;
        colliderDesc = rapier.ColliderDesc.cuboid(width / 2, height / 2, PLANE_HALF_DEPTH);
      } else {
        radius = placement.r ?? kind.shape.r;
        width = height = radius * 2;
        // Rapier cylinders run along Y; rotate a quarter turn so the axis points along Z.
        colliderDesc = rapier.ColliderDesc.cylinder(PLANE_HALF_DEPTH, radius).setRotation({
          x: Math.SQRT1_2,
          y: 0,
          z: 0,
          w: Math.SQRT1_2,
        });
      }
      colliderDesc.setFriction(material.friction).setRestitution(material.restitution);
      if (dynamic && kind.mass !== undefined) colliderDesc.setMass(kind.mass);

      const group = compounds.get(index);
      if (group !== undefined) colliderDesc.setCollisionGroups((1 << group) * 0x10000 + (0xffff & ~(1 << group)));
      const collider = world.createCollider(colliderDesc, body);
      if (placement.cycle) collider.setEnabled(cycleState(placement.cycle, 0) !== 'off');
      const surface: Surface = {
        colliderHandle: collider.handle,
        bodyHandle: body.handle,
        material,
        kind,
        propIndex: index,
        dynamic,
        moving,
        live: Boolean(kind.live),
      };
      this.surfaces.set(collider.handle, surface);
      this.catalog.set(collider.handle, surface);
      const built: BuiltProp = {
        index,
        placement,
        kind,
        material,
        width,
        height,
        radius,
        colliderHandle: collider.handle,
        bodyHandle: body.handle,
        dynamic,
        moving,
      };
      this.props.push(built);
      if (placement.motion || placement.cycle) this.scripted.push(built);
      if (placement.motion) this.motionByBody.set(body.handle, placement);
      if (follows) this.followerVelocity.set(body.handle, { x: 0, y: 0 });
    });
    this.joinProps();
  }

  /**
   * Parts bolted or pinned together (a wheel's hub, spokes and cabins) must never collide with one
   * another, whatever pose the wheel is in. Each compound gets its own collision group; every other
   * collider keeps the default and meets all of them.
   */
  private compoundGroups(): Map<number, number> {
    const { props } = this.level;
    const byTag = new Map<string, number>();
    props.forEach((placement, index) => {
      if (placement.tag) byTag.set(placement.tag, index);
    });
    const rootOf = (index: number): number => {
      const { weld, pin } = props[index]!;
      const parent = weld ?? pin?.tag;
      return parent === undefined ? index : rootOf(byTag.get(parent) ?? index);
    };
    const groups = new Map<number, number>();
    const rootGroup = new Map<number, number>();
    props.forEach((placement, index) => {
      const root = rootOf(index);
      const hasParts = placement.tag !== undefined && props.some((other) => other.weld === placement.tag || other.pin?.tag === placement.tag);
      if (root === index && !hasParts) return;
      if (!rootGroup.has(root)) rootGroup.set(root, rootGroup.size);
      groups.set(index, rootGroup.get(root)!);
    });
    if (rootGroup.size > 16) throw new Error('A level can hold at most 16 compound props');
    return groups;
  }

  /** Bolts and pins the parts of a compound prop, such as a wheel, once every body exists. */
  private joinProps(): void {
    const { rapier, world } = this;
    const byTag = new Map<string, BuiltProp>();
    for (const prop of this.props) {
      const tag = prop.placement.tag;
      if (tag) byTag.set(tag, prop);
    }
    const partner = (prop: BuiltProp, tag: string): BuiltProp => {
      const found = byTag.get(tag);
      if (!found?.dynamic) throw new Error(`Prop ${prop.index} (${prop.kind.id}) is joined to "${tag}", which is not a dynamic prop`);
      return found;
    };
    for (const prop of this.props) {
      const { weld, pin } = prop.placement;
      if (!weld && !pin) continue;
      const parent = partner(prop, (weld ?? pin?.tag)!);
      const child = poseAt(prop.placement, 0);
      const base = poseAt(parent.placement, 0);
      const bodies = [world.getRigidBody(parent.bodyHandle), world.getRigidBody(prop.bodyHandle)] as const;
      let data: RAPIER.JointData;
      if (weld) {
        const anchor = toBodyFrame(base, child);
        data = rapier.JointData.fixed({ x: anchor.x, y: anchor.y, z: 0 }, IDENTITY, ZERO3, quatZ(base.rot - child.rot));
      } else {
        const at = pin!.at;
        const onParent = toBodyFrame(base, at);
        const onChild = toBodyFrame(child, at);
        data = rapier.JointData.revolute({ x: onParent.x, y: onParent.y, z: 0 }, { x: onChild.x, y: onChild.y, z: 0 }, { x: 0, y: 0, z: 1 });
      }
      world.createImpulseJoint(data, bodies[0], bodies[1], true);
    }
  }

  /** Pins a dynamic body to a fixed point with a free-swinging revolute joint about Z. */
  private hang(body: RAPIER.RigidBody, placement: PropPlacement, pivot: Vec2, kind: PropKind): void {
    const { rapier, world } = this;
    const anchor = world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(pivot.x, pivot.y, 0));
    const rot = placement.rot ?? 0;
    const dx = pivot.x - placement.x;
    const dy = pivot.y - placement.y;
    const local = { x: dx * Math.cos(-rot) - dy * Math.sin(-rot), y: dx * Math.sin(-rot) + dy * Math.cos(-rot), z: 0 };
    const joint = world.createImpulseJoint(rapier.JointData.revolute(ZERO3, local, { x: 0, y: 0, z: 1 }), anchor, body, true) as RAPIER.RevoluteImpulseJoint;
    if (kind.bearing !== undefined) {
      joint.configureMotorModel(rapier.MotorModel.ForceBased);
      joint.configureMotorVelocity(0, kind.bearing);
    }
    if (kind.tilt && kind.mass !== undefined) {
      joint.setLimits(rot - kind.tilt.limit, rot + kind.tilt.limit);
      joint.configureMotorModel(rapier.MotorModel.ForceBased);
      // A board hinged at its end carries its own weight on the spring; lifting the rest angle by that sag keeps it level.
      const sag = (kind.mass * this.gravity * (placement.x - pivot.x)) / kind.tilt.stiffness;
      joint.configureMotorPosition(rot + clamp(sag, -kind.tilt.limit, kind.tilt.limit), kind.tilt.stiffness, kind.tilt.damping);
    }
  }

  get scriptedProps(): readonly BuiltProp[] {
    return this.scripted;
  }

  /**
   * Aims a follower at `offset` metres along its travel for the next tick. The velocity is
   * kept so that anything riding the follower is carried at the speed it really moves.
   */
  placeFollower(prop: BuiltProp, offset: Vec2, velocity: Vec2): void {
    const body = this.world.getRigidBody(prop.bodyHandle);
    body.setNextKinematicTranslation({ x: prop.placement.x + offset.x, y: prop.placement.y + offset.y, z: 0 });
    this.followerVelocity.set(prop.bodyHandle, velocity);
  }

  /** Whether a prop still has a collider in the world: broken glass does not. */
  isIntact(prop: BuiltProp): boolean {
    return this.surfaces.has(prop.colliderHandle);
  }

  /** Switches a prop's collider on or off without forgetting it, as crumbling surfaces do. */
  setSolid(prop: BuiltProp, solid: boolean): void {
    if (!this.surfaces.has(prop.colliderHandle)) return;
    this.world.getCollider(prop.colliderHandle).setEnabled(solid);
  }

  isSolid(prop: BuiltProp): boolean {
    return this.surfaces.has(prop.colliderHandle) && this.world.getCollider(prop.colliderHandle).isEnabled();
  }

  /**
   * Positions scripted props for the tick that starts at `timeMs`. Kinematic
   * bodies are aimed at where they will be one tick later, so the solver sees the
   * true velocity when it carries MAGNO along.
   */
  drive(timeMs: number): void {
    this.clockMs = timeMs;
    const dtMs = 1000 / TUNING.sim.hz;
    for (const prop of this.scripted) {
      const { motion, cycle } = prop.placement;
      if (motion) {
        const next = poseAt(prop.placement, timeMs + dtMs);
        const body = this.world.getRigidBody(prop.bodyHandle);
        body.setNextKinematicTranslation({ x: next.x, y: next.y, z: 0 });
        body.setNextKinematicRotation(quatZ(next.rot));
      }
      if (cycle) this.world.getCollider(prop.colliderHandle).setEnabled(cycleState(cycle, timeMs) !== 'off');
    }
  }

  private buildMagno(): void {
    const { rapier, world } = this;
    const { radius, halfHeight, mass, linearDamping, angularDamping } = TUNING.body;
    const spawn = this.level.spawn;
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(spawn.x, spawn.y + radius + halfHeight + 0.05, 0)
        .enabledTranslations(true, true, false)
        .enabledRotations(false, false, true)
        .setLinearDamping(linearDamping)
        .setAngularDamping(angularDamping)
        .setCcdEnabled(true),
    );
    const collider = world.createCollider(
      rapier.ColliderDesc.capsule(halfHeight, radius)
        .setMass(mass)
        .setFriction(0)
        .setFrictionCombineRule(rapier.CoefficientCombineRule.Min)
        .setRestitution(0)
        .setRestitutionCombineRule(rapier.CoefficientCombineRule.Max),
      body,
    );
    this.magnoBodyHandle = body.handle;
    this.magnoColliderHandle = collider.handle;
  }

  removeSurface(colliderHandle: number): void {
    if (!this.surfaces.has(colliderHandle)) return;
    this.world.removeCollider(this.world.getCollider(colliderHandle), true);
    this.surfaces.delete(colliderHandle);
  }

  /**
   * Nearest contact per surface for a sphere of MAGNO's radius centred at `center`.
   * Contacts closer than the probe reach are returned, ordered nearest first.
   */
  probe(center: Vec2): SurfaceContact[] {
    const R = TUNING.body.radius;
    const pos = { x: center.x, y: center.y, z: 0 };
    const contacts: SurfaceContact[] = [];
    this.world.intersectionsWithShape(
      pos,
      IDENTITY,
      this.probeShape,
      (collider) => {
        const surface = this.surfaces.get(collider.handle);
        if (!surface) return true;
        const proj = collider.projectPoint(pos, false);
        if (!proj) return true;
        const dx = pos.x - proj.point.x;
        const dy = pos.y - proj.point.y;
        const dist = Math.hypot(dx, dy);
        let nx: number;
        let ny: number;
        if (dist < 1e-5 || proj.isInside) {
          const c = collider.translation();
          nx = pos.x - c.x;
          ny = pos.y - c.y;
          const l = Math.hypot(nx, ny) || 1;
          nx /= l;
          ny /= l;
        } else {
          nx = dx / dist;
          ny = dy / dist;
        }
        contacts.push({
          surface,
          point: { x: proj.point.x, y: proj.point.y },
          normal: { x: nx, y: ny },
          gap: (proj.isInside ? -dist : dist) - R,
        });
        return true;
      },
      undefined,
      undefined,
      this.magnoCollider,
    );
    return contacts.sort((a, b) => a.gap - b.gap);
  }

  /** Magnetic surfaces inside the snap radius that have a clear line from `center`. */
  snapCandidates(center: Vec2, exclude: ReadonlySet<number>): SnapCandidate[] {
    const pos = { x: center.x, y: center.y, z: 0 };
    const found: SnapCandidate[] = [];
    this.world.intersectionsWithShape(
      pos,
      IDENTITY,
      this.snapShape,
      (collider) => {
        const handle = collider.handle;
        if (exclude.has(handle)) return true;
        const surface = this.surfaces.get(handle);
        if (!surface || !isMagnetic(surface.material)) return true;
        const proj = collider.projectPoint(pos, false);
        if (!proj) return true;
        const point = { x: proj.point.x, y: proj.point.y };
        const distance = len2({ x: point.x - pos.x, y: point.y - pos.y });
        if (distance > this.snapRadius || !this.hasLineOfSight(pos, point, handle)) return true;
        found.push({ surface, point, distance });
        return true;
      },
      undefined,
      undefined,
      this.magnoCollider,
    );
    return found;
  }

  private hasLineOfSight(from: { x: number; y: number }, to: Vec2, targetHandle: number): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) return true;
    const ray = new this.rapier.Ray({ x: from.x, y: from.y, z: 0 }, { x: dx / dist, y: dy / dist, z: 0 });
    const hit = this.world.castRay(ray, dist + 0.02, true, undefined, undefined, this.magnoCollider);
    if (!hit) return true;
    return hit.collider.handle === targetHandle || hit.timeOfImpact >= dist - 0.06;
  }

  /** Distance along `dir` to the first solid surface, or Infinity. */
  castDistance(from: Vec2, dir: Vec2, maxDist: number): number {
    const l = Math.hypot(dir.x, dir.y);
    if (l < 1e-6) return Infinity;
    const ray = new this.rapier.Ray({ x: from.x, y: from.y, z: 0 }, { x: dir.x / l, y: dir.y / l, z: 0 });
    const hit = this.world.castRay(ray, maxDist, true, undefined, undefined, this.magnoCollider);
    return hit ? hit.timeOfImpact : Infinity;
  }

  /** Velocity of a body at a world-space point (planar rigid body). */
  velocityAt(bodyHandle: number, point: Vec2): Vec2 {
    const follower = this.followerVelocity.get(bodyHandle);
    if (follower) return follower;
    const scripted = this.motionByBody.get(bodyHandle);
    if (scripted) {
      const dtMs = 1000 / TUNING.sim.hz;
      const { vx, vy, w } = poseVelocity(scripted, this.clockMs, dtMs);
      const c = poseAt(scripted, this.clockMs);
      return { x: vx - w * (point.y - c.y), y: vy + w * (point.x - c.x) };
    }
    const body = this.world.getRigidBody(bodyHandle);
    if (body.isFixed()) return { x: 0, y: 0 };
    const v = body.linvel();
    const w = body.angvel().z;
    const c = body.translation();
    return { x: v.x - w * (point.y - c.y), y: v.y + w * (point.x - c.x) };
  }

  applyImpulseAt(bodyHandle: number, impulse: Vec2, at: Vec2): void {
    const body = this.world.getRigidBody(bodyHandle);
    if (body.isFixed()) return;
    body.applyImpulseAtPoint({ x: impulse.x, y: impulse.y, z: 0 }, { x: at.x, y: at.y, z: 0 }, true);
  }

  addForceAt(bodyHandle: number, force: Vec2, at: Vec2): void {
    const body = this.world.getRigidBody(bodyHandle);
    if (body.isFixed()) return;
    body.addForceAtPoint({ x: force.x, y: force.y, z: 0 }, { x: at.x, y: at.y, z: 0 }, true);
  }

  resetDynamicProps(): void {
    for (const prop of this.dynamicProps) {
      const body = this.world.getRigidBody(prop.bodyHandle);
      body.setTranslation({ x: prop.placement.x, y: prop.placement.y, z: 0 }, true);
      body.setRotation(quatZ(prop.placement.rot ?? 0), true);
      body.setLinvel(ZERO3, true);
      body.setAngvel(ZERO3, true);
    }
  }
}
