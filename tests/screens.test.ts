// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMap } from '@/game/map-model';
import { ALL_LEVELS } from '@/levels';
import { freshSave } from '@/platform/storage';
import { LockerScreen } from '@/ui/locker-screen';
import { MapScreen } from '@/ui/map-screen';
import { ModalHost, pickNeighbour } from '@/ui/modal-host';
import { CoachOverlay, dominantKey } from '@/ui/coach-overlay';

const TODAY = new Date(2026, 6, 15);

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('spatial focus navigation', () => {
  const grid = [
    { x: 0, y: 0, w: 50, h: 50 },
    { x: 60, y: 0, w: 50, h: 50 },
    { x: 120, y: 0, w: 50, h: 50 },
    { x: 0, y: 60, w: 50, h: 50 },
    { x: 60, y: 60, w: 50, h: 50 },
  ];

  it('moves to the neighbour in the direction pressed', () => {
    expect(pickNeighbour(grid, 0, 'right')).toBe(1);
    expect(pickNeighbour(grid, 1, 'down')).toBe(4);
    expect(pickNeighbour(grid, 4, 'up')).toBe(1);
    expect(pickNeighbour(grid, 4, 'left')).toBe(3);
  });

  it('prefers the item straight ahead over a nearer one off to the side', () => {
    expect(pickNeighbour(grid, 2, 'down')).toBe(4);
  });

  it('reports nothing when the edge has been reached', () => {
    expect(pickNeighbour(grid, 0, 'left')).toBe(-1);
  });
});

describe('modal stack', () => {
  it('returns to the screen underneath when the top one closes', () => {
    const host = new ModalHost();
    const pause = document.createElement('div');
    const map = document.createElement('div');
    document.body.append(pause, map);
    host.open(pause);
    host.open(map);
    expect(pause.classList.contains('open')).toBe(false);
    expect(host.active).toBe(map);
    host.close(map);
    expect(pause.classList.contains('open')).toBe(true);
    host.closeAll();
    expect(host.active).toBeNull();
  });
});

describe('level map screen', () => {
  const build = (stars: Record<string, number> = {}) => {
    const handlers = { select: vi.fn(), back: vi.fn(), openLocker: vi.fn(), share: vi.fn(), tick: vi.fn() };
    const screen = new MapScreen(document.body, new ModalHost(), handlers);
    const save = { ...freshSave(), stars };
    screen.show({
      biomes: buildMap(ALL_LEVELS, save),
      stars: Object.values(stars).reduce((a, b) => a + b, 0),
      scrap: 120,
      highlights: [{ levelId: 'scrapyard-00', levelName: 'First Steps', biome: 'scrapyard', heightMeters: 18.4, bounces: 3, junk: 2, grade: 'A', score: 30 }],
      currentLevelId: 'scrapyard-00',
    });
    return { screen, handlers };
  };

  it('stacks the mountain with the stratosphere at the peak and the scrapyard at the base', () => {
    build();
    const order = [...document.querySelectorAll<HTMLElement>('.biome')].map((b) => b.dataset.biome);
    expect(order).toEqual(['stratosphere', 'playground', 'metropolis', 'suburbia', 'scrapyard']);
  });

  it('starts a level that is open and ignores a tap on a locked one', () => {
    const { handlers } = build();
    document.querySelector<HTMLElement>('[data-level="scrapyard-00"]')!.click();
    expect(handlers.select).toHaveBeenCalledWith('scrapyard-00');
    document.querySelector<HTMLElement>('[data-level="scrapyard-03"]')!.click();
    expect(handlers.select).toHaveBeenCalledTimes(1);
  });

  it('shows the star gate on sealed biomes and the stars earned on cleared levels', () => {
    build({ 'scrapyard-00': 3 });
    expect(document.querySelector('[data-biome="suburbia"] .gate')!.textContent).toContain('12');
    expect(document.querySelectorAll('[data-level="scrapyard-00"] .pips i.on')).toHaveLength(3);
  });

  it('lays out every shipping level of the new biomes with its name and a locked state', () => {
    build();
    for (const biome of ['suburbia', 'metropolis', 'playground', 'stratosphere']) {
      const nodes = [...document.querySelectorAll<HTMLElement>(`[data-biome="${biome}"] [data-level]`)];
      expect(nodes.map((n) => n.dataset.level)).toEqual(ALL_LEVELS.filter((l) => l.biome === biome).map((l) => l.id));
      for (const level of ALL_LEVELS.filter((l) => l.biome === biome)) {
        expect(document.querySelector(`[data-level="${level.id}"]`)!.getAttribute('aria-label')).toContain(level.name);
      }
    }
  });

  it('lets the player into Suburbia from the map once the gate stars are earned', () => {
    const { handlers } = build({ 'scrapyard-00': 3, 'scrapyard-01': 3, 'scrapyard-02': 3, 'scrapyard-03': 3, 'scrapyard-04': 3 });
    document.querySelector<HTMLElement>('[data-level="suburbia-01"]')!.click();
    expect(handlers.select).toHaveBeenCalledWith('suburbia-01');
    document.querySelector<HTMLElement>('[data-level="suburbia-03"]')!.click();
    expect(handlers.select).toHaveBeenCalledTimes(1);
  });

  it('lists the best falls and shares one on request', () => {
    const { handlers } = build();
    expect(document.querySelector('.fall-chip b')!.textContent).toBe('A');
    document.querySelector<HTMLElement>('.fall-chip button')!.click();
    expect(handlers.share).toHaveBeenCalledOnce();
  });

  it('keeps zoom within its limits', () => {
    const { screen } = build();
    screen.setZoom(9);
    expect(screen.zoom).toBe(1.5);
    screen.setZoom(0);
    expect(screen.zoom).toBe(0.7);
  });
});

