import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { TUNING } from '@/config/tuning';
import { AdPlacement, type PlacementKind } from '@/platform/ad-placement';
import { LocalSdk, type PlatformSdk } from '@/platform/sdk';
import { SdkBus } from '@/platform/sdk-bus';

/**
 * The placement layer's own laws (R-MZ-03/06), driven the way a session moves:
 * the clock runs, intent arrives, and only what the rules allow reaches the SDK.
 * The resume break is exempt on purpose — always calling it on the pause-to-play
 * transition is the host's contract, and the SDK decides what actually shows.
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

describe('the break floor', () => {
  it('always breaks on resume, whatever the clocks say', async () => {
    const { ads, sdk } = layer();
    expect(await ads.resumeBreak()).toBe(true);
    ads.advance(1_000);
    expect(await ads.resumeBreak(), 'the platform contract break ignores every floor').toBe(true);
    expect(sdk.calls.filter((c) => c === 'commercialBreak')).toHaveLength(2);
  });

  it('keeps the first minute of a session free of discretionary breaks', async () => {
    const { ads, sdk } = layer();
    sdk.calls.length = 0;
    ads.advance(30_000);
    expect(await ads.advanceBreak()).toBe(false);
    expect(await ads.retryBreak()).toBe(false);
    expect(sdk.calls).toEqual([]);
    ads.advance(31_000);
    expect(await ads.advanceBreak()).toBe(true);
    expect(sdk.calls).toEqual(['commercialBreak']);
  });

  it('waits out the floor before the next-level break, measured from the last break of any kind', async () => {
    const { ads, sdk } = layer();
    ads.advance(TUNING.ads.firstBreakMinMs + 1_000);
    expect(await ads.advanceBreak()).toBe(true);
    expect(sdk.calls).toHaveLength(1);
    // A resume break inside the floor window resets the clock it is measured from.
    ads.advance(10_000);
    await ads.resumeBreak();
    expect(sdk.calls).toHaveLength(2);
    expect(await ads.advanceBreak()).toBe(false);
    ads.advance(TUNING.ads.breakFloorMs);
    expect(await ads.advanceBreak()).toBe(true);
    expect(sdk.calls).toHaveLength(3);
  });

  it('makes the retry wait twice the floor — retry momentum is sacred', async () => {
    const { ads, sdk } = layer();
    ads.advance(61_000);
    expect(await ads.retryBreak()).toBe(true);
    ads.advance(TUNING.ads.breakFloorMs);
    expect(await ads.retryBreak(), 'the ninety-second floor is not enough here').toBe(false);
    ads.advance(TUNING.ads.retryFloorMs - TUNING.ads.breakFloorMs + 1_000);
    expect(await ads.retryBreak()).toBe(true);
    expect(sdk.calls).toHaveLength(2);
  });

  it('does not spend the floor on a break that could not run', async () => {
    const sdk = new ManualAdSdk();
    const bus = new SdkBus(sdk);
    const ads = new AdPlacement(bus);
    ads.advance(61_000);
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
    expect(await retried, 'the failed attempt spent no floor').toBe(true);
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
  it('holds every spacing law across ten thousand scripted moments', async () => {
    const { ads } = layer();
    const rng = new Rng(20261027);
    const breaks: Array<{ t: number; kind: 'resume' | 'advance' | 'retry' }> = [];
    const prompts: Array<{ t: number; kind: PlacementKind }> = [];

    for (let i = 0; i < 10_000; i++) {
      ads.advance(rng.range(50, 500));
      const t = ads.sessionClockMs;
      const roll = rng.next();
      if (roll < 0.1) {
        if (await ads.resumeBreak()) breaks.push({ t, kind: 'resume' });
      } else if (roll < 0.3) {
        if (await ads.advanceBreak()) breaks.push({ t, kind: 'advance' });
      } else if (roll < 0.45) {
        if (await ads.retryBreak()) breaks.push({ t, kind: 'retry' });
      } else if (roll < 0.7) {
        if (ads.offer('second-wind')) prompts.push({ t, kind: 'second-wind' });
      } else if (roll < 0.95) {
        if (ads.offer('scrap-doubler')) prompts.push({ t, kind: 'scrap-doubler' });
      } else {
        ads.noteWatched();
      }
    }

    expect(breaks.length).toBeGreaterThan(40);
    expect(prompts.length).toBeGreaterThan(20);
    for (let i = 0; i < breaks.length; i++) {
      const { t, kind } = breaks[i]!;
      const previous = i > 0 ? breaks[i - 1]!.t : Number.NEGATIVE_INFINITY;
      if (kind === 'resume') continue; // The host's contract break: the SDK decides what shows.
      expect(t, `discretionary break ${i} at ${t}ms`).toBeGreaterThanOrEqual(TUNING.ads.firstBreakMinMs);
      expect(t, `break ${i} (${kind}) came too soon after ${previous}ms`).toBeGreaterThanOrEqual(
        previous + (kind === 'retry' ? TUNING.ads.retryFloorMs : TUNING.ads.breakFloorMs),
      );
    }
    for (let i = 1; i < prompts.length; i++) {
      expect(prompts[i]!.t - prompts[i - 1]!.t, `prompt ${i} rode too soon after ${i - 1}`).toBeGreaterThanOrEqual(
        TUNING.ads.promptGapMs,
      );
    }
  });
});
