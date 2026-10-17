// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExchangeView, ImportOutcome } from '@/game/ghost-exchange';
import { SHARE_HEIGHT, SHARE_WIDTH, buildDuelCard, type DuelCardSpec } from '@/game/share-card';
import { InputManager } from '@/input/input';
import { LOCALES, setLocale, tf, type LocaleId } from '@/locale';
import { TABLES } from '@/locale/strings';
import { DEFAULT_SETTINGS } from '@/platform/settings';
import { GhostExchangeScreen, type ExchangeHandlers } from '@/ui/ghost-exchange';
import { ModalHost } from '@/ui/modal-host';
import { GameUi, type ClearCardData, type UiHandlers } from '@/ui/ui';

const noop = (): void => undefined;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const view = (over: Partial<ExchangeView> = {}): ExchangeView => ({
  levelName: 'Crusher Row',
  personalMs: 41_230,
  friend: null,
  alias: 'Mina',
  ...over,
});

interface Rig {
  host: ModalHost;
  screen: GhostExchangeScreen;
  handlers: { [K in keyof ExchangeHandlers]: ReturnType<typeof vi.fn<ExchangeHandlers[K]>> };
  writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;
}

const rig = (clipboardFails = false): Rig => {
  const host = new ModalHost();
  const handlers = {
    exportCode: vi.fn<ExchangeHandlers['exportCode']>(async () => 'MGH1.abc'),
    importCode: vi.fn<ExchangeHandlers['importCode']>(async (): Promise<ImportOutcome> => ({ ok: true, name: 'Ana', level: 'Crusher Row' })),
    removeFriend: vi.fn<ExchangeHandlers['removeFriend']>(),
    back: vi.fn<ExchangeHandlers['back']>(),
    tick: vi.fn<ExchangeHandlers['tick']>(),
  };
  const writeText = vi.fn<(text: string) => Promise<void>>(async () => {
    if (clipboardFails) throw new Error('denied');
  });
  const screen = new GhostExchangeScreen(document.body, host, handlers, () => ({ writeText }));
  return { host, screen, handlers, writeText };
};

const byText = (text: string): HTMLButtonElement =>
  [...document.querySelectorAll<HTMLButtonElement>('.exchange button')].find((b) => b.textContent!.includes(text))!;
const status = (): string => document.querySelector('.exchange-status')!.textContent!;
const pasteField = (): HTMLTextAreaElement => document.querySelector('.exchange-import textarea')!;

beforeEach(() => {
  document.body.innerHTML = '';
  setLocale('en');
});

afterEach(() => setLocale('en'));

describe('exchange screen: your ghost', () => {
  it('asks the player to beat par first when there is no ghost to share', () => {
    const { screen } = rig();
    screen.show(view({ personalMs: null }));
    expect(document.querySelector('.exchange')!.textContent).toContain('Beat par on this level');
    expect(byText('Copy code')).toBeUndefined();
  });

  it('copies the code under the typed name, puts it on the clipboard and shows it', async () => {
    const { screen, handlers, writeText } = rig();
    screen.show(view());
    const name = document.querySelector<HTMLInputElement>('.name-field')!;
    expect(name.value).toBe('Mina');
    name.value = 'Mina B';
    byText('Copy code').click();
    await flush();
    expect(handlers.exportCode).toHaveBeenCalledWith('Mina B');
    expect(writeText).toHaveBeenCalledWith('MGH1.abc');
    expect(status()).toBe('Code copied');
    const shown = document.querySelector<HTMLTextAreaElement>('.exchange-block textarea[readonly]')!;
    expect(shown.value).toBe('MGH1.abc');
  });

  it('falls back to a selected code when the browser refuses the clipboard', async () => {
    const { screen } = rig(true);
    screen.show(view());
    byText('Copy code').click();
    await flush();
    expect(status()).toBe('Select the code and copy it');
    const shown = document.querySelector<HTMLTextAreaElement>('.exchange-block textarea[readonly]')!;
    expect(document.activeElement).toBe(shown);
  });

  it('shows nothing when the game has no code to give', async () => {
    const { screen, handlers } = rig();
    handlers.exportCode.mockResolvedValueOnce(null);
    screen.show(view());
    byText('Copy code').click();
    await flush();
    expect(document.querySelector('.exchange-block textarea[readonly]')).toBeNull();
    expect(status()).toBe('');
  });
});

