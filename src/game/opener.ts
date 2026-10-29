import { clamp, lerp, smoothstep, type Vec2 } from '@/core/mathx';
import type { Framing } from '@/render/mountain';

export interface OpenerEffects {
  /** Rung two of the ladder: MAGNO bounces in place to say "over here". */
  hop(): void;
  /** The first catch of the whole game, slowed so the landing lands (PRD 16.2). */
  firstCatch(): void;
  /** The staged HUD finishes on its own rather than waiting for a first input (PRD 15.3). */
  hudReveal(): void;
  /** The player acted during the first-catch beat: hand the clock back at once. */
  interruptBeat(): void;
}

export interface OpenerLevel {
  /** A biome is being entered on its first level: open it on the poster shot. */
  establish: boolean;
  /** This level attempt may still play the one-time first-catch beat. */
  beat: boolean;
  /** The visit is portrait: the vista composes for the narrow frame (P-MO-01). */
  portrait: boolean;
  spawn: Vec2;
  summit: Vec2;
  /** Where the follow camera comes to rest at the spawn; shots ease back to it exactly. */
  follow: Vec2;
  followHeight: number;
}

export interface OpenerFrame {
  /** Directed camera for this frame, or null to hand control back to the follow rig. */
  framing: Framing | null;
}

const HAND_AFTER_MS = 3000;
const HOP_AFTER_MS = 8000;
const PAN_AFTER_MS = 15000;
const PAN_MS = 1700;
const PAN_REACH = 0.6;
const PAN_ZOOM = 2.1;
/** The boot move: hold on MAGNO, pull out to the vista, settle home (PRD 15.3). */
const HERO_HOLD_MS = 500;
/** A character portrait: at the follow camera's long lens this is the scale where MAGNO's face carries the frame. */
const HERO_VISIBLE_METERS = 2.2;
/** Headroom above MAGNO at that scale, capped so his face carries the frame in either orientation (P-MO-01). */
const HERO_HEADROOM_MAX = 0.6;
const VISTA_IN_MS = 1000;
const VISTA_HOLD_MS = 200;
const HOME_IN_MS = 700;
/** Vista scale: the whole climb plus margin, kept inside a band where MAGNO still reads as the subject. */
const SHOT_CLIMB_FACTOR = 1.7;
const SHOT_MIN_HEIGHT = 1.7;
const SHOT_MAX_HEIGHT = 4.2;
/** The portrait vista stays closer (P-MO-01): a narrow frame pulled to landscape distance turns MAGNO into a smudge, so it composes the shaft instead of the whole climb. */
const SHOT_PORTRAIT_MAX_HEIGHT = 3.0;
const SHOT_CENTER_SHARE = 0.62;
/** Metres of frame below MAGNO at the vista's widest, so he never falls out of his own opening shot. */
const SHOT_BOTTOM_MARGIN = 2;
const SHOT_TOTAL_MS = HERO_HOLD_MS + VISTA_IN_MS + VISTA_HOLD_MS + HOME_IN_MS;
const HUD_REVEAL_MS = 10_000;
const LADDER_CYCLES = 2;
const BEAT_WINDOW_MS = 1600;
const LOG_KEEP = 64;

type Move = { kind: 'shot' | 'pan' } | null;

/**
 * The first ninety seconds (PRD 15 and 16). It owns the poster shot that opens
 * a biome, the idle ladder that never leaves a waiting player stuck — hand,
 * hop, goal pan, then silence — and the one-time first-catch beat. Everything
 * here is presentation: the simulation never learns the opener exists, and the
 * first input interrupts whatever is on screen.
 */
export class Opener {
  /** Session timeline of what fired and when, for the end-to-end checks. */
  readonly log: string[] = [];
  hand = false;

  private level: OpenerLevel | null = null;
  private move: Move = null;
  private moveMs = 0;
  private framing: Framing | null = null;
  private idleMs = 0;
  private clockMs = 0;
  private cycle = 0;
  private hopped = false;
  private panned = false;
  private hudRevealed = false;
  private launched = false;
  private caught = false;
  private beatLive = false;
  private beatLiveMs = 0;

  constructor(private readonly effects: OpenerEffects) {}

  beginLevel(level: OpenerLevel): void {
    this.level = level;
    this.move = null;
    this.framing = null;
    this.idleMs = 0;
    this.cycle = 0;
    this.hopped = false;
    this.panned = false;
    this.hudRevealed = false;
    this.launched = false;
    this.caught = false;
    this.hand = false;
    if (level.establish) {
      this.move = { kind: 'shot' };
      this.moveMs = 0;
      this.framing = this.shotFraming(0);
      this.note('shot');
    }
  }

  /** True while a directed shot owns the camera: the coach and other stage furniture stand aside. */
  get presenting(): boolean {
    return this.framing !== null;
  }

  /** A pause, an overlay screen or the film: stop presenting, keep the ladder's place. */
  suspend(): void {
    this.move = null;
    this.framing = null;
    this.hand = false;
  }

  /** Any player activity: the ladder yields and whatever the camera was showing is released. */
  noteInput(): void {
    if (this.idleMs >= HAND_AFTER_MS) this.cycle++;
    this.idleMs = 0;
    this.hand = false;
    if (this.move) {
      this.move = null;
      this.framing = null;
    }
    if (this.beatLive) {
      this.beatLive = false;
      this.effects.interruptBeat();
    }
  }

