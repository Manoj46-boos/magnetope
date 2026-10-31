// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BIOME_NAMES, BIOME_TAGLINES, biomeAnnouncement } from '@/game/progress';
import { LOCALES, TABLES } from '@/locale/strings';
import { BiomeBanner } from '@/ui/banner';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('biome title card', () => {
  const make = () => new BiomeBanner(document.body);

  it('announces the biome and its promise, then gets out of the way on its own', () => {
    const banner = make();
    banner.show('Suburbia', 'Bouncy lawns');
    expect(banner.visible).toBe(true);
    expect(banner.element.textContent).toContain('Suburbia');
    expect(banner.element.textContent).toContain('Bouncy lawns');
    vi.advanceTimersByTime(2500);
    expect(banner.visible).toBe(true);
    vi.advanceTimersByTime(200);
    expect(banner.visible).toBe(false);
  });

  it('restarts its timer when a second card replaces the first', () => {
    const banner = make();
    banner.show('Suburbia', 'one');
    vi.advanceTimersByTime(2000);
    banner.show('Metropolis', 'two');
    vi.advanceTimersByTime(2000);
    expect(banner.visible).toBe(true);
    expect(banner.element.textContent).toContain('Metropolis');
    expect(banner.element.textContent).not.toContain('Suburbia');
    vi.advanceTimersByTime(700);
    expect(banner.visible).toBe(false);
  });

  it('can be dismissed at once, as on a retry', () => {
    const banner = make();
    banner.show('Suburbia', 'x');
    banner.hide();
    expect(banner.visible).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(banner.visible).toBe(false);
  });

  it('is announced politely to screen readers and never takes a click', () => {
    const banner = make();
    expect(banner.element.getAttribute('role')).toBe('status');
    expect(banner.element.getAttribute('aria-live')).toBe('polite');
  });

  it('treats the text as text, not markup', () => {
    const banner = make();
    banner.show('<img src=x onerror=alert(1)>', '<b>bold</b>');
    expect(banner.element.querySelector('img')).toBeNull();
    expect(banner.element.querySelectorAll('b')).toHaveLength(1);
  });

  it('carries the wordmark itself on a fresh save\'s boot card (P-FT-02)', () => {
    const banner = make();
    banner.showWordmark('A game by Magnetope Studio');
    expect(banner.visible).toBe(true);
    // the lockup is real markup: the magnet letters, the ident as the O
    expect(banner.element.querySelector('.lockup')).not.toBeNull();
    expect(banner.element.querySelectorAll('.lockup > span')).toHaveLength(3);
    expect(banner.element.querySelector('.lockup-o svg')).not.toBeNull();
    expect(banner.element.textContent).toContain('A game by Magnetope Studio');
    vi.advanceTimersByTime(2800);
    expect(banner.visible).toBe(false);
  });
});

describe('when a title card is owed', () => {
  it('opens Suburbia and Metropolis with a card, in the biome the player has just entered', () => {
    expect(biomeAnnouncement('scrapyard', 'suburbia')).toEqual({ name: BIOME_NAMES.suburbia, tagline: 'suburbiaTagline' });
    expect(biomeAnnouncement('suburbia', 'metropolis')).toEqual({ name: BIOME_NAMES.metropolis, tagline: 'metropolisTagline' });
    expect(biomeAnnouncement(null, 'suburbia')).not.toBeNull();
  });

  it('opens the Playground of Giants and the Stratosphere with their own cards', () => {
    expect(biomeAnnouncement('metropolis', 'playground')).toEqual({ name: 'Playground of Giants', tagline: 'playgroundTagline' });
    expect(biomeAnnouncement('playground', 'stratosphere')).toEqual({ name: 'Stratosphere', tagline: 'stratosphereTagline' });
  });

  it('stays quiet while the player remains in a biome, including across retries', () => {
    expect(biomeAnnouncement('suburbia', 'suburbia')).toBeNull();
    expect(biomeAnnouncement('metropolis', 'metropolis')).toBeNull();
    expect(biomeAnnouncement('playground', 'playground')).toBeNull();
    expect(biomeAnnouncement('stratosphere', 'stratosphere')).toBeNull();
  });

  it('never interrupts the opening: the Scrapyard has no card', () => {
    expect(biomeAnnouncement(null, 'scrapyard')).toBeNull();
    expect(biomeAnnouncement('suburbia', 'scrapyard')).toBeNull();
  });

  it('has a taglines translated into every locale for every biome that shows a card', () => {
    for (const key of Object.values(BIOME_TAGLINES)) {
      for (const locale of LOCALES) expect(TABLES[locale][key!].trim().length, `${locale} ${key}`).toBeGreaterThan(8);
    }
  });
});
