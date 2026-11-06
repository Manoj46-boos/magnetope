import type { Browser, Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cosmeticById, type SkinCosmetic } from '@/config/cosmetics';
import { isHeadlessAudioNoise, launchBrowser, startServer } from './browser/harness';

/**
 * The summit heads on the live rig (visual renewal PRD 12.8): a real browser
 * boots the game, equips each head through the save the same way a player's
 * unlock would, and reads the rig's own mounted casting — then proves the
 * change reaches the screen as pixels, because a head that renders as the
 * classic is a rename, not a redesign.
 */

const HEAD_IDS = ['skin.industrial', 'skin.vintage', 'skin.neon', 'skin.carnival', 'skin.aurora', 'skin.trophy'] as const;

let browser: Browser | null = null;
let server: ViteDevServer | null = null;
let origin = '';
let page: Page | null = null;
const problems: string[] = [];

beforeAll(async () => {
  browser = await launchBrowser();
  if (!browser) return;
  const started = await startServer();
  server = started.server;
  origin = started.url;
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript('window.__name = (f) => f;');
  page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !isHeadlessAudioNoise(m.text())) problems.push(`console: ${m.text()}`);
  });
}, 90000);

afterAll(async () => {
  await page?.context().close();
  await browser?.close();
  await server?.close();
});

const runnable = (name: string, body: () => Promise<void>, timeout = 120000) =>
  it(
    name,
    async (ctx) => {
      if (!page) ctx.skip();
      await body();
    },
    timeout,
  );

async function boot(): Promise<void> {
  await page!.goto(origin);
  await page!.waitForFunction(() => Boolean((window as unknown as { __game?: unknown }).__game), null, { timeout: 30000 });
  await page!.evaluate(() => {
    const game = (window as unknown as { __game: { debug: { holdClock(h: boolean): void } } }).__game;
    game.debug.holdClock(true);
  });
}

/** Equips a skin id through the game's own equip path, owning it first the way an unlock would. */
async function equip(id: string): Promise<void> {
  await page!.evaluate((skinId) => {
    const game = (window as unknown as {
      __game: {
        save: { update(fn: (d: Record<string, unknown>) => void): void };
        debug: { equip(id: string): void };
      };
    }).__game;
    game.save.update((d) => {
      const owned = new Set(d.owned as string[]);
      owned.add(skinId);
      d.owned = [...owned];
    });
    game.debug.equip(skinId);
  }, id);
}

describe('the summit heads in live play', () => {
  runnable('mounts each casting on the live rig, one visible at a time', async () => {
    await boot();
    for (const id of HEAD_IDS) {
      const style = (cosmeticById(id) as SkinCosmetic).look.head!;
      await equip(id);
      const read = await page!.evaluate(() => {
        const game = (window as unknown as Record<string, any>).__game;
        const rig = game.debug.renderer.rig;
        const heads = (rig as unknown as { heads: Record<string, { visible: boolean }> }).heads;
        return {
          mounted: Object.entries(heads).filter(([, group]) => group.visible).map(([name]) => name),
          equippedSkin: game.debug.save.data.equipped.skin,
        };
      }, style);
      expect(read.equippedSkin, id).toBe(id);
      expect(read.mounted, `${id} must mount its own casting, and only it`).toEqual([style]);
    }
  });

  runnable('changes the pixels a player sees: no head renders as the classic', async () => {
    await boot();
    // A stable settled frame of the same level, only the head changing between shots.
    const shots = new Map<string, string>();
    for (const id of ['skin.classic', ...HEAD_IDS] as const) {
      await equip(id);
      await page!.evaluate(() => {
        const game = (window as unknown as { __game: { debug: { advance(s: number): void } } }).__game;
        for (let i = 0; i < 30; i++) game.debug.advance(1 / 60);
      });
      const png = await page!.screenshot({ timeout: 60000 });
      shots.set(id, png.length + ':' + png.slice(0, 2048).toString('base64').slice(0, 256));
    }
    // Every head's frame differs from the classic's: the casting reaches the screen.
    const classicShot = shots.get('skin.classic')!;
    for (const id of HEAD_IDS) {
      expect(shots.get(id), `${id} rendered a frame`).toBeTruthy();
      expect(shots.get(id) === classicShot, `${id} must not render exactly as the classic`).toBe(false);
    }
  });

  runnable('raised no console errors or page errors through the whole visit', async () => {
    expect(problems).toEqual([]);
  });
});