describe('locker screen', () => {
  const build = (mutate: (s: ReturnType<typeof freshSave>) => void = () => undefined) => {
    const handlers = { equip: vi.fn(), buy: vi.fn(), watch: vi.fn(), back: vi.fn(), tick: vi.fn() };
    const screen = new LockerScreen(document.body, new ModalHost(), handlers);
    const save = freshSave();
    mutate(save);
    screen.show({ save, today: TODAY });
    return { screen, handlers, save };
  };

  const card = (id: string) => document.querySelector<HTMLElement>(`[data-item="${id}"]`)!;

  it('shows the classic skin as equipped and every skin on the first tab', () => {
    build();
    expect(card('skin.classic').classList.contains('equipped')).toBe(true);
    expect(document.querySelectorAll('.card')).toHaveLength(17);
  });

  it('offers a purchase with a price and a watch-to-unlock alternative', () => {
    const { handlers } = build((s) => void (s.scrap = 500));
    const buttons = card('skin.rust').querySelectorAll<HTMLElement>('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.textContent).toContain('150');
    buttons[0]!.click();
    buttons[1]!.click();
    expect(handlers.buy).toHaveBeenCalledWith('skin.rust');
    expect(handlers.watch).toHaveBeenCalledWith('skin.rust');
  });

  it('shows what is needed to earn a locked reward instead of a buy button', () => {
    build();
    expect(card('skin.flag').querySelector('button')).toBeNull();
    expect(card('skin.flag').textContent).toContain('15');
  });

  it('lets the player equip an owned item and switch to the field-line tab', () => {
    const { handlers } = build((s) => void s.owned.push('skin.rust'));
    card('skin.rust').querySelector<HTMLElement>('button')!.click();
    expect(handlers.equip).toHaveBeenCalledWith('skin.rust');
    document.querySelectorAll<HTMLElement>('.tab')[1]!.click();
    expect(card('field.classic')).not.toBeNull();
    expect(document.querySelector('[data-item="skin.rust"]')).toBeNull();
  });

  it('labels seasonal items with their season when out of season', () => {
    build();
    expect(card('skin.frost').textContent).toContain('winter');
  });
});

describe('ghost hand overlay', () => {
  it('picks the arrow key that points along the first hop', () => {
    expect(dominantKey({ x: 0.9, y: -0.4 })).toBe('right');
    expect(dominantKey({ x: -0.2, y: -0.95 })).toBe('up');
    expect(dominantKey({ x: -1, y: 0 })).toBe('left');
  });

  it('shows the device-specific demonstration and hides again on request', () => {
    const overlay = new CoachOverlay(document.body);
    overlay.show({ cue: 'launch', device: 'keyboard', direction: { x: 1, y: 0 }, anchor: { x: 100, y: 100 } });
    expect(overlay.visible).toBe(true);
    expect(document.querySelector('.key.right.lit')).not.toBeNull();
    expect(document.querySelector('.key.space')).not.toBeNull();
    overlay.show({ cue: 'snap', device: 'touch', direction: { x: 1, y: 0 }, anchor: { x: 100, y: 100 } });
    expect(document.querySelector('.demo.flip')).not.toBeNull();
    overlay.hide();
    expect(overlay.visible).toBe(false);
  });
});
