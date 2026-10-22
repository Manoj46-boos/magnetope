import type { InputManager } from '@/input/input';
import { LOCALES, getLocale, t, tf, type LocaleId, type StringKey } from '@/locale';
import { DEFAULT_SETTINGS, type Settings } from '@/platform/settings';
import { formatTime } from '@/game/progress';
import { BiomeBanner } from './banner';
import { CoachOverlay } from './coach-overlay';
import { el, esc } from './dom';
import { ControlsScreen } from './controls-screen';
import { KeysScreen } from './keys-screen';
import { EndingScreen } from './ending-screen';
import { GhostExchangeScreen, type ExchangeHandlers } from './ghost-exchange';
import { ICONS, MAGNO_SILHOUETTE, STUDIO_MARK } from './icons';
import { LockerScreen, type LockerHandlers } from './locker-screen';
import { MapScreen, type MapHandlers } from './map-screen';
import { ModalHost } from './modal-host';

export interface UiHandlers {
  pause(): void;
  resume(): void;
  restart(): void;
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
  next(): void;
  retry(): void;
  secondWind(): void;
  doubleScrap(): void;
  shareFall(): void;
  openMap(): void;
  openLocker(): void;
  watchEnding(): void;
  openExchange(): void;
  shareDuel(): void;
  tick(): void;
  stamp(index: number): void;
  map: MapHandlers;
  locker: LockerHandlers;
  exchange: ExchangeHandlers;
}

export interface ClearCardData {
  levelName: string;
  stars: number;
  newBest: boolean;
  timeMs: number;
  parSeconds: number;
  scrap: number;
  hasNext: boolean;
  canDouble: boolean;
  /** True on the last level, where the clear card offers the ending again. */
  finale: boolean;
  /** The friend ghost raced this run, with the outcome. */
  friend: { name: string; beaten: boolean; marginMs: number } | null;
}

export interface FallCardData {
  heightMeters: number;
  bounces: number;
  junk: number;
  grade: string;
  offerSecondWind: boolean;
  shareable: boolean;
}

export interface HudState {
  altitudeFrac: number;
  showRail: boolean;
  timeMs: number | null;
  parSeconds: number;
  bestStars: number;
  showStars: boolean;
}

const LANGUAGE_NAMES: Record<LocaleId, string> = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  pt: 'Português (BR)',
  tr: 'Türkçe',
};

/**
 * The surfaces of the design: loading, HUD, pause, level map, locker, level
 * clear card, fall card and the touch layer. Everything is plain DOM so it is
 * crisp at any scale, navigable by keyboard, mouse and touch, and costs no
 * bundle weight.
 */
export class GameUi {
  readonly root: HTMLElement;
  readonly host = new ModalHost();
  readonly map: MapScreen;
  readonly locker: LockerScreen;
  readonly exchange: GhostExchangeScreen;
  readonly controls: ControlsScreen;
  readonly keysScreen: KeysScreen;
  readonly coach: CoachOverlay;
  readonly banner: BiomeBanner;
  readonly ending: EndingScreen;
  private readonly loading: HTMLElement;
  private readonly loadingBar: HTMLElement;
  private readonly hud: HTMLElement;
  private readonly rail: HTMLElement;
  private readonly railFill: HTMLElement;
  private readonly railMarker: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly starsTrack: HTMLElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly touch: HTMLElement;
  private readonly ring: HTMLElement;
  private readonly thumb: HTMLElement;
  private readonly flipButton: HTMLElement;
  private readonly pauseModal: HTMLElement;
  private readonly clearModal: HTMLElement;
  private readonly fallCard: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly speedLines: HTMLElement;
  private readonly flashEl: HTMLElement;
  private toggles = new Map<string, HTMLButtonElement>();
  private languageSelect!: HTMLSelectElement;
  private fallTimer = 0;
  private toastTimer = 0;
  private lastTimerText = '';
  private settings: Settings = DEFAULT_SETTINGS;

