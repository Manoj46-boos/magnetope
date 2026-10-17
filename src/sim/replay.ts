import type { InputFrame } from './types';

/**
 * Compact input recording. Only changes are stored, so an eight second run is a
 * few dozen entries; the same format backs bot routes and speedrun ghosts.
 */
export interface Recording {
  version: 1;
  levelId: string;
  totalTicks: number;
  /** [tick, tiltX * 100, tiltY * 100, flipHeld] on every change. */
  changes: Array<[number, number, number, 0 | 1]>;
}

export class InputRecorder {
  private readonly changes: Recording['changes'] = [];
  private last: [number, number, 0 | 1] | null = null;
  private ticks = 0;

  push(frame: InputFrame): void {
    const entry: [number, number, 0 | 1] = [
      Math.round(frame.tiltX * 100),
      Math.round(frame.tiltY * 100),
      frame.flipHeld ? 1 : 0,
    ];
    const last = this.last;
    if (!last || last[0] !== entry[0] || last[1] !== entry[1] || last[2] !== entry[2]) {
      this.changes.push([this.ticks, entry[0], entry[1], entry[2]]);
      this.last = entry;
    }
    this.ticks++;
  }

  finish(levelId: string): Recording {
    return { version: 1, levelId, totalTicks: this.ticks, changes: this.changes.map((c) => [...c]) };
  }
}

/** Rebuilds per-tick input frames, deriving the press and release edges from held-state changes. */
export class ReplayPlayer {
  private cursor = 0;
  private tick = 0;
  private tiltX = 0;
  private tiltY = 0;
  private held = false;

  constructor(private readonly recording: Recording) {}

  get done(): boolean {
    return this.tick >= this.recording.totalTicks;
  }

  get currentTick(): number {
    return this.tick;
  }

  next(): InputFrame {
    const { changes } = this.recording;
    const wasHeld = this.held;
    while (this.cursor < changes.length && changes[this.cursor]![0] <= this.tick) {
      const [, tx, ty, held] = changes[this.cursor]!;
      this.tiltX = tx / 100;
      this.tiltY = ty / 100;
      this.held = held === 1;
      this.cursor++;
    }
    this.tick++;
    return {
      tiltX: this.tiltX,
      tiltY: this.tiltY,
      flipHeld: this.held,
      flipDown: this.held && !wasHeld,
      flipUp: !this.held && wasHeld,
    };
  }
}

export const encodeRecording = (recording: Recording): string => JSON.stringify(recording);

export function decodeRecording(json: string): Recording {
  const raw = JSON.parse(json) as Partial<Recording>;
  if (raw.version !== 1 || typeof raw.levelId !== 'string' || typeof raw.totalTicks !== 'number' || !Array.isArray(raw.changes)) {
    throw new Error('Unsupported recording format');
  }
  return raw as Recording;
}
