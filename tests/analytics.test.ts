import { Window, type Element as DomElement } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import type { Vec2 } from '@/core/mathx';
import { ALL_LEVELS, levelById } from '@/levels';
import { COSMETICS } from '@/config/cosmetics';
import { AttemptRecorder, Telemetry, type TelemetryRecord } from '@/platform/telemetry';
import { clusterFalls } from '../tools/analytics/cluster';
import { buildFunnel, buildTiers, readSessions } from '../tools/analytics/funnel';
import { renderHeatmap } from '../tools/analytics/heatmap';
import { buildPacing } from '../tools/analytics/pacing';
import { buildDangle } from '../tools/analytics/dangle';
import { parseTelemetry, readJsonLines } from '../tools/analytics/records';
import { BENCHMARKS, buildFridayReport, fridayToMarkdown, FRIDAY_SECTIONS, toMarkdown, buildReport, reviewQueue } from '../tools/analytics/report';

/** Plays attempts through the shipped recorder and returns exactly what it would have flushed. */
function recordSession(levelId: string, attempts: Array<{ falls: Vec2[]; outcome: 'clear' | 'restart' | 'leave'; ms?: number }>): TelemetryRecord[] {
  const sent: TelemetryRecord[] = [];
  let clock = 0;
  const telemetry = new Telemetry({ send: (batch) => sent.push(...batch), canFlush: () => true, now: () => clock });
  const recorder = new AttemptRecorder(telemetry, () => clock);
  attempts.forEach((attempt, index) => {
    recorder.begin(levelId);
    for (const at of attempt.falls) {
      clock += 4000;
      recorder.fall(9, at, 'B');
    }
    clock += attempt.ms ?? 30000;
    recorder.finish(attempt.outcome, attempt.ms ?? 30000, attempt.outcome === 'clear' ? 2 : 0);
    clock += 1500;
    // the queue caps at 200, the way the real one does: flush at a natural stop every few attempts
    if ((index + 1) % 10 === 0) telemetry.flush();
  });
  telemetry.flush();
  return sent;
}

const around = (rng: Rng, centre: Vec2, spread: number): Vec2 => ({
  x: centre.x + (rng.next() - 0.5) * spread,
  y: centre.y + (rng.next() - 0.5) * spread,
});

interface VisitPlan {
  fresh?: boolean;
  locale?: string;
  device?: string;
  tier?: string;
  /** The visit's idle tail, which the length record ends up reporting. */
  idleSeconds?: number;
  input?: boolean;
  attempts?: Array<{ level: string; outcome: 'clear' | 'restart' | 'leave'; ms: number }>;
  ghost?: string;
  unlock?: string;
  dangles?: string[];
  earn?: number[];
  spend?: number[];
}

const BUYABLE = COSMETICS.find((c) => c.acquire.how === 'scrap')!;
const PRICE = BUYABLE.acquire.how === 'scrap' ? BUYABLE.acquire.price : 0;

/**
 * Plays one visit through the shipped recorder the way the game records it: the boot
 * record first, then the attempts, then the clear-time records in the order the clear
 * flow makes them, and the flush that reports the visit's length.
 */
function playVisit(plan: VisitPlan): TelemetryRecord[] {
  const sent: TelemetryRecord[] = [];
  let clock = 0;
  const telemetry = new Telemetry({ send: (batch) => sent.push(...batch), canFlush: () => true, now: () => clock });
  const recorder = new AttemptRecorder(telemetry, () => clock);
  telemetry.record('boot', plan.fresh === false ? 'return' : 'fresh', `${plan.locale ?? 'en'}|${plan.device ?? 'desktop'}|${plan.tier ?? 'high'}`);
  if (plan.input) {
    clock += 4000;
    telemetry.record('input', 'first', String(Math.round(clock / 1000)));
  }
  for (const attempt of plan.attempts ?? []) {
    recorder.begin(attempt.level);
    clock += attempt.ms;
    recorder.finish(attempt.outcome, attempt.ms, attempt.outcome === 'clear' ? 3 : 0);
  }
  for (const earn of plan.earn ?? []) telemetry.record('scrap', 'earn', String(earn));
  if (plan.ghost) telemetry.record('ghost', plan.ghost, 'set');
  for (const dangle of plan.dangles ?? []) telemetry.record('dangle', dangle, 'shown');
  if (plan.unlock) telemetry.record('cosmetic', plan.unlock, 'unlock');
  for (const spend of plan.spend ?? []) telemetry.record('scrap', 'spend', String(spend));
  clock += (plan.idleSeconds ?? 0) * 1000;
  telemetry.flush();
  return sent;
}

