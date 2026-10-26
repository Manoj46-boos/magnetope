import type { LevelDef } from '@/sim/types';
import type { TelemetryRecord } from '@/platform/telemetry';
import { buildDangle, type DangleReport } from './dangle';
import { buildFunnel, buildTiers, readSessions, type FunnelReport, type TierRow } from './funnel';
import { buildPacing, type PacingReport } from './pacing';
import { parseTelemetry, type AttemptEvent, type ParsedTelemetry } from './records';

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
  medianClearSeconds: number | null;
  /** Attempts the average player needs per clear; null before the first clear. */
  attemptsPerClear: number | null;
  medianRetryMs: number | null;
  /** The tallest falls the level handed out, worst first, if any were recorded. */
  worstFalls: string[];
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

/** The weekly heatmap review in numbers: whether each level's fall rate sits in the contract band. */
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
      const verdict = verdictFor(fallRate, level.fallRateTarget, band, attempts.length, minAttempts);

      const notes: string[] = [];
      if (verdict === 'too-hard') notes.push(`falls in ${percent(fallRate)} of attempts against a target of ${percent(level.fallRateTarget)}`);
      if (verdict === 'too-easy') notes.push(`falls in only ${percent(fallRate)} of attempts against a target of ${percent(level.fallRateTarget)}`);
      if (attempts.length >= minAttempts && rate(leaves.length, attempts.length) > 0.2) notes.push(`${percent(rate(leaves.length, attempts.length))} of attempts end in leaving the level`);
      if (clears.length === 0 && attempts.length >= minAttempts) notes.push('nobody has cleared it yet');

      const worstFalls = [...falls]
        .sort((a, b) => b.heightM - a.heightM)
        .slice(0, 3)
        .map((f) => `${f.heightM} m (${f.grade})`);

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
        medianClearSeconds: median(clears.flatMap((a) => (a.runSeconds === null ? [] : [a.runSeconds]))),
        attemptsPerClear: clears.length ? attempts.length / clears.length : null,
        medianRetryMs: median(parsed.retryLatenciesMs.get(level.id) ?? []),
        worstFalls,
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

const worstSpot = (report: LevelReport): string => report.worstFalls[0] ?? '-';

const levelRow = (report: LevelReport): string =>
  `| ${report.levelId} | ${report.attempts} | ${percent(report.clearRate)} | ${percent(report.fallRate)} | ${percent(report.target)} | ${report.verdict} | ${worstSpot(report)} |`;

export function toMarkdown(reports: readonly LevelReport[]): string {
  const lines = ['# Difficulty review', '', '| Level | Attempts | Clear | Fall rate | Target | Verdict | Worst fall |', '| --- | ---: | ---: | ---: | ---: | --- | --- |'];
  for (const report of reports) lines.push(levelRow(report));
  const queue = reviewQueue(reports);
  if (queue.length) {
    lines.push('', '## Review queue', '');
    for (const r of queue) lines.push(`- **${r.levelId}**: ${r.notes.join('; ') || r.verdict}`);
  }
  return lines.join('\n') + '\n';
}

/** Poki's published floors and the margins this game set past them (premium PRD Ch. 8): the numbers the Friday report judges against. */
export const BENCHMARKS = {
  /** Conversion to play: the healthy floor, and the overall and touch targets with a biome of margin over it. */
  conversionFloor: 0.65,
  conversionTarget: 0.75,
  mobileConversionTarget: 0.7,
  /** Average playtime: the floor the platform publishes, and the target one biome past it. */
  playtimeFloorMinutes: 5,
  playtimeTargetMinutes: 7,
  /** The load law's own ceilings for the first touch, by the device class the visit booted on. */
  firstTouchCeilingS: { desktop: 3, touch: 6 } as const,
  /** The economy sim's over-accumulation law: how big a banked Scrap pile is allowed to be. */
  overAccumulationCeiling: 0.02,
} as const;

/** The five sections, in the order the weekly ritual reads them (R-AN-07). */
export const FRIDAY_SECTIONS = ['difficulty', 'session-0 funnel', 'economy pacing', 'dangle', 'perf tiers'] as const;

export interface FridayReport {
  difficulty: LevelReport[];
  funnel: FunnelReport;
  pacing: PacingReport;
  dangle: DangleReport;
  /** The boot tier census over every visit, fresh or returning. */
  tiers: TierRow[];
  /** What the week's numbers arm: a number that arms no decision is deleted, not admired (Kaushik). */
  actions: string[];
}

const firstInputShare = (funnel: FunnelReport): number => funnel.steps.find((s) => s.step === 'first-input')?.share ?? 0;

