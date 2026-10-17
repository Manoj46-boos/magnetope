import type { FallHighlight } from '@/game/highlights';
import type { MapBiome, MapNode } from '@/game/map-model';
import { formatTime, TOTAL_STARS } from '@/game/progress';
import { t } from '@/locale';
import { PALETTES, type Hsl } from '@/render/palette';
import { el, esc } from './dom';
import { ICONS } from './icons';
import type { ModalHost } from './modal-host';

export interface MapHandlers {
  select(levelId: string): void;
  back(): void;
  openLocker(): void;
  share(highlight: FallHighlight): void;
  tick(): void;
}

export interface MapView {
  biomes: readonly MapBiome[];
  stars: number;
  scrap: number;
  highlights: readonly FallHighlight[];
  currentLevelId: string;
}

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.15;

const hsl = (c: Hsl, lShift = 0): string => `hsl(${c.h} ${c.s}% ${Math.max(0, Math.min(100, c.l + lShift))}%)`;

/**
 * The level-select mountain (PRD 12.2): five biome bands stacked from the
 * scrapyard at the base to the stratosphere at the peak, zoomable by wheel,
 * pinch or buttons. Fully reachable by keyboard and touch.
 */
export class MapScreen {
  readonly modal: HTMLElement;
  private readonly scroll: HTMLElement;
  private readonly mountain: HTMLElement;
  private readonly chips: HTMLElement;
  private readonly strip: HTMLElement;
  private zoomValue = 1;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchStart = 0;
  private pinchZoom = 1;

  constructor(
    parent: HTMLElement,
    private readonly host: ModalHost,
    private readonly handlers: MapHandlers,
  ) {
    this.modal = el('div', { class: 'layer modal screen', 'data-ui': true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'map-title' });
    const frame = el('div', { class: 'map-frame' });

    const head = el('header', { class: 'screen-head' });
    const back = this.iconButton('back', 'back', () => this.handlers.back());
    back.setAttribute('data-autofocus', '');
    const title = el('h2', { id: 'map-title', 'data-i18n': 'quitToMap' }, t('quitToMap'));
    this.chips = el('div', { class: 'chips' });
    const lockerBtn = el('button', { class: 'btn compact', type: 'button', 'data-nav': true, 'data-ui': true }, `${ICONS.locker}<span data-i18n="locker">${t('locker')}</span>`);
    lockerBtn.addEventListener('click', () => {
      this.handlers.tick();
      this.handlers.openLocker();
    });
    const zoom = el('div', { class: 'zoom' });
    zoom.append(
      this.iconButton('minus', 'zoomOut', () => this.setZoom(this.zoomValue - ZOOM_STEP)),
      this.iconButton('plus', 'zoomIn', () => this.setZoom(this.zoomValue + ZOOM_STEP)),
    );
    head.append(back, title, this.chips, zoom, lockerBtn);

    this.scroll = el('div', { class: 'map-scroll' });
    this.mountain = el('div', { class: 'mountain' });
    this.scroll.appendChild(this.mountain);
    this.strip = el('footer', { class: 'highlights' });

    frame.append(head, this.scroll, this.strip);
    this.modal.appendChild(frame);
    parent.appendChild(this.modal);
    this.bindZoom();
  }

  private iconButton(icon: keyof typeof ICONS, label: 'back' | 'zoomIn' | 'zoomOut', onClick: () => void): HTMLButtonElement {
    const b = el('button', { class: 'icon-btn small', type: 'button', 'data-nav': true, 'data-ui': true, 'aria-label': t(label) }, ICONS[icon]);
    b.dataset.label = label;
    b.addEventListener('click', () => {
      this.handlers.tick();
      onClick();
    });
    return b;
  }

  get zoom(): number {
    return this.zoomValue;
  }