describe('reading visits out of the export (R-AN-09)', () => {
  it('splits the stream at boot records and keeps each visit\u2019s own label', () => {
    const visits = readSessions([...playVisit({}), ...playVisit({ fresh: false, locale: 'de', device: 'touch', tier: 'low' })]);
    expect(visits).toHaveLength(2);
    expect(visits[0]).toMatchObject({ fresh: true, locale: 'en', device: 'desktop', tier: 'high' });
    expect(visits[1]).toMatchObject({ fresh: false, locale: 'de', device: 'touch', tier: 'low' });
  });

  it('reports the length the visit last said it was, not the first guess', () => {
    const records = playVisit({ idleSeconds: 120 });
    const again = [...records.slice(0, -1), { category: 'session', what: 'length', action: '300' }];
    expect(readSessions(again)[0]!.seconds).toBe(300);
  });

  it('carries records it does not know without losing the visits around them', () => {
    const records = [
      ...playVisit({}),
      { category: 'sdk', what: 'ad', action: 'shown' },
      { category: 'fall', what: 'scrapyard-01', action: 'h=8.0;c=oops;g=B' },
      ...playVisit({ fresh: false }),
    ];
    const visits = readSessions(records);
    expect(visits).toHaveLength(2);
    // a record between two visits rides with the one it landed inside
    expect(visits[0]!.records.some((r) => r.category === 'sdk')).toBe(true);
    expect(visits[0]!.records.some((r) => r.category === 'fall')).toBe(true);
  });

  it('keeps a boot record with nothing to read rather than inventing a segment', () => {
    const visits = readSessions([{ category: 'boot', what: 'fresh', action: '' }]);
    expect(visits[0]).toMatchObject({ locale: 'unknown', device: 'unknown', tier: 'unknown' });
    expect(readSessions([])).toEqual([]);
  });
});

