import { Window, type Element as DomElement } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { Rng } from '@/core/rng';
import type { Vec2 } from '@/core/mathx';
import { levelById } from '@/levels';
import { AttemptRecorder, Telemetry, type TelemetryRecord } from '@/platform/telemetry';
import { clusterFalls } from '../tools/analytics/cluster';
import { renderHeatmap } from '../tools/analytics/heatmap';
import { parseTelemetry, readJsonLines } from '../tools/analytics/records';
import { buildReport, reviewQueue, toMarkdown } from '../tools/analytics/report';

/** Plays attempts through the shipped recorder and returns exactly what it would have flushed. */
function recordSession(levelId: string, attempts: Array<{ falls: Vec2[]; outcome: 'clear' | 'restart' | 'leave'; ms?: number }>): TelemetryRecord[] {
  const sent: TelemetryRecord[] = [];
  let clock = 0;
  const telemetry = new Telemetry({ send: (batch) => sent.push(...batch), canFlush: () => true, now: () => clock });
  const recorder = new AttemptRecorder(telemetry, () => clock);
  for (const attempt of attempts) {
    recorder.begin(levelId);
    recorder.stick();
    recorder.flip({ x: 0, y: 1 });
    for (const at of attempt.falls) {
      clock += 4000;
      recorder.fall(9, at, 'B');
    }
    clock += attempt.ms ?? 30000;
    recorder.finish(attempt.outcome, attempt.ms ?? 30000, attempt.outcome === 'clear' ? 2 : 0);
    clock += 1500;
  }
  telemetry.flush();
  return sent;
}

const around = (rng: Rng, centre: Vec2, spread: number): Vec2 => ({
  x: centre.x + (rng.next() - 0.5) * spread,
  y: centre.y + (rng.next() - 0.5) * spread,
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
    expect(parsed.attempts[1]).toMatchObject({ runMs: 41000, stars: 2, falls: 0 });
    expect(parsed.falls).toHaveLength(1);
    expect(parsed.falls[0]!.at).toEqual({ x: 5, y: 9 });
    expect(parsed.retryLatenciesMs.get('scrapyard-04')).toEqual([31500]);
    expect(parsed.sessionSeconds).toHaveLength(1);
  });

  it('ties the last fall to the attempt that followed it, so a quit has a place', () => {
    const parsed = parseTelemetry(
      recordSession('scrapyard-04', [
        { falls: [{ x: 1, y: 1 }, { x: 9, y: 20 }], outcome: 'leave' },
        { falls: [], outcome: 'clear' },
      ]),
    );
    expect(parsed.attempts[0]!.lastFall?.at).toEqual({ x: 9, y: 21 });
    expect(parsed.attempts[1]!.lastFall).toBeNull();
  });

  it('skips records it does not know and lines that are not JSON', () => {
    const text = [
      '{"category":"level","what":"scrapyard-01","action":"enter"}',
      'not json',
      '[{"category":"fall","what":"scrapyard-01","action":"h=8.0;c=2:3;g=B"},{"category":"sdk","what":"ad","action":"shown"}]',
      '{"hello":"world"}',
      '',
    ].join('\n');
    const parsed = parseTelemetry(readJsonLines(text));
    expect(parsed.entries.get('scrapyard-01')).toBe(1);
    expect(parsed.falls).toHaveLength(1);
    expect(parsed.falls[0]!.at).toEqual({ x: 5, y: 7 });
  });

  it('ignores a fall with a damaged cell rather than placing it at the origin', () => {
    const parsed = parseTelemetry([{ category: 'fall', what: 'scrapyard-01', action: 'h=8.0;c=oops;g=B' }]);
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
    expect(report.hotspots[0]!.center.y).toBeCloseTo(13, 0);
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

  it('shows where players quit as well as where they fall', () => {
    const quit = { x: 6, y: 40 };
    const attempts = [
      ...Array.from({ length: 20 }, () => ({ falls: [quit], outcome: 'leave' as const })),
      ...Array.from({ length: 20 }, () => ({ falls: [{ x: -5, y: 6 }], outcome: 'restart' as const })),
      ...Array.from({ length: 10 }, () => ({ falls: [], outcome: 'clear' as const })),
    ];
    const report = buildReport(parseTelemetry(recordSession(level.id, attempts)), [level])[0]!;

    expect(report.leaves).toBe(20);
    expect(report.quitPoints[0]!.center.y).toBeCloseTo(41, 0);
    expect(report.hotspots.length).toBeGreaterThanOrEqual(2);
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
    expect(report.medianClearMs).toBe(40000);
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
