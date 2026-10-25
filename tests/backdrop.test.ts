import { Color, Mesh, MeshBasicMaterial, PerspectiveCamera, ShaderMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { Backdrop, skylineFor } from '@/render/backdrop';
import { PALETTES } from '@/render/palette';
import { Rng } from '@/core/rng';
import type { BiomeId } from '@/sim/types';

/** The three skyline layers are the meshes that carry a flat-colour material and a hand-built ridge. */
function skylineMeshes(backdrop: Backdrop): Mesh[] {
  return backdrop.group.children.filter(
    (c): c is Mesh => c instanceof Mesh && c.material instanceof MeshBasicMaterial && c.renderOrder === -8,
  );
}

const auroraOf = (backdrop: Backdrop): Mesh[] =>
  backdrop.group.children.filter((c): c is Mesh => c instanceof Mesh && c.material instanceof ShaderMaterial && c.renderOrder === -9);

const cloudsOf = (backdrop: Backdrop): Mesh[] =>
  backdrop.group.children.filter((c): c is Mesh => c instanceof Mesh && c.material instanceof MeshBasicMaterial && c.renderOrder === -7);

const lightsOf = (layer: Mesh): Mesh | undefined => layer.children.find((c): c is Mesh => c instanceof Mesh);

const heightsOf = (layer: Mesh): number[] => {
  const positions = layer.geometry.getAttribute('position').array;
  const tops: number[] = [];
  for (let i = 0; i < positions.length; i += 3) tops.push(positions[i + 1]!);
  return tops;
};

describe('backdrop skylines', () => {
  it('builds three parallax layers for every biome', () => {
    for (const biome of ['scrapyard', 'suburbia', 'metropolis', 'playground', 'stratosphere'] as BiomeId[]) {
      const backdrop = new Backdrop(biome, 11);
      expect(skylineMeshes(backdrop), biome).toHaveLength(3);
      backdrop.dispose();
    }
  });

  it('gives each biome its own silhouette from the same seed', () => {
    const signature = (biome: BiomeId): string => {
      const backdrop = new Backdrop(biome, 11);
      const sig = skylineMeshes(backdrop)
        .map((layer) => layer.geometry.getAttribute('position').count)
        .join('/');
      backdrop.dispose();
      return sig;
    };
    const all = (['scrapyard', 'suburbia', 'metropolis', 'playground', 'stratosphere'] as BiomeId[]).map(signature);
    expect(new Set(all).size).toBe(5);
  });

  it('is repeatable: the same seed always builds the same skyline', () => {
    const build = (): number[] => {
      const backdrop = new Backdrop('metropolis', 42);
      const heights = heightsOf(skylineMeshes(backdrop)[0]!);
      backdrop.dispose();
      return heights;
    };
    expect(build()).toEqual(build());
  });

  it('builds a Suburbia skyline of low gabled roofs, far shorter than the city towers', () => {
    const tallest = (biome: BiomeId): number => {
      const backdrop = new Backdrop(biome, 5);
      const peak = Math.max(...heightsOf(skylineMeshes(backdrop)[0]!));
      backdrop.dispose();
      return peak;
    };
    expect(tallest('suburbia')).toBeLessThan(tallest('metropolis') * 0.7);
  });

  it('lights the city but leaves the suburbs and the scrapyard unlit', () => {
    const lit = (biome: BiomeId): number => {
      const backdrop = new Backdrop(biome, 5);
      const count = skylineMeshes(backdrop).filter((layer) => lightsOf(layer)).length;
      backdrop.dispose();
      return count;
    };
    expect(lit('metropolis')).toBe(3);
    expect(lit('suburbia')).toBe(0);
    expect(lit('scrapyard')).toBe(0);
  });

  it('keeps window lights inside the budget and as whole quads', () => {
    const backdrop = new Backdrop('metropolis', 9);
    for (const layer of skylineMeshes(backdrop)) {
      const lights = lightsOf(layer)!;
      const vertices = lights.geometry.getAttribute('position').count;
      expect(vertices % 6).toBe(0);
      expect(vertices / 6).toBeLessThanOrEqual(520);
      expect(vertices).toBeGreaterThan(0);
      const colors = lights.geometry.getAttribute('color');
      expect(colors.count).toBe(vertices);
    }
    backdrop.dispose();
  });

  it('pins the lit windows to their layer so they travel with the skyline', () => {
    const backdrop = new Backdrop('metropolis', 9);
    const layer = skylineMeshes(backdrop)[1]!;
    const lights = lightsOf(layer)!;
    const layerZ = layer.geometry.getAttribute('position').getZ(0);
    const lightZ = lights.geometry.getAttribute('position').getZ(0);
    expect(Math.abs(lightZ - layerZ)).toBeLessThan(1);
    backdrop.dispose();
  });

  it('raises giant playground equipment above the dunes: wheels, swing frames and slides in the haze', () => {
    const backdrop = new Backdrop('playground', 5);
    const far = heightsOf(skylineMeshes(backdrop)[0]!);
    const scrapyard = new Backdrop('scrapyard', 5);
    const junk = heightsOf(skylineMeshes(scrapyard)[0]!);
    expect(Math.max(...far)).toBeGreaterThan(30);
    expect(far.length).toBeGreaterThan(junk.length);
    scrapyard.dispose();
    backdrop.dispose();
  });

  it('scatters spent hardware through the whole sky above the Stratosphere, not just near the horizon', () => {
    const backdrop = new Backdrop('stratosphere', 5);
    const far = heightsOf(skylineMeshes(backdrop)[0]!);
    expect(Math.max(...far)).toBeGreaterThan(100);
    const high = far.filter((y) => y > 40).length;
    expect(high).toBeGreaterThan(60);
    backdrop.dispose();
  });

  it('keeps every free-standing silhouette as whole triangles', () => {
    for (const biome of ['playground', 'stratosphere'] as BiomeId[]) {
      const backdrop = new Backdrop(biome, 3);
      for (const layer of skylineMeshes(backdrop)) {
        expect(layer.geometry.getAttribute('position').count % 3, biome).toBe(0);
      }
      backdrop.dispose();
    }
  });

  it('hangs curtains of aurora in the Stratosphere only', () => {
    const sky = new Backdrop('stratosphere', 7);
    expect(auroraOf(sky)).toHaveLength(4);
    sky.dispose();
    for (const biome of ['scrapyard', 'suburbia', 'metropolis', 'playground'] as BiomeId[]) {
      const backdrop = new Backdrop(biome, 7);
      expect(auroraOf(backdrop), biome).toHaveLength(0);
      backdrop.dispose();
    }
  });

  it('colours the aurora from the biome accent, shifted a quarter turn toward green at the top', () => {
    const backdrop = new Backdrop('stratosphere', 7);
    const material = auroraOf(backdrop)[0]!.material as ShaderMaterial;
    const hueOf = (c: Color): number => {
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      return hsl.h * 360;
    };
    const low = hueOf(material.uniforms.uLow!.value as Color);
    const high = hueOf(material.uniforms.uHigh!.value as Color);
    const accent = PALETTES.stratosphere.accent.h;
    expect(low).toBeCloseTo(accent, 0);
    expect(high).toBeCloseTo((accent + 95) % 360, 0);
    expect(high).not.toBeCloseTo(low, 0);
    backdrop.dispose();
  });

  it('sways the aurora on the clock it is given, and only while time passes', () => {
    const backdrop = new Backdrop('stratosphere', 7);
    const camera = new PerspectiveCamera();
    const time = (): number => (auroraOf(backdrop)[0]!.material as ShaderMaterial).uniforms.uTime!.value as number;
    expect(time()).toBe(0);
    backdrop.update(camera, 0.5);
    backdrop.update(camera, 1.5);
    expect(time()).toBeCloseTo(2, 6);
    backdrop.dispose();
  });

  it('clears the thin air of clouds while every lower biome keeps its drifting ones', () => {
    const sky = new Backdrop('stratosphere', 7);
    expect(cloudsOf(sky)).toHaveLength(0);
    sky.dispose();
    for (const biome of ['scrapyard', 'suburbia', 'metropolis', 'playground'] as BiomeId[]) {
      const backdrop = new Backdrop(biome, 7);
      expect(cloudsOf(backdrop).length, biome).toBeGreaterThan(5);
      backdrop.dispose();
    }
  });

  it('disposes the window lights along with everything else', () => {
    const backdrop = new Backdrop('metropolis', 9);
    expect(() => backdrop.dispose()).not.toThrow();
  });
});

describe('the landmark silhouette (R-AR-06)', () => {
  const heroSpec = { z: -52, scale: 1.5, height: 28, parallax: 0.03, hero: true };
  const plainSpec = { z: -52, scale: 1.5, height: 28, parallax: 0.03 };

  const maxY = (pairs: number[]): number => {
    let top = -Infinity;
    for (let i = 1; i < pairs.length; i += 2) top = Math.max(top, pairs[i]!);
    return top;
  };

  it('raises one hero piece inside the camera band that tops its own ridge lumps', () => {
    for (const biome of ['scrapyard', 'suburbia', 'metropolis', 'playground', 'stratosphere'] as BiomeId[]) {
      const skyline = skylineFor(biome, heroSpec, new Rng(11));
      expect(skyline.hero, `${biome}: landmark shapes`).toBeDefined();
      expect(skyline.hero!.length, `${biome}: the hero is made of triangles`).toBeGreaterThanOrEqual(6);
      // The 24-degree lens frames barely twenty metres at the near depth, so
      // the hero keeps its profile in that band while topping the ridge lumps.
      expect(maxY(skyline.hero!), `${biome}: the hero reads above the ridge`).toBeGreaterThanOrEqual(maxY(skyline.ridge.flat()) * 0.55);
    }
  });

  it('keeps the landmark to the one hero layer, so the other skies stay anonymous', () => {
    for (const biome of ['scrapyard', 'suburbia'] as BiomeId[]) {
      expect(skylineFor(biome, plainSpec, new Rng(11)).hero ?? [], biome).toHaveLength(0);
    }
  });

  it('hangs the landmark on the built backdrop near layer', () => {
    for (const biome of ['scrapyard', 'suburbia', 'metropolis', 'playground', 'stratosphere'] as BiomeId[]) {
      const backdrop = new Backdrop(biome, 11);
      const near = skylineMeshes(backdrop)[2]!;
      const heights = heightsOf(near);
      const hero = skylineFor(biome, heroSpec, new Rng(11));
      // The mesh keeps its vertices as 32-bit floats, so allow the last bit to round.
      expect(Math.max(...heights), `${biome}: the built layer carries the hero`).toBeGreaterThanOrEqual(maxY(hero.hero!) - 0.01);
      backdrop.dispose();
    }
  });
});
