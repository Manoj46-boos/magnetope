import { describe, expect, it } from 'vitest';
import { prop } from '@/levels/author';
import {
  CARD_SKY,
  FALL_SKY,
  IDENT_CATCH_MS,
  IDENT_HOOK_MS,
  IDENT_MS,
  PANIC_SKY,
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
  const stage = new ThumbnailStage('panic-launch', true);
  const frames = [stage.step(0)];
  for (let t = FRAME; t <= ms; t += FRAME) frames.push(stage.step(FRAME));
  return frames.map((frame, i) => ({ frame, phase: i * FRAME }));
}

/** The subject box's centre in card UV, the number the legibility audit is derived from. */
const centre = (variant: ThumbnailVariant) => {
  const box = thumbnailSubjectBox(variant);
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
};

describe('the variant registry', () => {
  it('names the three scored cards and nothing else', () => {
    expect(THUMBNAIL_VARIANTS).toEqual(['panic-launch', 'fall-comedy', 'tower-scale']);
    for (const id of THUMBNAIL_VARIANTS) expect(thumbnailVariant(id)).toBe(id);
    expect(thumbnailVariant('scrapyard-04')).toBeNull();
    expect(thumbnailVariant('')).toBeNull();
  });

  it('dresses every card with a real level, never an invented world (R-TH-03)', () => {
    for (const variant of THUMBNAIL_VARIANTS) expect(thumbnailLevel(variant)).toBe('scrapyard-04');
  });
});

