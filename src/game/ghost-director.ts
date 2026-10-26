import type { Vec2 } from '@/core/mathx';
import { GhostRecorder, decodeGhost, encodeGhost, sampleGhost, timeAtPoint, type GhostTrack } from '@/sim/ghost';
import type { FriendGhost } from '@/platform/storage';
import type { Simulation } from '@/sim/simulation';

/** A ghost lingers at its finish line for a moment, then leaves the scene. */
const LINGER_MS = 3000;

export interface GhostPoses {
  par: Vec2 | null;
  personal: Vec2 | null;
  friend: Vec2 | null;
}

export interface FriendRace {
  name: string;
  durationMs: number;
}

/** Where and when the run's own flip happened, the landmark the delta card reads (R-RT-07). */
export interface FlipMoment {
  point: Vec2;
  timeMs: number;
}

export type ParLoader = (levelId: string) => Promise<GhostTrack | null>;

/**
 * Owns the ghosts for the level being played: records the current run, holds
 * the developer (par) ghost, the player's personal best and a friend's shared
 * ghost, and says where each stands at any moment of the run (PRD 5.5).
 */
export class GhostDirector {
  private recorder = new GhostRecorder();
  private par: GhostTrack | null = null;
  private personal: GhostTrack | null = null;
  private friend: { name: string; track: GhostTrack } | null = null;
  private generation = 0;

  constructor(private readonly loadPar: ParLoader) {}

  get parTrack(): GhostTrack | null {
    return this.par;
  }

  get hasPersonal(): boolean {
    return this.personal !== null;
  }

  /** The friend this run is racing, if the level has a shared ghost. */
  get race(): FriendRace | null {
    return this.friend ? { name: this.friend.name, durationMs: this.friend.track.durationMs } : null;
  }

  /** Starts a fresh attempt. The par ghost arrives asynchronously and is ignored if the level changed meanwhile. */
  begin(levelId: string, storedPersonal: string | undefined, storedFriend?: FriendGhost): void {
    const generation = ++this.generation;
    this.recorder = new GhostRecorder();
    this.par = null;
    this.personal = storedPersonal ? decodeGhost(storedPersonal, levelId) : null;
    this.setFriend(levelId, storedFriend);
    void this.loadPar(levelId).then((track) => {
      if (generation === this.generation) this.par = track;
    });
  }

  /** Swaps the friend ghost without disturbing the run being recorded. */
  setFriend(levelId: string, stored: FriendGhost | undefined): void {
    const track = stored ? decodeGhost(stored.ghost, levelId) : null;
    this.friend = stored && track ? { name: stored.name, track } : null;
  }

  /** Call once after every simulation tick. */
  capture(sim: Simulation): void {
    if (sim.run.started && !sim.run.cleared) this.recorder.push(sim.magno.view.position);
  }

  /**
   * How many milliseconds the live run was ahead of the personal ghost at
   * `flip` — positive means the player got there first. Null when there is no
   * personal ghost to race or the ghost's route never passed the flip (R-RT-07).
   */
  deltaAtFlip(flip: FlipMoment): number | null {
    if (!this.personal) return null;
    const ghostMs = timeAtPoint(this.personal, flip.point);
    return ghostMs === null ? null : ghostMs - flip.timeMs;
  }

  /** Encodes the finished run so it can be stored as the personal ghost. */
  encodeRun(sim: Simulation, levelId: string): string {
    return encodeGhost(this.recorder.finish(levelId, sim.run.timeMs, sim.magno.view.position));
  }

  poses(timeMs: number, enabled: boolean): GhostPoses {
    if (!enabled) return { par: null, personal: null, friend: null };
    return {
      par: this.poseOf(this.par, timeMs),
      personal: this.poseOf(this.personal, timeMs),
      friend: this.poseOf(this.friend?.track ?? null, timeMs),
    };
  }

  private poseOf(track: GhostTrack | null, timeMs: number): Vec2 | null {
    if (!track || timeMs > track.durationMs + LINGER_MS) return null;
    const { x, y } = sampleGhost(track, timeMs);
    return { x, y };
  }
}