describe('exchange screen: a friend\'s ghost', () => {
  it('says so when the level has none, and lists the friend with their time when it has', () => {
    const { screen } = rig();
    screen.show(view());
    expect(document.querySelector('.exchange')!.textContent).toContain('No friend ghost on this level yet');
    screen.update(view({ friend: { name: 'Ana', durationMs: 38_500 } }));
    const line = document.querySelector('.friend-line')!.textContent!;
    expect(line).toContain('Ana');
    expect(line).toContain('38.50');
  });

  it('removes the friend ghost on request', () => {
    const { screen, handlers } = rig();
    screen.show(view({ friend: { name: 'Ana', durationMs: 38_500 } }));
    byText('Remove').click();
    expect(handlers.removeFriend).toHaveBeenCalledTimes(1);
  });

  it('adds a pasted code, confirms by name and level, and clears the field', async () => {
    const { screen, handlers } = rig();
    screen.show(view());
    pasteField().value = '  MGH1.xyz \n';
    byText('Add ghost').click();
    await flush();
    expect(handlers.importCode).toHaveBeenCalledWith('MGH1.xyz');
    expect(status()).toBe('Ana added to Crusher Row');
    expect(pasteField().value).toBe('');
  });

  it('keeps the pasted text and explains a rejected code', async () => {
    const { screen, handlers } = rig();
    handlers.importCode.mockResolvedValueOnce({ ok: false, message: 'ghostErrChecksum' });
    screen.show(view());
    pasteField().value = 'MGH1.damaged';
    byText('Add ghost').click();
    await flush();
    expect(status()).toBe('The code looks damaged. Copy it again in full');
    expect(pasteField().value).toBe('MGH1.damaged');
  });

  it('does nothing for an empty box', async () => {
    const { screen, handlers } = rig();
    screen.show(view());
    byText('Add ghost').click();
    await flush();
    expect(handlers.importCode).not.toHaveBeenCalled();
  });

  it('speaks the player\'s language, status line included', async () => {
    const { screen, handlers } = rig();
    handlers.importCode.mockResolvedValueOnce({ ok: false, message: 'ghostErrFormat' });
    setLocale('de');
    screen.show(view());
    expect(document.querySelector('.exchange h2')!.textContent).toBe('Geister-Tausch');
    pasteField().value = 'x';
    byText('Geist hinzufügen').click();
    await flush();
    expect(status()).toBe('Das ist kein Geist-Code');
  });
});

describe('typing a code never plays or steers the game', () => {
  const key = (target: EventTarget, code: string): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };

  it('lets menu navigation keys through to the text box instead of moving focus', () => {
    const { screen } = rig();
    screen.show(view());
    const field = pasteField();
    field.focus();
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowDown']) {
      expect(key(field, code).defaultPrevented, code).toBe(false);
    }
    expect(document.activeElement).toBe(field);
  });

  it('keeps arrow keys moving focus between the menu\'s buttons', () => {
    const { screen } = rig();
    screen.show(view());
    const copy = byText('Copy code');
    copy.focus();
    expect(key(copy, 'ArrowDown').defaultPrevented).toBe(true);
  });

  describe('input manager', () => {
    let stage: HTMLElement;
    let input: InputManager;
    let retries: number;
    let pauses: number;

    beforeEach(() => {
      stage = document.createElement('div');
      document.body.appendChild(stage);
      input = new InputManager(stage, { playerScreen: () => null, settings: () => ({ ...DEFAULT_SETTINGS }) });
      input.attach();
      input.setEnabled(true);
      retries = 0;
      pauses = 0;
      input.events.on('retry', () => retries++);
      input.events.on('pause', () => pauses++);
    });

    afterEach(() => input.dispose());

    it('does not restart the level when someone types an r', () => {
      const field = document.createElement('textarea');
      document.body.appendChild(field);
      key(field, 'KeyR');
      expect(retries).toBe(0);
      key(document.body, 'KeyR');
      expect(retries).toBe(1);
    });

    it('does not pause on a typed p, but Escape still leaves the box', () => {
      const field = document.createElement('input');
      field.type = 'text';
      document.body.appendChild(field);
      key(field, 'KeyP');
      expect(pauses).toBe(0);
      key(field, 'Escape');
      expect(pauses).toBe(1);
    });

    it('does not flip or move MAGNO from keys typed into a field', () => {
      const field = document.createElement('textarea');
      document.body.appendChild(field);
      key(field, 'Space');
      key(field, 'KeyD');
      expect(input.sample().flipHeld).toBe(false);
      expect(input.sample().tiltX).toBe(0);
      key(document.body, 'KeyD');
      expect(input.sample().tiltX).toBeGreaterThan(0);
    });
  });
});

