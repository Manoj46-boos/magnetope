/**
 * Programme loudness and true peak after ITU-R BS.1770-4 and EBU R128, at 48 kHz.
 * Pure arithmetic on sample arrays, so the same meter serves the browser fixture
 * that renders the game's audio graph and the unit tests that check the meter itself.
 */

export const METER_RATE = 48000;

const BLOCK_SECONDS = 0.4;
const HOP_SECONDS = 0.1;
const SHORT_TERM_SECONDS = 3;
const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = 10;
const LUFS_OFFSET = -0.691;

interface Biquad {
  b: readonly [number, number, number];
  a: readonly [number, number];
}

/** The two K-weighting stages of BS.1770-4 table 1 (head shelf, then revised low-cut) at 48 kHz. */
const K_STAGES: readonly Biquad[] = [
  { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] },
  { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] },
];

function kWeight(input: Float32Array): Float64Array {
  let signal = Float64Array.from(input);
  for (const { b, a } of K_STAGES) {
    const out = new Float64Array(signal.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < signal.length; i++) {
      const x0 = signal[i]!;
      const y0 = b[0] * x0 + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
      out[i] = y0;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }
    signal = out;
  }
  return signal;
}

const toLufs = (meanSquare: number): number => (meanSquare > 0 ? LUFS_OFFSET + 10 * Math.log10(meanSquare) : -Infinity);

/** Mean square of every 400 ms window, hopping 100 ms, summed over the channels (all weighted 1.0). */
function blockPowers(channels: Float32Array[], windowSeconds: number): number[] {
  const weighted = channels.map(kWeight);
  const window = Math.round(windowSeconds * METER_RATE);
  const hop = Math.round(HOP_SECONDS * METER_RATE);
  const length = weighted[0]!.length;
  const powers: number[] = [];
  for (let start = 0; start + window <= length; start += hop) {
    let sum = 0;
    for (const channel of weighted) {
      let acc = 0;
      for (let i = start; i < start + window; i++) acc += channel[i]! * channel[i]!;
      sum += acc / window;
    }
    powers.push(sum);
  }
  return powers;
}

const mean = (values: number[]): number => values.reduce((s, v) => s + v, 0) / values.length;

/** Integrated programme loudness with the absolute and relative gates; -Infinity for silence. */
export function integratedLufs(channels: Float32Array[]): number {
  const powers = blockPowers(channels, BLOCK_SECONDS);
  const audible = powers.filter((p) => toLufs(p) > ABSOLUTE_GATE_LUFS);
  if (audible.length === 0) return -Infinity;
  const relativeGate = toLufs(mean(audible)) - RELATIVE_GATE_LU;
  const kept = audible.filter((p) => toLufs(p) > relativeGate);
  return kept.length === 0 ? -Infinity : toLufs(mean(kept));
}

/** Loudest 3 s window, ungated: how hard the busiest passage hits. */
export function shortTermMaxLufs(channels: Float32Array[]): number {
  const powers = blockPowers(channels, SHORT_TERM_SECONDS);
  return powers.length === 0 ? -Infinity : toLufs(Math.max(...powers));
}

export const samplePeakDb = (channels: Float32Array[]): number => {
  let peak = 0;
  for (const channel of channels) for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i]!));
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
};

const TP_TAPS = 12;
const TP_PHASES = [1, 2, 3] as const;

/** Hann-windowed sinc phases of a 4x interpolator, normalised to unity gain at DC. */
const TP_FILTERS: Float64Array[] = TP_PHASES.map((phase) => {
  const taps = new Float64Array(TP_TAPS);
  let sum = 0;
  for (let k = 0; k < TP_TAPS; k++) {
    const t = k - (TP_TAPS / 2 - 1) - phase / 4;
    const sinc = Math.sin(Math.PI * t) / (Math.PI * t);
    const hann = 0.5 * (1 + Math.cos((Math.PI * t) / (TP_TAPS / 2)));
    taps[k] = sinc * hann;
    sum += taps[k]!;
  }
  for (let k = 0; k < TP_TAPS; k++) taps[k]! /= sum;
  return taps;
});

/** True peak in dBTP: the largest reconstructed value between samples, by 4x oversampling. */
export function truePeakDb(channels: Float32Array[]): number {
  let peak = 0;
  for (const channel of channels) {
    const n = channel.length;
    for (let i = 0; i < n; i++) {
      const direct = Math.abs(channel[i]!);
      if (direct > peak) peak = direct;
      if (i < TP_TAPS || i >= n - TP_TAPS) continue;
      for (const taps of TP_FILTERS) {
        let acc = 0;
        for (let k = 0; k < TP_TAPS; k++) acc += taps[k]! * channel[i - (TP_TAPS / 2 - 1) + k]!;
        const value = Math.abs(acc);
        if (value > peak) peak = value;
      }
    }
  }
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

export interface Loudness {
  integratedLufs: number;
  shortTermMaxLufs: number;
  samplePeakDb: number;
  truePeakDb: number;
}

export function measure(channels: Float32Array[]): Loudness {
  return {
    integratedLufs: integratedLufs(channels),
    shortTermMaxLufs: shortTermMaxLufs(channels),
    samplePeakDb: samplePeakDb(channels),
    truePeakDb: truePeakDb(channels),
  };
}
