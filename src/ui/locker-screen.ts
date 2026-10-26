import { COSMETICS, cosmeticsOfKind, spotlightOf, type Cosmetic, type CosmeticKind, type Requirement } from '@/config/cosmetics';
import { canWatchToUnlock, cosmeticStatus, setProgress, type ItemStatus } from '@/game/locker';
import { levelById } from '@/levels';
import { t, tf, tn, type StringKey } from '@/locale';
import type { SaveData } from '@/platform/storage';
import { el, esc } from './dom';
import { ICONS, fieldPreview, magnoPreview } from './icons';
import type { ModalHost } from './modal-host';
import type { BiomeId } from '@/sim/types';

export interface LockerHandlers {
  equip(id: string): void;
  buy(id: string): void;
  watch(id: string): void;
  claim(id: string): void;
  back(): void;
  tick(): void;
}

export interface LockerView {
  save: SaveData;
  today: Date;
}

const TABS: ReadonlyArray<{ kind: CosmeticKind; label: StringKey }> = [
  { kind: 'skin', label: 'skins' },
  { kind: 'field', label: 'fieldLines' },
];

/** R-EC-05: each set wears its biome's name. */
const SET_NAME_KEYS: Readonly<Record<BiomeId, StringKey>> = {
  scrapyard: 'setScrapyard',
  suburbia: 'setSuburbia',
  metropolis: 'setMetropolis',
  playground: 'setPlayground',
  stratosphere: 'setStratosphere',
};

/** Plain-language requirement for a reward-path item, e.g. "15 stars". */
export function describeRequirement(requirement: Requirement): string {
  switch (requirement.type) {
    case 'stars':
      return tf('reqStars', { n: requirement.count });
    case 'clears':
      return tf('reqClears', { n: requirement.count });
    case 'perfect':
      return tf('reqPerfect', { n: requirement.count });
    case 'grade':
      return tf('reqGrade', { g: requirement.atLeast });
    case 'level': {
      const index = safeLevelIndex(requirement.id);
      return tf('reqLevel', { n: index });
    }
  }
}

function safeLevelIndex(id: string): number {
  try {
    return levelById(id).index;
  } catch {
    return 0;
  }
}

/** The cosmetic locker: skins and field-line colours, bought with Scrap, earned, or unlocked by a rewarded video. */
export class LockerScreen {
  readonly modal: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly chips: HTMLElement;
  private readonly sets: HTMLElement;
  private readonly tabButtons = new Map<CosmeticKind, HTMLButtonElement>();
  private tab: CosmeticKind = 'skin';
  private view: LockerView | null = null;

  constructor(
    parent: HTMLElement,
    private readonly host: ModalHost,
    private readonly handlers: LockerHandlers,
  ) {
    this.modal = el('div', { class: 'layer modal screen', 'data-ui': true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'locker-title' });
    const frame = el('div', { class: 'locker-frame' });

    const head = el('header', { class: 'screen-head' });
    const back = el('button', { class: 'icon-btn small', type: 'button', 'data-nav': true, 'data-autofocus': true, 'data-ui': true, 'data-label': 'back', 'aria-label': t('back') }, ICONS.back);
    back.addEventListener('click', () => {
      this.handlers.tick();
      this.handlers.back();
    });
    const title = el('h2', { id: 'locker-title', 'data-i18n': 'locker' }, t('locker'));
    this.chips = el('div', { class: 'chips' });
    head.append(back, title, this.chips);

    const tabs = el('div', { class: 'tabs', role: 'tablist' });
    for (const { kind, label } of TABS) {
      const b = el('button', { class: 'tab', type: 'button', role: 'tab', 'data-nav': true, 'data-ui': true, 'data-i18n': label }, esc(t(label)));
      b.addEventListener('click', () => {
        this.handlers.tick();
        this.tab = kind;
        this.refresh();
      });
      this.tabButtons.set(kind, b);
      tabs.appendChild(b);
    }

    this.grid = el('div', { class: 'locker-grid', role: 'list' });
    this.sets = el('div', { class: 'sets', role: 'list' });
    frame.append(head, tabs, this.sets, this.grid);
    this.modal.appendChild(frame);
    parent.appendChild(this.modal);
  }

  show(view: LockerView): void {
    this.view = view;
    this.refresh();
    this.host.open(this.modal);
  }

  hide(): void {
    this.host.close(this.modal);
  }

  get isOpen(): boolean {
    return this.host.active === this.modal;
  }

  /** Re-renders against fresh save data after an equip, purchase or unlock. */
  update(view: LockerView): void {
    this.view = view;
    this.refresh();
  }

  /** The week’s unclaimed spotlight look greets the front of its tab, not the bottom of the pile. */
  private ordered(kind: CosmeticKind, view: LockerView): Array<Cosmetic> {
    const spotlight = spotlightOf(view.today);
    const pinned = spotlight.kind === kind && !view.save.owned.includes(spotlight.id) ? [spotlight] : [];
    return [...pinned, ...cosmeticsOfKind(kind).filter((item) => item.id !== spotlight.id)];
  }