function weekActions(funnel: FunnelReport, pacing: PacingReport, dangle: DangleReport, queue: readonly LevelReport[]): string[] {
  const actions: string[] = [];
  const conversion = firstInputShare(funnel);
  if (funnel.visits > 0 && conversion < BENCHMARKS.conversionFloor) {
    actions.push(`first-input conversion ${percent(conversion)} sits under Poki's ${percent(BENCHMARKS.conversionFloor)} floor: the boot or the opener is losing players before they ever touch the game — fix this before anything else`);
  } else if (funnel.visits > 0 && conversion < BENCHMARKS.conversionTarget) {
    actions.push(`first-input conversion ${percent(conversion)} clears the floor but sits under the ${percent(BENCHMARKS.conversionTarget)} target: re-read the opener's first four seconds`);
  }
  if (funnel.worstDrop) actions.push(`the steepest funnel drop is at ${funnel.worstDrop.step} (${funnel.worstDrop.dropped} of the visits that got there fell away): the playtest fix list's next target`);
  if (pacing.medianMinutes !== null && pacing.medianMinutes < BENCHMARKS.playtimeFloorMinutes) actions.push(`the median visit lasts ${pacing.medianMinutes.toFixed(1)} min, under the ${BENCHMARKS.playtimeFloorMinutes} min floor: read the difficulty queue for where they stop`);
  if (queue.length > 0) actions.push(`${queue.length} level(s) sit outside their fall-rate band: the review queue is the retune list`);
  if (dangle.shown > 0 && dangle.converted === 0) actions.push(`${dangle.shown} dangles shown and none taken: reprice the shelf or re-rotate the card's pool`);
  if (pacing.sinkRatio !== null && pacing.medianUnlocksPerVisit === 0) actions.push(`the median visit never takes a look off the shelf (sink ratio ${pacing.sinkRatio.toFixed(2)}): prices, or where the shelf sits in view`);
  if (funnel.medianFirstTouchS !== null && funnel.medianFirstTouchS > Math.max(BENCHMARKS.firstTouchCeilingS.desktop, BENCHMARKS.firstTouchCeilingS.touch)) {
    actions.push(`the first touch lands ${funnel.medianFirstTouchS} s in, past the load law's ceilings: the boot or the opener is slow where it counts`);
  }
  return actions;
}

/** The weekly retune ritual's whole input (R-AN-07): all five sections from one export. */
export function buildFridayReport(records: readonly TelemetryRecord[], levels: readonly LevelDef[], options: ReportOptions = {}): FridayReport {
  const difficulty = buildReport(parseTelemetry(records), levels, options);
  const funnel = buildFunnel(records, levels);
  const pacing = buildPacing(readSessions(records));
  const dangle = buildDangle(records);
  const tiers = buildTiers(records);
  return { difficulty, funnel, pacing, dangle, tiers, actions: weekActions(funnel, pacing, dangle, reviewQueue(difficulty)) };
}

const minutes = (value: number | null): string => (value === null ? '—' : `${value.toFixed(1)} min`);

export function fridayToMarkdown(report: FridayReport): string {
  const lines: string[] = ['# Friday report', ''];

  lines.push('## Difficulty', '', '| Level | Attempts | Clear | Fall rate | Target | Verdict | Worst fall |', '| --- | ---: | ---: | ---: | ---: | --- | --- |');
  for (const level of report.difficulty) lines.push(levelRow(level));
  const queue = reviewQueue(report.difficulty);
  if (queue.length) lines.push('', `The review queue: ${queue.map((r) => r.levelId).join(', ')}.`);

  lines.push('', '## Session-0 funnel', '', '| Step | Reached | Share | Fell away |', '| --- | ---: | ---: | ---: |');
  for (const step of report.funnel.steps) lines.push(`| ${step.step} | ${step.reached} | ${percent(step.share)} | ${step.dropped === null ? '—' : step.dropped} |`);
  lines.push(`First touch: ${report.funnel.medianFirstTouchS === null ? '—' : `${report.funnel.medianFirstTouchS} s in (median)`}, against the load law's ${BENCHMARKS.firstTouchCeilingS.desktop} s desktop / ${BENCHMARKS.firstTouchCeilingS.touch} s touch ceilings.`);
  lines.push('', '| Locale | Device | Visits | First input | First clear |', '| --- | --- | ---: | ---: | ---: |');
  for (const segment of report.funnel.segments) {
    lines.push(`| ${segment.locale} | ${segment.device} | ${segment.visits} | ${percent(segment.visits === 0 ? 0 : segment.firstInput / segment.visits)} | ${percent(segment.visits === 0 ? 0 : segment.firstClear / segment.visits)} |`);
  }

  lines.push('', '## Economy pacing', '', '| Measure | This week |', '| --- | ---: |');
  lines.push(`| Visits | ${report.pacing.visits} |`);
  lines.push(`| Scrap earned per visit, median | ${report.pacing.medianEarnPerVisit ?? '—'} |`);
  lines.push(`| Scrap spent per visit, median | ${report.pacing.medianSpendPerVisit ?? '—'} |`);
  lines.push(`| Unlocks per visit, median | ${report.pacing.medianUnlocksPerVisit ?? '—'} |`);
  lines.push(`| Visit length, median | ${minutes(report.pacing.medianMinutes)} against the ${BENCHMARKS.playtimeTargetMinutes} min target |`);
  lines.push(`| Sink ratio (spent of earned) | ${report.pacing.sinkRatio === null ? '—' : report.pacing.sinkRatio.toFixed(2)} |`);

  lines.push('', '## Dangle', '', '| Look | Shown | Converted |', '| --- | ---: | ---: |');
  for (const look of report.dangle.byLook) lines.push(`| ${look.id} | ${look.shown} | ${look.converted} |`);
  lines.push(`Overall: ${report.dangle.converted} of ${report.dangle.shown} shown dangles converted.`);

  lines.push('', '## Perf tiers', '', '| Tier | Visits | Share |', '| --- | ---: | ---: |');
  for (const tier of report.tiers) lines.push(`| ${tier.tier} | ${tier.visits} | ${percent(tier.share)} |`);

  lines.push('', '## The week\u2019s decisions', '');
  if (report.actions.length === 0) lines.push('Nothing outside a band: keep the build, run the next playtest.');
  for (const action of report.actions) lines.push(`- ${action}`);

  return lines.join('\n') + '\n';
}

