/**
 * Physics feel baselines. Values trace to PRD Table 4.1 unless noted; they are
 * tuning baselines, so every consumer reads from here rather than inlining numbers.
 */
export const TUNING = {
  sim: { hz: 60, maxStepsPerFrame: 5, gravity: 9.81 },

  body: {
    radius: 0.225,
    halfHeight: 0.075,
    mass: 40,
    linearDamping: 0.05,
    angularDamping: 0.6,
  },

  attach: {
    holdForceN: 1800,
    holdRampMs: 60,
    frictionRampMs: 250,
    frictionMu: 0.9,
    /** Surface gap (m) inside which an attract-mode body is captured. */
    captureGap: 0.14,
    crawlSpeed: 1.6,
    crawlAccel: 18,
  },

  repel: {
    fullSpeed: 14,
    tapSpeed: 6,
    tiltShare: 0.3,
    chargeMs: 900,
    chargeLevels: 3,
    /** Attract is suppressed briefly after a launch so the body clears the surface it left. */
    lockMs: 190,
  },

  snap: {
    radius: 4.5,
    coneDeg: 15,
    k: 240,
    zeta: 0.55,
    maxAccel: 74,
    maxDurationMs: 950,
    cooldownMs: 160,
    /** Contact normal alignment needed for a surface to count as a target face. */
    facingBias: 0.15,
  },

  air: { tiltAccel: 2.4 },

  /** R-GF-03: the forgiveness windows, named and small — both live under the
   * 150 ms line so the game stays forgiving without turning sloppy. */
  windows: {
    /** A flip pressed this soon after leaving a surface still launches (coyote). */
    coyoteMs: 120,
    /** A flip pressed this early before a surface arrives is held until it does (buffer). */
    bufferMs: 140,
  },

  weakMetal: { holdMs: 1200, fadeMs: 450, lockoutMs: 700 },

  fall: {
    slowMoHeight: 12,
    slowMoImpactSpeed: 14,
    /** Drops shorter than this are stumbles, not falls. */
    minFallHeight: 4,
    settleSpeed: 0.55,
    settleMs: 260,
    maxSlowMoPerWindow: 4,
    slowMoWindowMs: 180_000,
    slowMoScale: 0.35,
    slowMoRampInMs: 150,
    slowMoRampOutMs: 450,
    /** Auto-align assist engages for the last stretch of a fall (PRD 4.5). */
    assistWindowMs: 300,
    assistStrength: 0.55,
  },

  recover: { getUpMs: 650, settleBounceMs: 120, scrambleMs: 400, scrambleAuthority: 0.4, hardImpactSpeed: 7 },

  safetyLine: { dropMeters: 6 },

  /** PRD 10.4: hard cap on concurrent physics bodies; levels are authored well inside it. */
  budget: { maxBodies: 260 },
} as const;

export type Tuning = typeof TUNING;
