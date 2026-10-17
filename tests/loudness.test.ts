import { describe, expect, it } from 'vitest';
import { METER_RATE, integratedLufs, measure, samplePeakDb, shortTermMaxLufs, truePeakDb } from './helpers/loudness';

const tone = (hz: number, dbfs: number, seconds: number, phase = 0): Float32Array => {
  const out = new Float32Array(Math.round(seconds * METER_RATE));
  const amplitude = 10 ** (dbfs / 20);
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / METER_RATE + phase);
  return out;
};

const concat = (...parts: Float32Array[]): Float32Array => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

describe('the loudness meter', () => {
  it('reads a stereo 997 Hz tone at -23 dBFS as -23 LUFS, the EBU reference level', () => {
    const channel = tone(997, -23, 20);
    expect(integratedLufs([channel, channel])).toBeCloseTo(-23, 1);
  });

  it('reads one channel of the same tone 3 dB quieter than two', () => {
    const channel = tone(997, -20, 10);
    const both = integratedLufs([channel, channel]);
    const one = integratedLufs([channel, new Float32Array(channel.length)]);
    expect(both - one).toBeCloseTo(3.01, 1);
  });

  it('weights frequencies the way an ear does: a tone near 3 kHz reads louder than one at 100 Hz', () => {
    const low = tone(100, -20, 10);
    const mid = tone(3000, -20, 10);
    expect(integratedLufs([mid, mid])).toBeGreaterThan(integratedLufs([low, low]) + 3);
  });

  it('reports silence as silence', () => {
    const quiet = new Float32Array(METER_RATE * 5);
    expect(integratedLufs([quiet, quiet])).toBe(-Infinity);
    expect(truePeakDb([quiet])).toBe(-Infinity);
  });

  it('ignores a long quiet passage when it is more than 10 LU under the rest, as the relative gate demands', () => {
    const loud = tone(997, -14, 10);
    const faint = tone(997, -44, 30);
    const programme = concat(loud, faint);
    expect(integratedLufs([programme, programme])).toBeCloseTo(-14, 0);
    expect(shortTermMaxLufs([programme, programme])).toBeCloseTo(-14, 0);
  });

  it('counts a quiet passage that is within the gate', () => {
    const loud = tone(997, -14, 10);
    const near = tone(997, -20, 10);
    const programme = concat(loud, near);
    const level = integratedLufs([programme, programme]);
    expect(level).toBeLessThan(-14.5);
    expect(level).toBeGreaterThan(-18);
  });

  it('finds a true peak the samples never show', () => {
    const channel = tone(METER_RATE / 4, 0, 2, Math.PI / 4);
    expect(samplePeakDb([channel])).toBeCloseTo(-3.01, 1);
    expect(truePeakDb([channel])).toBeGreaterThan(-0.4);
    expect(truePeakDb([channel])).toBeLessThan(0.3);
  });

  it('puts all four readings on one report', () => {
    const channel = tone(997, -18, 8);
    const report = measure([channel, channel]);
    expect(report.integratedLufs).toBeCloseTo(-18, 1);
    expect(report.samplePeakDb).toBeCloseTo(-18, 1);
    expect(report.truePeakDb).toBeCloseTo(-18, 0);
    expect(report.shortTermMaxLufs).toBeCloseTo(-18, 1);
  });
});
