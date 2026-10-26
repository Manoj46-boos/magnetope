import { TABLES, type StringKey, type Table } from './strings';

/** The id the language menu and the page code read for the pseudo locale. */
export const PSEUDO_ID = 'pseudo';

/** The growth factor every string is stretched to, at minimum (R-LO-04: 1.4x, brackets, diacritics). */
export const PSEUDO_GROWTH = 1.4;

/**
 * Diacritics already drawn by the shipped tables, so the pseudo locale can
 * never ask the font for a glyph no real translation uses (the font sweep
 * holds it to the same law).
 */
const ACCENTS: Record<string, string> = {
  a: 'á',
  e: 'é',
  i: 'í',
  o: 'ó',
  u: 'ú',
  n: 'ñ',
  c: 'ç',
  s: 'ş',
  g: 'ğ',
};

/** Wears the shipped diacritics on every letter that carries one. */
const accented = (text: string): string => text.replace(/[aegincosu]/g, (ch) => ACCENTS[ch] ?? ch);

/** Stretches one plain segment by repeating its own words, whitespace and all, so line breaks stay realistic. */
const stretch = (segment: string): string => {
  const target = Math.ceil(segment.length * PSEUDO_GROWTH);
  const tokens = segment.split(/(\s+)/).filter((t) => t !== '');
  if (tokens.length === 0) return segment;
  const grown = [...tokens];
  for (let i = 0; grown.join('').length < target; i = (i + 1) % tokens.length) grown.push(tokens[i]!);
  return grown.join('');
};

/**
 * The pseudo locale: the English table as a QA fixture. Each string keeps its
 * `{placeholders}` untouched (formatting must still work), stretches to at
 * least 1.4x by repeating whole words rather than growing one runaway token,
 * wears the diacritics the real tables ship, and sits in brackets so a
 * truncated string is visible at a glance. A screen that fits this fits the
 * longest honest translation with the fit law's headroom to spare.
 */
export function pseudoTable(source: Table = TABLES.en): Table {
  const out = {} as Table;
  for (const key of Object.keys(source) as StringKey[]) {
    const original = source[key]!;
    // The whole string grows past 1.4x, brackets included: the fit law's
    // headroom is measured on what the screen actually holds.
    const needed = Math.ceil(original.length * PSEUDO_GROWTH) + 2;
    const parts = original.split(/(\{\w+\})/).map((part) => (part.startsWith('{') ? part : accented(stretch(part))));
    const pad = original.replace(/\{\w+\}/g, '').trim() || 'pseudo';
    while (parts.join('').length < needed) parts.push(accented(stretch(pad)));
    out[key] = `[${parts.join('')}]`;
  }
  return out;
}
