import type { SessionView } from './funnel';

/**
 * The economy pacing reader (premium PRD R-AN-04): what the Scrap economy
 * actually paid and took per visit, read from the scrap and cosmetic records
 * the game flushes. The medians feed the Friday report; the sink ratio is the
 * sim's over-accumulation law, read on real players instead of a population.
 */

export interface PacingReport {
  visits: number;
  medianEarnPerVisit: number | null;
  medianSpendPerVisit: number | null;
  medianUnlocksPerVisit: number | null;
  /** The visit length the session records last reported, in minutes. */
  medianMinutes: number | null;
  /** Total Scrap spent over total Scrap earned: null when nothing was ever earned. */
  sinkRatio: number | null;
}

const amount = (action: string): number => (/^\d+$/.test(action) ? Number(action) : 0);

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const total = (visit: SessionView, what: 'earn' | 'spend'): number =>
  visit.records.filter((r) => r.category === 'scrap' && r.what === what).reduce((sum, r) => sum + amount(r.action), 0);

export function buildPacing(sessions: readonly SessionView[]): PacingReport {
  const visits = sessions.length;
  const earned = sessions.map((visit) => total(visit, 'earn'));
  const spent = sessions.map((visit) => total(visit, 'spend'));
  const unlocks = sessions.map((visit) => visit.records.filter((r) => r.category === 'cosmetic' && r.action === 'unlock').length);
  const minutes: number[] = [];
  for (const visit of sessions) if (visit.seconds !== null) minutes.push(visit.seconds / 60);

  const earnTotal = earned.reduce((sum, n) => sum + n, 0);
  const spendTotal = spent.reduce((sum, n) => sum + n, 0);
  return {
    visits,
    medianEarnPerVisit: median(earned),
    medianSpendPerVisit: median(spent),
    medianUnlocksPerVisit: median(unlocks),
    medianMinutes: median(minutes),
    sinkRatio: earnTotal === 0 ? null : spendTotal / earnTotal,
  };
}
