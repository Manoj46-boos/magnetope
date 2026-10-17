import type { FieldLook, SkinLook } from '@/config/cosmetics';

const svg = (body: string, size = 24, viewBox = '0 0 24 24'): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  restart: svg('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>'),
  next: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  sound: svg('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: svg('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
  music: svg('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="16.5" cy="16" r="2.5" fill="currentColor"/>'),
  video: svg('<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3" fill="currentColor"/>'),
  assist: svg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="2 3.5"/>'),
  motion: svg('<path d="M3 12c3-6 6-6 9 0s6 6 9 0"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>'),
  star: svg('<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" fill="currentColor"/>', 28),
  starOutline: svg('<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/>', 28),
  scrap: svg('<path d="M5 8l5-3 6 2 3 5-3 6-6 2-5-3z" fill="currentColor" stroke-width="1.5"/>', 22),
  map: svg('<path d="M2.5 20.5l6.5-12 4 6.5 2.5-3.5 6 9z"/><path d="M9 8.5l1.6 2.6"/>'),
  locker: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 3v18M9 8.5h.01M15 8.5h.01"/>'),
  share: svg('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13.5V20h14v-6.5"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  keyboard: svg('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9"/>'),
  sliders: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  ghost: svg('<path d="M6 20.5V11a6 6 0 0 1 12 0v9.5l-3-2-3 2-3-2z"/><circle cx="10" cy="11" r="1" fill="currentColor"/><circle cx="14" cy="11" r="1" fill="currentColor"/>'),
} as const;

/** MAGNO in a skin's colours, for the locker grid. Same shapes as the loading mark. */
export const magnoPreview = (look: SkinLook): string => `<svg class="magno-prev" viewBox="0 0 120 130" aria-hidden="true">
  <g transform="rotate(-10 60 78)">
    ${look.accessory === 'flag' ? `<path d="M96 70V28" stroke="${look.ring}" stroke-width="3"/><path d="M96 28l16 7-16 7z" fill="${look.tip}"/>` : ''}
    <ellipse cx="60" cy="82" rx="26" ry="33" fill="${look.body}"/>
    <ellipse cx="60" cy="76" rx="13" ry="12" fill="${look.socket}"/>
    <circle cx="60" cy="76" r="7.5" fill="#f7f4ee"/><circle cx="61.5" cy="76.5" r="3.2" fill="#0c1118"/>
    ${look.accessory === 'sticker' ? `<path d="M40 104l4-7 4 7-7-4.5h8.5z" fill="${look.tip}"/>` : ''}
    <path d="M36 40a24 24 0 0 1 48 0" stroke="${look.ring}" stroke-width="13" fill="none"/>
    <rect x="29" y="40" width="14" height="15" fill="${look.ring}"/><rect x="77" y="40" width="14" height="15" fill="${look.ring}"/>
    <rect x="29" y="51" width="14" height="8" fill="${look.tip}"/><rect x="77" y="51" width="14" height="8" fill="${look.tip}"/>
    ${look.accessory === 'antenna' ? `<path d="M60 16V4" stroke="${look.ring}" stroke-width="3"/><circle cx="60" cy="4" r="4.5" fill="${look.tip}"/>` : ''}
    <path d="M30 92c-9 6-12 15-9 21M90 92c9 6 12 15 9 21" stroke="${look.ring}" stroke-width="5" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;

/** Attract loops converge on the left, repel loops fan out on the right: the two states differ by shape as well as colour. */
export const fieldPreview = (look: FieldLook): string => `<svg class="field-prev" viewBox="0 0 160 100" aria-hidden="true" fill="none" stroke-linecap="round">
  <g stroke="${look.attract}" stroke-width="4"><path d="M10 50c14-34 46-34 56 0"/><path d="M10 50c14 34 46 34 56 0"/><path d="M22 50c8-16 28-16 34 0" stroke="${look.attractCore}" stroke-width="3"/></g>
  <g stroke="${look.repel}" stroke-width="4"><path d="M94 50c10-40 52-40 62-8"/><path d="M94 50c10 40 52 40 62 8"/><path d="M104 50c6-18 30-20 40-6" stroke="${look.repelCore}" stroke-width="3"/></g>
  <circle cx="80" cy="50" r="5" fill="#fff" stroke="none" opacity=".9"/>
</svg>`;

/** Ghost hand for the gestural tutorial: a pointing finger, drawn once and animated with CSS. */
export const HAND = `<svg class="hand-glyph" viewBox="0 0 64 80" aria-hidden="true">
  <path d="M26 6c0-3.3 2.7-6 6-6s6 2.7 6 6v28l4-1.2c3.3-1 6.6 1 7.4 4.3l1.8 8.6c1.4 6.8-.4 13.7-4.9 18.9L44 76H22l-8.5-14.4c-1.4-2.4-1.1-5.3.7-7.4 2-2.3 5.3-2.7 7.7-1L26 55.4z" fill="#fff" stroke="rgba(10,14,22,.45)" stroke-width="2.4" stroke-linejoin="round"/>
</svg>`;

/** MAGNO mid-flip, used by the loading screen: horseshoe head, body, one eye. */
export const MAGNO_SILHOUETTE = `<svg class="magno-flip" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
  <g transform="rotate(-14 60 70)">
    <ellipse cx="60" cy="78" rx="22" ry="28" fill="#cfd6df"/>
    <ellipse cx="60" cy="72" rx="11" ry="10" fill="#10161f"/>
    <circle cx="60" cy="72" r="6" fill="#f7f4ee"/>
    <circle cx="61.5" cy="72.5" r="2.6" fill="#0c1118"/>
    <path d="M38 38a22 22 0 0 1 44 0" stroke="#e9edf2" stroke-width="12" fill="none" stroke-linecap="butt"/>
    <rect x="32" y="38" width="12" height="14" fill="#e9edf2"/><rect x="76" y="38" width="12" height="14" fill="#e9edf2"/>
    <rect x="32" y="48" width="12" height="7" fill="#e5484d"/><rect x="76" y="48" width="12" height="7" fill="#e5484d"/>
    <path d="M26 86c-8 6-11 14-8 20M94 86c8 6 11 14 8 20" stroke="#cfd6df" stroke-width="5" fill="none" stroke-linecap="round"/>
  </g>
  <path class="spark" d="M12 30l10 4M108 24l-10 6M100 100l10 6" stroke="#5fd4ff" stroke-width="3" stroke-linecap="round"/>
</svg>`;

export const STUDIO_MARK = `<svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true"><path d="M10 8v16a14 14 0 0 0 28 0V8" stroke="#ffb347" stroke-width="7" fill="none"/><rect x="6.5" y="6" width="7" height="9" fill="#e5484d"/><rect x="34.5" y="6" width="7" height="9" fill="#e5484d"/></svg>`;
