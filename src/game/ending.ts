import { clamp, lerp, smoothstep } from '@/core/mathx';
import { Emitter } from '@/core/emitter';

export type EndingBeat = 'rise' | 'seat' | 'bloom' | 'pullback' | 'credits';

interface BeatSpan {
  beat: EndingBeat;
  from: number;
  to: number;
}

/** The sixty-second wordless victory of PRD 3.5, cut into five beats. */
export const ENDING_SPANS: readonly BeatSpan[] = [
  { beat: 'rise', from: 0, to: 6 },
  { beat: 'seat', from: 6, to: 10 },
  { beat: 'bloom', from: 10, to: 22 },
  { beat: 'pullback', from: 22, to: 48 },
  { beat: 'credits', from: 48, to: 60 },
];

export const ENDING_SECONDS = 60;
export const CLICK_SECONDS = 10;

/** How far the core hovers above its pedestal before it flies to MAGNO, in metres. */
const HOVER_METERS = 1.3;

/** Everything the renderer and the credits layer need to draw one instant of the ending. */
export interface EndingFrame {
  seconds: number;
  beat: EndingBeat;
  /** 0 on the pedestal, 1 touching MAGNO's chest. */
  corePath: number;
  /** Metres the core floats above the straight line to the chest. */
  coreLift: number;
  /** The loose crystal is visible until it clicks home. */
  coreLoose: boolean;
  /** Light shining out of the chest socket. */
  chestGlow: number;
  /** Growth of the field-line bloom, 0 to 1. */
  bloom: number;
  bloomAlpha: number;
  /** Camera pull-back, 0 at MAGNO to 1 over the whole mountain. */
  pull: number;
  mountain: number;
  beam: number;
  credits: number;
  letterbox: number;
}

const easeInOut = (t: number): number => t * t * (3 - 2 * t);
const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
const progress = (seconds: number, from: number, to: number): number => clamp((seconds - from) / (to - from), 0, 1);

export function beatAt(seconds: number): EndingBeat {
  for (const span of ENDING_SPANS) if (seconds < span.to) return span.beat;
  return 'credits';
}

export function endingFrame(seconds: number): EndingFrame {
  const s = clamp(seconds, 0, ENDING_SECONDS);
  const rise = easeInOut(progress(s, 0.4, 6));
  const travel = easeInOut(progress(s, 6, CLICK_SECONDS));
  const seated = s >= CLICK_SECONDS;
  const afterClick = s - CLICK_SECONDS;

  return {
    seconds: s,
    beat: beatAt(s),
    corePath: travel,
    coreLift: HOVER_METERS * rise * (1 - travel) + Math.sin(travel * Math.PI) * 0.35,
    coreLoose: !seated,
    chestGlow: seated ? lerp(1, 0.78, smoothstep(0, 3, afterClick)) * smoothstep(0, 0.35, afterClick) : 0,
    bloom: seated ? easeOutCubic(progress(s, CLICK_SECONDS, 40)) : 0,
    bloomAlpha: seated ? smoothstep(0, 1.2, afterClick) * lerp(1, 0.55, progress(s, 30, 48)) : 0,
    pull: easeInOut(progress(s, 22, 48)),
    mountain: easeInOut(progress(s, 26, 36)),
    beam: easeInOut(progress(s, 12, 18)),
    credits: easeInOut(progress(s, 48, 51)),
    letterbox: easeInOut(progress(s, 0, 1.2)),
  };
}

export interface EndingEvents {
  /** The core seats in MAGNO's chest. Fires once. */
  click: undefined;
  beat: EndingBeat;
  /** Fires once, whether the film ran out or the player skipped it. */
  done: { skipped: boolean };
}

/** Plays the ending on the real-time clock. It can be skipped at any instant, including the first. */
export class EndingDirector {
  readonly events = new Emitter<EndingEvents>();
  private seconds = 0;
  private lastBeat: EndingBeat | null = null;
  private clicked = false;
  private over = false;

  get elapsed(): number {
    return this.seconds;
  }

  get finished(): boolean {
    return this.over;
  }

  get frame(): EndingFrame {
    return endingFrame(this.seconds);
  }

  update(dt: number): void {
    if (this.over) return;
    this.seconds = Math.min(ENDING_SECONDS, this.seconds + Math.max(0, dt));
    this.announce();
    if (this.seconds >= ENDING_SECONDS) this.finish(false);
  }

  skip(): void {
    if (this.over) return;
    this.seconds = ENDING_SECONDS;
    this.clicked = true;
    this.finish(true);
  }

  private announce(): void {
    const beat = beatAt(this.seconds);
    if (beat !== this.lastBeat) {
      this.lastBeat = beat;
      this.events.emit('beat', beat);
    }
    if (!this.clicked && this.seconds >= CLICK_SECONDS) {
      this.clicked = true;
      this.events.emit('click', undefined);
    }
  }

  private finish(skipped: boolean): void {
    if (this.over) return;
    this.over = true;
    this.events.emit('done', { skipped });
  }
}
