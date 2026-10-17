import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * PRD 7.5, table 7.1: the interface moves on five tokens and nothing is hand-timed. The style
 * sheets are read as shipped: the tokens must carry the table's numbers, and every transition
 * and animation must run on a token.
 */

const read = (name: string): string => readFileSync(fileURLToPath(new URL(`../src/ui/${name}`, import.meta.url)), 'utf8');
const SHEETS = { 'style.css': read('style.css'), 'screens.css': read('screens.css'), 'coach.css': read('coach.css') };

const token = (name: string): string => {
  const match = SHEETS['style.css'].match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`style.css does not define --${name}`);
  return match[1]!.trim();
};

/** Resolves `var(--x)` chains the way the browser would, enough to read a duration and a curve. */
const resolve = (value: string): string => {
  let out = value;
  for (let i = 0; i < 5; i++) out = out.replace(/var\(--([\w-]+)\)/g, (_, name: string) => token(name));
  return out;
};

describe('the UI motion tokens (PRD table 7.1)', () => {
  it('micro is 120 ms with a standard ease-out', () => {
    expect(resolve(token('t-micro'))).toMatch(/^120ms cubic-bezier\(0\.2, ?0\.8, ?0\.3, ?1\)$/);
  });

  it('short is 220 ms with an ease-out-back that overshoots', () => {
    const curve = resolve(token('t-short')).match(/^220ms cubic-bezier\(([\d.]+), ?([\d.]+), ?([\d.]+), ?([\d.]+)\)$/);
    expect(curve).not.toBeNull();
    expect(Number(curve![2])).toBeGreaterThan(1);
  });

  it('medium is 380 ms with a quintic ease-in-out', () => {
    expect(resolve(token('t-medium'))).toMatch(/^380ms cubic-bezier\(0\.86, ?0, ?0\.14, ?1\)$/);
  });

  it('hero is 600 ms and overshoots by 1.12', () => {
    const curve = resolve(token('t-hero')).match(/^600ms cubic-bezier\(([\d.]+), ?([\d.]+), ?([\d.]+), ?([\d.]+)\)$/);
    expect(curve).not.toBeNull();
    expect(Number(curve![4])).toBeCloseTo(1.12, 2);
  });

  it('loop is a 1.8 s ease-in-out that repeats', () => {
    expect(resolve(token('t-loop'))).toBe('1.8s ease-in-out infinite');
  });
});

/** Every time a style sheet sets how long something moves, with the declaration it came from. */
function durations(css: string): Array<{ declaration: string; time: string }> {
  const found: Array<{ declaration: string; time: string }> = [];
  for (const [, property, value] of css.matchAll(/\b(transition|animation)(?:-duration)?:\s*([^;]+);/g)) {
    for (const time of value!.matchAll(/(?<![\w.-])(\d*\.?\d+m?s)\b/g)) found.push({ declaration: `${property}: ${value!.replace(/\s+/g, ' ').trim()}`, time: time[1]! });
  }
  return found;
}

/** Gesture demonstrations and a flicker are choreography with their own timing, not interface tweens. */
const CHOREOGRAPHY = /\b(chevron|ring-cycle|drag-cycle|tap-cycle|pulse-cycle|hold-cycle|key-aim|key-flip|key-hold|spark-blink)\b/;
const REDUCED_MOTION_RESET = '0.01ms';

describe('hand-timed motion', () => {
  for (const [name, css] of Object.entries(SHEETS)) {
    it(`${name} times every interface tween with a token`, () => {
      const stray = durations(css).filter(
        ({ declaration, time }) => time !== REDUCED_MOTION_RESET && time !== '0s' && !CHOREOGRAPHY.test(declaration) && !/animation-delay/.test(declaration),
      );
      expect(stray, 'durations that are not a --t-* token').toEqual([]);
    });
  }

  it('lets a hidden panel stay visible exactly as long as its fade takes', () => {
    const delays = [...SHEETS['style.css'].matchAll(/visibility 0s linear ([^,;]+)/g)].map((m) => resolve(m[1]!.trim()).split(' ')[0]);
    expect(delays.length).toBeGreaterThan(0);
    for (const delay of delays) expect(['380ms', '600ms']).toContain(delay);
  });
});
