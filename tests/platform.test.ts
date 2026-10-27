import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import { resolveLocale, setLocale, t } from '@/locale';
import { LOCALES, TABLES } from '@/locale/strings';
import { LocalSdk, type PlatformSdk } from '@/platform/sdk';
import { SdkBus } from '@/platform/sdk-bus';
import { DEFAULT_KEYS, rebind } from '@/input/keymap';
import { MemoryBackend, SaveStore, freshSave, sanitizeSave, type KeyValueBackend } from '@/platform/storage';

/** SDK whose ads stay open until the test releases them. */
class ManualAdSdk implements PlatformSdk {
  readonly calls: string[] = [];
  private release: (() => void) | null = null;

  async init(): Promise<void> {}
  loadingFinished(): void {}
  gameplayStart(): void {
    this.calls.push('start');
  }
  gameplayStop(): void {
    this.calls.push('stop');
  }
  commercialBreak(): Promise<void> {
    this.calls.push('commercial');
    return new Promise((resolve) => (this.release = resolve));
  }
  rewardedBreak(): Promise<boolean> {
    this.calls.push('rewarded');
    return new Promise((resolve) => (this.release = () => resolve(true)));
  }
  getLanguage(): string {
    return 'en';
  }
  measure(): void {}
  finishAd(): void {
    this.calls.push('adEnd');
    this.release?.();
    this.release = null;
  }
}

describe('SdkBus event rules', () => {
  it('does not fire gameplayStart on construction or load', () => {
    const sdk = new LocalSdk();
    new SdkBus(sdk);
    expect(sdk.calls).toEqual([]);
  });

  it('fires gameplayStart on the first input and only once', () => {
    const sdk = new LocalSdk();
    const bus = new SdkBus(sdk);
    for (let i = 0; i < 50; i++) bus.onPlayerInput();
    expect(sdk.calls).toEqual(['gameplayStart']);
  });

  it('never fires gameplayStop twice in a row', () => {
    const sdk = new LocalSdk();
    const bus = new SdkBus(sdk);
    bus.onPlayerInput();
    bus.stop();
    bus.stop();
    bus.stop();
    expect(sdk.calls).toEqual(['gameplayStart', 'gameplayStop']);
  });

  it('ignores gameplayStop when nothing is playing', () => {
    const sdk = new LocalSdk();
    const bus = new SdkBus(sdk);
    expect(bus.stop()).toBe(false);
    expect(sdk.calls).toEqual([]);
  });

  it('stops gameplay before a commercial break and restarts only on the next input', async () => {
    const sdk = new LocalSdk();
    const bus = new SdkBus(sdk);
    bus.onPlayerInput();
    await bus.commercialBreak();
    expect(sdk.calls).toEqual(['gameplayStart', 'gameplayStop', 'commercialBreak']);
    expect(bus.state).toBe('idle');
    bus.onPlayerInput();
    expect(sdk.calls.at(-1)).toBe('gameplayStart');
  });

  it('emits nothing to the SDK while an ad is playing', async () => {
    const sdk = new ManualAdSdk();
    const bus = new SdkBus(sdk);
    bus.onPlayerInput();
    const pending = bus.commercialBreak();
    expect(bus.state).toBe('ad');
    bus.onPlayerInput();
    bus.stop();
    bus.start();
    await bus.commercialBreak();
    await bus.rewardedBreak();
    expect(sdk.calls).toEqual(['start', 'stop', 'commercial']);
    sdk.finishAd();
    await pending;
    expect(bus.state).toBe('idle');
  });

  it('announces ad windows so audio can duck the music', async () => {
    const sdk = new ManualAdSdk();
    const bus = new SdkBus(sdk);
    const seen: string[] = [];
    bus.events.on('adStart', (e) => seen.push(`start:${e.kind}`));
    bus.events.on('adEnd', (e) => seen.push(`end:${e.kind}:${e.granted}`));
    const pending = bus.rewardedBreak();
    sdk.finishAd();
    expect(await pending).toBe(true);
    expect(seen).toEqual(['start:rewarded', 'end:rewarded:true']);
  });

  it('reports a declined or failed rewarded break as not granted', async () => {
    const sdk = new LocalSdk({ rewardedGranted: false });
    const bus = new SdkBus(sdk);
    expect(await bus.rewardedBreak()).toBe(false);
    expect(bus.state).toBe('idle');
  });

  it('survives an SDK that throws, so ad blockers never stop play', async () => {
    const broken: PlatformSdk = {
      init: async () => {},
      loadingFinished: () => {},
      gameplayStart: () => {},
      gameplayStop: () => {},
      commercialBreak: () => Promise.reject(new Error('blocked')),
      rewardedBreak: () => Promise.reject(new Error('blocked')),
      getLanguage: () => 'en',
      measure: () => {},
    };
    const bus = new SdkBus(broken);
    bus.onPlayerInput();
    await expect(bus.commercialBreak()).rejects.toThrow();
    expect(bus.state).toBe('idle');
    expect(bus.onPlayerInput()).toBe(true);
  });

  it('holds every invariant across 10,000 scripted inputs', async () => {
    const sdk = new ManualAdSdk();
    const bus = new SdkBus(sdk);
    const rng = new Rng(20261008);
    let adOpen = false;
    let pending: Promise<unknown> | null = null;

    for (let i = 0; i < 10_000; i++) {
      const roll = rng.next();
      if (adOpen) {
        if (roll < 0.1) {
          sdk.finishAd();
          await pending;
          adOpen = false;
        } else {
          bus.onPlayerInput();
          bus.stop();
        }
        continue;
      }
      if (roll < 0.62) bus.onPlayerInput();
      else if (roll < 0.82) bus.stop();
      else if (roll < 0.92) {
        pending = bus.commercialBreak();
        adOpen = true;
      } else {
        pending = bus.rewardedBreak();
        adOpen = true;
      }
    }
    if (adOpen) {
      sdk.finishAd();
      await pending;
    }

    const calls = sdk.calls;
    let playing = false;
    let inAd = false;
    for (const call of calls) {
      if (call === 'start') {
        expect(playing).toBe(false);
        expect(inAd).toBe(false);
        playing = true;
      } else if (call === 'stop') {
        expect(playing).toBe(true);
        expect(inAd).toBe(false);
        playing = false;
      } else if (call === 'adEnd') {
        expect(inAd).toBe(true);
        inAd = false;
      } else {
        expect(playing).toBe(false);
        expect(inAd).toBe(false);
        inAd = true;
      }
    }
    expect(bus.state).toBe('idle');
    expect(calls.filter((c) => c === 'start').length).toBeGreaterThan(100);
  });
});

