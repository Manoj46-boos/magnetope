import { TUNING } from '@/config/tuning';
import type { SdkBus } from './sdk-bus';

/**
 * The rewarded surfaces the game owns. The union is closed on purpose: it is
 * the placement vocabulary R-MZ-06 caps, so a new surface is added here, next to
 * the laws that govern it — never by reaching past the layer for the SDK.
 */
export type PlacementKind = 'second-wind' | 'scrap-doubler' | 'locker-unlock';

/**
 * The placement policy layer (R-MZ-01/03/06). Callers state intent — resume,
 * next level, retry, an offer to show — and this layer decides what reaches the
 * SDK, so no screen can be pushy by accident:
 *
 * - The resume break always rides, because calling it on the pause-to-play
 *   transition is the host's own contract; the SDK decides what actually shows.
 * - The discretionary breaks wait for the session to open and then for their
 *   floors, measured from the last break of any kind.
 * - Rewarded prompts share one clock: one prompt per gap window, however many
 *   cards pass. Declines and instant retries both count, because the player
 *   already saw the ask.
 * - The locker's watch button is walked to, never prompted, so it stays outside
 *   the prompt clock — its views are unlimited (R-MZ-10 caps value, not views).
 */
export class AdPlacement {
  private sessionMs = 0;
  private lastBreakAtMs = Number.NEGATIVE_INFINITY;
  private lastPromptAtMs = Number.NEGATIVE_INFINITY;
  private readonly placements = new Set<PlacementKind>();

  constructor(private readonly bus: SdkBus) {}

  get sessionClockMs(): number {
    return this.sessionMs;
  }

  /** The session's own clock, driven by the game tick so every law below is testable. */
  advance(dtMs: number): void {
    if (dtMs > 0) this.sessionMs += dtMs;
  }

  /** The pause-to-play break (R-MZ-01): always called, whatever the clocks say. */
  async resumeBreak(): Promise<boolean> {
    return this.runCommercial();
  }

  /** The clear card's Next-level break: once the session is open, past the floor (R-MZ-03). */
  async advanceBreak(): Promise<boolean> {
    if (!this.sessionOpen()) return false;
    if (this.sessionMs - this.lastBreakAtMs < TUNING.ads.breakFloorMs) return false;
    return this.runCommercial();
  }

  /** The retry break: retry momentum is sacred, so it waits twice the floor (PRD 9.3). */
  async retryBreak(): Promise<boolean> {
    if (!this.sessionOpen()) return false;
    if (this.sessionMs - this.lastBreakAtMs < TUNING.ads.retryFloorMs) return false;
    return this.runCommercial();
  }

  /** May this rewarded prompt be offered now? Showing the ask is what spends the window. */
  offer(kind: PlacementKind): boolean {
    if (this.sessionMs - this.lastPromptAtMs < TUNING.ads.promptGapMs) return false;
    if (this.placements.size >= TUNING.ads.maxPlacements && !this.placements.has(kind)) return false;
    this.lastPromptAtMs = this.sessionMs;
    this.placements.add(kind);
    return true;
  }

  /** The locker's watch button, counted as the placement it is without touching the prompt clock. */
  noteWatched(): void {
    this.placements.add('locker-unlock');
  }

  /** True when a break may ride at all: the first minute of a session belongs to play alone. */
  private sessionOpen(): boolean {
    return this.sessionMs >= TUNING.ads.firstBreakMinMs;
  }

  private async runCommercial(): Promise<boolean> {
    const shown = await this.bus.commercialBreak();
    // A break that could not run (the bus was mid-ad) spends no floor — the next
    // natural stop may still try.
    if (shown) this.lastBreakAtMs = this.sessionMs;
    return shown;
  }
}
