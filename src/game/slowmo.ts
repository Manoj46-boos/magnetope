import { TUNING } from '@/config/tuning';
import { clamp, lerp } from '@/core/mathx';

type Phase = 'idle' | 'in' | 'hold' | 'out';

interface Entry {
  atMs: number;
  height: number;
}

/**
 * Presentation-side time scale for the big-fall slow motion (PRD 8.3). It ramps
 * to 0.35 over 150 ms, holds until the landing resolves, then recovers over
 * 450 ms. A budget of four per three minutes keeps the effect special, and when
 * the budget is spent only a taller fall may take a slot.
 */
export class SlowMoDirector {
  private phase: Phase = 'idle';
  private phaseMs = 0;
  private fromScale = 1;
  private clockMs = 0;
  private history: Entry[] = [];
  private holdMs = 0;
  disabled = false;

  /** Current time scale handed to the fixed stepper and the audio layer. */
  scale = 1;

  /** 0 at normal speed, 1 at full slow motion. */
  get strength(): number {
    return clamp((1 - this.scale) / (1 - TUNING.fall.slowMoScale), 0, 1);
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  /** Asks for slow motion. Returns whether the request was granted. */
  request(heightMeters: number): boolean {
    if (this.disabled || this.phase === 'in' || this.phase === 'hold') return false;
    const { maxSlowMoPerWindow, slowMoWindowMs } = TUNING.fall;
    this.history = this.history.filter((e) => this.clockMs - e.atMs < slowMoWindowMs);
    if (this.history.length >= maxSlowMoPerWindow) {
      let smallest = 0;
      for (let i = 1; i < this.history.length; i++) if (this.history[i]!.height < this.history[smallest]!.height) smallest = i;
      if (heightMeters <= this.history[smallest]!.height) return false;
      this.history.splice(smallest, 1);
    }
    this.history.push({ atMs: this.clockMs, height: heightMeters });
    this.enter('in');
    return true;
  }

  /** The fall resolved or was caught: start recovering to normal speed. */
  release(): void {
    if (this.phase === 'in' || this.phase === 'hold') this.enter('out');
  }

  reset(): void {
    this.phase = 'idle';
    this.scale = 1;
    this.phaseMs = 0;
    this.holdMs = 0;
  }

  /** Advance by real (unscaled) milliseconds. */
  update(realMs: number): void {
    this.clockMs += realMs;
    if (this.disabled && (this.phase === 'in' || this.phase === 'hold')) this.enter('out');
    this.phaseMs += realMs;
    const target = TUNING.fall.slowMoScale;
    switch (this.phase) {
      case 'in': {
        const t = clamp(this.phaseMs / TUNING.fall.slowMoRampInMs, 0, 1);
        this.scale = lerp(this.fromScale, target, t);
        if (t >= 1) this.enter('hold');
        break;
      }
      case 'hold':
        this.holdMs += realMs;
        this.scale = target;
        // Safety valve in case a landing never resolves.
        if (this.holdMs > 7000) this.enter('out');
        break;
      case 'out': {
        const t = clamp(this.phaseMs / TUNING.fall.slowMoRampOutMs, 0, 1);
        this.scale = lerp(this.fromScale, 1, t * t * (3 - 2 * t));
        if (t >= 1) this.reset();
        break;
      }
      case 'idle':
        this.scale = 1;
    }
  }

  private enter(phase: Phase): void {
    this.phase = phase;
    this.phaseMs = 0;
    this.fromScale = this.scale;
    if (phase === 'hold') this.holdMs = 0;
  }
}
