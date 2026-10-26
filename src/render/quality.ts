export type QualityTier = 'high' | 'mid' | 'low';

export interface QualityProfile {
  tier: QualityTier;
  /** Concurrent particle ceiling enforced by the VFX director (PRD Table 8.2). */
  particleCeiling: number;
  fieldLineSegments: number;
  /** Concurrent wind streaks drawn at a gust's peak (PRD Table 8.1 allows 18). */
  windStreaks: number;
  dustScale: number;
  maxPixelRatio: number;
  minResolutionScale: number;
  glow: boolean;
  /** Bloom runs at 1/divisor of the frame; 0 turns it off (PRD 8.5). */
  bloomDivisor: 0 | 2 | 4;
  /** Multisample count of the scene target. */
  msaa: number;
  /** Mobile replaces the shader vignette with the baked corner darkening in the overlay. */
  shaderVignette: boolean;
  /** Directional sun shadows. Tier-low skips them so cold-load and frame time hold. */
  shadows: boolean;
}

export const PROFILES: Readonly<Record<QualityTier, QualityProfile>> = {
  high: { tier: 'high', particleCeiling: 900, fieldLineSegments: 24, windStreaks: 18, dustScale: 1, maxPixelRatio: 2, minResolutionScale: 0.8, glow: true, bloomDivisor: 2, msaa: 4, shaderVignette: true, shadows: true },
  mid: { tier: 'mid', particleCeiling: 500, fieldLineSegments: 24, windStreaks: 12, dustScale: 0.5, maxPixelRatio: 1.5, minResolutionScale: 0.65, glow: true, bloomDivisor: 4, msaa: 2, shaderVignette: true, shadows: true },
  // Tier-low keeps a small dust scale so the ambient air never reads as empty
  // even on the cheapest devices; the directional shadows are what we skip.
  low: { tier: 'low', particleCeiling: 260, fieldLineSegments: 12, windStreaks: 6, dustScale: 0.35, maxPixelRatio: 1, minResolutionScale: 0.55, glow: false, bloomDivisor: 0, msaa: 0, shaderVignette: false, shadows: false },
};

export interface DeviceHints {
  hardwareConcurrency: number;
  deviceMemory?: number;
  /** The display's own pixel ratio, the fill-rate bill a tier has to pay (R-PE-08). */
  devicePixelRatio: number;
  coarsePointer: boolean;
  maxTextureSize: number;
  rendererName: string;
}

const LOW_GPU = /mali-4|mali-t|mali-g5|mali-g68|adreno \(tm\) [2-4]\d\d|powervr|swiftshader|llvmpipe|software/i;

/** Picks a starting tier; the runtime can still step down if frame time suffers. */
export function detectTier(hints: DeviceHints): QualityTier {
  if (LOW_GPU.test(hints.rendererName)) return 'low';
  const memory = hints.deviceMemory ?? (hints.coarsePointer ? 4 : 8);
  if (hints.hardwareConcurrency <= 2 || memory <= 2 || hints.maxTextureSize < 4096) return 'low';
  // A modern flagship holds the high tier's 60 fps (R-PE-03) even as a phone:
  // eight cores, a full memory hint and a sharp display together say so.
  const flagship = hints.coarsePointer && hints.hardwareConcurrency >= 8 && memory >= 8 && hints.devicePixelRatio >= 3;
  if (flagship) return 'high';
  if (hints.coarsePointer || hints.hardwareConcurrency <= 6 || memory <= 4) return 'mid';
  return 'high';
}

export const stepDown = (tier: QualityTier): QualityTier => (tier === 'high' ? 'mid' : 'low');
