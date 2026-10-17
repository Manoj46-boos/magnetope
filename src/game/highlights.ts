import type { BiomeId } from '@/sim/types';

export interface FallHighlight {
  levelId: string;
  levelName: string;
  biome: BiomeId;
  heightMeters: number;
  bounces: number;
  junk: number;
  grade: string;
  score: number;
}

/** The session's funniest falls, best first (PRD 5.6). Lives in memory: it is a highlight reel, not a record. */
export class HighlightStrip {
  private entries: FallHighlight[] = [];

  constructor(private readonly limit = 5) {}

  add(highlight: FallHighlight): void {
    this.entries.push(highlight);
    this.entries.sort((a, b) => b.score - a.score);
    if (this.entries.length > this.limit) this.entries.length = this.limit;
  }

  get list(): readonly FallHighlight[] {
    return this.entries;
  }
}
