import type { SaveData } from '@/platform/storage';
import type { BiomeId, LevelDef } from '@/sim/types';
import { BIOME_NAMES, BIOME_ORDER, BIOME_STAR_GATES, LEVELS_PER_BIOME, totalStars } from './progress';

export type NodeState = 'locked' | 'open' | 'cleared';

export interface MapNode {
  id: string;
  name: string;
  index: number;
  state: NodeState;
  stars: number;
  bestMs: number | null;
  grade: string | null;
  /** The level the player should play next. */
  frontier: boolean;
  /** A personal ghost waits on this level to be beaten (R-RT-02). */
  hasGhost: boolean;
}

export interface MapBiome {
  id: BiomeId;
  name: string;
  gate: number;
  unlocked: boolean;
  /** Stars still missing before this biome opens; zero when it is open. */
  starsToGo: number;
  nodes: MapNode[];
  planned: number;
}

type MapSave = Pick<SaveData, 'stars' | 'bestMs' | 'bestGrade'> & { ghosts?: Record<string, string> };

/**
 * The level-select mountain, base first (PRD 12.2). A biome opens on its star
 * gate; inside a biome each level opens once the one before it is cleared, and
 * a cleared level always stays open.
 */
export function buildMap(levels: readonly LevelDef[], save: MapSave): MapBiome[] {
  const stars = totalStars(save);
  let frontierAssigned = false;

  return BIOME_ORDER.map((biome, biomeIndex) => {
    const gate = BIOME_STAR_GATES[biomeIndex] ?? Infinity;
    const unlocked = stars >= gate;
    const inBiome = levels.filter((l) => l.biome === biome).sort((a, b) => a.index - b.index);

    const nodes = inBiome.map((level, i): MapNode => {
      const earned = save.stars[level.id] ?? 0;
      const previous = inBiome[i - 1];
      const previousCleared = !previous || (save.stars[previous.id] ?? 0) > 0;
      const state: NodeState = earned > 0 ? 'cleared' : unlocked && previousCleared ? 'open' : 'locked';
      const frontier = !frontierAssigned && state === 'open';
      if (frontier) frontierAssigned = true;
      return {
        id: level.id,
        name: level.name,
        index: level.index,
        state,
        stars: earned,
        bestMs: save.bestMs[level.id] ?? null,
        grade: save.bestGrade[level.id] ?? null,
        frontier,
        hasGhost: Boolean(save.ghosts?.[level.id]),
      };
    });

    return { id: biome, name: BIOME_NAMES[biome], gate, unlocked, starsToGo: Math.max(0, gate - stars), nodes, planned: LEVELS_PER_BIOME };
  });
}

/** True when the player may start `levelId` from the map. */
export function isPlayable(levels: readonly LevelDef[], save: MapSave, levelId: string): boolean {
  for (const biome of buildMap(levels, save)) {
    const node = biome.nodes.find((n) => n.id === levelId);
    if (node) return node.state !== 'locked';
  }
  return false;
}

/** The level to resume on: the first one the player can play and has not cleared, else the furthest they have reached. */
export function resumeLevelId(levels: readonly LevelDef[], save: MapSave): string {
  const nodes = buildMap(levels, save).flatMap((b) => b.nodes);
  const reached = nodes.filter((n) => n.state !== 'locked');
  return nodes.find((n) => n.frontier)?.id ?? reached[reached.length - 1]?.id ?? '';
}

/** The level after `currentId` that the player is allowed to start, skipping nothing that is locked behind a star gate. */
export function nextPlayableId(levels: readonly LevelDef[], save: MapSave, currentId: string): string | null {
  const ordered = buildMap(levels, save).flatMap((b) => b.nodes);
  const index = ordered.findIndex((n) => n.id === currentId);
  if (index < 0) return null;
  const next = ordered[index + 1];
  return next && next.state !== 'locked' ? next.id : null;
}

/** One want the clear card can dangle, whatever the shelf is doing (P-LD-06). */
export interface Want {
  /** The line's own key, so the locale can speak it and the UI never guesses. */
  kind: 'shelf' | 'star-gate' | 'ghost-chase';
  /** The want's own name: the look, the biome, or the level. */
  name: string;
  /** The number the line counts to: scrap to go, stars to go, or the ghost's own margin. */
  toGo: number;
}

/**
 * The clear card's own law (P-LD-06): no clear card is ever terminal. The
 * shelf's dangle leads; when the shelf is empty the card dangles the next
 * want anyway — the star gate the player is climbing toward, and past the
 * last gate, the ghost still standing on a level they have already cleared.
 * Only the ending, whose card is the film, has nothing left to want.
 */
export function nextWant(
  levels: readonly LevelDef[],
  save: MapSave,
  shelf: { name: string; scrapToGo: number } | null,
): Want | null {
  if (shelf) return { kind: 'shelf', name: shelf.name, toGo: shelf.scrapToGo };
  const biomes = buildMap(levels, save);
  const gate = biomes.find((b) => !b.unlocked && b.starsToGo > 0);
  if (gate) return { kind: 'star-gate', name: BIOME_NAMES[gate.id], toGo: gate.starsToGo };
  const ghost = biomes
    .flatMap((b) => b.nodes)
    .filter((n) => n.state === 'cleared' && !n.hasGhost)
    .sort((a, b) => a.index - b.index)[0];
  if (ghost) return { kind: 'ghost-chase', name: ghost.name, toGo: 0 };
  return null;
}
