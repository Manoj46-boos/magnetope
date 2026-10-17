/** The subset of the Poki SDK the game depends on. Everything else goes through SdkBus. */
export interface PlatformSdk {
  init(): Promise<void>;
  loadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(): Promise<void>;
  rewardedBreak(): Promise<boolean>;
  getLanguage(): string;
  /** Anonymous first-party event; a no-op where the host has no such channel. */
  measure(category: string, what: string, action: string): void;
}

interface PokiGlobal {
  init(): Promise<void>;
  gameLoadingFinished?(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(): Promise<void>;
  rewardedBreak(): Promise<boolean>;
  getLanguage?(): string;
  measure?(category: string, what: string, action: string): void;
}

declare global {
  interface Window {
    PokiSDK?: PokiGlobal;
  }
}

const browserLanguage = (): string => {
  try {
    return (navigator.language || 'en').slice(0, 2).toLowerCase();
  } catch {
    return 'en';
  }
};

/** Wraps the injected PokiSDK. Every call is guarded so a blocked or failing SDK never stops play. */
class PokiSdkAdapter implements PlatformSdk {
  constructor(private readonly poki: PokiGlobal) {}

  async init(): Promise<void> {
    try {
      await this.poki.init();
    } catch {
      /* Ad blockers reject init; the game must stay playable. */
    }
  }

  loadingFinished(): void {
    this.safely(() => this.poki.gameLoadingFinished?.());
  }

  gameplayStart(): void {
    this.safely(() => this.poki.gameplayStart());
  }

  gameplayStop(): void {
    this.safely(() => this.poki.gameplayStop());
  }

  async commercialBreak(): Promise<void> {
    try {
      await this.poki.commercialBreak();
    } catch {
      /* Treated as a completed break. */
    }
  }

  async rewardedBreak(): Promise<boolean> {
    try {
      return Boolean(await this.poki.rewardedBreak());
    } catch {
      return false;
    }
  }

  getLanguage(): string {
    try {
      return (this.poki.getLanguage?.() ?? browserLanguage()).slice(0, 2).toLowerCase();
    } catch {
      return browserLanguage();
    }
  }

  measure(category: string, what: string, action: string): void {
    this.safely(() => this.poki.measure?.(category, what, action));
  }

  private safely(fn: () => void): void {
    try {
      fn();
    } catch {
      /* SDK faults are never allowed to surface into the game loop. */
    }
  }
}

/** Stand-in used in development, tests and any host that does not inject the SDK. */
export class LocalSdk implements PlatformSdk {
  readonly calls: string[] = [];
  readonly measured: Array<{ category: string; what: string; action: string }> = [];

  constructor(
    private readonly options: { adDelayMs?: number; rewardedGranted?: boolean; language?: string } = {},
  ) {}

  async init(): Promise<void> {
    this.calls.push('init');
  }

  loadingFinished(): void {
    this.calls.push('loadingFinished');
  }

  gameplayStart(): void {
    this.calls.push('gameplayStart');
  }

  gameplayStop(): void {
    this.calls.push('gameplayStop');
  }

  async commercialBreak(): Promise<void> {
    this.calls.push('commercialBreak');
    await this.wait();
  }

  async rewardedBreak(): Promise<boolean> {
    this.calls.push('rewardedBreak');
    await this.wait();
    return this.options.rewardedGranted ?? true;
  }

  getLanguage(): string {
    return this.options.language ?? browserLanguage();
  }

  measure(category: string, what: string, action: string): void {
    this.measured.push({ category, what, action });
  }

  private wait(): Promise<void> {
    const ms = this.options.adDelayMs ?? 0;
    return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
  }
}

export function createPlatformSdk(): PlatformSdk {
  if (typeof window !== 'undefined' && window.PokiSDK) return new PokiSdkAdapter(window.PokiSDK);
  return new LocalSdk();
}
