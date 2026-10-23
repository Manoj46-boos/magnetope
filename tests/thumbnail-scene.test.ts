import { describe, expect, it } from 'vitest';
import { prop } from '@/levels/author';
import {
  CARD_SKY,
  IDENT_CATCH_MS,
  IDENT_HOOK_MS,
  IDENT_MS,
  THUMBNAIL_VARIANTS,
  ThumbnailStage,
  cardDressProp,
  thumbnailLevel,
  thumbnailSubjectBox,
  thumbnailVariant,
  type ThumbnailVariant,
} from '@/render/thumbnail-scene';

const FRAME = 1000 / 60;

/** Runs the ident from phase 0 to `ms`, collecting every frame so latch beats (flash, blink) are observed on the exact step that fired them. */
function identRun(ms: number) {
  const stage = new ThumbnailStage('hero-launch', true);
  const frames = [stage.step(0)];
  for (let t = FRAME; t <= ms; t += FRAME) frames.push(stage.step(FRAME));
  return frames.map((frame, i) => ({ frame, phase: i * FRAME }));
}

const firstAt = (frames: ReturnType<typeof identRun>, when: (frame: ReturnType<ThumbnailStage['step']>) => boolean) =>
  frames.find(({ frame }) => when(frame));

/** The subject box's centre in card UV, the number the legibility audit is derived from. */
const centre = (variant: ThumbnailVariant) => {
  const box = thumbnailSubjectBox(variant);
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
};

describe('the variant registry', () => {
  it('names the three scored cards and nothing else', () => {
    expect(THUMBNAIL_VARIANTS).toEqual(['hero-launch', 'fall-comedy', 'tower-scale']);
    for (const id of THUMBNAIL_VARIANTS) expect(thumbnailVariant(id)).toBe(id);
    expect(thumbnailVariant('scrapyard-04')).toBeNull();
    expect(thumbnailVariant('')).toBeNull();
  });

  it('dresses every card with a real level, never an invented world (R-TH-03)', () => {
    for (const variant of THUMBNAIL_VARIANTS) expect(thumbnailLevel(variant)).toBe('scrapyard-04');
  });
});

describe('the card compositions (R-TH-01)', () => {
  it('sits the hero low and left, where the eye enters the frame', () => {
    const hero = centre('hero-launch');
    expect(hero.x).toBeLessThan(0.45);
    expect(hero.y).toBeGreaterThan(0.55);
  });

  it('fills a third of the hero card with MAGNO, the 200 ms read', () => {
    const { w } = thumbnailSubjectBox('hero-launch');
    expect(w).toBeGreaterThan(0.28);
    expect(w).toBeLessThan(0.4);
  });

  it('keeps the fall card on the same corner so the pair reads as one brand', () => {
    const fall = centre('fall-comedy');
    expect(fall.x).toBeLessThan(0.45);
    expect(fall.y).toBeGreaterThan(0.4);
  });

  it('puts the ambience card on the climb itself, subject small and high', () => {
    const tower = thumbnailSubjectBox('tower-scale');
    const at = { x: tower.x + tower.w / 2, y: tower.y + tower.h / 2 };
    expect(at.x).toBeGreaterThan(0.5);
    expect(at.y).toBeLessThan(0.35);
    expect(tower.w).toBeLessThan(0.15);
  });

  it('grades a dusk sky: burnt horizon, deep teal zenith, no Poki-green lightness', () => {
    expect(CARD_SKY.horizon.h).toBeGreaterThanOrEqual(15);
    expect(CARD_SKY.horizon.h).toBeLessThanOrEqual(45);
    expect(CARD_SKY.top.h).toBeGreaterThanOrEqual(190);
    expect(CARD_SKY.top.h).toBeLessThanOrEqual(230);
    // the hue-collision rule fires on light, saturated greens; a dusk sky never enters that band
    for (const band of [CARD_SKY.top, CARD_SKY.horizon, CARD_SKY.sun]) expect(band.l).toBeLessThan(45);
  });
});

