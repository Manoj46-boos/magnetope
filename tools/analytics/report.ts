import type { LevelDef } from '@/sim/types';
import { clusterFalls, type Cluster } from './cluster';
import type { AttemptEvent, FallEvent, ParsedTelemetry } from './records';

export type Verdict = 'in-band' | 'too-hard' | 'too-easy' | 'sparse';

export interface LevelReport {
  levelId: string;
  entries: number;
  attempts: number;
  clears: number;
  restarts: number;
  leaves: number;
  clearRate: number;
  /** Share of attempts that contained at least one fall. */
  fallRate: number;
  target: number;
  verdict: Verdict;
  medianClearMs: number | null;
  /** Attempts the average player needs per clear; null before the first clear. */
  attemptsPerClear: number | null;
  medianRetryMs: number | null;
  /** Where falls bunch up. */
  hotspots: Cluster[];
  /** Where players were last seen failing before they left, ranked by how many left there. */
  quitPoints: Cluster[];
  falls: FallEvent[];
  notes: string[];
}

export interface ReportOptions {
  /** How far the observed fall rate may sit from the level's target before it is flagged. */
  band?: number;
  /** Attempts below this are too few to judge. */
  minAttempts?: number;
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const rate = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);
const percent = (value: number): string => `${(value * 100).toFixed(0)}%`;

function verdictFor(observed: number, target: number, band: number, attempts: number, minAttempts: number): Verdict {
  if (attempts < minAttempts) return 'sparse';
  if (observed > target + band) return 'too-hard';
  if (observed < target - band) return 'too-easy';
  return 'in-band';
}

/** The weekly heatmap review in numbers: where players fail, whether that sits in the contract band, where they quit. */
export function buildReport(parsed: ParsedTelemetry, levels: readonly LevelDef[], options: ReportOptions = {}): LevelReport[] {
  const { band = 0.15, minAttempts = 30 } = options;
  const attemptsByLevel = new Map<string, AttemptEvent[]>();
  for (const attempt of parsed.attempts) attemptsByLevel.set(attempt.levelId, [...(attemptsByLevel.get(attempt.levelId) ?? []), attempt]);

  return levels
    .filter((level) => parsed.entries.has(level.id) || attemptsByLevel.has(level.id))
    .map((level) => {
      const attempts = attemptsByLevel.get(level.id) ?? [];
      const clears = attempts.filter((a) => a.outcome === 'clear');
      const leaves = attempts.filter((a) => a.outcome === 'leave');
      const fallRate = rate(attempts.filter((a) => a.falls > 0).length, attempts.length);
      const falls = parsed.falls.filter((f) => f.levelId === level.id);
      const quitFalls = leaves.flatMap((a) => (a.lastFall ? [a.lastFall.at] : []));
      const verdict = verdictFor(fallRate, level.fallRateTarget, band, attempts.length, minAttempts);

      const notes: string[] = [];
      if (verdict === 'too-hard') notes.push(`falls in ${percent(fallRate)} of attempts against a target of ${percent(level.fallRateTarget)}`);
      if (verdict === 'too-easy') notes.push(`falls in only ${percent(fallRate)} of attempts against a target of ${percent(level.fallRateTarget)}`);
      if (attempts.length >= minAttempts && rate(leaves.length, attempts.length) > 0.2) notes.push(`${percent(rate(leaves.length, attempts.length))} of attempts end in leaving the level`);
      if (clears.length === 0 && attempts.length >= minAttempts) notes.push('nobody has cleared it yet');

      return {
        levelId: level.id,
        entries: parsed.entries.get(level.id) ?? 0,
        attempts: attempts.length,
        clears: clears.length,
        restarts: attempts.filter((a) => a.outcome === 'restart').length,
        leaves: leaves.length,
        clearRate: rate(clears.length, attempts.length),
        fallRate,
        target: level.fallRateTarget,
        verdict,
        medianClearMs: median(clears.map((a) => a.runMs)),
        attemptsPerClear: clears.length ? attempts.length / clears.length : null,
        medianRetryMs: median(parsed.retryLatenciesMs.get(level.id) ?? []),
        hotspots: clusterFalls(falls.map((f) => f.at)),
        quitPoints: clusterFalls(quitFalls, { maxK: 3 }),
        falls,
        notes,
      };
    });
}

/** The review queue for the designer: every level outside its band or with a warning, the biggest drift first. */
export function reviewQueue(reports: readonly LevelReport[]): LevelReport[] {
  return reports
    .filter((r) => r.verdict === 'too-hard' || r.verdict === 'too-easy' || r.notes.length > 0)
    .sort((a, b) => Math.abs(b.fallRate - b.target) - Math.abs(a.fallRate - a.target));
}

export function toMarkdown(reports: readonly LevelReport[]): string {
  const lines = ['# Difficulty review', '', '| Level | Attempts | Clear | Fall rate | Target | Verdict | Worst spot |', '| --- | ---: | ---: | ---: | ---: | --- | --- |'];
  for (const r of reports) {
    const top = r.hotspots[0];
    const where = top ? `(${top.center.x.toFixed(0)}, ${top.center.y.toFixed(0)}) ${percent(top.share)}` : '-';
    lines.push(`| ${r.levelId} | ${r.attempts} | ${percent(r.clearRate)} | ${percent(r.fallRate)} | ${percent(r.target)} | ${r.verdict} | ${where} |`);
  }
  const queue = reviewQueue(reports);
  if (queue.length) {
    lines.push('', '## Review queue', '');
    for (const r of queue) lines.push(`- **${r.levelId}**: ${r.notes.join('; ') || r.verdict}`);
  }
  return lines.join('\n') + '\n';
}
