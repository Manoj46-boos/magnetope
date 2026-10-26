import type { TelemetryRecord } from '@/platform/telemetry';

/**
 * The dangle-choice reader (premium PRD R-AN-04): of the looks the clear card
 * named, how many were later taken — in the same visit or a later one. The
 * stream's own order is the only witness; no look is counted converted by an
 * unlock that happened before it was ever dangled.
 */

export interface DangleRow {
  id: string;
  shown: number;
  converted: number;
}

export interface DangleReport {
  shown: number;
  converted: number;
  /** Converted over shown; null when the card never dangled anything. */
  ratio: number | null;
  byLook: DangleRow[];
}

export function buildDangle(records: readonly TelemetryRecord[]): DangleReport {
  const unlockedAfter = new Map<string, number[]>();
  records.forEach((record, at) => {
    if (record.category === 'cosmetic' && record.action === 'unlock') unlockedAfter.set(record.what, [...(unlockedAfter.get(record.what) ?? []), at]);
  });

  const perLook = new Map<string, DangleRow>();
  let shown = 0;
  let converted = 0;
  records.forEach((record, at) => {
    if (record.category !== 'dangle' || record.action !== 'shown') return;
    shown++;
    const row = perLook.get(record.what) ?? { id: record.what, shown: 0, converted: 0 };
    row.shown++;
    if ((unlockedAfter.get(record.what) ?? []).some((unlockAt) => unlockAt > at)) {
      row.converted++;
      converted++;
    }
    perLook.set(record.what, row);
  });

  return {
    shown,
    converted,
    ratio: shown === 0 ? null : converted / shown,
    byLook: [...perLook.values()].sort((a, b) => b.shown - a.shown || a.id.localeCompare(b.id)),
  };
}
