import { TUNING } from '@/config/tuning';
import { Emitter } from '@/core/emitter';
import { smoothstep, type Vec2 } from '@/core/mathx';
import type { BuiltProp, PhysicsWorld } from './world';

export interface ReactiveEvents {
  crumbleWarn: { propIndex: number };
  crumble: { propIndex: number; point: Vec2 };
  restore: { propIndex: number };
  followerMove: { propIndex: number; direction: 'out' | 'in' };
}

interface CrumbleState {
  /** Weight carried so far, in milliseconds. */
  load: number;
  /** Time left before the surface re-forms; 0 while it stands. */
  goneMs: number;
  warned: boolean;
}

interface FollowState {
  /** 0 retracted, 1 fully out. */
  progress: number;
  /** Time the follower will stay out after the last touch. */
  holdMs: number;
  direction: 'out' | 'in' | 'idle';
}

/** Plain data so a snapshot can carry it: crumbling and sliding surfaces are part of the world's state. */
export interface ReactiveData {
  crumble: Record<number, CrumbleState>;
  follow: Record<number, FollowState>;
}

/** Load bleeds away at this multiple of real time once MAGNO steps off, so a quick hop never wears a surface down. */
const LOAD_RECOVERY = 1.5;
/** Clearance around a gone surface that MAGNO must leave before it may re-form under him. */
const RESTORE_CLEARANCE = { x: 0.7, y: 0.9 };

export interface CrumbleView {
  /** 0 steady, rising to 1 as the surface is about to go. */
  stress: number;
  gone: boolean;
}

/**
 * Surfaces that answer to MAGNO: ones that give way under his weight, and ones that
 * slide out while he clings to their switch. Driven by contacts alone, so it is as
 * deterministic as the physics it sits beside.
 */
export class ReactiveSystem {
  readonly events = new Emitter<ReactiveEvents>();
  private data: ReactiveData = { crumble: {}, follow: {} };
  private readonly crumblers: BuiltProp[];
  private readonly followers: BuiltProp[];
  private readonly switches = new Map<string, number[]>();

  constructor(private readonly physics: PhysicsWorld) {
    this.crumblers = physics.props.filter((p) => p.kind.reaction?.type === 'crumble');
    this.followers = physics.props.filter((p) => p.placement.follow);
    for (const prop of physics.props) {
      const tag = prop.placement.tag;
      if (tag) this.switches.set(tag, [...(this.switches.get(tag) ?? []), prop.index]);
    }
    for (const prop of this.crumblers) this.data.crumble[prop.index] = { load: 0, goneMs: 0, warned: false };
    for (const prop of this.followers) this.data.follow[prop.index] = { progress: 0, holdMs: 0, direction: 'idle' };
  }

  get active(): boolean {
    return this.crumblers.length > 0 || this.followers.length > 0;
  }

  snapshot(): ReactiveData {
    return structuredClone(this.data);
  }

  restore(data: ReactiveData): void {
    this.data = structuredClone(data);
    for (const prop of this.crumblers) this.physics.setSolid(prop, this.data.crumble[prop.index]!.goneMs <= 0);
    for (const prop of this.followers) this.place(prop, this.data.follow[prop.index]!.progress, 0);
  }

  crumbleView(propIndex: number): CrumbleView {
    const state = this.data.crumble[propIndex];
    const prop = this.physics.props[propIndex];
    const reaction = prop?.kind.reaction;
    if (!state || reaction?.type !== 'crumble') return { stress: 0, gone: false };
    return { stress: Math.min(1, state.load / reaction.holdMs), gone: state.goneMs > 0 };
  }

  /** How far a follower has travelled, 0..1, eased the way the body is placed. */
  followProgress(propIndex: number): number {
    const state = this.data.follow[propIndex];
    return state ? smoothstep(0, 1, state.progress) : 0;
  }

  /** `held` are the colliders MAGNO is holding, standing on or leaning against this tick. */
  step(held: readonly number[], magno: Vec2): void {
    if (!this.active) return;
    const dtMs = 1000 / TUNING.sim.hz;
    const touched = new Set<number>();
    for (const handle of held) {
      const surface = this.physics.surfaces.get(handle);
      if (surface) touched.add(surface.propIndex);
    }
    for (const prop of this.crumblers) this.stepCrumble(prop, touched.has(prop.index), magno, dtMs);
    for (const prop of this.followers) this.stepFollower(prop, touched, dtMs);
  }

  private stepCrumble(prop: BuiltProp, loaded: boolean, magno: Vec2, dtMs: number): void {
    const reaction = prop.kind.reaction;
    if (reaction?.type !== 'crumble') return;
    const state = this.data.crumble[prop.index]!;

    if (state.goneMs > 0) {
      state.goneMs = Math.max(0, state.goneMs - dtMs);
      if (state.goneMs === 0 && this.isOccupied(prop, magno)) state.goneMs = dtMs;
      if (state.goneMs === 0) {
        this.physics.setSolid(prop, true);
        this.events.emit('restore', { propIndex: prop.index });
      }
      return;
    }

    state.load = loaded ? state.load + dtMs : Math.max(0, state.load - dtMs * LOAD_RECOVERY);
    const warning = state.load >= reaction.holdMs - reaction.warnMs;
    if (warning && !state.warned) this.events.emit('crumbleWarn', { propIndex: prop.index });
    state.warned = warning;
    if (state.load < reaction.holdMs) return;

    state.load = 0;
    state.warned = false;
    state.goneMs = reaction.restoreMs;
    this.physics.setSolid(prop, false);
    this.events.emit('crumble', { propIndex: prop.index, point: { x: prop.placement.x, y: prop.placement.y } });
  }

  private isOccupied(prop: BuiltProp, magno: Vec2): boolean {
    const { x, y } = prop.placement;
    return (
      Math.abs(magno.x - x) < prop.width / 2 + RESTORE_CLEARANCE.x && Math.abs(magno.y - y) < prop.height / 2 + RESTORE_CLEARANCE.y
    );
  }

  private stepFollower(prop: BuiltProp, touched: ReadonlySet<number>, dtMs: number): void {
    const follow = prop.placement.follow!;
    const state = this.data.follow[prop.index]!;
    const switches = this.switches.get(follow.tag) ?? [];
    const held = (!follow.manual && touched.has(prop.index)) || switches.some((index) => touched.has(index));

    state.holdMs = held ? follow.holdMs : Math.max(0, state.holdMs - dtMs);
    const before = state.progress;
    state.progress =
      state.holdMs > 0 ? Math.min(1, state.progress + dtMs / follow.extendMs) : Math.max(0, state.progress - dtMs / follow.retractMs);

    const direction = state.progress > before ? 'out' : state.progress < before ? 'in' : 'idle';
    if (direction !== 'idle' && direction !== state.direction) this.events.emit('followerMove', { propIndex: prop.index, direction });
    state.direction = direction;

    this.place(prop, state.progress, state.progress - before);
  }

  /** Puts the follower where `progress` says it should be for the coming tick, with the velocity of getting there. */
  private place(prop: BuiltProp, progress: number, step: number): void {
    const follow = prop.placement.follow!;
    const here = smoothstep(0, 1, progress);
    const behind = smoothstep(0, 1, progress - step);
    const dt = 1 / TUNING.sim.hz;
    this.physics.placeFollower(
      prop,
      { x: follow.dx * here, y: follow.dy * here },
      { x: (follow.dx * (here - behind)) / dt, y: (follow.dy * (here - behind)) / dt },
    );
  }
}
