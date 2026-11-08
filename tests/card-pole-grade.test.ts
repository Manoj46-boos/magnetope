import { describe, expect, it } from 'vitest';
import { Group, MeshStandardMaterial } from 'three';
import { POLE_NORTH, POLE_SOUTH } from '@/render/palette';
import { MagnoRig } from '@/render/magno-rig';

/**
 * The card's pole grade (visual renewal PRD 16.5): the 200 ms test's own
 * failure mode — the pole pair not reading at 64 px — answered the way the
 * chapter prescribes, the pair intensified for the thumbnail only. The laws
 * here hold the grade to what the render proved it needed: the red pole's
 * hue surviving the card's hot key (a deeper diffuse under a strong
 * emissive), the blue pole's depth surviving it (the diffuse held back),
 * both pivots grown so the pair owns real pixels at card scale — and all of
 * it gone the moment the face lifts, because gameplay never sees a card
 * grade.
 */

const flying = (): Parameters<MagnoRig['update']>[0] =>
  ({
    position: { x: 0, y: 10 },
    velocity: { x: 3.9, y: 3.1 },
    angle: 0,
    visualAngle: -18 * (Math.PI / 180),
    state: 'airborne',
    polarity: 'repel',
    charge01: 0,
    chargeLevel: 0,
    snapArmed: false,
    snapEngaged: false,
    snapTarget: { x: 0.55, y: 16.6 },
    attachNormal: null,
    limp: false,
    scramble: false,
    recoverPhase: 0,
    grounded: false,
    chaining: false,
    dropMeters: 0,
    snapAssist: false,
  }) as never;

const run = (rig: MagnoRig, ms: number): void => {
  for (let i = 0; i < Math.ceil(ms / 16); i++) rig.update(flying(), { x: 0, y: 10 }, 1 / 60, false);
};

const polePivotsOf = (rig: MagnoRig): Group[] => (rig as unknown as { polePivots: Group[] }).polePivots;
const materialsOf = (rig: MagnoRig): { north: MeshStandardMaterial; south: MeshStandardMaterial } => {
  const inner = rig as unknown as { northMaterial: MeshStandardMaterial; southMaterial: MeshStandardMaterial };
  return { north: inner.northMaterial, south: inner.southMaterial };
};

describe("the card's pole grade (visual renewal 16.5)", () => {
  it('grows the pole pair under the panic face, and only under it', () => {
    const rig = new MagnoRig();
    const pivots = polePivotsOf(rig);
    expect(pivots.length).toBeGreaterThanOrEqual(14); // seven castings, two poles each
    const scales = () => pivots.map((p) => p.scale.x);
    run(rig, 100);
    expect(scales().every((s) => s === 1), 'gameplay never scales the pair').toBe(true);
    rig.setCardFace('panic');
    run(rig, 100);
    expect(scales().every((s) => s > 1.6), 'the card grows every casting’s pair').toBe(true);
    rig.setCardFace(null);
    run(rig, 100);
    expect(scales().every((s) => s === 1), 'lifting the face returns the pair untouched').toBe(true);
    rig.dispose();
  });

  it('pins each pole its own way: red deep under a strong emissive, blue held back', () => {
    const rig = new MagnoRig();
    const { north, south } = materialsOf(rig);
    const northBefore = north.color.clone();
    const southBefore = south.color.clone();
    const emissiveBefore = north.emissiveIntensity;
    rig.setCardFace('panic');
    // Red's failure was climbing toward white-pink: its diffuse must deepen or
    // hold, never brighten past its own hue, and its emissive must carry it.
    expect(north.color.r).toBeLessThanOrEqual(northBefore.r * 1.11 + 1e-6);
    expect(north.emissiveIntensity).toBeGreaterThan(emissiveBefore);
    // Blue's failure was washing pale: its diffuse is held under its base.
    expect(south.color.b).toBeLessThanOrEqual(southBefore.b + 1e-6);
    rig.dispose();
  });

  it('restores the gameplay materials exactly when the face lifts', () => {
    const rig = new MagnoRig();
    const { north, south } = materialsOf(rig);
    const northColor = north.color.clone();
    const southColor = south.color.clone();
    rig.setCardFace('panic');
    rig.setCardFace(null);
    expect(north.color.equals(northColor)).toBe(true);
    expect(south.color.equals(southColor)).toBe(true);
    expect(north.emissiveIntensity).toBe(0.55);
    expect(south.emissiveIntensity).toBe(0.55);
    rig.dispose();
  });

  it('keeps the brand pair as the hue it grades: north red, south blue', () => {
    const rig = new MagnoRig();
    const { north, south } = materialsOf(rig);
    rig.setCardFace('panic');
    // The grade moves light and scale, never identity: the emissive keeps the
    // brand hues, so the pair the card shows is still the pair the game owns.
    expect(north.emissive.getHex()).toBe(POLE_NORTH.getHex());
    expect(south.emissive.getHex()).toBe(POLE_SOUTH.getHex());
    rig.dispose();
  });
});

describe('the loading screen\u2019s field-line arc (visual renewal 16.7)', () => {
  it('authors the arc once, pole to pole, in the signature cyan', async () => {
    const { MAGNO_SILHOUETTE } = await import('@/ui/icons');
    // The arc rides the head between its two pole tips and speaks the field
    // line's own colour — the load's first impression is the magnetism signature.
    expect(MAGNO_SILHOUETTE).toContain('class="field-arc"');
    expect(MAGNO_SILHOUETTE).toContain('stroke="#00e5ff"');
    expect(MAGNO_SILHOUETTE.match(/x="76" y="48" width="12" height="7" fill="#1e88e5"/)).toBeTruthy();
    expect(MAGNO_SILHOUETTE.match(/x="32" y="48" width="12" height="7" fill="#e53935"/)).toBeTruthy();
  });

  it('stands still: the load\u2019s only animation is the arc itself', async () => {
    const css = await import('fs').then((fs) => fs.readFileSync('src/ui/style.css', 'utf8'));
    // The flip-bob and spark-blink are gone; the arc's reach is the one thing
    // that moves, through the dashoffset the progress drives.
    expect(css).not.toContain('flip-bob');
    expect(css).toContain('--load');
    expect(css).toContain('stroke-dashoffset: calc(var(--arc) * (1 - var(--load, 0)))');
  });
});
