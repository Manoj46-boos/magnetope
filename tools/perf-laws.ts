import type { QualityTier } from '@/render/quality';

/**
 * The performance chapter's numbers (premium PRD 23.3), in the one place the
 * tests gate against and the budget doc quotes. Every constant here is a law
 * something enforces: the load gate owns the cold-load lines, the browser
 * battery owns the frame laws, and `docs/PERF_BUDGET.md` renders this table.
 */

/** Click-to-playability, from navigation to the first level being input-ready. */
export const C2P_BUDGET_MS = { desktop: 1500, mid: 4000, low: 10000 } as const;

/** After the first input, no main-thread task may run this long (R-PE-12). */
export const LONGTASK_MS = 50;

/** A retry rebuilds the level inside this (R-PE-13); the promise to players is 400. */
export const RESTART_BUDGET_MS = 50;

/** From the clear card's next tap to the next level's first drawn frame (R-PE-13). */
export const LEVEL_LINK_BUDGET_MS = 1000;

/** The frame rate a tier promises (R-PE-03): 60 where the target is 60, 30 at the floor. */
export const FPS_FLOOR: Record<QualityTier, number> = { high: 60, mid: 60, low: 30 };