describe('the static cards hold their pose', () => {
  it('returns the same frame no matter how long the stage runs', () => {
    const stage = new ThumbnailStage('hero-launch');
    const first = stage.step(0);
    for (let i = 0; i < 300; i++) stage.step(FRAME);
    const held = stage.step(0);
    expect(held.view.position).toEqual(first.view.position);
    expect(held.view.velocity).toEqual(first.view.velocity);
    expect(held.flash).toBe(0);
    expect(held.blink).toBe(false);
  });

  it('arms the hero on a live beam and the blooper on a repel', () => {
    expect(new ThumbnailStage('hero-launch').step(0).view.snapEngaged).toBe(true);
    expect(new ThumbnailStage('fall-comedy').step(0).view.polarity).toBe('repel');
    expect(new ThumbnailStage('tower-scale').step(0).view.snapEngaged).toBe(true);
  });

  it('stages the hero at joy, the falls and the wide card dead straight', () => {
    expect(new ThumbnailStage('hero-launch').step(0).joy).toBeGreaterThan(0);
    expect(new ThumbnailStage('fall-comedy').step(0).joy).toBe(0);
    expect(new ThumbnailStage('tower-scale').step(0).joy).toBe(0);
  });

  it('never plays the ident timeline outside the hero composition', () => {
    const stage = new ThumbnailStage('fall-comedy', true);
    let frame = stage.step(0);
    for (let t = FRAME; t <= IDENT_CATCH_MS + 800; t += FRAME) frame = stage.step(FRAME);
    expect(frame.view.state).not.toBe('attached');
    expect(frame.flash).toBe(0);
    expect(frame.view.position).toEqual(new ThumbnailStage('fall-comedy').step(0).view.position);
  });
});

describe('the ident timeline (R-TH-10)', () => {
  it('starts off-frame: the flip-in enters from below and left, unarmed', () => {
    const first = new ThumbnailStage('hero-launch', true).step(0);
    const settled = new ThumbnailStage('hero-launch').step(0);
    expect(first.view.position.x).toBeLessThan(settled.view.position.x);
    expect(first.view.position.y).toBeLessThan(settled.view.position.y);
    expect(first.view.snapArmed).toBe(false);
    expect(first.flash).toBe(0);
  });

  it('lands the hook inside half a second, within a frame of the mark, and arms the beam', () => {
    const frames = identRun(IDENT_HOOK_MS + 3 * FRAME);
    const armed = firstAt(frames, (frame) => frame.view.snapArmed)!;
    expect(armed.phase).toBeLessThanOrEqual(IDENT_HOOK_MS + FRAME);
    expect(frames[29]!.frame.view.position.x).toBeCloseTo(armed.frame.view.position.x, 1);
  });

  it('flashes the catch exactly once, on the frame the beam engages', () => {
    const frames = identRun(IDENT_MS);
    const engaged = firstAt(frames, (frame) => frame.view.snapEngaged)!;
    expect(engaged.frame.flash).toBe(1);
    expect(engaged.phase).toBeLessThanOrEqual(IDENT_HOOK_MS + 620 + FRAME);
    expect(frames.filter(({ frame }) => frame.flash > 0)).toHaveLength(1);
  });

  it('settles into the catch attached, joy on, no drift after the loop point', () => {
    const frames = identRun(IDENT_MS + 2000);
    const settled = firstAt(frames, (frame) => frame.view.state === 'attached')!;
    expect(settled.phase).toBeLessThanOrEqual(IDENT_CATCH_MS + FRAME);
    expect(settled.frame.view.velocity).toEqual({ x: 0, y: 0 });
    expect(settled.frame.view.attachNormal).not.toBeNull();
    expect(settled.frame.joy).toBe(1);
    const loop = frames.find(({ phase }) => phase >= IDENT_MS)!;
    const past = frames.at(-1)!;
    expect(past.frame.view.position).toEqual(loop.frame.view.position);
    expect(past.frame.view.state).toBe('attached');
    expect(past.frame.joy).toBe(1);
  });

  it('blinks once before the loop and never again', () => {
    const frames = identRun(IDENT_MS + 600);
    const blinks = frames.filter(({ frame }) => frame.blink);
    expect(blinks).toHaveLength(1);
    expect(blinks[0]!.phase).toBeGreaterThanOrEqual(IDENT_CATCH_MS + 560);
    expect(blinks[0]!.phase).toBeLessThan(IDENT_CATCH_MS + 700 + FRAME);
  });
});

describe('staged dress props', () => {
  it('builds box props at their overridden size with no physics behind them', () => {
    const built = cardDressProp(prop.crate(0.95, 15.7, { w: 1.9, h: 1.6 }), 0);
    expect(built.width).toBe(1.9);
    expect(built.height).toBe(1.6);
    expect(built.radius).toBe(0);
    expect(built.colliderHandle).toBe(-1);
    expect(built.bodyHandle).toBe(-1);
    expect(built.dynamic).toBe(false);
    expect(built.moving).toBe(false);
  });

  it('builds disc props as their doubled radius', () => {
    const built = cardDressProp(prop.barrel(1.85, 15.45), 1);
    expect(built.width).toBe(1.4);
    expect(built.height).toBe(1.4);
    expect(built.radius).toBe(0.7);
  });

  it('keeps the index so a stacked pile stays addressable', () => {
    expect(cardDressProp(prop.washer(1.1, 17.45, { rot: 0.12 }), 2).index).toBe(2);
  });
});