  private refresh(): void {
    const view = this.view;
    if (!view) return;
    const focusedId = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-item]')?.dataset.item;

    const owned = view.save.owned.length;
    this.chips.innerHTML = `<span class="chip"><span class="gold">${ICONS.scrap}</span>${tn(view.save.scrap)}</span><span class="chip" title="${esc(t('collection'))}">${t('collection')} ${tn(owned)}<small>/${tn(COSMETICS.length)}</small></span>`;
    for (const [kind, button] of this.tabButtons) button.setAttribute('aria-selected', String(kind === this.tab));
    this.renderSets(view.save);
    this.grid.replaceChildren(...this.ordered(this.tab, view).map((item) => this.card(item, view)));

    if (focusedId) this.grid.querySelector<HTMLElement>(`[data-item="${focusedId}"] [data-nav]`)?.focus({ preventScroll: true });
  }

  /** R-EC-05: the five sets and how full each one is — the collection's completion, set by set. */
  private renderSets(save: SaveData): void {
    this.sets.replaceChildren(
      ...setProgress(save).map(({ set, have, need, complete }) =>
        el(
          'span',
          { class: `set-chip ${complete ? 'complete' : ''}`, role: 'listitem' },
          `${complete ? ICONS.check : ''}${esc(t(SET_NAME_KEYS[set.biome]))} ${tn(have)}/${tn(need)}`,
        ),
      ),
    );
  }

  private card(item: Cosmetic, view: LockerView): HTMLElement {
    const status = cosmeticStatus(view.save, item, view.today);
    const preview = item.kind === 'skin' ? magnoPreview(item.look) : fieldPreview(item.look);
    const card = el('article', { class: `card ${status.state}`, role: 'listitem', 'data-item': item.id });
    card.innerHTML = `<div class="preview">${preview}</div><h4>${esc(item.name)}</h4>${status.state === 'spotlight' ? `<span class="spotlight-tag">${esc(t('spotlightFree'))}</span>` : ''}`;
    card.appendChild(this.footer(item, status, view));
    return card;
  }

  private footer(item: Cosmetic, status: ItemStatus, view: LockerView): HTMLElement {
    const foot = el('div', { class: 'foot' });
    switch (status.state) {
      case 'equipped':
        foot.appendChild(el('span', { class: 'state ok' }, `${ICONS.check}${esc(t('equipped'))}`));
        break;
      case 'owned':
        foot.appendChild(this.action('equip', 'btn compact primary', () => this.handlers.equip(item.id)));
        break;
      case 'buyable': {
        const price = el(
          'button',
          { class: `btn compact ${status.affordable ? 'primary' : 'dim'}`, type: 'button', 'data-nav': true, 'data-ui': true, 'aria-label': `${t('unlock')} ${status.price} ${t('scrap')}` },
          `<span class="gold">${ICONS.scrap}</span>${status.price}`,
        );
        price.addEventListener('click', () => {
          this.handlers.tick();
          this.handlers.buy(item.id);
        });
        foot.appendChild(price);
        if (canWatchToUnlock(view.save, item, view.today)) {
          const watch = el('button', { class: 'icon-btn small', type: 'button', 'data-nav': true, 'data-ui': true, 'aria-label': t('watchToUnlock') }, ICONS.video);
          watch.addEventListener('click', () => {
            this.handlers.tick();
            this.handlers.watch(item.id);
          });
          foot.appendChild(watch);
        }
        break;
      }
      case 'earnable': {
        const { have, need, requirement } = status.progress;
        foot.innerHTML = `<span class="state">${ICONS.lock}${esc(describeRequirement(requirement))}</span><span class="meter"><i style="width:${Math.round((have / need) * 100)}%"></i></span>`;
        break;
      }
      case 'spotlight': {
        const claim = el(
          'button',
          { class: 'btn compact primary', type: 'button', 'data-nav': true, 'data-ui': true, 'aria-label': `${t('unlock')} ${t('spotlightFree')}` },
          esc(t('spotlightFree')),
        );
        claim.addEventListener('click', () => {
          this.handlers.tick();
          this.handlers.claim(item.id);
        });
        foot.appendChild(claim);
        break;
      }
      case 'offseason':
        foot.appendChild(el('span', { class: 'state' }, `${ICONS.lock}${esc(tf('seasonal', { s: t(status.season) }))}`));
        break;
    }
    return foot;
  }

  private action(label: StringKey, cls: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', { class: cls, type: 'button', 'data-nav': true, 'data-ui': true }, esc(t(label)));
    b.addEventListener('click', () => {
      this.handlers.tick();
      onClick();
    });
    return b;
  }

  applyLocale(): void {
    this.refresh();
  }
}