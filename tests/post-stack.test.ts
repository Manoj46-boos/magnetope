import type { Browser, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GRADES, applyGrade } from '@/render/grade';
import { launchBrowser, startServer } from './browser/harness';
import type { ProbeSpec } from './browser/post-fixture';

/**
 * Drives the real post stack in a real browser, with flat-colour scenes whose
 * correct output is known, and reads the pixels back. Skipped on machines with
 * no browser that can create a WebGL2 context.
 */

let server: ViteDevServer | null = null;
let browser: Browser | null = null;
let page: Page | null = null;

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  const url = started.url;
  page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  await page.addInitScript('window.__name = (f) => f;');
  await page.goto(`${url}tests/browser/post.html`);
  const ready = await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true, null, { timeout: 20000 }).then(
    () => true,
    () => false,
  );
  if (!ready) page = null;
}, 60000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

const probe = (spec: ProbeSpec): Promise<number[][]> => page!.evaluate((s) => (window as unknown as { probe: (spec: ProbeSpec) => number[][] }).probe(s), spec);
const to255 = (v: number): number => Math.round(v * 255);
const brightness = (rgb: number[]): number => (rgb[0]! + rgb[1]! + rgb[2]!) / 3;

describe('the post stack in a browser', () => {
  const run = (name: string, body: () => Promise<void>) => it(name, async (ctx) => {
    if (!page) ctx.skip();
    await body();
  });

  run('applies the biome grade to what is on screen, as the lookup table bakes it', async () => {
    const swatches: Array<[number, number, number]> = [
      [0.2, 0.4, 0.7],
      [0.8, 0.3, 0.2],
      [0.5, 0.5, 0.5],
      [0.9, 0.85, 0.6],
    ];
    for (const biome of ['scrapyard', 'metropolis', 'stratosphere'] as const) {
      for (const swatch of swatches) {
        const [seen] = await probe({ tier: 'low', biome, background: swatch, samples: [[200, 200]] });
        const expected = applyGrade(GRADES[biome], swatch).map(to255);
        seen!.forEach((value, i) => expect(Math.abs(value - expected[i]!), `${biome} ${swatch} channel ${i}`).toBeLessThanOrEqual(6));
      }
    }
  });

  run('shows the same scene in different colours in different biomes', async () => {
    const background: [number, number, number] = [0.6, 0.6, 0.6];
    const [warm] = await probe({ tier: 'low', biome: 'scrapyard', background, samples: [[200, 200]] });
    const [cool] = await probe({ tier: 'low', biome: 'stratosphere', background, samples: [[200, 200]] });
    expect(warm![0]! - warm![2]!).toBeGreaterThan(cool![0]! - cool![2]! + 6);
  });

  run('darkens the corners by about a tenth and leaves the centre alone', async () => {
    const background: [number, number, number] = [0.6, 0.6, 0.6];
    const samples: Array<[number, number]> = [[200, 200], [1, 1], [398, 398]];
    const flat = await probe({ tier: 'low', biome: 'suburbia', background, samples });
    const vignetted = await probe({ tier: 'high', biome: 'suburbia', background, samples });

    expect(brightness(vignetted[0]!) / brightness(flat[0]!)).toBeGreaterThan(0.98);
    for (const corner of [1, 2]) {
      const ratio = brightness(vignetted[corner]!) / brightness(flat[corner]!);
      expect(ratio).toBeGreaterThan(0.85);
      expect(ratio).toBeLessThan(0.91);
    }
  });

  run('makes a very bright light glow into the air around it', async () => {
    const quad = { rect: [180, 180, 40, 40] as [number, number, number, number], color: [8, 8, 8] as [number, number, number] };
    const base = { biome: 'stratosphere' as const, background: [0, 0, 0] as [number, number, number], quads: [quad], samples: [[200, 200], [170, 200], [160, 200], [200, 20]] as Array<[number, number]> };
    const bloomed = await probe({ ...base, tier: 'high' });
    const plain = await probe({ ...base, tier: 'low' });

    expect(brightness(bloomed[0]!)).toBeGreaterThan(200);
    expect(brightness(bloomed[1]!)).toBeGreaterThan(brightness(plain[1]!) + 20);
    expect(brightness(bloomed[1]!)).toBeGreaterThan(brightness(bloomed[2]!));
    expect(brightness(bloomed[3]!)).toBeLessThan(6);
  });

  run('does not glow anything below the threshold', async () => {
    const quad = { rect: [180, 180, 40, 40] as [number, number, number, number], color: [0.5, 0.5, 0.5] as [number, number, number] };
    const base = { biome: 'stratosphere' as const, background: [0, 0, 0] as [number, number, number], quads: [quad], samples: [[170, 200]] as Array<[number, number]> };
    const bloomed = await probe({ ...base, tier: 'high' });
    const plain = await probe({ ...base, tier: 'low' });
    expect(Math.abs(brightness(bloomed[0]!) - brightness(plain[0]!))).toBeLessThan(3);
  });

  run('glows the same on the half and quarter resolution tiers, only softer', async () => {
    const quad = { rect: [180, 180, 40, 40] as [number, number, number, number], color: [8, 8, 8] as [number, number, number] };
    const base = { biome: 'stratosphere' as const, background: [0, 0, 0] as [number, number, number], quads: [quad], samples: [[170, 200]] as Array<[number, number]> };
    const desktop = await probe({ ...base, tier: 'high' });
    const phone = await probe({ ...base, tier: 'mid' });
    expect(brightness(phone[0]!)).toBeGreaterThan(15);
    expect(brightness(phone[0]!) / brightness(desktop[0]!)).toBeGreaterThan(0.5);
    expect(brightness(phone[0]!) / brightness(desktop[0]!)).toBeLessThan(1.6);
  });

  run('keeps one broken material from blacking out the pixels around it', async () => {
    const light = { rect: [60, 180, 40, 40] as [number, number, number, number], color: [8, 8, 8] as [number, number, number] };
    const broken = { rect: [300, 180, 20, 20] as [number, number, number, number], color: [0, 0, 0] as [number, number, number], broken: true };
    const base = { biome: 'scrapyard' as const, background: [0.5, 0.5, 0.5] as [number, number, number], samples: [[290, 190], [330, 190], [310, 230]] as Array<[number, number]> };
    const withBroken = await probe({ ...base, tier: 'high', quads: [light, broken] });
    const without = await probe({ ...base, tier: 'high', quads: [light] });
    for (let i = 0; i < 3; i++) expect(Math.abs(brightness(withBroken[i]!) - brightness(without[i]!)), `sample ${i}`).toBeLessThan(4);
  });

  run('holds a flat sky flat, with no banding steps larger than one level', async () => {
    const row: Array<[number, number]> = Array.from({ length: 40 }, (_, i) => [150 + i, 200]);
    const seen = await probe({ tier: 'high', biome: 'stratosphere', background: [0.05, 0.04, 0.2], samples: row });
    const blues = seen.map((p) => p[2]!);
    expect(Math.max(...blues) - Math.min(...blues)).toBeLessThanOrEqual(2);
  });
});