describe('clear card and pause menu', () => {
  const handlers = (over: Partial<UiHandlers> = {}): UiHandlers => ({
    pause: noop,
    resume: noop,
    restart: noop,
    setSetting: noop,
    next: noop,
    retry: noop,
    secondWind: noop,
    doubleScrap: noop,
    shareFall: noop,
    openMap: noop,
    openLocker: noop,
    watchEnding: noop,
    openExchange: noop,
    shareDuel: noop,
    tick: noop,
    stamp: noop,
    map: { select: noop, back: noop, openLocker: noop, share: noop, tick: noop },
    locker: { equip: noop, buy: noop, watch: noop, back: noop, tick: noop },
    exchange: { exportCode: async () => null, importCode: async () => ({ ok: false, message: 'ghostErrFormat' }), removeFriend: noop, back: noop, tick: noop },
    ...over,
  });
  const card: ClearCardData = {
    levelName: 'Crusher Row',
    stars: 2,
    newBest: false,
    timeMs: 38_000,
    parSeconds: 40,
    scrap: 20,
    hasNext: true,
    canDouble: true,
    finale: false,
    friend: null,
  };
  const clearButtons = (): string[] => [...document.querySelectorAll('.clear-card .btn')].map((b) => b.textContent!.trim());

  it('opens the exchange from the pause menu and from the clear card', () => {
    const openExchange = vi.fn();
    const ui = new GameUi(document.body, handlers({ openExchange }));
    const pauseButton = [...document.querySelectorAll<HTMLButtonElement>('#ui .btn')].find((b) => b.textContent!.includes('Ghost exchange'))!;
    pauseButton.click();
    ui.showClear(card);
    [...document.querySelectorAll<HTMLButtonElement>('.clear-card .btn')].find((b) => b.textContent!.includes('Ghosts'))!.click();
    expect(openExchange).toHaveBeenCalledTimes(2);
  });

  it('tells the player they beat the friend, and offers to share the win', () => {
    const shareDuel = vi.fn();
    const ui = new GameUi(document.body, handlers({ shareDuel }));
    ui.showClear({ ...card, friend: { name: 'Ana', beaten: true, marginMs: 1_500 } });
    expect(document.querySelector('.duel-tag')!.textContent).toBe('You beat Ana');
    expect(document.querySelector('.duel-tag')!.classList.contains('won')).toBe(true);
    [...document.querySelectorAll<HTMLButtonElement>('.clear-card .btn')].find((b) => b.textContent!.includes('Share the win'))!.click();
    expect(shareDuel).toHaveBeenCalledTimes(1);
  });

  it('shows how far behind the friend the player finished, without a share button', () => {
    const ui = new GameUi(document.body, handlers());
    ui.showClear({ ...card, friend: { name: 'Ana', beaten: false, marginMs: 2_340 } });
    expect(document.querySelector('.duel-tag')!.textContent).toBe('Ana is 2.34s ahead');
    expect(clearButtons()).not.toContain('Share the win');
  });

  it('shows no race line on a level without a friend ghost', () => {
    const ui = new GameUi(document.body, handlers());
    ui.showClear(card);
    expect(document.querySelector('.duel-tag')).toBeNull();
  });

  it('closes the exchange before anything beneath it when the player backs out', () => {
    const ui = new GameUi(document.body, handlers());
    ui.openPause();
    ui.exchange.show(view());
    expect(ui.exchange.isOpen).toBe(true);
    expect(ui.dismissOverlayScreen()).toBe(true);
    expect(ui.exchange.isOpen).toBe(false);
    expect(ui.pauseOpen).toBe(true);
  });
});

describe('duel share card', () => {
  const spec = (locale: LocaleId = 'en', over: Partial<DuelCardSpec> = {}): DuelCardSpec => ({
    friend: 'Ana',
    timeMs: 38_250,
    friendMs: 41_000,
    levelName: 'Crusher Row',
    biome: 'scrapyard',
    labels: { title: tf('duelTitle', { n: over.friend ?? 'Ana' }), ahead: TABLES[locale].duelAhead, you: TABLES[locale].you },
    ...over,
  });
  const texts = (s: DuelCardSpec): string[] => buildDuelCard(s).flatMap((o) => (o.op === 'text' ? [o.text] : []));

  it('names the friend, the winning margin and both times', () => {
    expect(texts(spec())).toEqual(expect.arrayContaining(['Beat Ana', '2.75s', '38.25s', '41.00s', 'ANA', 'YOU', 'MAGNETOPE', 'Crusher Row']));
  });

  it('never shows a negative margin', () => {
    const lost = texts(spec('en', { timeMs: 50_000 }));
    expect(lost).toContain('0.00s');
    expect(lost.some((t) => t.startsWith('-'))).toBe(false);
  });

  it.each(LOCALES)('keeps every text run inside the frame in %s, even for the longest name', (locale) => {
    setLocale(locale);
    const longest = spec(locale, { friend: 'WWWWWWWWWWWWWW' });
    for (const op of buildDuelCard(longest)) {
      if (op.op !== 'text') continue;
      expect(op.maxWidth).toBeLessThanOrEqual(SHARE_WIDTH - 2 * 60);
      expect(op.y).toBeGreaterThan(0);
      expect(op.y).toBeLessThan(SHARE_HEIGHT);
    }
  });

  it('is deterministic and carries no links', () => {
    expect(buildDuelCard(spec())).toEqual(buildDuelCard(spec()));
    expect(JSON.stringify(buildDuelCard(spec()))).not.toMatch(/https?:|www\./i);
  });
});
