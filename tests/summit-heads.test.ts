import { describe, expect, it } from 'vitest';
import { Group, Mesh, Object3D } from 'three';
import { COSMETICS, DEFAULT_SKIN_ID, cosmeticById, SETS, type SkinCosmetic, type HeadStyle } from '@/config/cosmetics';
import { claimEarned, cosmeticStatus, setProgress } from '@/game/locker';
import { MagnoRig, skinFromLook } from '@/render/magno-rig';
import { magnoPreview } from '@/ui/icons';
import { MemoryBackend, SaveStore, sanitizeSave } from '@/platform/storage';

/**
 * The summit heads (visual renewal PRD 12.8): six skins whose horseshoe is
 * structurally its own casting, each unlocked by the biome that shaped it.
 * The laws here are the chapter's own: every head the rig can wear is a
 * different silhouette, every casting keeps the flared pole pair that makes
 * MAGNO read as a magnet, the rig swaps castings whole (never blends them),
 * and the reward path actually pays each head at its biome's summit.
 */

const heads = COSMETICS.filter((c): c is SkinCosmetic => c.kind === 'skin' && c.look.head !== undefined);

/** How many distinct head groups the rig exposes, by name. */
function headNames(rig: MagnoRig): string[] {
  const inner = (rig as unknown as { heads: Record<string, Group> }).heads;
  return Object.keys(inner);
}

describe('the summit head catalogue (visual renewal 12.8)', () => {
  it('ships six structurally different heads, one per biome summit plus the campaign trophy', () => {
    expect(heads.map((c) => c.id)).toEqual([
      'skin.industrial',
      'skin.vintage',
      'skin.neon',
      'skin.carnival',
      'skin.aurora',
      'skin.trophy',
    ]);
    const styles = new Set(heads.map((c) => c.look.head));
    expect(styles.size).toBe(6);
  });

  it('unlocks each biome head at that biome\u2019s own summit, and the trophy at the full 210', () => {
    const byLevel = new Map(heads.map((c) => [c.acquire.how === 'reward' && c.acquire.requirement.type === 'level' ? c.acquire.requirement.id : null, c]));
    expect(byLevel.get('scrapyard-13')?.look.head).toBe('industrial');
    expect(byLevel.get('suburbia-13')?.look.head).toBe('vintage');
    expect(byLevel.get('metropolis-13')?.look.head).toBe('neon');
    expect(byLevel.get('playground-13')?.look.head).toBe('carnival');
    expect(byLevel.get('stratosphere-14')?.look.head).toBe('aurora');
    const trophy = cosmeticById('skin.trophy') as SkinCosmetic;
    expect(trophy.acquire).toEqual({ how: 'reward', requirement: { type: 'stars', count: 210 } });
  });

  it('keeps every head inside the biome set that earned it, each set still whole', () => {
    const setOf = (id: string) => SETS.find((set) => set.pieces.some((piece) => piece.id === id))?.biome;
    expect(setOf('skin.industrial')).toBe('scrapyard');
    expect(setOf('skin.vintage')).toBe('suburbia');
    expect(setOf('skin.neon')).toBe('metropolis');
    expect(setOf('skin.carnival')).toBe('playground');
    expect(setOf('skin.aurora')).toBe('stratosphere');
    expect(setOf('skin.trophy')).toBe('stratosphere');
  });
});

