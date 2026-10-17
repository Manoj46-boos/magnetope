import type { MagnoState } from '@/sim/magno';

/** What the ghost hand demonstrates right now. */
export type CoachCue = 'launch' | 'snap';

const SNAP_CUE_AFTER_MS = 250;
const SNAP_CUE_UNTIL_MS = 3500;
const LESSONS_TO_FINISH = 2;

/**
 * Decides which gesture the tutorial hand shows (PRD 12.1). It teaches by
 * demonstration only: launch from a hold, then snap while airborne. The hand
 * steps aside while the player is already doing the thing, and retires for good
 * after two launches that each ended in a catch.
 */
export class Coach {
  private repels = 0;
  private catches = 0;
  private airborneMs = 0;
  private done: boolean;

  constructor(
    enabled: boolean,
    private readonly onFinish: () => void,
  ) {
    this.done = !enabled;
  }

  get active(): boolean {
    return !this.done;
  }

  onRepel(): void {
    if (this.done) return;
    this.repels++;
    this.airborneMs = 0;
  }

  onAttach(): void {
    if (this.done || this.repels === 0) return;
    this.catches++;
    if (this.catches >= LESSONS_TO_FINISH) {
      this.done = true;
      this.onFinish();
    }
  }

  update(dtMs: number, state: MagnoState): CoachCue | null {
    if (this.done) return null;
    switch (state) {
      case 'attached':
        this.airborneMs = 0;
        return 'launch';
      case 'airborne':
        this.airborneMs += dtMs;
        return this.repels === 1 && this.airborneMs > SNAP_CUE_AFTER_MS && this.airborneMs < SNAP_CUE_UNTIL_MS ? 'snap' : null;
      default:
        return null;
    }
  }
}
