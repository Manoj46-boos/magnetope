import type { TelemetryRecord } from '@/platform/telemetry';
import type { LevelDef } from '@/sim/types';
import { readSessions } from './funnel';
import { parseTelemetry } from './records';

/**
 * The stuck/drift read (premium PRD R-RT-10): the two signatures Poki's own
 * failure diagnostics name, detected from the event trails the way the
 * commission demanded — a retry is worth a thousand survey answers, and
 * neither signature is ever guessed from a hunch.
 *
 * Stuck is a fail-repeat loop: one player restarting the same level over and
 * over without a clear between the tries. Four is the line, because the
 * campaign's own par honesty says a level in band clears in two to three
 * attempts — three tries is a level being learned, four in a row is a level
 * fighting the player. The retune cycle (R-LD-16) is the action it arms.
 *
 * Drift is a clean exit mid-loop: a visit whose last level act was a clear,
 * with no next level ever entered — the loop had somewhere to go and the
 * player quietly left anyway. The final level's clear is the ending, not
 * drift; leaving after it is finishing. The action it arms is the clear
 * card's dangle rotation and a celebrate-cadence audit.
 */

/** Restarts in a row at one level, in one visit, before the read calls it a loop. */
export const STUCK_STREAK = 4;
/** A level needs this many clears before its drift share is worth reading. */
export const DRIFT_MIN_CLEARS = 6;
/** The share of a level's clears that end the visit right there before the read flags it. */
export const DRIFT_SHARE = 0.5;

export interface StuckRow {
  levelId: string;
  /** Visits that rode a fail-repeat streak to the law's line here. */
  players: number;
  /** The longest streak any of them rode, restarts in a row. */
  worstStreak: number;
  /** Stuck visits that never cleared the level in that visit. */
  gaveUp: number;
}

export interface DriftRow {
  levelId: string;
  clears: number;
  /** Visits that ended straight on this clear, campaign unfinished. */
  cleanExits: number;
  /** cleanExits over clears; 0 before any clear. */
  share: number;
  /** True when the share clears the law's line on enough clears to read. */
  flagged: boolean;
}

export interface StuckDriftReport {
  stuck: StuckRow[];
  /** Every level with at least one clear, worst share first. */
  drift: DriftRow[];
}

/** The longest run of restarts at one level inside one visit; a clear, a leave or a level change breaks it. */
function worstStreakIn(records: readonly TelemetryRecord[]): Map<string, number> {
  const attempts = parseTelemetry(records).attempts;
  const streaks = new Map<string, number>();
  let running = 0;
  let runningLevel = '';
  for (const attempt of attempts) {
    if (attempt.outcome === 'restart' && attempt.levelId === runningLevel) {
      running += 1;
    } else if (attempt.outcome === 'restart') {
      running = 1;
    } else {
      running = 0;
    }
    runningLevel = attempt.outcome === 'restart' ? attempt.levelId : '';
    if (running > (streaks.get(attempt.levelId) ?? 0)) streaks.set(attempt.levelId, running);
  }
  return streaks;
}

/** True when the visit entered any level after its last attempt record — the loop kept going. */
function enteredAnotherLevel(records: readonly TelemetryRecord[]): boolean {
  let lastAttempt = -1;
  for (let index = records.length - 1; index >= 0; index--) {
    if (records[index]!.category === 'attempt') {
      lastAttempt = index;
      break;
    }
  }
  return records.some((record, index) => index > lastAttempt && record.category === 'level' && record.action === 'enter');
}

export function buildStuckDrift(records: readonly TelemetryRecord[], levels: readonly LevelDef[]): StuckDriftReport {
  const finalLevel = levels[levels.length - 1]?.id ?? '';
  const stuckByLevel = new Map<string, StuckRow>();
  const driftByLevel = new Map<string, DriftRow>();

  for (const visit of readSessions(records)) {
    const attempts = parseTelemetry(visit.records).attempts;
    const clearedLevels = new Set(attempts.filter((a) => a.outcome === 'clear').map((a) => a.levelId));

    for (const [levelId, streak] of worstStreakIn(visit.records)) {
      if (streak < STUCK_STREAK) continue;
      const row = stuckByLevel.get(levelId) ?? { levelId, players: 0, worstStreak: 0, gaveUp: 0 };
      row.players += 1;
      row.worstStreak = Math.max(row.worstStreak, streak);
      if (!clearedLevels.has(levelId)) row.gaveUp += 1;
      stuckByLevel.set(levelId, row);
    }

    const last = attempts[attempts.length - 1];
    if (last && last.outcome === 'clear' && last.levelId !== finalLevel && !enteredAnotherLevel(visit.records)) {
      const row = driftByLevel.get(last.levelId) ?? { levelId: last.levelId, clears: 0, cleanExits: 0, share: 0, flagged: false };
      row.cleanExits += 1;
      driftByLevel.set(last.levelId, row);
    }
  }

  for (const attempt of parseTelemetry(records).attempts) {
    if (attempt.outcome !== 'clear') continue;
    const row = driftByLevel.get(attempt.levelId) ?? { levelId: attempt.levelId, clears: 0, cleanExits: 0, share: 0, flagged: false };
    row.clears += 1;
    driftByLevel.set(attempt.levelId, row);
  }

  const drift = [...driftByLevel.values()]
    .map((row) => ({ ...row, share: row.clears === 0 ? 0 : row.cleanExits / row.clears, flagged: false }))
    .map((row) => ({ ...row, flagged: row.clears >= DRIFT_MIN_CLEARS && row.share >= DRIFT_SHARE }))
    .sort((a, b) => b.share - a.share || b.clears - a.clears || a.levelId.localeCompare(b.levelId));

  return {
    stuck: [...stuckByLevel.values()].sort((a, b) => b.players - a.players || b.worstStreak - a.worstStreak || a.levelId.localeCompare(b.levelId)),
    drift,
  };
}