describe('the session-0 funnel (R-AN-06)', () => {
  const third = ALL_LEVELS[2]!;
  const parMs = third.parSeconds * 1000;

  it('climbs the seven steps over first-time visits only, and names the steepest drop', () => {
    const records = [
      ...playVisit({
        input: true,
        attempts: [
          { level: 'scrapyard-00', outcome: 'clear', ms: 20_000 },
          { level: third.id, outcome: 'clear', ms: parMs - 1 },
        ],
        ghost: 'scrapyard-00',
        unlock: BUYABLE.id,
      }),
      ...playVisit({ input: true, attempts: [{ level: 'scrapyard-00', outcome: 'clear', ms: 90_000 }] }),
      ...playVisit({ input: true, attempts: [{ level: 'scrapyard-01', outcome: 'clear', ms: 90_000 }] }),
      ...playVisit({ fresh: false, input: true, attempts: [{ level: third.id, outcome: 'clear', ms: 1000 }] }),
    ];
    const funnel = buildFunnel(records, ALL_LEVELS);
    expect(funnel.visits).toBe(3);
    expect(funnel.steps.map((s) => [s.step, s.reached])).toEqual([
      ['boot', 3],
      ['first-input', 3],
      ['first-clear', 3],
      ['level-3-entry', 1],
      ['first-par', 1],
      ['first-ghost', 1],
      ['first-cosmetic', 1],
    ]);
    const level3 = funnel.steps.find((s) => s.step === 'level-3-entry')!;
    expect(level3.dropped).toBe(2);
    expect(funnel.worstDrop?.step).toBe('level-3-entry');
    expect(funnel.worstDrop?.dropped).toBe(2);
  });

  it('reads the first-par step from the level\u2019s own par time, never from the stars', () => {
    const records = [...playVisit({ input: true, attempts: [{ level: third.id, outcome: 'clear', ms: parMs + 5000 }] })];
    expect(buildFunnel(records, ALL_LEVELS).steps.find((s) => s.step === 'first-par')!.reached).toBe(0);
    const boundary = [...playVisit({ input: true, attempts: [{ level: third.id, outcome: 'clear', ms: parMs }] })];
    expect(buildFunnel(boundary, ALL_LEVELS).steps.find((s) => s.step === 'first-par')!.reached).toBe(1);
  });

  it('cross-tabs the ladder by the boot record\u2019s own locale and device', () => {
    const records = [
      ...playVisit({ locale: 'en', device: 'touch', input: true, attempts: [{ level: 'scrapyard-00', outcome: 'clear', ms: 30_000 }] }),
      ...playVisit({ locale: 'en', device: 'touch', input: true }),
      ...playVisit({ locale: 'en', device: 'desktop', input: true, attempts: [{ level: 'scrapyard-00', outcome: 'clear', ms: 30_000 }] }),
      ...playVisit({ locale: 'de', device: 'touch' }),
    ];
    const segments = buildFunnel(records, ALL_LEVELS).segments;
    expect(segments).toEqual([
      { locale: 'en', device: 'touch', visits: 2, firstInput: 2, firstClear: 1 },
      { locale: 'de', device: 'touch', visits: 1, firstInput: 0, firstClear: 0 },
      { locale: 'en', device: 'desktop', visits: 1, firstInput: 1, firstClear: 1 },
    ]);
  });

  it('answers nothing when the export carries no first-time visit', () => {
    const funnel = buildFunnel(playVisit({ fresh: false }), ALL_LEVELS);
    expect(funnel.visits).toBe(0);
    expect(funnel.worstDrop).toBeNull();
    expect(funnel.medianFirstTouchS).toBeNull();
  });
});

describe('the perf tier census', () => {
  it('counts the boot records over every visit, returning ones included', () => {
    const records = [
      ...playVisit({ tier: 'high' }),
      ...playVisit({ tier: 'high', device: 'touch' }),
      ...playVisit({ tier: 'low', device: 'touch', fresh: false }),
    ];
    const tiers = buildTiers(records);
    expect(tiers.map((t) => [t.tier, t.visits])).toEqual([['high', 2], ['low', 1]]);
    expect(tiers[0]!.share).toBeCloseTo(2 / 3, 5);
  });
});

describe('the economy pacing reader (R-AN-04)', () => {
  it('medians what each visit earned, spent and unlocked', () => {
    const visits = readSessions([
      ...playVisit({ earn: [40], spend: [PRICE], unlock: BUYABLE.id, idleSeconds: 300 }),
      ...playVisit({ earn: [40], idleSeconds: 480 }),
      ...playVisit({ earn: [80], idleSeconds: 120, fresh: false }),
    ]);
    const pacing = buildPacing(visits);
    expect(pacing.visits).toBe(3);
    expect(pacing.medianEarnPerVisit).toBe(40);
    expect(pacing.medianMinutes).toBeCloseTo(5, 5);
    expect(pacing.medianUnlocksPerVisit).toBe(0);
    expect(pacing.sinkRatio).toBeCloseTo(PRICE / 160, 5);
  });

  it('keeps a visit that never flushed a length out of the minute median', () => {
    const visit = readSessions(playVisit({}).filter((r) => r.category !== 'session'))[0]!;
    const pacing = buildPacing([visit]);
    expect(pacing.medianMinutes).toBeNull();
    expect(pacing.sinkRatio).toBeNull();
  });
});

