/** The slice of the History API the guard needs; tests pass a stand-in. */
export interface HistoryPort {
  pushState(data: unknown, unused: string): void;
  back(): void;
}

export interface BackGuardOptions {
  history: HistoryPort;
  events: EventTarget;
  /** Returns true when the press was used up (play paused, a screen closed), false when there is nothing left to give. */
  onBack: () => boolean;
}

/**
 * The Android back button (PRD table 4.2) pauses instead of throwing the player
 * out of a run. The guard keeps one history entry in front of the page: pressing
 * back consumes it and the game answers, and the entry goes back while the
 * press was useful. Once the game has nothing left to do, the press goes
 * through to the browser, so the player is never trapped.
 */
export class BackGuard {
  private armed = false;
  private readonly onPop = (): void => {
    if (!this.armed) return;
    this.armed = false;
    if (this.options.onBack()) this.arm();
    else this.options.history.back();
  };

  constructor(private readonly options: BackGuardOptions) {
    options.events.addEventListener('popstate', this.onPop);
  }

  /** Browsers only keep history entries made after a user gesture, so call this from the first input. */
  arm(): void {
    if (this.armed) return;
    this.armed = true;
    try {
      this.options.history.pushState({ magnetope: 'back-guard' }, '');
    } catch {
      this.armed = false;
    }
  }

  dispose(): void {
    this.options.events.removeEventListener('popstate', this.onPop);
    this.armed = false;
  }
}