class ThrowingBackend implements KeyValueBackend {
  read(): string | null {
    throw new Error('SecurityError');
  }
  write(): void {
    throw new Error('QuotaExceededError');
  }
}

class FlakyBackend implements KeyValueBackend {
  value: string | null = null;
  failWrites = false;
  read(): string | null {
    return this.value;
  }
  write(value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.value = value;
  }
}

describe('SaveStore persistence', () => {
  it('round-trips progress through a backend', () => {
    const backend = new MemoryBackend();
    const first = new SaveStore(backend);
    first.update((s) => {
      s.stars['scrapyard-01'] = 3;
      s.scrap = 120;
    });
    const second = new SaveStore(backend);
    expect(second.data.stars['scrapyard-01']).toBe(3);
    expect(second.data.scrap).toBe(120);
  });

  it('stays fully usable when storage is blocked from the start (incognito)', () => {
    const store = new SaveStore(null);
    expect(store.persistent).toBe(false);
    store.update((s) => {
      s.scrap = 40;
    });
    expect(store.data.scrap).toBe(40);
  });

  it('survives a backend that throws on every call', () => {
    const store = new SaveStore(new ThrowingBackend());
    expect(store.data).toEqual(freshSave());
    expect(() =>
      store.update((s) => {
        s.scrap = 10;
      }),
    ).not.toThrow();
    expect(store.data.scrap).toBe(10);
  });

  it('degrades to memory exactly once when a write hits the quota and raises one notice', () => {
    const backend = new FlakyBackend();
    const store = new SaveStore(backend);
    let notices = 0;
    store.events.on('degraded', () => notices++);
    store.update((s) => {
      s.scrap = 5;
    });
    expect(store.persistent).toBe(true);
    backend.failWrites = true;
    store.update((s) => {
      s.scrap = 6;
    });
    store.update((s) => {
      s.scrap = 7;
    });
    expect(store.persistent).toBe(false);
    expect(notices).toBe(1);
    expect(store.data.scrap).toBe(7);
  });

  it('recovers from corrupted JSON with a fresh save', () => {
    const backend = new MemoryBackend();
    backend.write('{not json');
    expect(new SaveStore(backend).data).toEqual(freshSave());
  });

  it('keeps valid fields and repairs invalid ones from a tampered save', () => {
    const repaired = sanitizeSave({
      stars: { a: 9, b: -4, c: 2, d: 'x' },
      bestMs: { a: 1234.7, b: -50 },
      scrap: -20,
      owned: ['skin.gold', 7, 'skin.gold'],
      equipped: { skin: 'skin.unowned', field: 'field.classic' },
      settings: { aimMode: 'laser', touchSensitivity: 99, sound: false },
    });
    expect(repaired.stars).toEqual({ a: 3, b: 0, c: 2 });
    expect(repaired.bestMs).toEqual({ a: 1235, b: 1 });
    expect(repaired.scrap).toBe(0);
    expect(repaired.owned.filter((id) => id === 'skin.gold')).toHaveLength(1);
    expect(repaired.equipped.skin).toBe('skin.classic');
    expect(repaired.settings.aimMode).toBe('auto');
    expect(repaired.settings.touchSensitivity).toBe(1.5);
    expect(repaired.settings.sound).toBe(false);
  });

  it('keeps the daily ad Scrap ledger whole and repairs a tampered one', () => {
    const kept = sanitizeSave({ adScrap: { day: '2026-10-27', earned: 140 } });
    expect(kept.adScrap).toEqual({ day: '2026-10-27', earned: 140 });
    const repaired = sanitizeSave({ adScrap: { day: 'a'.repeat(40), earned: -12.7 } });
    expect(repaired.adScrap).toEqual({ day: 'a'.repeat(10), earned: 0 });
    expect(sanitizeSave({ adScrap: { earned: 5 } }).adScrap).toEqual({ day: '', earned: 0 });
    expect(sanitizeSave({}).adScrap).toEqual({ day: '', earned: 0 });
  });

  it('keeps a custom key layout across a reload', () => {
    const backend = new MemoryBackend();
    const first = new SaveStore(backend);
    const rebound = rebind(DEFAULT_KEYS, 'flip', 0, 'KeyF');
    if (!rebound.ok) throw new Error('rebind refused');
    first.update((s) => {
      s.settings.keys = rebound.keys;
    });
    expect(new SaveStore(backend).data.settings.keys.flip).toEqual(['KeyF', 'KeyJ']);
  });

  it('gives a save from before key remapping the default keys', () => {
    const backend = new MemoryBackend();
    backend.write(JSON.stringify({ version: 2, settings: { sound: false, aimMode: 'mouse' } }));
    const { settings } = new SaveStore(backend).data;
    expect(settings.keys).toEqual(DEFAULT_KEYS);
    expect(settings.sound).toBe(false);
    expect(settings.aimMode).toBe('mouse');
  });

  it('drops a tampered key layout whole and keeps the rest of the settings', () => {
    const repaired = sanitizeSave({ settings: { sound: false, keys: { ...DEFAULT_KEYS, flip: ['Enter'], left: ['Space'] } } });
    expect(repaired.settings.keys).toEqual(DEFAULT_KEYS);
    expect(repaired.settings.sound).toBe(false);
  });

  it('does not let a failed save lose the in-memory progress', () => {
    const backend = new FlakyBackend();
    const store = new SaveStore(backend);
    backend.failWrites = true;
    store.update((s) => {
      s.stars['x'] = 2;
    });
    store.update((s) => {
      s.stars['y'] = 1;
    });
    expect(store.data.stars).toEqual({ x: 2, y: 1 });
  });
});

describe('localisation', () => {
  it('ships the seven launch locales', () => {
    expect([...LOCALES]).toEqual(['en', 'de', 'es', 'fr', 'it', 'pt', 'tr']);
  });

  it('resolves platform language tags with an English fallback', () => {
    expect(resolveLocale('de-AT')).toBe('de');
    expect(resolveLocale('PT')).toBe('pt');
    expect(resolveLocale('ja')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  it('has every key translated and non-empty in every locale', () => {
    const keys = Object.keys(TABLES.en);
    for (const locale of LOCALES) {
      expect(Object.keys(TABLES[locale]).sort()).toEqual([...keys].sort());
      for (const key of keys) expect(TABLES[locale][key as keyof typeof TABLES.en].trim().length).toBeGreaterThan(0);
    }
  });

  it('switches the active language', () => {
    setLocale('de');
    expect(t('resume')).toBe('Weiter');
    setLocale('en');
    expect(t('resume')).toBe('Resume');
  });

  it('keeps the longest translations short enough for elastic layouts', () => {
    const longest = Math.max(...LOCALES.flatMap((l) => Object.values(TABLES[l]).map((s) => s.length)));
    expect(longest).toBeLessThan(60);
  });
});
