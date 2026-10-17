import { Emitter } from '@/core/emitter';
import type { PlatformSdk } from './sdk';

export type SdkState = 'idle' | 'playing' | 'ad';
export type SdkCall = 'gameplayStart' | 'gameplayStop' | 'commercialBreak' | 'rewardedBreak';

export interface SdkBusEvents {
  adStart: { kind: 'commercial' | 'rewarded' };
  adEnd: { kind: 'commercial' | 'rewarded'; granted: boolean };
}

/**
 * The only module allowed to talk to the platform SDK. It owns the Poki event
 * rules so they hold by construction: gameplayStart only on input, gameplayStop
 * only while playing, never twice in a row, and nothing at all during an ad.
 */
export class SdkBus {
  readonly events = new Emitter<SdkBusEvents>();
  /** Ordered record of calls that reached the SDK; the CI trace test asserts on it. */
  readonly trace: SdkCall[] = [];
  private current: SdkState = 'idle';

  constructor(private readonly sdk: PlatformSdk) {}

  get state(): SdkState {
    return this.current;
  }

  /** Call for every player input. Only the first one after a stop reaches the SDK. */
  onPlayerInput(): boolean {
    return this.start();
  }

  start(): boolean {
    if (this.current !== 'idle') return false;
    this.current = 'playing';
    this.trace.push('gameplayStart');
    this.sdk.gameplayStart();
    return true;
  }

  stop(): boolean {
    if (this.current !== 'playing') return false;
    this.current = 'idle';
    this.trace.push('gameplayStop');
    this.sdk.gameplayStop();
    return true;
  }

  /**
   * A natural-stop ad opportunity. Allowed only between stretches of play, so
   * gameplay is stopped first if the caller forgot to.
   */
  async commercialBreak(): Promise<boolean> {
    if (this.current === 'ad') return false;
    this.stop();
    this.current = 'ad';
    this.trace.push('commercialBreak');
    this.events.emit('adStart', { kind: 'commercial' });
    try {
      await this.sdk.commercialBreak();
    } finally {
      this.current = 'idle';
      this.events.emit('adEnd', { kind: 'commercial', granted: true });
    }
    return true;
  }

  /** Player-initiated rewarded video. Resolves true only when the reward was earned. */
  async rewardedBreak(): Promise<boolean> {
    if (this.current === 'ad') return false;
    this.stop();
    this.current = 'ad';
    this.trace.push('rewardedBreak');
    this.events.emit('adStart', { kind: 'rewarded' });
    let granted = false;
    try {
      granted = await this.sdk.rewardedBreak();
    } finally {
      this.current = 'idle';
      this.events.emit('adEnd', { kind: 'rewarded', granted });
    }
    return granted;
  }
}