describe('the dangle-choice reader (R-AN-04)', () => {
  it('counts a dangle converted only when the look is unlocked after it was shown', () => {
    const other = COSMETICS.find((c) => c.acquire.how === 'scrap' && c.id !== BUYABLE.id)!;
    const stream = [
      ...playVisit({ dangles: [BUYABLE.id, BUYABLE.id], unlock: BUYABLE.id }),
      ...playVisit({ dangles: [other.id] }),
    ];
    const report = buildDangle(stream);
    expect(report.shown).toBe(3);
    expect(report.converted).toBe(2);
    expect(report.ratio).toBeCloseTo(2 / 3, 5);
    expect(report.byLook.find((l) => l.id === BUYABLE.id)).toMatchObject({ shown: 2, converted: 2 });
    expect(report.byLook.find((l) => l.id === other.id)).toMatchObject({ shown: 1, converted: 0 });
  });

  it('does not count an unlock that happened before the dangle', () => {
    const stream = [...playVisit({ unlock: BUYABLE.id }), ...playVisit({ dangles: [BUYABLE.id] })];
    const report = buildDangle(stream);
    expect(report.converted).toBe(0);
    expect(report.ratio).toBe(0);
  });

  it('reports nothing when the card never dangled', () => {
    const report = buildDangle(playVisit({}));
    expect(report.shown).toBe(0);
    expect(report.ratio).toBeNull();
  });
});

describe('the Friday report (R-AN-07)', () => {
  const third = ALL_LEVELS[2]!;
  const parMs = third.parSeconds * 1000;
  /** A week of exports: a fixture with a full climb, two that fell away, a returning regular and a hard level. */
  const weekFixture = (): string =>
    [
      ...playVisit({
        locale: 'en',
        device: 'touch',
        input: true,
        attempts: [
          { level: 'scrapyard-00', outcome: 'clear', ms: 20_000 },
          { level: third.id, outcome: 'clear', ms: parMs - 1 },
        ],
        earn: [60],
        ghost: 'scrapyard-00',
        dangles: [BUYABLE.id],
        unlock: BUYABLE.id,
        spend: [PRICE],
        idleSeconds: 420,
      }),
      ...playVisit({ locale: 'en', device: 'touch', input: true, attempts: [{ level: 'scrapyard-00', outcome: 'clear', ms: 90_000 }], earn: [40], idleSeconds: 60 }),
      ...playVisit({ locale: 'de', device: 'desktop', tier: 'low', idleSeconds: 30 }),
      ...playVisit({ fresh: false, locale: 'de', device: 'desktop', input: true, idleSeconds: 600 }),
      ...recordSession('scrapyard-04', Array.from({ length: 60 }, (_, i) => ({ falls: i % 3 === 0 ? [{ x: 4, y: 12 }] : [], outcome: i % 5 === 4 ? ('clear' as const) : ('restart' as const) }))),
    ]
      .map((record) => JSON.stringify(record))
      .join('\n');

  it('produces all five sections from a fixture export, through the export loop', () => {
    const records = readJsonLines(weekFixture());
    expect(records.length).toBeGreaterThan(20);
    const report = buildFridayReport(records, ALL_LEVELS);
    const text = fridayToMarkdown(report);

    for (const section of FRIDAY_SECTIONS) expect(text.toLowerCase()).toContain(`## ${section}`);
    expect(text).toContain('## The week\u2019s decisions');
    // the difficulty section carries the fixture's hard level with its verdict
    expect(text).toContain('| scrapyard-04 | 60 |');
    // the funnel names the steepest drop, and the ladder's numbers are the fixture's own
    expect(text).toContain('| first-input | 2 |');
    expect(text).toContain('| level-3-entry | 1 |');
    // the pacing medians and the dangle's ratio are both readable, priced from the shelf
    expect(report.pacing.medianEarnPerVisit).toBe(20);
    expect(report.pacing.medianSpendPerVisit).toBe(0);
    expect(report.pacing.sinkRatio).toBeCloseTo(PRICE / 100, 5);
    expect(text).toContain('| Scrap spent per visit, median |');
    expect(text).toContain('1 of 1 shown dangles converted');
    // the tier census read the boot records
    expect(text.toLowerCase()).toContain('| low |');
  });

  it('arms the week\u2019s decisions, and stays quiet in a week inside every band', () => {
    const troubled = buildFridayReport(readJsonLines(weekFixture()), ALL_LEVELS);
    expect(troubled.actions.length).toBeGreaterThan(0);
    expect(troubled.actions.some((a) => a.startsWith('the steepest funnel drop'))).toBe(true);

    const third2 = ALL_LEVELS[2]!;
    const quietWeek = [
      ...playVisit({
        input: true,
        attempts: [
          { level: 'scrapyard-00', outcome: 'clear', ms: 20_000 },
          { level: third2.id, outcome: 'clear', ms: third2.parSeconds * 1000 - 1 },
        ],
        ghost: 'scrapyard-00',
        unlock: BUYABLE.id,
        dangles: [BUYABLE.id],
        earn: [60],
        spend: [PRICE],
        idleSeconds: 480,
      }),
    ];
    const quiet = buildFridayReport(quietWeek, ALL_LEVELS);
    expect(quiet.actions).toEqual([]);
    expect(fridayToMarkdown(quiet)).toContain('Nothing outside a band');
  });

  it('judges the first touch against the load law\u2019s own ceilings', () => {
    const slow = buildFridayReport(readJsonLines([...playVisit({ input: true, idleSeconds: 30 })].map((r) => JSON.stringify(r)).join('\n')), ALL_LEVELS);
    // the visit's input record said 4 s: inside both ceilings, so no slow-touch decision
    expect(slow.actions.some((a) => a.includes('past the load law'))).toBe(false);
    const worse = [...playVisit({ input: true, idleSeconds: 30 })];
    worse[1] = { ...worse[1]!, action: String(BENCHMARKS.firstTouchCeilingS.touch + 1) };
    const judged = buildFridayReport(worse, ALL_LEVELS);
    expect(judged.actions.some((a) => a.includes('past the load law'))).toBe(true);
  });
});


