import { TUNING } from '@/config/tuning';
import type { SdkBus } from './sdk-bus';

/**
 * The rewarded surfaces the game owns. The union is closed on purpose: it is
 * the placement vocabulary R-MZ-06 caps, so a new surface is added here, next to
 * the laws that govern it — never by reaching past the layer for the SDK.
 */
export type PlacementKind = 'second-wind' | 'scrap-doubler' | 'locker-unlock';

/**
 * The placement policy layer (R-MZ-01/03/06, rebuild PRD 9.2). Callers state
 * intent — resume, next level, retry, an offer to show — and this layer passes
 * every natural stop straight through to the SDK, because the platform owns ad
 * frequency outright: “do not implement internal ad timers, rely on Poki’s
 * system to manage ad frequency.” Not every call triggers an ad; the host
 * decides when a player is ready, so the game’s whole job is to signal the
 * stops — death-and-restart and next-level are the host’s own canonical
 * placements — and stay out of the way.
 *
 * What the layer still governs is the player-facing half of ad manners, the
 * part the platform leaves to the developer:
 *
 * - Rewarded prompts share one clock: one prompt per gap window, however many
 *   cards pass. Declines and instant retries both count, because the player
 *   already saw the ask.
 * - The locker's watch button is walked to, never prompted, so it stays outside
 *   the prompt clock — its views are unlimited (R-MZ-10 caps value, not views).
 */
export class AdPlacement {
  private sessionMs = 0;
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
    return this.bus.commercialBreak();
  }

  /** The clear card's Next-level break (R-MZ-03): every natural stop is signaled — the platform decides what shows. */
  async advanceBreak(): Promise<boolean> {
    return this.bus.commercialBreak();
  }

  /** The retry break: death-and-restart is the platform's canonical placement, so it always rides (rebuild PRD 9.2). */
  async retryBreak(): Promise<boolean> {
    return this.bus.commercialBreak();
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
}
