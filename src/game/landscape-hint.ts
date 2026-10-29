import type { BiomeId } from '@/sim/types';

/** Two failed attempts in a row is a player fighting the climb, not learning it. */
const FAILS_TO_HINT = 2;

/**
 * The optional landscape chip (P-MO-06). A wide metropolis climb held portrait
 * after two failed attempts in a row earns one quiet suggestion, once a
 * session: landscape makes this climb easier. Portrait is the game's natural
 * orientation, so the hint never argues — it never blocks, never repeats, and
 * every other biome stays quiet in either orientation.
 */
export class LandscapeHint {
  private spent = false;
  private fails = 0;

  /** An attempt at the current level ended without a clear. */
  failed(): void {
    this.fails++;
  }

  /** The level was cleared or left behind: the streak of failed attempts is over. */
  reset(): void {
    this.fails = 0;
  }

  /** Whether the chip may come out for this climb, held this way. */
  due(biome: BiomeId, portrait: boolean): boolean {
    return !this.spent && this.fails >= FAILS_TO_HINT && biome === 'metropolis' && portrait;
  }

  /** The chip came out: the session has said its one sentence. */
  spend(): void {
    this.spent = true;
    this.fails = 0;
  }
}