  onLaunch(): void {
    this.launched = true;
    this.note('launch');
  }

  onCatch(): void {
    if (!this.level?.beat || this.caught || !this.launched) return;
    this.caught = true;
    this.beatLive = true;
    this.beatLiveMs = BEAT_WINDOW_MS;
    this.effects.firstCatch();
    this.note('first-catch');
  }

  /** A gameplay moment worth putting on the session timeline. */
  mark(what: string): void {
    this.note(what);
  }

  update(dtMs: number, runStarted: boolean): OpenerFrame {
    this.clockMs += dtMs;
    if (this.beatLive) {
      this.beatLiveMs -= dtMs;
      if (this.beatLiveMs <= 0) this.beatLive = false;
    }

    if (this.move) {
      this.moveMs += dtMs;
      const total = this.move.kind === 'shot' ? SHOT_TOTAL_MS : PAN_MS;
      if (this.moveMs >= total) {
        const done = this.move;
        this.move = null;
        this.framing = null;
        if (done.kind === 'pan') {
          // A finished ladder may climb again, but from the first rung: the idle
          // clock restarts so the repeat is paced like the first pass.
          this.cycle++;
          this.hopped = false;
          this.panned = false;
          this.idleMs = 0;
        }
      } else {
        this.framing = this.move.kind === 'shot' ? this.shotFraming(this.moveMs) : this.panFraming(this.moveMs);
      }
    }

    if (runStarted) {
      this.idleMs = 0;
      this.hand = false;
    } else {
      this.idleMs += dtMs;
      const live = this.cycle < LADDER_CYCLES;
      const hand = live && this.idleMs >= HAND_AFTER_MS;
      if (hand && !this.hand) this.note('hand');
      this.hand = hand;
      if (live && !this.hopped && this.idleMs >= HOP_AFTER_MS) {
        this.hopped = true;
        this.effects.hop();
        this.note('hop');
      }
      if (live && !this.panned && this.idleMs >= PAN_AFTER_MS) {
        this.panned = true;
        this.move = { kind: 'pan' };
        this.moveMs = 0;
        this.framing = this.panFraming(0);
        this.note('pan');
      }
    }

    if (!this.hudRevealed && this.idleMs >= HUD_REVEAL_MS) {
      this.hudRevealed = true;
      this.effects.hudReveal();
      this.note('hud-reveal');
    }

    return { framing: this.framing };
  }

  /**
   * The boot move in three keys: open on MAGNO so the first frame sells the
   * character, pull out to a vista that holds the whole climb — the summit
   * small above him, answering "what" and "why" — then settle into the follow
   * framing. One continuous piece of camera work, interruptible at any frame.
   */
  private shotFraming(ms: number): Framing {
    const { spawn, summit, follow, followHeight, portrait } = this.level!;
    const climb = Math.max(1, summit.y - spawn.y);
    const vistaHeight = clamp(climb * SHOT_CLIMB_FACTOR, followHeight * SHOT_MIN_HEIGHT, followHeight * (portrait ? SHOT_PORTRAIT_MAX_HEIGHT : SHOT_MAX_HEIGHT));
    const rise = Math.min(climb * SHOT_CENTER_SHARE, vistaHeight / 2 - SHOT_BOTTOM_MARGIN);
    const hero = { center: { x: follow.x, y: Math.min(follow.y, spawn.y + HERO_HEADROOM_MAX) }, height: HERO_VISIBLE_METERS };
    const vista = { center: { x: lerp(spawn.x, summit.x, 0.5), y: spawn.y + rise }, height: vistaHeight };
    const home = { center: { x: follow.x, y: follow.y }, height: followHeight };

    const blend = (from: typeof hero, to: typeof home, u: number): Framing => ({
      center: { x: lerp(from.center.x, to.center.x, u), y: lerp(from.center.y, to.center.y, u) },
      visibleHeight: lerp(from.height, to.height, u),
    });

    if (ms < HERO_HOLD_MS) return { center: hero.center, visibleHeight: hero.height };
    if (ms < HERO_HOLD_MS + VISTA_IN_MS) return blend(hero, vista, smoothstep(0, 1, (ms - HERO_HOLD_MS) / VISTA_IN_MS));
    if (ms < HERO_HOLD_MS + VISTA_IN_MS + VISTA_HOLD_MS) return { center: vista.center, visibleHeight: vista.height };
    return blend(vista, home, smoothstep(0, 1, (ms - HERO_HOLD_MS - VISTA_IN_MS - VISTA_HOLD_MS) / HOME_IN_MS));
  }

  /** Rung three: drift most of the way to the summit, hold a breath, and come home. */
  private panFraming(ms: number): Framing {
    const { summit, follow, followHeight } = this.level!;
    const out = smoothstep(0, PAN_MS * 0.55, ms);
    const back = smoothstep(PAN_MS * 0.55, PAN_MS, ms);
    const u = out - back;
    return {
      center: {
        x: lerp(follow.x, lerp(follow.x, summit.x, PAN_REACH), u),
        y: lerp(follow.y, lerp(follow.y, summit.y, PAN_REACH), u),
      },
      visibleHeight: followHeight * lerp(1, PAN_ZOOM, u),
    };
  }

  private note(what: string): void {
    this.log.push(`${what}@${Math.round(this.clockMs)}`);
    if (this.log.length > LOG_KEEP) this.log.shift();
  }
}
