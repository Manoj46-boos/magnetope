// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { endingFrame } from '@/game/ending';
import { setLocale } from '@/locale';
import { EndingScreen, type ClimbSummary } from '@/ui/ending-screen';
import { GameUi, type ClearCardData, type UiHandlers } from '@/ui/ui';

const SUMMARY: ClimbSummary = { stars: 87, maxStars: 105, levelsCleared: 35, totalLevels: 35, bestFall: { heightMeters: 31.4, grade: 'SSS' } };

let screen: EndingScreen;
let skipped: Mock<() => void>;

beforeEach(() => {
  document.body.innerHTML = '';
  setLocale('en');
  screen = new EndingScreen(document.body);
  skipped = vi.fn<() => void>();
});

afterEach(() => {
  screen.hide();
  setLocale('en');
});

const skipButton = (): HTMLButtonElement => document.querySelector('.ending .skip') as HTMLButtonElement;
const press = (key: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('ending screen', () => {
  it('is hidden until the film starts', () => {
    expect(screen.visible).toBe(false);
    expect(screen.element.getAttribute('aria-hidden')).toBe('true');
  });

  it('offers a skip button from the very first frame, and the button works', () => {
    screen.show(SUMMARY, skipped);
    expect(screen.visible).toBe(true);
    expect(skipButton().textContent).toContain('Skip');
    expect(skipButton().hasAttribute('data-ui')).toBe(true);
    skipButton().click();
    expect(skipped).toHaveBeenCalledTimes(1);
  });

  it.each(['Escape', 'Enter', ' '])('skips on the %j key and swallows it so nothing else reacts', (key) => {
    screen.show(SUMMARY, skipped);
    const event = press(key);
    expect(skipped).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores other keys', () => {
    screen.show(SUMMARY, skipped);
    press('a');
    press('ArrowUp');
    expect(skipped).not.toHaveBeenCalled();
  });

  it('does not react to keys once hidden', () => {
    screen.show(SUMMARY, skipped);
    screen.hide();
    const event = press('Escape');
    expect(skipped).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(screen.visible).toBe(false);
  });

  it('draws the bars and the credits fade from the film frame', () => {
    screen.show(SUMMARY, skipped);
    screen.render(endingFrame(0.6));
    expect(Number(screen.element.style.getPropertyValue('--bars'))).toBeGreaterThan(0.3);
    expect(Number(screen.element.style.getPropertyValue('--credits'))).toBe(0);
    screen.render(endingFrame(60));
    expect(Number(screen.element.style.getPropertyValue('--bars'))).toBe(1);
    expect(Number(screen.element.style.getPropertyValue('--credits'))).toBe(1);
  });

  it('turns Skip into Next once the closing card is up', () => {
    screen.show(SUMMARY, skipped);
    screen.render(endingFrame(30));
    expect(skipButton().textContent).toContain('Skip');
    screen.render(endingFrame(55));
    expect(skipButton().textContent).toContain('Next');
    expect(skipButton().textContent).not.toContain('Skip');
  });

  it('shows the climb on the closing card', () => {
    screen.show(SUMMARY, skipped);
    const text = screen.element.querySelector('.credits')!.textContent!;
    expect(text).toContain('MAGNETOPE');
    expect(text).toContain('87');
    expect(text).toContain('/105');
    expect(text).toContain('35');
    expect(text).toContain('31.4');
    expect(text).toContain('SSS');
    expect(text).toContain('Thank you for climbing');
    expect(text).toContain('Magnetope Studio');
  });

  it('shows a dash instead of a best fall when the player never fell', () => {
    screen.show({ ...SUMMARY, bestFall: null }, skipped);
    expect(screen.element.querySelector('.credits')!.textContent).toContain('–');
    expect(screen.element.querySelector('.credits')!.textContent).not.toContain('undefined');
  });

  it('speaks the player language on the skip button and the closing card', () => {
    setLocale('de');
    screen.show(SUMMARY, skipped);
    expect(skipButton().textContent).toContain('Überspringen');
    expect(screen.element.querySelector('.credits')!.textContent).toContain('Danke fürs Klettern');
    setLocale('tr');
    screen.applyLocale();
    expect(skipButton().textContent).toContain('Atla');
  });

  it('is labelled for assistive tech while it is up', () => {
    screen.show(SUMMARY, skipped);
    expect(screen.element.getAttribute('role')).toBe('region');
    expect(screen.element.getAttribute('aria-label')).toBe('The ending');
    expect(screen.element.hasAttribute('aria-hidden')).toBe(false);
  });

  it('can be shown again after it was dismissed, with a fresh handler and a fresh card', () => {
    screen.show(SUMMARY, skipped);
    screen.render(endingFrame(55));
    screen.hide();
    const again = vi.fn<() => void>();
    screen.show({ ...SUMMARY, stars: 90 }, again);
    expect(skipButton().textContent).toContain('Skip');
    expect(screen.element.querySelector('.credits')!.textContent).toContain('90');
    skipButton().click();
    expect(again).toHaveBeenCalledTimes(1);
    expect(skipped).not.toHaveBeenCalled();
  });
});

describe('level clear card on the last level', () => {
  const noop = (): void => undefined;
  const handlers = (watchEnding: () => void): UiHandlers => ({
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
    watchEnding,
    openExchange: noop,
    shareDuel: noop,
    tick: noop,
    stamp: noop,
    map: { select: noop, back: noop, openLocker: noop, share: noop, tick: noop },
    locker: { equip: noop, buy: noop, watch: noop, back: noop, tick: noop },
    exchange: { exportCode: async () => null, importCode: async () => ({ ok: false, message: 'ghostErrFormat' }), removeFriend: noop, back: noop, tick: noop },
  });
  const card: ClearCardData = { levelName: 'Summit', stars: 3, newBest: true, timeMs: 90_000, parSeconds: 100, scrap: 40, hasNext: false, canDouble: true, finale: true, friend: null };
  const labels = (): string[] => [...document.querySelectorAll('.clear-card .btn')].map((b) => b.textContent!.trim());

  it('offers the ending again on the finale, and the button plays it', () => {
    const watch = vi.fn<() => void>();
    const ui = new GameUi(document.body, handlers(watch));
    ui.showClear(card);
    expect(labels()).toContain('Watch the ending');
    const button = [...document.querySelectorAll<HTMLButtonElement>('.clear-card .btn')].find((b) => b.textContent!.includes('Watch the ending'))!;
    button.click();
    expect(watch).toHaveBeenCalledTimes(1);
  });

  it('does not offer it on any other level', () => {
    const ui = new GameUi(document.body, handlers(noop));
    ui.showClear({ ...card, finale: false, hasNext: true });
    expect(labels()).not.toContain('Watch the ending');
  });
});
