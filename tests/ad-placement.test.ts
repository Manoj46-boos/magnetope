import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { TUNING } from '@/config/tuning';
import { AdPlacement, type PlacementKind } from '@/platform/ad-placement';
import { LocalSdk, type PlatformSdk } from '@/platform/sdk';
import { SdkBus } from '@/platform/sdk-bus';

/**
 * The placement layer's own laws (R-MZ-03/06, rebuild PRD 9.2), driven the way
 * a session moves: the clock runs, intent arrives, and the platform — not any
 * clock the game keeps — decides what an intent is worth (P-MZ-01). The one
 * timing law left in the layer is the player-facing one: the shared window
 * every rewarded ask spends.
 */

/** SDK whose ads stay open until the test releases them, the way a real break holds the screen. */
class ManualAdSdk implements PlatformSdk {
  commercialCalls = 0;
  private release: (() => void) | null = null;

  async init(): Promise<void> {}
  loadingFinished(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  commercialBreak(): Promise<void> {
    this.commercialCalls++;
    return new Promise((resolve) => (this.release = resolve));
  }
  rewardedBreak(): Promise<boolean> {
    return new Promise((resolve) => (this.release = () => resolve(true)));
  }
  getLanguage(): string {
    return 'en';
  }
  measure(): void {}
  finishAd(): void {
    this.release?.();
    this.release = null;
  }
}

const layer = () => {
  const sdk = new LocalSdk();
  const bus = new SdkBus(sdk);
  return { bus, ads: new AdPlacement(bus), sdk };
};

describe('every natural stop is signaled (P-MZ-01)', () => {
  it('always breaks on resume, whatever the clocks say', async () => {
    const { ads, sdk } = layer();
    expect(await ads.resumeBreak()).toBe(true);
    ads.advance(1_000);
    expect(await ads.resumeBreak(), 'the platform contract break ignores every clock').toBe(true);
    expect(sdk.calls.filter((c) => c === 'commercialBreak')).toHaveLength(2);
  });

  it('signals a session-0 stop — the first minute is the platform’s to place, not ours to guard', async () => {
    const { ads, sdk } = layer();
    sdk.calls.length = 0;
    expect(await ads.advanceBreak()).toBe(true);
    expect(await ads.retryBreak()).toBe(true);
    expect(sdk.calls).toEqual(['commercialBreak', 'commercialBreak']);
  });

  it('signals back-to-back stops with no floor between them', async () => {
    const { ads, sdk } = layer();
    await ads.resumeBreak();
    expect(await ads.advanceBreak(), 'the stop right after a break rides anyway').toBe(true);
    expect(await ads.retryBreak(), 'and so does the next one, seconds later').toBe(true);
    expect(sdk.calls.filter((c) => c === 'commercialBreak')).toHaveLength(3);
  });

  it('declines only while the bus holds an ad — the bus’s own law, not a timer', async () => {
    const sdk = new ManualAdSdk();
    const bus = new SdkBus(sdk);
    const ads = new AdPlacement(bus);
    const watching = bus.rewardedBreak();
    await Promise.resolve();
    expect(bus.state).toBe('ad');
    expect(await ads.advanceBreak(), 'the bus is holding an ad, so nothing reaches the SDK').toBe(false);
    expect(sdk.commercialCalls).toBe(0);
    sdk.finishAd();
    await watching;
    const retried = ads.advanceBreak();
    await Promise.resolve();
    sdk.finishAd();
    expect(await retried, 'the moment the bus freed, the stop rides').toBe(true);
    expect(sdk.commercialCalls).toBe(1);
  });
});

describe('the prompt etiquette', () => {
  it('allows the first prompt of a session and then spends one window per offer', () => {
    const { ads } = layer();
    expect(ads.offer('second-wind')).toBe(true);
    expect(ads.offer('scrap-doubler'), 'the second ask rides the same window, whatever card carries it').toBe(false);
    ads.advance(TUNING.ads.promptGapMs - 1);
    expect(ads.offer('scrap-doubler')).toBe(false);
    ads.advance(1);
    expect(ads.offer('scrap-doubler')).toBe(true);
  });

  it('marks the ask, not the click: declines and instant retries both count', () => {
    const { ads } = layer();
    expect(ads.offer('second-wind')).toBe(true);
    ads.advance(1_000);
    expect(ads.offer('second-wind'), 'a card the player dismissed still spent its ask').toBe(false);
  });

  it('counts the locker as a placement without ever touching the prompt clock', () => {
    const { ads } = layer();
    expect(ads.offer('second-wind')).toBe(true);
    ads.noteWatched();
    ads.advance(5_000);
    expect(ads.offer('scrap-doubler'), 'the watch button is walked to, never prompted').toBe(false);
    ads.advance(TUNING.ads.promptGapMs);
    expect(ads.offer('scrap-doubler')).toBe(true);
  });

  it('keeps all three placements alive in one session: the cap binds the union, not the views', () => {
    const { ads } = layer();
    expect(ads.offer('second-wind')).toBe(true);
    ads.advance(TUNING.ads.promptGapMs);
    expect(ads.offer('scrap-doubler')).toBe(true);
    ads.noteWatched();
    ads.advance(TUNING.ads.promptGapMs);
    // Views stay unlimited (R-MZ-10 caps value, not asks): a kind already shown is never refused.
    expect(ads.offer('second-wind')).toBe(true);
  });
});

describe('the scripted session', () => {
  it('hands every scripted stop to the SDK and holds the one window that is ours', async () => {
    const { ads, sdk } = layer();
    const rng = new Rng(20261027);
    let stops = 0;
    const prompts: Array<{ t: number; kind: PlacementKind }> = [];

    for (let i = 0; i < 10_000; i++) {
      ads.advance(rng.range(50, 500));
      const t = ads.sessionClockMs;
      const roll = rng.next();
      if (roll < 0.1) {
        await ads.resumeBreak();
        stops++;
      } else if (roll < 0.3) {
        await ads.advanceBreak();
        stops++;
      } else if (roll < 0.45) {
        await ads.retryBreak();
        stops++;
      } else if (roll < 0.7) {
        if (ads.offer('second-wind')) prompts.push({ t, kind: 'second-wind' });
      } else if (roll < 0.95) {
        if (ads.offer('scrap-doubler')) prompts.push({ t, kind: 'scrap-doubler' });
      } else {
        ads.noteWatched();
      }
    }

    // No gate lives on this side of the SDK: every scripted stop reached it,
    // and nothing the game measured — a first minute, a gap since the last
    // break — ever held one back.
    expect(sdk.calls.filter((c) => c === 'commercialBreak')).toHaveLength(stops);
    expect(stops, `only ${stops} stops in ten thousand moments`).toBeGreaterThan(4_000);
    expect(prompts.length).toBeGreaterThan(20);
    for (let i = 1; i < prompts.length; i++) {
      expect(prompts[i]!.t - prompts[i - 1]!.t, `prompt ${i} rode too soon after ${i - 1}`).toBeGreaterThanOrEqual(
        TUNING.ads.promptGapMs,
      );
    }
  });
});
