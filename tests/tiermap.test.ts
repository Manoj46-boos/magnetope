import { describe, expect, it } from 'vitest';
import { detectTier } from '@/render/quality';
import { MATRIX, renderMatrix, renderTally, tierTally, type DeviceReportRow } from '../tools/tiermap';

/**
 * R-PE-11: the tier map's oracle. The matrix on record must be the live probe's
 * own answers, and the report reader must place a device report's fleet into
 * the tiers the shipped code would boot them on.
 */

const FIXTURE: DeviceReportRow[] = [
  { gpuString: 'NVIDIA GeForce RTX 3060', cores: 12, memoryGb: 8, devicePixelRatio: 1, touch: false, share: 0.3 },
  { gpuString: 'Mali-G52 MC1', cores: 8, memoryGb: 4, devicePixelRatio: 2, touch: true, share: 0.22 },
  { gpuString: 'Adreno (TM) 740', cores: 8, memoryGb: 8, devicePixelRatio: 3, touch: true, share: 0.18 },
  { gpuString: 'Intel UHD Graphics 600', cores: 4, memoryGb: 4, devicePixelRatio: 1, touch: true, share: 0.2 },
  { gpuString: 'Adreno (TM) 618', cores: 8, memoryGb: 6, devicePixelRatio: 2, touch: true, share: 0.1 },
];

describe('the tier map (R-PE-11)', () => {
  it('renders the probe matrix with the probe\'s own answers', () => {
    const text = renderMatrix();
    for (const [name, hints] of MATRIX) {
      const row = `| ${name} | \`${hints.rendererName}\` | ${hints.hardwareConcurrency} cores | ${detectTier(hints)} |`;
      expect(text, name).toContain(row);
    }
  });

  it('places the fleet the way the probe would boot it', () => {
    const tally = tierTally(FIXTURE);
    expect(tally.map((t) => t.tier)).toEqual(['high', 'mid', 'low']);
    expect(tally.find((t) => t.tier === 'low')!.devices).toContain('Mali-G52 MC1');
    expect(tally.find((t) => t.tier === 'high')!.devices).toContain('Adreno (TM) 740');
  });

  it('counts every player exactly once', () => {
    const tally = tierTally(FIXTURE);
    expect(tally.reduce((sum, t) => sum + t.share, 0)).toBeCloseTo(1);
  });

  it('renders a report the recalibration ritual can read back', () => {
    const text = renderTally(FIXTURE);
    expect(text).toContain('| low | 22.0%');
    expect(text).toContain('| high | 48.0%');
    expect(text).toContain('Mali-G52 MC1');
  });
});