  constructor(
    parent: HTMLElement,
    private readonly handlers: UiHandlers,
  ) {
    this.root = el('div', { id: 'ui' });
    parent.appendChild(this.root);

    this.root.appendChild(el('div', { class: 'layer vignette' }));
    this.speedLines = this.layer('speed-lines');
    this.flashEl = this.layer('flash');
    this.coach = new CoachOverlay(this.root);
    this.banner = new BiomeBanner(this.root);
    this.ending = new EndingScreen(this.root);

    this.hud = this.layer('hud');
    this.rail = el('div', { class: 'rail' }, `<span class="summit">${ICONS.star}</span><div class="fill"></div><div class="marker"></div>`);
    this.railFill = this.rail.querySelector('.fill') as HTMLElement;
    this.railMarker = this.rail.querySelector('.marker') as HTMLElement;
    this.timer = el('div', { class: 'timer', 'aria-live': 'off' });
    this.starsTrack = el('div', { class: 'stars-track', 'aria-hidden': true });
    this.pauseButton = el('button', { class: 'icon-btn pause-btn', 'data-ui': true, type: 'button', 'aria-label': t('pause') }, ICONS.pause);
    this.pauseButton.addEventListener('click', () => this.handlers.pause());
    this.hud.append(this.rail, this.timer, this.starsTrack, this.pauseButton);

    this.touch = this.layer('touch');
    this.ring = el('div', { class: 'stick-ring' });
    this.thumb = el('div', { class: 'stick-thumb' });
    this.flipButton = el('div', { class: 'flip-btn' }, ICONS.assist);
    this.touch.append(this.ring, this.thumb, this.flipButton);

    this.fallCard = el('div', { class: 'fall-card', 'data-ui': true, role: 'status', 'aria-live': 'polite' });
    this.root.appendChild(this.fallCard);

    this.pauseModal = this.buildPause();
    this.clearModal = this.layer('modal', true);
    this.map = new MapScreen(this.root, this.host, handlers.map);
    this.locker = new LockerScreen(this.root, this.host, handlers.locker);
    this.exchange = new GhostExchangeScreen(this.root, this.host, handlers.exchange);
    this.keysScreen = new KeysScreen(this.root, this.host, {
      set: (keys) => this.handlers.setSetting('keys', keys),
      back: () => this.keysScreen.hide(),
      tick: () => this.handlers.tick(),
    });
    this.controls = new ControlsScreen(this.root, this.host, {
      set: (key, value) => this.handlers.setSetting(key, value),
      openKeys: () => this.keysScreen.show(this.settings.keys),
      back: () => this.controls.hide(),
      tick: () => this.handlers.tick(),
    });
    this.toastEl = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    this.root.appendChild(this.toastEl);

    this.loadingBar = el('div', { class: 'bar' }, '<i></i>');
    this.loading = el('div', { class: 'layer loading', role: 'progressbar', 'aria-label': t('loading') });
    this.loading.innerHTML = `${MAGNO_SILHOUETTE}<div class="logo">${STUDIO_MARK}<span>MAGNETOPE</span></div>`;
    this.loading.appendChild(this.loadingBar);
    this.root.appendChild(this.loading);
  }

  private layer(extra: string, ui = false): HTMLElement {
    const node = el('div', { class: `layer ${extra}`, 'data-ui': ui });
    this.root.appendChild(node);
    return node;
  }

  // ------------------------------------------------------------------ loading

  setLoading(progress: number): void {
    (this.loadingBar.firstElementChild as HTMLElement).style.width = `${Math.round(progress * 100)}%`;
  }

  /** Replaces whatever is on screen with a way out: a short message and one button that reloads the page. */
  showFatal(onReload: () => void): void {
    this.loading.remove();
    this.root.querySelector('.fatal')?.remove();
    const screen = el('div', { class: 'layer fatal', role: 'alert', 'data-ui': true });
    screen.innerHTML = `${MAGNO_SILHOUETTE}<h1>${esc(t('fatalTitle'))}</h1>`;
    const reload = el('button', { class: 'btn primary', type: 'button' }, esc(t('fatalReload')));
    reload.addEventListener('click', onReload);
    screen.appendChild(reload);
    this.root.appendChild(screen);
    reload.focus();
  }

