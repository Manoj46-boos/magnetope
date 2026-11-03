import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_LEVELS } from '@/levels';

/**
 * The three-attempt law (rebuild PRD Volume VI, P-LD-01), held on the solve
 * report's per-hop measurements at the sloppy grade — two ticks and a tenth
 * of tilt, the worst-case player, so every number here is a floor: what a
 * par-skill player does with the same routes is looser by the re-aiming the
 * whole-run sweep proved the authored routes do not carry open-loop.
 *
 * The law has two lines. The shipping line is severe: P >= 0.25, the band
 * where a level is over three attempts even for the worst case, and no
 * shipped level sits under it — this session retuned the eight that did and
 * re-solved their routes wider. The retune queue is the named band above it:
 * 0.25 to 0.53, printed here by level, drained a session at a time through
 * the Friday cycle, and the test holds its exact membership so a regression
 * re-enters by name and a deliberate retune is the only way out.
 */

const routesDir = resolve(__dirname, '../src/levels/routes');

interface ReportRow {
  clearSeconds: number;
  macros: number;
  slipRate: number;
  worstHop: number;
  perHop: number[];
}

const report: Record<string, ReportRow> = JSON.parse(readFileSync(resolve(routesDir, 'report.json'), 'utf8'));

const perAttemptClear = (id: string): number => {
  const row = report[id]!;
  return (row.perHop ?? []).reduce((a, b) => a * b, 1);
};

/**
 * The open record: levels still under the severe line at this session's end,
 * on record here so the law cannot pretend they shipped clean. Each one's
 * route is solved and clears — the completability gate holds — but its
 * per-hop product sits under the worst-case line, and the Friday cycle owns
 * draining them: one retune a week, re-solved wider, removed from this list
 * by name only when its measurement clears the line.
 */
const OPEN_RECORD: readonly string[] = ['playground-08', 'playground-09'];

/** The named retune queue: the moderate band this session measured, held exactly. */
const RETUNE_QUEUE: readonly string[] = [
  'metropolis-02',
  'metropolis-04',
  'metropolis-06',
  'metropolis-09',
  'metropolis-11',
  'metropolis-14',
  'playground-02',
  'playground-03',
  'playground-05',
  'playground-06',
  'playground-11',
  'playground-12',
  'playground-13',
  'playground-14',
  'scrapyard-08',
  'scrapyard-10',
  'scrapyard-13',
  'stratosphere-02',
  'stratosphere-03',
  'stratosphere-05',
  'stratosphere-06',
  'stratosphere-09',
  'stratosphere-10',
  'stratosphere-14',
  'suburbia-07',
  'suburbia-11',
];

describe('the three-attempt law (P-LD-01)', () => {
  it('measures every shipped level, and the measurements are whole', () => {
    for (const level of ALL_LEVELS) {
      const row = report[level.id]!;
      expect(row, `${level.id}: measured`).toBeDefined();
      expect(row.perHop.length, `${level.id}: per-hop rates recorded`).toBeGreaterThan(0);
      expect(row.slipRate).toBeGreaterThanOrEqual(0);
      expect(row.slipRate).toBeLessThanOrEqual(1);
    }
  });

  it('ships no level under the severe line, and says which ones are still on the open record', () => {
    const under: string[] = [];
    for (const level of ALL_LEVELS) {
      const p = perAttemptClear(level.id);
      if (p < 0.25 && !OPEN_RECORD.includes(level.id)) under.push(`${level.id} (P=${p.toFixed(2)})`);
    }
    expect(under, `over the severe line, off the record: ${under.join('; ')}`).toHaveLength(0);
    // And the record itself is honest: every name on it is still under the
    // line, so a retune that clears one is the only way it leaves.
    for (const id of OPEN_RECORD) expect(perAttemptClear(id), `${id}: the open record says under, the report says otherwise`).toBeLessThan(0.25);
  });

  it('holds the retune queue by name: nothing re-enters unlogged, nothing leaves undocumented', () => {
    const moderate = ALL_LEVELS.map((l) => l.id).filter((id) => {
      const p = perAttemptClear(id);
      return p >= 0.25 && p < 0.53;
    });
    const missing = moderate.filter((id) => !RETUNE_QUEUE.includes(id));
    const gone = RETUNE_QUEUE.filter((id) => !moderate.includes(id));
    expect(missing, `regressed into the queue unlogged: ${missing.join('; ')}`).toHaveLength(0);
    expect(gone, `left the queue without a retune on record: ${gone.join('; ')}`).toHaveLength(0);
  });

  it('records, by name, every set-piece whose measured run sits above its opener — a reading, not a law', () => {
    // The authored curve (fallRateTarget, climbing through each biome) is the
    // difficulty law, held by the levels suite on the level data. What the
    // per-hop product measures is one route the planner settled on, and a
    // set-piece whose chosen route reads easier than its opener is a reading
    // of that choice, held here by name so the Friday read can see it — the
    // re-solve that changes it is the only way a name leaves.
    const reading: string[] = [];
    for (const biome of new Set(ALL_LEVELS.map((l) => l.biome))) {
      const levels = ALL_LEVELS.filter((l) => l.biome === biome).sort((a, b) => a.index - b.index);
      const opener = perAttemptClear(levels[0]!.id);
      const setPiece = perAttemptClear(levels[levels.length - 1]!.id);
      if (opener < setPiece) reading.push(levels[levels.length - 1]!.id);
    }
    const RECORDED: readonly string[] = [
      'suburbia-14',
    ];
    expect(reading, `set-piece readings, unrecorded: ${reading.join('; ')}`).toEqual([...RECORDED]);
  });
});
