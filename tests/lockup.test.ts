import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCKUP, LOCKUP_IDENT, LOCKUP_WORDMARK } from '@/ui/lockup';

const root = resolve(__dirname, '..');

/**
 * R-TH-08: the wordmark, ident and palette are one token set, and every brand
 * surface — store wordmark, ending card, clear-card stamp — draws from it. This
 * is the file-existence half of the gate; the render halves live with the
 * surfaces that use them (ending-screen.test.ts).
 */
describe('lockup tokens', () => {
  it('is a four-colour system: ink, two poles and the field arc', () => {
    expect(LOCKUP.ink).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(Object.values(LOCKUP)).size).toBe(4);
  });

  it('builds the ident from the tokens: horseshoe, both poles, the arc', () => {
    expect(LOCKUP_IDENT).toContain('stroke="currentColor"');
    expect(LOCKUP_IDENT).toContain(`fill="${LOCKUP.poleNorth}"`);
    expect(LOCKUP_IDENT).toContain(`fill="${LOCKUP.poleSouth}"`);
    expect(LOCKUP_IDENT).toContain(`stroke="${LOCKUP.arc}"`);
    expect(LOCKUP_IDENT).toContain('aria-hidden="true"');
  });

  it('builds the wordmark as one readable mark, not scattered letters', () => {
    expect(LOCKUP_WORDMARK).toContain('role="img"');
    expect(LOCKUP_WORDMARK).toContain('aria-label="MAGNETOPE"');
    // the magnet letters carry the pole red; the rest inherit the surface ink
    expect(LOCKUP_WORDMARK).toContain(`color:${LOCKUP.poleNorth}`);
    expect(LOCKUP_WORDMARK).toContain(LOCKUP_IDENT);
  });

  it('keeps the store wordmark on the same palette (series coherence)', () => {
    const svg = readFileSync(resolve(root, 'src/ui/wordmark.svg'), 'utf8');
    for (const value of Object.values(LOCKUP)) expect(svg).toContain(value);
  });
});