describe('the card compositions (R-TH-01, rebuild PRD 1.4)', () => {
  it('sits the panic launch at the lower-left thirds crossing, where the eye enters the frame', () => {
    // the box is centred on the subject point: the box's middle is MAGNO's own UV
    const box = thumbnailSubjectBox('panic-launch');
    expect(box.x + box.w / 2).toBeCloseTo(0.38, 2);
    expect(box.y + box.h / 2).toBeCloseTo(0.62, 2);
  });

  it('fills near half the panic card with its subject, the 200 ms read', () => {
    const { w } = thumbnailSubjectBox('panic-launch');
    expect(w).toBeCloseTo(0.45, 1);
  });

  it('launches along the 38-degree vector, repelling, with the destination already in view', () => {
    const view = new ThumbnailStage('panic-launch').step(0).view;
    expect(Math.atan2(view.velocity.y, view.velocity.x)).toBeCloseTo((38 * Math.PI) / 180, 2);
    expect(view.polarity).toBe('repel');
    expect(view.state).toBe('airborne');
    expect(view.snapEngaged).toBe(false);
    expect(view.snapTarget).not.toBeNull();
    // the launch reads bottom-left to top-right: the destination sits up and right of him
    expect(view.snapTarget!.x).toBeGreaterThan(view.position.x);
    expect(view.snapTarget!.y).toBeGreaterThan(view.position.y);
  });

  it('performs the panic face on both close cards and leaves the ambience card to its view', () => {
    expect(new ThumbnailStage('panic-launch').step(0).face).toBe('panic');
    expect(new ThumbnailStage('fall-comedy').step(0).face).toBe('panic');
    expect(new ThumbnailStage('tower-scale').step(0).face).toBeNull();
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

  it('grades the panic family: indigo zenith, coral horizon, violet for the fall sibling', () => {
    // the dusk grade keeps its burnt amber; the panic ramp biases to indigo and
    // coral, the fall card to violet — and no band of any of them sits in the
    // green hue window the Poki background rule lives in, whatever its lightness
    for (const band of [CARD_SKY.top, CARD_SKY.horizon, CARD_SKY.sun, PANIC_SKY.top, PANIC_SKY.horizon, PANIC_SKY.sun, FALL_SKY.top, FALL_SKY.horizon, FALL_SKY.sun]) {
      const mint = band.h > 140 && band.h < 180 && band.s > 40;
      expect(mint, `band ${JSON.stringify(band)} sits in the mint window`).toBe(false);
      expect(band.l).toBeLessThan(45);
    }
    expect(PANIC_SKY.top.h).toBeGreaterThanOrEqual(215);
    expect(PANIC_SKY.top.h).toBeLessThanOrEqual(230);
    expect(PANIC_SKY.horizon.h).toBeGreaterThanOrEqual(350);
    expect(PANIC_SKY.horizon.h).toBeLessThanOrEqual(362);
    // the family lockup: the fall card is the panic ramp with one hue shifted
    expect(FALL_SKY.top.h).toBeGreaterThan(PANIC_SKY.top.h);
    expect(FALL_SKY.sun).toEqual(PANIC_SKY.sun);
  });
});

describe('the static cards hold their pose', () => {
  it('returns the same frame no matter how long the stage runs', () => {
    const stage = new ThumbnailStage('panic-launch');
    const first = stage.step(0);
    for (let i = 0; i < 300; i++) stage.step(FRAME);
    const held = stage.step(0);
    expect(held.view.position).toEqual(first.view.position);
    expect(held.view.velocity).toEqual(first.view.velocity);
    expect(held.flash).toBe(0);
    expect(held.blink).toBe(false);
  });

  it('arms no beam on the launch and stages the blooper on a repel', () => {
    expect(new ThumbnailStage('panic-launch').step(0).view.snapEngaged).toBe(false);
    expect(new ThumbnailStage('fall-comedy').step(0).view.polarity).toBe('repel');
    expect(new ThumbnailStage('tower-scale').step(0).view.snapEngaged).toBe(true);
  });

  it('stages the launch and the falls dead straight, never at joy', () => {
    expect(new ThumbnailStage('panic-launch').step(0).joy).toBe(0);
    expect(new ThumbnailStage('fall-comedy').step(0).joy).toBe(0);
  });

  it('never plays the ident timeline outside the panic composition', () => {
    const stage = new ThumbnailStage('fall-comedy', true);
    let frame = stage.step(0);
    for (let t = FRAME; t <= IDENT_CATCH_MS + 800; t += FRAME) frame = stage.step(FRAME);
    expect(frame.view.state).not.toBe('attached');
    expect(frame.flash).toBe(0);
    expect(frame.view.position).toEqual(new ThumbnailStage('fall-comedy').step(0).view.position);
  });
});

describe('the ident timeline (R-TH-10, rebuild PRD 1.4.4)', () => {
  it('starts off-frame: the tumble-in enters from below and left, the panic face already on', () => {
    const first = new ThumbnailStage('panic-launch', true).step(0);
    const settled = new ThumbnailStage('panic-launch').step(0);
    expect(first.view.position.x).toBeLessThan(settled.view.position.x);
    expect(first.view.position.y).toBeLessThan(settled.view.position.y);
    expect(first.view.snapArmed).toBe(false);
    expect(first.face).toBe('panic');
    expect(first.flash).toBe(0);
  });

  it('lands the hook inside half a second, within a frame of the mark', () => {
    const frames = identRun(IDENT_HOOK_MS + 3 * FRAME);
    const at = frames[29]!.frame.view.position;
    const settled = new ThumbnailStage('panic-launch').step(0).view.position;
    expect(at.x).toBeCloseTo(settled.x, 1);
    expect(at.y).toBeCloseTo(settled.y, 1);
  });

  it('flies the launch unarmed and panicking until the last tenth, when the beam connects', () => {
    const frames = identRun(IDENT_CATCH_MS - 100 - 2 * FRAME);
    const late = frames.at(-1)!.frame;
    expect(late.face).toBe('panic');
    expect(late.view.snapEngaged).toBe(false);
    expect(late.flash).toBe(0);
    expect(frames.filter(({ frame }) => frame.flash > 0)).toHaveLength(0);
    // the beam connects in the final tenth, ahead of the flash it precedes
    const connecting = identRun(IDENT_CATCH_MS - 2 * FRAME).at(-1)!.frame;
    expect(connecting.view.snapEngaged).toBe(true);
    expect(connecting.flash).toBe(0);
  });

  it('flashes the catch exactly once, on the two-second mark', () => {
    const frames = identRun(IDENT_MS);
    const caught = frames.filter(({ frame }) => frame.flash > 0);
    expect(caught).toHaveLength(1);
    expect(caught[0]!.phase).toBeLessThanOrEqual(IDENT_CATCH_MS + FRAME);
    expect(caught[0]!.phase).toBeGreaterThanOrEqual(IDENT_CATCH_MS);
    expect(caught[0]!.frame.view.state).toBe('attached');
  });

  it('settles into the catch attached, joy on, the face handed back, no drift after the loop point', () => {
    const frames = identRun(IDENT_MS + 2000);
    const settled = frames.find(({ frame }) => frame.view.state === 'attached')!;
    expect(settled.phase).toBeLessThanOrEqual(IDENT_CATCH_MS + FRAME);
    expect(settled.frame.view.velocity).toEqual({ x: 0, y: 0 });
    expect(settled.frame.view.attachNormal).not.toBeNull();
    expect(settled.frame.joy).toBe(1);
    expect(settled.frame.face).toBeNull();
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