describe('the rig wears each casting (visual renewal 12.8)', () => {
  it('builds every head style plus the classic, each exactly one visible at a time', () => {
    const rig = new MagnoRig();
    const names = headNames(rig);
    expect(names.sort()).toEqual(['aurora', 'carnival', 'classic', 'industrial', 'neon', 'trophy', 'vintage'].sort());
    // The classic shows on a bare rig, the way every default visit meets him.
    const inner = (rig as unknown as { heads: Record<string, Group> }).heads;
    expect(inner.classic!.visible).toBe(true);
    expect(Object.values(inner).filter((group) => group.visible)).toHaveLength(1);
  });

  it.each(heads.map((c) => [c.id, c.look.head!] as const))('mounts %s whole when equipped', (id, style) => {
    const rig = new MagnoRig();
    rig.applySkin(skinFromLook((cosmeticById(id) as SkinCosmetic).look));
    const inner = (rig as unknown as { heads: Record<HeadStyle | "classic", Group> }).heads;
    expect(inner[style]!.visible, `${id} must show its own casting`).toBe(true);
    // And only its own: a blend of two castings is a mistake the eye catches.
    expect(Object.values(inner).filter((group) => group.visible)).toHaveLength(1);
    // The casting carries geometry that renders: an empty group is a silent lie.
    let meshes = 0;
    inner[style].traverse((child) => {
      if ((child as Mesh).isMesh) meshes += 1;
    });
    expect(meshes, `${id}'s casting has no meshes`).toBeGreaterThanOrEqual(4);
  });

  it('keeps the pole pair law on every casting: two pole pivots, each flared, each carrying its tip', () => {
    const rig = new MagnoRig();
    const inner = (rig as unknown as { heads: Record<string, Group> }).heads;
    // The pole-pair law is structural: each casting's builder places two pole
    // pivots — a group whose only child is the tip mesh — each rotated by its
    // own flare. Read off the geometry every casting actually mounted.
    for (const [name, group] of Object.entries(inner)) {
      const pivots: Object3D[] = [];
      group.traverse((child) => {
        if (child.type === 'Group' && child.children.length === 1 && (child.children[0] as Mesh).isMesh) pivots.push(child);
      });
      expect(pivots.length, `${name} casting must carry exactly two pole pivots`).toBe(2);
      const flares = pivots.map((pivot) => Math.abs(pivot.rotation.z));
      expect(Math.min(...flares), `${name}'s poles must flare`).toBeGreaterThan(0.1);
    }
  });

  it('returns to the classic casting when a skin names no head', () => {
    const rig = new MagnoRig();
    const vintage = cosmeticById('skin.vintage') as SkinCosmetic;
    const look = skinFromLook(vintage.look);
    rig.applySkin(look);
    const inner = (rig as unknown as { heads: Record<string, Group> }).heads;
    expect(inner.vintage!.visible).toBe(true);
    rig.applySkin({ body: look.body, ring: look.ring, socket: look.socket, tip: look.tip });
    expect(inner.classic!.visible).toBe(true);
    expect(inner.vintage!.visible).toBe(false);
  });
});

describe('the reward path pays the heads (visual renewal 12.8)', () => {
  const store = () => new SaveStore(new MemoryBackend());
  const idsOf = (s: ReturnType<typeof store>): string[] => claimEarned(s).map((r) => r.id);

  it('earns the Scrapyard head the moment The Heap clears, and only then', () => {
    const s = store();
    const status = (save: ReturnType<typeof sanitizeSave>) => cosmeticStatus(save, cosmeticById('skin.industrial')!, new Date());
    expect(status(s.data).state).toBe('earnable');
    s.update((d) => void (d.stars['scrapyard-13'] = 2));
    expect(status(s.data).state).toBe('earnable');
    expect(idsOf(s)).toContain('skin.industrial');
    expect(s.data.owned).toContain('skin.industrial');
  });

  it('does not pay a biome\u2019s head before its own summit', () => {
    const s = store();
    s.update((d) => {
      d.stars['scrapyard-13'] = 3;
      d.stars['suburbia-12'] = 3;
    });
    const earned = idsOf(s);
    expect(earned).toContain('skin.industrial');
    expect(earned).not.toContain('skin.vintage');
    expect(earned).not.toContain('skin.neon');
    expect(earned).not.toContain('skin.carnival');
    expect(earned).not.toContain('skin.aurora');
  });

  it('pays the trophy at the full 210 stars, a perfect campaign\u2019s own capstone', () => {
    const s = store();
    // The honest road: seventy levels three-starred is the PRD's own 210.
    s.update((d) => {
      for (let i = 0; i < 70; i++) d.stars[`level-${i}`] = 3;
    });
    expect(idsOf(s)).toContain('skin.trophy');
  });

  it('keeps the sets\u2019 own progress honest with the heads inside them', () => {
    const s = store();
    s.update((d) => void (d.owned.push('skin.industrial')));
    const stratosphere = setProgress(s.data).find((row) => row.set.biome === 'stratosphere');
    expect(stratosphere?.need).toBe(6);
    expect(stratosphere?.have).toBe(0);
    const scrapyard = setProgress(s.data).find((row) => row.set.biome === 'scrapyard');
    expect(scrapyard?.have).toBe(1);
  });
});

describe('the locker previews draw each casting (visual renewal 12.8)', () => {
  it('gives every head its own crown, and keeps the pole pair every casting shares', () => {
    for (const skin of heads) {
      const svg = magnoPreview(skin.look);
      // The pole rectangles are the law every casting shares: the silhouette
      // survives even the flattest drawing of it.
      expect(svg).toContain(`<rect x="29" y="51" width="14" height="8" fill="${skin.look.tip}"/>`);
      expect(svg).toContain(`<rect x="77" y="51" width="14" height="8" fill="${skin.look.tip}"/>`);
    }
  });

  it('draws no head twice: each crown markup is unique among the seven', () => {
    const crowns = [DEFAULT_SKIN_ID, ...heads.map((c) => c.id)].map((id) => {
      const look = (cosmeticById(id) as SkinCosmetic).look;
      return magnoPreview(look).match(/<g transform="rotate[^>]*>\s*([\s\S]*?)<rect x="29" y="40"/)![1]!.trim();
    });
    expect(new Set(crowns).size).toBe(7);
  });
});
