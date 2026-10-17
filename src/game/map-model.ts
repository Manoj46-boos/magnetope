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

type MapSave = Pick<SaveData, 'stars' | 'bestMs' | 'bestGrade'>;

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
