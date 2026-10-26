import { LOCALES, TABLES, type LocaleId, type StringKey, type Table } from './strings';
import { PSEUDO_ID, pseudoTable } from './pseudo';

export type { LocaleId, StringKey } from './strings';
export { LOCALES } from './strings';
export { PSEUDO_ID, pseudoTable } from './pseudo';

export const isLocale = (value: string): value is LocaleId => (LOCALES as readonly string[]).includes(value);

/** Resolves a platform or user language tag to a supported locale, falling back to English. */
export function resolveLocale(tag: string | undefined | null): LocaleId {
  const short = (tag ?? 'en').slice(0, 2).toLowerCase();
  return isLocale(short) ? short : 'en';
}

let active: LocaleId = 'en';
/** The QA fixture table when the pseudo locale is on, null for every real locale. */
let pseudo: Table | null = null;

export const setLocale = (id: LocaleId): void => {
  active = id;
  pseudo = null;
};

export const getLocale = (): LocaleId => active;

/** The language the page should declare: the pseudo locale is a fixture, not a BCP-47 tag. */
export const pageLang = (): string => (pseudo ? 'en' : active);

/** Applies the language setting in one place: a real tag resolves, the pseudo id stretches the English table. */
export function setLanguage(tag: string): void {
  if (tag === PSEUDO_ID) {
    pseudo = pseudoTable();
    return;
  }
  setLocale(resolveLocale(tag));
}

export const isPseudo = (): boolean => pseudo !== null;

const current = (): Table => pseudo ?? TABLES[active];

export const t = (key: StringKey): string => current()[key] ?? TABLES.en[key];

/** Translates a string and fills its `{name}` placeholders. */
export const tf = (key: StringKey, params: Record<string, string | number>): string =>
  t(key).replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));

/**
 * A count in the active locale's own grouping (R-EC-12). Scrap is a fictional
 * unit, so it carries no currency sign anywhere — only its own digits. The
 * pseudo locale keeps English digits: it tests layout, not grouping.
 */
export const tn = (value: number): string => new Intl.NumberFormat(active).format(value);