describe('reading what the game flushes', () => {
  it('turns the recorder output back into falls, attempts and retry delays', () => {
    const records = recordSession('scrapyard-04', [
      { falls: [{ x: 5.2, y: 9.1 }], outcome: 'restart' },
      { falls: [], outcome: 'clear', ms: 41000 },
    ]);
    const parsed = parseTelemetry(records);

    expect(parsed.entries.get('scrapyard-04')).toBe(2);
    expect(parsed.attempts.map((a) => a.outcome)).toEqual(['restart', 'clear']);
    expect(parsed.attempts[1]).toMatchObject({ runSeconds: 41, stars: 2, falls: 0 });
    expect(parsed.attempts[0]!.falls).toBe(1);
    expect(parsed.falls).toHaveLength(1);
    expect(parsed.falls[0]).toMatchObject({ levelId: 'scrapyard-04', heightM: 9, grade: 'B' });
    expect(parsed.retryLatenciesMs.get('scrapyard-04')).toEqual([31500]);
    expect(parsed.sessionSeconds).toHaveLength(1);
  });

  it('counts each attempt\u2019s falls, so a quitting attempt leaves its number behind', () => {
    const parsed = parseTelemetry(
      recordSession('scrapyard-04', [
        { falls: [{ x: 1, y: 1 }, { x: 9, y: 20 }], outcome: 'leave' },
        { falls: [], outcome: 'clear' },
      ]),
    );
    expect(parsed.attempts[0]!.falls).toBe(2);
    expect(parsed.attempts[1]!.falls).toBe(0);
  });

  it('skips records it does not know and lines that are not JSON', () => {
    const text = [
      '{"category":"level","what":"scrapyard-01","action":"enter"}',
      'not json',
      '[{"category":"fall","what":"scrapyard-01","action":"h-8 g-B"},{"category":"sdk","what":"ad","action":"shown"}]',
      '{"hello":"world"}',
      '',
    ].join('\n');
    const parsed = parseTelemetry(readJsonLines(text));
    expect(parsed.entries.get('scrapyard-01')).toBe(1);
    expect(parsed.falls).toHaveLength(1);
    expect(parsed.falls[0]).toMatchObject({ heightM: 8, grade: 'B' });
  });

  it('ignores a fall record that does not parse rather than trusting its height', () => {
    const parsed = parseTelemetry([{ category: 'fall', what: 'scrapyard-01', action: 'h-oops g-B' }]);
    expect(parsed.falls).toHaveLength(0);
  });
});