  hideLoading(): void {
    this.loading.classList.add('done');
    this.loading.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => this.loading.remove(), 500);
  }

  // ---------------------------------------------------------------------- HUD

  showHud(on: boolean): void {
    this.hud.classList.toggle('on', on);
  }

  setTouchControls(on: boolean): void {
    this.touch.classList.toggle('on', on);
  }

  /** The flip affordance idles at half presence until the first touch, so the first frame still says "press me" (PRD 15.3). */
  setTouchRest(rest: boolean): void {
    this.touch.classList.toggle('rest', rest);
  }

  updateHud(state: HudState): void {
    this.rail.classList.toggle('show', state.showRail);
    const pct = Math.max(0, Math.min(1, state.altitudeFrac)) * 100;
    this.railFill.style.height = `${pct}%`;
    this.railMarker.style.bottom = `${pct}%`;

    const showTimer = state.timeMs !== null;
    this.timer.classList.toggle('show', showTimer);
    if (showTimer) {
      const text = `${formatTime(state.timeMs ?? 0)}|${state.parSeconds}`;
      if (text !== this.lastTimerText) {
        this.lastTimerText = text;
        this.timer.innerHTML = `${formatTime(state.timeMs ?? 0)}<span class="par">${t('par')} ${formatTime(state.parSeconds * 1000)}</span>`;
        this.timer.classList.toggle('ahead', (state.timeMs ?? 0) / 1000 <= state.parSeconds);
      }
    }

    this.starsTrack.classList.toggle('show', state.showStars);
    if (state.showStars) {
      const markup = [0, 1, 2]
        .map((i) => `<span class="${i < state.bestStars ? 'on' : ''}">${i < state.bestStars ? ICONS.star : ICONS.starOutline}</span>`)
        .join('');
      if (this.starsTrack.innerHTML !== markup) this.starsTrack.innerHTML = markup;
    }
  }

  updateTouch(input: InputManager): void {
    const stick = input.stick;
    const show = stick.active;
    this.ring.style.display = show ? 'block' : 'none';
    this.thumb.style.display = show ? 'block' : 'none';
    if (show) {
      this.ring.style.left = `${stick.originX}px`;
      this.ring.style.top = `${stick.originY}px`;
      this.thumb.style.left = `${stick.originX + stick.x * 54}px`;
      this.thumb.style.top = `${stick.originY - stick.y * 54}px`;
    }
    this.flipButton.classList.toggle('down', input.flipTouchActive);
  }

  setSlowMo(strength: number, reduced: boolean): void {
    this.speedLines.style.opacity = reduced ? '0' : String(0.08 * strength);
  }

  flash(amount: number): void {
    this.flashEl.style.opacity = String(Math.min(0.05, amount * 0.05));
  }

  // -------------------------------------------------------------------- pause

  private buildPause(): HTMLElement {
    const modal = this.layer('modal', true);
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'pause-title');
    const panel = el('div', { class: 'panel pause' });
    panel.innerHTML = `<h2 id="pause-title" data-i18n="pause">${t('pause')}</h2>`;

    const stack = el('div', { class: 'stack' });
    const resume = this.button('resume', 'play', 'btn primary', () => this.handlers.resume());
    resume.setAttribute('data-autofocus', '');
    stack.appendChild(resume);
    stack.appendChild(this.button('restart', 'restart', 'btn', () => this.handlers.restart()));
    const shortcuts = el('div', { class: 'pair' });
    shortcuts.append(
      this.opening('map', this.button('quitToMap', 'map', 'btn', () => this.handlers.openMap())),
      this.opening('locker', this.button('locker', 'locker', 'btn', () => this.handlers.openLocker())),
    );
    stack.appendChild(shortcuts);
    const more = el('div', { class: 'pair' });
    more.append(
      this.opening('exchange', this.button('ghostExchange', 'ghost', 'btn', () => this.handlers.openExchange())),
      this.opening('controls', this.button('controls', 'sliders', 'btn', () => this.controls.show(this.settings))),
    );
    stack.appendChild(more);

    const toggles = el('div', { class: 'toggles' });
    const addToggle = (key: keyof Settings, label: StringKey, icon: keyof typeof ICONS) => {
      const b = el('button', { class: 'toggle', 'data-nav': true, 'data-ui': true, type: 'button', 'aria-pressed': 'true' }, `${ICONS[icon]}<span data-i18n="${label}">${t(label)}</span>`);
      b.addEventListener('click', () => {
        const next = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(next));
        this.handlers.setSetting(key, next as never);
        this.handlers.tick();
      });
      toggles.appendChild(b);
      this.toggles.set(key, b);
    };
    addToggle('sound', 'sound', 'sound');
    addToggle('music', 'music', 'music');
    addToggle('assist', 'assist', 'assist');
    addToggle('reducedMotion', 'reducedMotion', 'motion');
    addToggle('ghosts', 'ghosts', 'ghost');

    const lang = el('label', { class: 'lang' }, ICONS.globe);
    this.languageSelect = el('select', { 'data-nav': true, 'data-ui': true, 'aria-label': t('language') });
    this.languageSelect.innerHTML =
      `<option value="auto">Auto</option>` + LOCALES.map((l) => `<option value="${l}">${LANGUAGE_NAMES[l]}</option>`).join('');
    this.languageSelect.addEventListener('change', () => this.handlers.setSetting('language', this.languageSelect.value));
    lang.appendChild(this.languageSelect);
    toggles.appendChild(lang);

    panel.append(stack, toggles);
    modal.appendChild(panel);
    return modal;
  }

  /** Names the screen a button opens, so automation and styling need not read the translated label. */
  private opening(screen: string, button: HTMLButtonElement): HTMLButtonElement {
    button.dataset.opens = screen;
    return button;
  }

  private button(label: StringKey, icon: keyof typeof ICONS, cls: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', { class: cls, type: 'button', 'data-nav': true, 'data-ui': true }, `${ICONS[icon]}<span data-i18n="${label}">${t(label)}</span>`);
    b.addEventListener('click', () => {
      this.handlers.tick();
      onClick();
    });
    return b;
  }

  syncSettings(settings: Settings): void {
    this.settings = settings;
    this.controls.sync(settings);
    this.keysScreen.sync(settings.keys);
    for (const [key, b] of this.toggles) b.setAttribute('aria-pressed', String(Boolean(settings[key as keyof Settings])));
    this.languageSelect.value = settings.language;
    document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
  }

  openPause(): void {
    this.host.open(this.pauseModal);
  }

  closePause(): void {
    this.host.close(this.pauseModal);
  }

  get pauseOpen(): boolean {
    return this.host.has(this.pauseModal);
  }

  /** Closes the map or locker if one is on top. Returns whether a screen was dismissed. */
  dismissOverlayScreen(): boolean {
    if (this.keysScreen.isOpen) {
      this.keysScreen.hide();
      return true;
    }
    if (this.controls.isOpen) {
      this.controls.hide();
      return true;
    }
    if (this.exchange.isOpen) {
      this.exchange.hide();
      return true;
    }
    if (this.locker.isOpen) {
      this.locker.hide();
      return true;
    }
    if (this.map.isOpen) {
      this.map.hide();
      return true;
    }
    return false;
  }

  /** Drops every screen, e.g. when the map sends the player into a level. */
  closeScreens(): void {
    this.host.closeAll();
  }

  // -------------------------------------------------------------- clear card

  showClear(data: ClearCardData): void {
    const panel = el('div', { class: 'panel clear-card' });
    const par = formatTime(data.parSeconds * 1000);
    panel.innerHTML = `
      ${data.newBest ? `<p class="best-tag">${t('newBest')}</p>` : ''}
      ${data.friend ? `<p class="duel-tag ${data.friend.beaten ? 'won' : ''}">${esc(this.duelLine(data.friend))}</p>` : ''}
      <div class="banner">${t('levelClear')}</div>
      <div class="stars">${[0, 1, 2].map(() => `<div class="slot">${ICONS.starOutline}</div>`).join('')}</div>
      <div class="facts">
        <div class="fact ${data.timeMs / 1000 <= data.parSeconds ? 'good' : ''}"><b>${formatTime(data.timeMs)}</b><span>${t('time')}</span></div>
        <div class="fact"><b>${par}</b><span>${t('par')}</span></div>
        <div class="fact"><b><span class="scrap-icon">${ICONS.scrap}</span>${data.scrap}</b><span>${t('scrap')}</span></div>
      </div>
      <div class="stack"></div>`;
    const stack = panel.querySelector('.stack') as HTMLElement;
    const secondary: HTMLElement[] = [];
    if (data.hasNext) stack.appendChild(this.button('next', 'next', 'btn primary', () => this.handlers.next()));
    else stack.appendChild(this.button('retry', 'restart', 'btn primary', () => this.handlers.retry()));
    if (data.canDouble) secondary.push(this.button('doubleScrap', 'video', 'btn', () => this.handlers.doubleScrap()));
    if (data.hasNext) secondary.push(this.button('retry', 'restart', 'btn', () => this.handlers.retry()));
    if (secondary.length === 2) {
      const row = el('div', { class: 'pair' });
      row.append(...secondary);
      stack.appendChild(row);
    } else {
      stack.append(...secondary);
    }
    if (data.friend?.beaten) stack.appendChild(this.button('shareWin', 'share', 'btn', () => this.handlers.shareDuel()));
    if (data.finale) stack.appendChild(this.button('watchEnding', 'play', 'btn', () => this.handlers.watchEnding()));
    const shortcuts = el('div', { class: 'pair' });
    shortcuts.append(
      this.button('quitToMap', 'map', 'btn', () => this.handlers.openMap()),
      this.button('ghosts', 'ghost', 'btn', () => this.handlers.openExchange()),
    );
    stack.appendChild(shortcuts);

    this.clearModal.replaceChildren(panel);
    this.host.open(this.clearModal);

    const slots = [...panel.querySelectorAll('.slot')];
    for (let i = 0; i < data.stars; i++) {
      window.setTimeout(() => {
        const slot = slots[i] as HTMLElement | undefined;
        if (!slot || !this.clearModal.classList.contains('open')) return;
        slot.innerHTML = ICONS.star;
        slot.classList.add('stamped');
        this.handlers.stamp(i);
      }, 520 + i * 260);
    }
  }

  private duelLine(friend: NonNullable<ClearCardData['friend']>): string {
    return friend.beaten
      ? tf('beatFriend', { n: friend.name })
      : tf('friendAhead', { n: friend.name, s: (friend.marginMs / 1000).toFixed(2) });
  }

  hideClear(): void {
    this.host.close(this.clearModal);
  }

  // ---------------------------------------------------------------- fall card

  showFall(data: FallCardData): void {
    const hi = ['S', 'SS', 'SSS'].includes(data.grade);
    this.fallCard.innerHTML = `
      <div class="grade ${hi ? 'hi' : ''}">${data.grade}</div>
      <div class="stats">
        <div>${data.heightMeters.toFixed(1)}<span>${t('meters')}</span></div>
        <div>${data.bounces}<span>${t('bounces')}</span></div>
        <div>${data.junk}<span>${t('junk')}</span></div>
      </div>
      <div class="actions"></div>`;
    const actions = this.fallCard.querySelector('.actions') as HTMLElement;
    actions.appendChild(this.button('retry', 'restart', 'btn primary', () => this.handlers.retry()));
    if (data.offerSecondWind) actions.appendChild(this.button('secondWind', 'video', 'btn', () => this.handlers.secondWind()));
    if (data.shareable) {
      const share = el('button', { class: 'icon-btn small', type: 'button', 'data-nav': true, 'data-ui': true, 'aria-label': t('share') }, ICONS.share);
      share.addEventListener('click', () => {
        this.handlers.tick();
        this.handlers.shareFall();
      });
      actions.appendChild(share);
    }
    this.fallCard.classList.add('open');
    window.clearTimeout(this.fallTimer);
    this.fallTimer = window.setTimeout(() => this.hideFall(), 4200);
  }

  hideFall(): void {
    window.clearTimeout(this.fallTimer);
    this.fallCard.classList.remove('open');
  }

  get fallCardOpen(): boolean {
    return this.fallCard.classList.contains('open');
  }

  // -------------------------------------------------------------------- toast

  toast(text: string, ms = 4200): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  // ------------------------------------------------------------------ locale

  applyLocale(): void {
    document.documentElement.lang = getLocale();
    this.root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.i18n as StringKey);
    });
    this.pauseButton.setAttribute('aria-label', t('pause'));
    this.ending.applyLocale();
    this.loading.setAttribute('aria-label', t('loading'));
    this.map.applyLocale();
    this.locker.applyLocale();
    this.exchange.applyLocale();
    this.controls.applyLocale();
    this.keysScreen.applyLocale();
  }

  get modalOpen(): boolean {
    return this.host.active !== null;
  }
}
