import type { TelemetryRecord } from '@/platform/telemetry';
import type { LevelDef } from '@/sim/types';

/**
 * The session-0 funnel reader (premium PRD R-AN-04/06): splits the export into
 * visits at their boot records, then counts how many first-time visits climb
 * each of the seven steps. The drop between adjacent steps is the playtest
 * fix list — the funnel says which step lost them, never why.
 */

export const FUNNEL_STEPS = ['boot', 'first-input', 'first-clear', 'level-3-entry', 'first-par', 'first-ghost', 'first-cosmetic'] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

/** One visit: every record from its boot record up to the next one. */
export interface SessionView {
  records: TelemetryRecord[];
  /** The save had cleared nothing when the visit booted, so this is the player's own session 0. */
  fresh: boolean;
  locale: string;
  device: string;
  tier: string;
  /** The visit's last reported length in seconds, or null when nothing ever flushed. */
  seconds: number | null;
}

export interface FunnelStepRow {
  step: FunnelStep;
  reached: number;
  share: number;
  /** How many of the visits that reached the previous step fell off before this one. */
  dropped: number | null;
}

export interface SegmentRow {
  locale: string;
  device: string;
  visits: number;
  firstInput: number;
  firstClear: number;
}

export interface TierRow {
  tier: string;
  visits: number;
  share: number;
}

export interface FunnelReport {
  /** First-time visits: the population the ladder reads. */
  visits: number;
  steps: FunnelStepRow[];
  /** The step that lost the most of the visits that reached it (R-AN-06's fix target). */
  worstDrop: FunnelStepRow | null;
  /** The median seconds from boot to the first play input, over the visits that touched the game. */
  medianFirstTouchS: number | null;
  /** The locale x device cross-tab (R-AN-09). */
  segments: SegmentRow[];
}

const UNKNOWN = 'unknown';

const count = (action: string): number | null => (/^\d+$/.test(action) ? Number(action) : null);

/** The boot record's segment, in the channel's own alphabet: locale, device class, tier, pipe-separated. */
function bootView(record: TelemetryRecord): SessionView {
  const [locale = UNKNOWN, device = UNKNOWN, tier = UNKNOWN] = record.action.split('|');
  return {
    records: [record],
    fresh: record.what === 'fresh',
    locale: locale || UNKNOWN,
    device: device || UNKNOWN,
    tier: tier || UNKNOWN,
    seconds: null,
  };
}

/** Splits the stream into visits at their boot records. Records before the first boot stay with the level readers. */
export function readSessions(records: readonly TelemetryRecord[]): SessionView[] {
  const visits: SessionView[] = [];
  for (const record of records) {
    if (record.category === 'boot') visits.push(bootView(record));
    else if (visits.length > 0) visits[visits.length - 1]!.records.push(record);
  }
  for (const visit of visits) {
    const length = [...visit.records].reverse().find((r) => r.category === 'session' && r.what === 'length');
    visit.seconds = length ? count(length.action) : null;
  }
  return visits;
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const isClear = (record: TelemetryRecord): boolean => record.category === 'attempt' && record.action === 'clear';

/** Builds the seven-step ladder over the first-time visits. */
export function buildFunnel(records: readonly TelemetryRecord[], levels: readonly LevelDef[]): FunnelReport {
  const visits = readSessions(records).filter((visit) => visit.fresh);
  const thirdLevel = levels[2]?.id ?? '';
  const parSeconds = new Map(levels.map((level) => [level.id, level.parSeconds]));

  const reached: Record<FunnelStep, number> = {
    boot: visits.length,
    'first-input': 0,
    'first-clear': 0,
    'level-3-entry': 0,
    'first-par': 0,
    'first-ghost': 0,
    'first-cosmetic': 0,
  };
  const firstTouchS: number[] = [];

  const underPar = (record: TelemetryRecord): boolean => {
    const ceiling = parSeconds.get(record.what);
    const seconds = record.category === 'time' ? count(record.action) : null;
    return ceiling !== undefined && seconds !== null && seconds <= ceiling;
  };

  for (const visit of visits) {
    const input = visit.records.find((r) => r.category === 'input' && r.what === 'first');
    if (input) {
      reached['first-input']++;
      const seconds = count(input.action);
      if (seconds !== null) firstTouchS.push(seconds);
    }
    if (visit.records.some(isClear)) reached['first-clear']++;
    if (visit.records.some((r) => r.category === 'level' && r.what === thirdLevel && r.action === 'enter')) reached['level-3-entry']++;
    if (visit.records.some(underPar)) reached['first-par']++;
    if (visit.records.some((r) => r.category === 'ghost' && r.action === 'set')) reached['first-ghost']++;
    if (visit.records.some((r) => r.category === 'cosmetic' && r.action === 'unlock')) reached['first-cosmetic']++;
  }

  const steps: FunnelStepRow[] = [];
  let previous: number | null = null;
  for (const step of FUNNEL_STEPS) {
    const got = reached[step];
    steps.push({
      step,
      reached: got,
      share: visits.length === 0 ? 0 : got / visits.length,
      dropped: previous === null ? null : previous - got,
    });
    previous = got;
  }
  const measurable = steps.filter((s) => s.dropped !== null && s.dropped > 0);
  const worstDrop = measurable.sort((a, b) => b.dropped! - a.dropped!)[0] ?? null;

  const segments = new Map<string, SegmentRow>();
  for (const visit of visits) {
    const key = `${visit.locale}|${visit.device}`;
    const row = segments.get(key) ?? { locale: visit.locale, device: visit.device, visits: 0, firstInput: 0, firstClear: 0 };
    row.visits++;
    if (visit.records.some((r) => r.category === 'input' && r.what === 'first')) row.firstInput++;
    if (visit.records.some(isClear)) row.firstClear++;
    segments.set(key, row);
  }

  return {
    visits: visits.length,
    steps,
    worstDrop,
    medianFirstTouchS: median(firstTouchS),
    segments: [...segments.values()].sort((a, b) => b.visits - a.visits || a.locale.localeCompare(b.locale) || a.device.localeCompare(b.device)),
  };
}

/** The boot records' own tier census, over every visit — the perf section's half of the picture. */
export function buildTiers(records: readonly TelemetryRecord[]): TierRow[] {
  const visits = readSessions(records);
  const byTier = new Map<string, number>();
  for (const visit of visits) byTier.set(visit.tier, (byTier.get(visit.tier) ?? 0) + 1);
  return [...byTier.entries()]
    .map(([tier, onTier]) => ({ tier, visits: onTier, share: visits.length === 0 ? 0 : onTier / visits.length }))
    .sort((a, b) => b.visits - a.visits || a.tier.localeCompare(b.tier));
}