  setZoom(value: number): void {
    this.zoomValue = Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value)) * 100) / 100;
    this.mountain.style.setProperty('--zoom', String(this.zoomValue));
  }

  private bindZoom(): void {
    this.scroll.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        this.setZoom(this.zoomValue - Math.sign(e.deltaY) * ZOOM_STEP);
      },
      { passive: false },
    );
    this.scroll.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        this.pinchStart = this.spread();
        this.pinchZoom = this.zoomValue;
      }
    });
    this.scroll.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const now = this.spread();
      if (this.pointers.size === 2 && this.pinchStart > 0 && now > 0) this.setZoom(this.pinchZoom * (now / this.pinchStart));
    });
    const release = (e: PointerEvent) => this.pointers.delete(e.pointerId);
    this.scroll.addEventListener('pointerup', release);
    this.scroll.addEventListener('pointercancel', release);
  }

  /** Distance between the first two active pointers. */
  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  show(view: MapView): void {
    this.render(view);
    this.host.open(this.modal);
    window.setTimeout(() => {
      const target = this.modal.querySelector<HTMLElement>('.node.frontier') ?? this.modal.querySelector<HTMLElement>(`.node[data-level="${view.currentLevelId}"]`);
      target?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    }, 60);
  }

  hide(): void {
    this.host.close(this.modal);
  }

  get isOpen(): boolean {
    return this.host.active === this.modal;
  }

  render(view: MapView): void {
    this.chips.innerHTML = `
      <span class="chip"><span class="gold">${ICONS.starOutline}</span>${view.stars}<small>/${TOTAL_STARS}</small></span>
      <span class="chip"><span class="gold">${ICONS.scrap}</span>${view.scrap}</span>`;

    this.mountain.style.setProperty('--zoom', String(this.zoomValue));
    this.mountain.replaceChildren(...[...view.biomes].reverse().map((biome, i) => this.biomeBand(biome, i, view.currentLevelId)));
    this.renderHighlights(view.highlights);
  }

  private biomeBand(biome: MapBiome, depthFromPeak: number, currentLevelId: string): HTMLElement {
    const palette = PALETTES[biome.id];
    const band = el('section', {
      class: `biome ${biome.unlocked ? '' : 'sealed'}`,
      'data-biome': biome.id,
      style: `--sky-a:${hsl(palette.skyTop)};--sky-b:${hsl(palette.skyHorizon)};--shoulder:${depthFromPeak}`,
    });
    const gate = biome.unlocked ? '' : `<span class="gate">${ICONS.lock}${biome.starsToGo} ${esc(t('starsToUnlock'))}</span>`;
    band.innerHTML = `<h3>${esc(biome.name)}${gate}</h3>`;

    const nodes = el('div', { class: 'nodes' });
    for (const node of biome.nodes) nodes.appendChild(this.node(node, node.id === currentLevelId));
    band.appendChild(nodes);

    if (biome.nodes.length < biome.planned) {
      band.appendChild(el('p', { class: 'soon' }, esc(t('soon'))));
    }
    return band;
  }

  private node(node: MapNode, current: boolean): HTMLButtonElement {
    const locked = node.state === 'locked';
    const pips = [0, 1, 2].map((i) => `<i class="${i < node.stars ? 'on' : ''}"></i>`).join('');
    const label = `${t('level')} ${node.index}, ${node.name}${node.stars ? `, ${node.stars}/3` : ''}`;
    const b = el(
      'button',
      {
        class: `node ${node.state} ${node.frontier ? 'frontier' : ''} ${current ? 'current' : ''}`,
        type: 'button',
        'data-nav': true,
        'data-ui': true,
        'data-level': node.id,
        'aria-label': label,
        'aria-disabled': locked ? 'true' : undefined,
        title: node.bestMs !== null ? `${esc(node.name)} · ${formatTime(node.bestMs)}` : esc(node.name),
      },
      `<span class="num">${locked ? ICONS.lock : node.index}</span><span class="pips">${pips}</span>${node.grade ? `<span class="grade-tag">${esc(node.grade)}</span>` : ''}`,
    );
    b.addEventListener('click', () => {
      if (locked) return;
      this.handlers.tick();
      this.handlers.select(node.id);
    });
    return b;
  }

  private renderHighlights(list: readonly FallHighlight[]): void {
    this.strip.classList.toggle('empty', list.length === 0);
    this.strip.replaceChildren();
    if (list.length === 0) return;
    this.strip.appendChild(el('span', { class: 'strip-title', 'data-i18n': 'bestFalls' }, t('bestFalls')));
    for (const h of list) {
      const chip = el('div', { class: 'fall-chip' }, `<b class="${['S', 'SS', 'SSS'].includes(h.grade) ? 'hi' : ''}">${esc(h.grade)}</b><span>${h.heightMeters.toFixed(1)} ${t('meters')}</span>`);
      const share = el('button', { class: 'icon-btn tiny', type: 'button', 'data-nav': true, 'data-ui': true, 'aria-label': t('share') }, ICONS.share);
      share.addEventListener('click', () => {
        this.handlers.tick();
        this.handlers.share(h);
      });
      chip.appendChild(share);
      this.strip.appendChild(chip);
    }
  }

  applyLocale(): void {
    this.modal.querySelectorAll<HTMLElement>('[data-label]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.label as 'back' | 'zoomIn' | 'zoomOut')));
  }
}
