import type { ExchangeView, ImportOutcome } from '@/game/ghost-exchange';
import { formatTime } from '@/game/progress';
import { t, tf, type StringKey } from '@/locale';
import { MAX_NAME_LENGTH } from '@/sim/ghost-code';
import { el, esc } from './dom';
import { ICONS } from './icons';
import type { ModalHost } from './modal-host';

export interface ExchangeHandlers {
  /** The player's ghost for this level as a code, or null when there is none. */
  exportCode(alias: string): Promise<string | null>;
  importCode(code: string): Promise<ImportOutcome>;
  removeFriend(): void;
  back(): void;
  tick(): void;
}

type ClipboardLike = Pick<Clipboard, 'writeText'> | undefined;

/**
 * Where ghosts change hands (PRD 5.5, 15.3). A player copies their own ghost as
 * a text code to send to a friend, and pastes a friend's code to race it. The
 * exchange is text only: nothing leaves the page.
 */
export class GhostExchangeScreen {
  readonly modal: HTMLElement;
  private readonly title: HTMLElement;
  private readonly mine: HTMLElement;
  private readonly theirs: HTMLElement;
  private readonly paste: HTMLTextAreaElement;
  private readonly status: HTMLElement;
  private view: ExchangeView | null = null;
  private outCode: HTMLTextAreaElement | null = null;
  private note: { key: StringKey; params?: Record<string, string> } | null = null;

  constructor(
    parent: HTMLElement,
    private readonly host: ModalHost,
    private readonly handlers: ExchangeHandlers,
    private readonly clipboard: () => ClipboardLike = () => navigator.clipboard,
  ) {
    this.modal = el('div', { class: 'layer modal', 'data-ui': true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'exchange-title' });
    const panel = el('div', { class: 'panel exchange' });

    const head = el('header', { class: 'exchange-head' });
    const back = el('button', { class: 'icon-btn small', type: 'button', 'data-nav': true, 'data-autofocus': true, 'data-ui': true, 'aria-label': t('back') }, ICONS.back);
    back.addEventListener('click', () => {
      this.handlers.tick();
      this.handlers.back();
    });
    this.title = el('h2', { id: 'exchange-title' });
    head.append(back, this.title);

    this.mine = el('section', { class: 'exchange-block' });
    this.theirs = el('section', { class: 'exchange-block' });

    this.paste = el('textarea', {
      class: 'code-field',
      rows: 3,
      spellcheck: false,
      autocomplete: 'off',
      autocapitalize: 'off',
      'data-nav': true,
      'data-ui': true,
      'aria-label': t('pasteCode'),
      placeholder: t('pasteCode'),
    });
    const add = el('button', { class: 'btn compact primary', type: 'button', 'data-nav': true, 'data-ui': true }, esc(t('addGhost')));
    add.dataset.i18n = 'addGhost';
    add.addEventListener('click', () => void this.submit());
    this.status = el('p', { class: 'exchange-status', role: 'status', 'aria-live': 'polite' });

    const importer = el('div', { class: 'exchange-import' });
    importer.append(this.paste, add);
    panel.append(head, this.mine, this.theirs, importer, this.status);
    this.modal.appendChild(panel);
    parent.appendChild(this.modal);
  }

  show(view: ExchangeView): void {
    this.view = view;
    this.outCode = null;
    this.note = null;
    this.paste.value = '';
    this.render();
    this.host.open(this.modal);
  }

  hide(): void {
    this.host.close(this.modal);
  }

  get isOpen(): boolean {
    return this.host.active === this.modal;
  }

  /** Refreshes after the friend ghost changed without closing the screen. */
  update(view: ExchangeView): void {
    this.view = view;
    this.render();
  }

  applyLocale(): void {
    if (this.view) this.render();
  }

  private render(): void {
    const view = this.view;
    if (!view) return;
    this.title.textContent = t('ghostExchange');
    this.paste.placeholder = t('pasteCode');
    this.paste.setAttribute('aria-label', t('pasteCode'));
    this.modal.querySelectorAll<HTMLElement>('[data-i18n]').forEach((n) => (n.textContent = t(n.dataset.i18n as StringKey)));
    this.renderMine(view);
    this.renderTheirs(view);
    this.status.textContent = this.note ? tf(this.note.key, this.note.params ?? {}) : '';
  }

  private renderMine(view: ExchangeView): void {
    const heading = `<h3><span class="swatch mine"></span>${esc(t('yourGhost'))}${view.personalMs !== null ? `<b>${formatTime(view.personalMs)}</b>` : ''}</h3>`;
    this.mine.innerHTML = heading;
    if (view.personalMs === null) {
      this.mine.appendChild(el('p', { class: 'hint' }, esc(t('ghostNeedsPar'))));
      return;
    }
    const alias = el('input', {
      class: 'name-field',
      type: 'text',
      maxlength: MAX_NAME_LENGTH,
      value: view.alias,
      'data-nav': true,
      'data-ui': true,
      'aria-label': t('yourName'),
      placeholder: t('yourName'),
      autocomplete: 'off',
    });
    const copy = el('button', { class: 'btn compact', type: 'button', 'data-nav': true, 'data-ui': true }, `${ICONS.share}<span>${esc(t('copyCode'))}</span>`);
    copy.addEventListener('click', () => void this.copy(alias.value));
    const row = el('div', { class: 'exchange-row' });
    row.append(alias, copy);
    this.mine.appendChild(row);
    if (this.outCode) this.mine.appendChild(this.outCode);
  }

  private renderTheirs(view: ExchangeView): void {
    this.theirs.innerHTML = `<h3><span class="swatch friend"></span>${esc(t('friendGhost'))}</h3>`;
    if (!view.friend) {
      this.theirs.appendChild(el('p', { class: 'hint' }, esc(t('ghostNone'))));
      return;
    }
    const row = el('div', { class: 'exchange-row' });
    row.appendChild(el('span', { class: 'friend-line' }, `${esc(view.friend.name)} <b>${formatTime(view.friend.durationMs)}</b>`));
    const remove = el('button', { class: 'btn compact dim', type: 'button', 'data-nav': true, 'data-ui': true }, esc(t('removeGhost')));
    remove.addEventListener('click', () => {
      this.handlers.tick();
      this.handlers.removeFriend();
    });
    row.appendChild(remove);
    this.theirs.appendChild(row);
  }

  private async copy(alias: string): Promise<void> {
    this.handlers.tick();
    const code = await this.handlers.exportCode(alias);
    if (!code) return;
    const field = this.outCode ?? el('textarea', { class: 'code-field', rows: 3, readonly: true, spellcheck: false, 'data-ui': true, 'aria-label': t('yourGhost') });
    field.value = code;
    this.outCode = field;
    if (!field.isConnected) this.mine.appendChild(field);

    let copied = false;
    try {
      await this.clipboard()?.writeText(code);
      copied = true;
    } catch {
      copied = false;
    }
    if (!copied) {
      field.focus({ preventScroll: true });
      field.select();
    }
    this.say(copied ? 'codeCopied' : 'codeSelect');
  }

  private async submit(): Promise<void> {
    this.handlers.tick();
    const code = this.paste.value.trim();
    if (!code) return;
    const outcome = await this.handlers.importCode(code);
    if (outcome.ok) {
      this.paste.value = '';
      this.say('ghostAdded', { n: outcome.name, l: outcome.level });
    } else {
      this.say(outcome.message);
    }
  }

  private say(key: StringKey, params?: Record<string, string>): void {
    this.note = { key, params };
    this.status.textContent = tf(key, params ?? {});
  }
}
