import { LOCALES, TABLES, type LocaleId, type StringKey } from './strings';

export type { LocaleId, StringKey } from './strings';
export { LOCALES } from './strings';

export const isLocale = (value: string): value is LocaleId => (LOCALES as readonly string[]).includes(value);

/** Resolves a platform or user language tag to a supported locale, falling back to English. */
export function resolveLocale(tag: string | undefined | null): LocaleId {
  const short = (tag ?? 'en').slice(0, 2).toLowerCase();
  return isLocale(short) ? short : 'en';
}

let active: LocaleId = 'en';

export const setLocale = (id: LocaleId): void => {
  active = id;
};

export const getLocale = (): LocaleId => active;

export const t = (key: StringKey): string => TABLES[active][key] ?? TABLES.en[key];

/** Translates a string and fills its `{name}` placeholders. */
export const tf = (key: StringKey, params: Record<string, string | number>): string =>
  t(key).replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