describe('finding where players fail', () => {
  it('separates three trouble spots and puts a centre on each', () => {
    const rng = new Rng(11);
    const truth = [
      { x: -6, y: 8 },
      { x: 6, y: 30 },
      { x: -2, y: 55 },
    ];
    const points = truth.flatMap((c, i) => Array.from({ length: 50 + i * 20 }, () => around(rng, c, 4)));

    const clusters = clusterFalls(points);

    expect(clusters).toHaveLength(3);
    for (const spot of truth) {
      const nearest = Math.min(...clusters.map((c) => Math.hypot(c.center.x - spot.x, c.center.y - spot.y)));
      expect(nearest).toBeLessThan(1);
    }
    expect(clusters.reduce((sum, c) => sum + c.share, 0)).toBeCloseTo(1, 5);
    expect(clusters[0]!.size).toBeGreaterThanOrEqual(clusters[1]!.size);
  });

  it('reports one broad area when falls are spread evenly, not an invented hotspot', () => {
    const rng = new Rng(3);
    const smear = Array.from({ length: 200 }, () => ({ x: rng.range(-8, 8), y: rng.range(0, 60) }));
    expect(clusterFalls(smear)).toHaveLength(1);
  });

  it('gives the same answer every time for the same falls', () => {
    const rng = new Rng(5);
    const points = [...Array.from({ length: 40 }, () => around(rng, { x: 0, y: 5 }, 3)), ...Array.from({ length: 40 }, () => around(rng, { x: 7, y: 25 }, 3))];
    expect(clusterFalls(points)).toEqual(clusterFalls(points));
  });

  it('copes with no falls and with a handful', () => {
    expect(clusterFalls([])).toEqual([]);
    expect(clusterFalls([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toHaveLength(1);
  });
});

describe('the difficulty review', () => {
  const level = levelById('scrapyard-04');

  const attemptsWithFallRate = (rate: number, count: number, spot: Vec2) =>
    Array.from({ length: count }, (_, i) => ({
      falls: i < Math.round(rate * count) ? [spot] : [],
      outcome: i % 5 === 4 ? ('clear' as const) : ('restart' as const),
    }));

  it('flags a level whose players fall far more often than the contract allows', () => {
    const report = buildReport(parseTelemetry(recordSession(level.id, attemptsWithFallRate(0.95, 60, { x: 4, y: 12 }))), [level])[0]!;
    expect(report.target).toBe(level.fallRateTarget);
    expect(report.verdict).toBe('too-hard');
    expect(report.fallRate).toBeCloseTo(0.95, 1);
    expect(report.worstFalls[0]).toBe('9 m (B)');
    expect(reviewQueue([report])).toHaveLength(1);
  });

  it('flags a level nobody falls on as too easy', () => {
    const report = buildReport(parseTelemetry(recordSession(level.id, attemptsWithFallRate(0, 60, { x: 0, y: 0 }))), [level], { band: 0.05 })[0]!;
    expect(level.fallRateTarget).toBeGreaterThan(0.1);
    expect(report.verdict).toBe('too-easy');
  });

  it('leaves a level alone when its fall rate sits in the band', () => {
    const report = buildReport(parseTelemetry(recordSession(level.id, attemptsWithFallRate(level.fallRateTarget, 100, { x: 4, y: 12 }))), [level])[0]!;
    expect(report.verdict).toBe('in-band');
    expect(reviewQueue([report])).toHaveLength(0);
  });

  it('will not judge a level from a handful of attempts', () => {
    const report = buildReport(parseTelemetry(recordSession(level.id, attemptsWithFallRate(1, 5, { x: 4, y: 12 }))), [level])[0]!;
    expect(report.verdict).toBe('sparse');
  });

  it('shows how many players leave the level as well as how often they fall', () => {
    const attempts = [
      ...Array.from({ length: 20 }, () => ({ falls: [{ x: 6, y: 40 }], outcome: 'leave' as const })),
      ...Array.from({ length: 20 }, () => ({ falls: [{ x: -5, y: 6 }], outcome: 'restart' as const })),
      ...Array.from({ length: 10 }, () => ({ falls: [], outcome: 'clear' as const })),
    ];
    const report = buildReport(parseTelemetry(recordSession(level.id, attempts)), [level])[0]!;

    expect(report.leaves).toBe(20);
    expect(report.worstFalls.every((f) => f.startsWith('9 m'))).toBe(true);
    expect(report.notes.some((n) => n.includes('leaving'))).toBe(true);
  });

  it('computes clear time and attempts per clear from the clears alone', () => {
    const attempts = [
      { falls: [], outcome: 'restart' as const },
      { falls: [], outcome: 'clear' as const, ms: 50000 },
      { falls: [], outcome: 'restart' as const },
      { falls: [], outcome: 'clear' as const, ms: 30000 },
    ];
    const report = buildReport(parseTelemetry(recordSession(level.id, attempts)), [level])[0]!;
    expect(report.medianClearSeconds).toBe(40);
    expect(report.attemptsPerClear).toBe(2);
  });

  it('only reports on levels that were played', () => {
    const reports = buildReport(parseTelemetry(recordSession(level.id, [{ falls: [], outcome: 'clear' }])), [level, levelById('scrapyard-01')]);
    expect(reports.map((r) => r.levelId)).toEqual([level.id]);
  });

  it('writes a table row for every level plus a queue of the ones to look at', () => {
    const hard = buildReport(parseTelemetry(recordSession(level.id, attemptsWithFallRate(1, 60, { x: 4, y: 12 }))), [level]);
    const text = toMarkdown(hard);
    expect(text).toContain(`| ${level.id} |`);
    expect(text).toContain('## Review queue');
  });
});

describe('the heatmap drawing', () => {
  const level = levelById('scrapyard-04');
  const parse = (svg: string): DomElement => {
    const holder = new Window().document.createElement('div');
    holder.innerHTML = svg;
    return holder.firstElementChild!;
  };

  it('draws every prop of the level, the start and the summit', () => {
    const svg = parse(renderHeatmap({ level, falls: [], hotspots: [] }));
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.querySelectorAll('rect, circle').length).toBeGreaterThanOrEqual(level.props.length + 3);
  });

  it('marks each hotspot and each quit point, and paints the falls', () => {
    const rng = new Rng(9);
    const falls = Array.from({ length: 80 }, () => around(rng, { x: 4, y: 12 }, 3));
    const hotspots = clusterFalls(falls);
    const quits = clusterFalls([{ x: 4, y: 12 }, { x: 4, y: 13 }, { x: 5, y: 12 }, { x: 4, y: 12 }, { x: 5, y: 13 }, { x: 4, y: 13 }], { maxK: 2 });
    const svg = parse(renderHeatmap({ level, falls, hotspots, quitPoints: quits }));

    expect(svg.querySelectorAll('[data-hotspot]')).toHaveLength(hotspots.length);
    expect(svg.querySelectorAll('[data-quit]')).toHaveLength(quits.length);
    const bare = parse(renderHeatmap({ level, falls: [], hotspots: [] }));
    expect(svg.querySelectorAll('rect').length).toBeGreaterThan(bare.querySelectorAll('rect').length);
  });

  it('puts a fall high on the level higher on the page than one near the start', () => {
    const svg = renderHeatmap({ level, falls: [{ x: 0, y: 1 }, { x: 0, y: 21 }], hotspots: [] });
    const cells = [...svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="28" height="28" fill="hsl/g)].map((m) => Number(m[1]));
    expect(cells).toHaveLength(2);
    const [low, high] = [Math.max(...cells), Math.min(...cells)];
    expect(high).toBeLessThan(low);
  });

  it('stays inside its canvas even when a fall lands below the level', () => {
    const svg = renderHeatmap({ level, falls: [{ x: 0, y: level.killY - 10 }], hotspots: [] });
    const height = Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)![1]);
    const cellY = Number(/<rect x="[\d.]+" y="([\d.]+)" width="28"/.exec(svg)![1]);
    expect(cellY).toBeGreaterThanOrEqual(0);
    expect(cellY).toBeLessThan(height);
  });
});
