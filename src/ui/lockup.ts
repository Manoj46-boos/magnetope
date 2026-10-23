/**
 * The MAGNETOPE lockup (PRD 17.3, R-TH-08): wordmark, ident and palette as one
 * token set, reused verbatim on the ending title card, the clear-card corner
 * stamp and the store page (src/ui/wordmark.svg renders from the same values),
 * so every surface speaks the same brand. The store card itself stays
 * text-free (R-TH-02); the lockup lives on the surfaces around it.
 */

export const LOCKUP = {
  ink: '#0a0a0a',
  poleNorth: '#e53935',
  poleSouth: '#1e88e5',
  arc: '#00e5ff',
} as const;

/** The ident: the horseshoe magnet under its field-line arc, the game's signature as one glyph. */
export const LOCKUP_IDENT = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <path d="M14 20 V34 A18 18 0 0 0 50 34 V20" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>
  <rect x="8.5" y="12" width="11" height="11" rx="2.5" fill="${LOCKUP.poleNorth}"/>
  <rect x="44.5" y="12" width="11" height="11" rx="2.5" fill="${LOCKUP.poleSouth}"/>
  <path d="M10 10 Q32 -2 54 10" fill="none" stroke="${LOCKUP.arc}" stroke-width="4.5" stroke-linecap="round" opacity="0.85"/>
</svg>`;

/**
 * The wordmark as markup: the magnet letters (M, O, T) carry the pole red, the O
 * is the horseshoe itself, and the rest stay ink — the same treatment
 * wordmark.svg draws for the store page.
 */
export const LOCKUP_WORDMARK = `<span class="lockup" role="img" aria-label="MAGNETOPE"><span style="color:${LOCKUP.poleNorth}">M</span>AGNE<span style="color:${LOCKUP.poleNorth}">T</span><span class="lockup-o" aria-hidden="true">${LOCKUP_IDENT}</span>PE</span>`;
