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

  /** R-CH: MAGNO's performance layer. The rig reads every number from here so the
   *  character's timing is tuning, not code — and the doc quotes the same values. */
  character: {
    /** R-CH-05: the head trails the body by this much; the eye leads both (PRD 7.4). */
    headLagMs: 30,
    handLagMs: 80,
    /** The lid dip of a blink, whole cycle. */
    blinkMs: 140,
    /** R-CH-02: while settled, a blink lands inside this window; the next one is re-rolled. */
    idleBlinkMinMs: 4000,
    idleBlinkMaxMs: 7000,
    /** R-CH-02: one character beat every ~20 s of idling — a look-around and a flip. */
    beatMs: 20_000,
    beatJitterMs: 4000,
    /** R-CH-02: settled means attached, not charging, and slower than this. */
    idleSpeed: 0.5,
    /** R-CH-03: the pupil dilates by this much over rest while the charge builds to full. */
    pupilDilate: 0.35,
    /** R-CH-03: the squeeze of a hard landing's wince, spent inside this window. */
    winceMs: 220,
    /** R-CH-03: a bonk after a fall this deep reads as the comic daze, not a small stumble. */
    dazeMeters: 9,
    /** R-CH-03: the clear gleam rides the eye for as long as the pride lid does. */
    gleamMs: 2400,
  },

  safetyLine: { dropMeters: 6 },

  /** PRD 10.4: hard cap on concurrent physics bodies; levels are authored well inside it. */
  budget: { maxBodies: 260 },
} as const;

export type Tuning = typeof TUNING;
