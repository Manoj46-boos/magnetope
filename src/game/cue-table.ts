import * as RECIPES from '@/audio/recipes';
import { type ChirpName } from '@/audio/recipes';
import { HumVoice, WindVoice } from '@/audio/continuous';
import { FieldLines } from '@/render/field-lines';
import { WindStreaks } from '@/render/wind-streaks';
import { MagnoRig } from '@/render/magno-rig';
import { Vfx } from '@/render/vfx';
import { vibrateCharge } from '@/platform/haptics';
import type { SimEventName } from './feel-table';

/**
 * The dual-channel law (R-AC-04): every gameplay-critical cue reaches two
 * senses, so a player who cannot hear it still sees it and a player who cannot
 * see it still hears it. Each row names its witnesses — visual systems and
 * audio voices as they exist in the code, imported here so a witness that is
 * deleted fails the compile before any test runs. The a11y suite holds every
 * row to the law and keeps the single-channel list short and justified.
 *
 * A row may carry a third sense (Vol V, P-AU-03): the touch haptics Volume III
 * added. It never stands in for the first two and is safe to spend on a host
 * with no vibrator — the no-op path is the witness's own.
 */

export interface CueRow {
  /** The cue's own name, the thing a player must not miss. */
  cue: string;
  /** The simulation event that carries it, where one exists. */
  event: SimEventName | null;
  /** The sense that sees it, naming a real visual system. */
  visual: string;
  /** The sense that hears it, naming a real voice or recipe. */
  audio: string;
  /** The hand, on touch only; a third sense, never a stand-in for the other two. */
  haptic?: string;
}

/** The visual witnesses, keyed as the rows name them. Every value is a real system the game draws through. */
export const VISUAL_WITNESSES = {
  'field lines': FieldLines,
  'wind streaks': WindStreaks,
  'the rig': MagnoRig,
  'the burst stack': Vfx,
} as const;

/** The audio witnesses: recipe functions and continuous voices as the rows name them. */
export const AUDIO_WITNESSES: Readonly<Record<string, unknown>> = {
  'attach voice': RECIPES.playAttach,
  'launch voice': RECIPES.playRepel,
  'snap voice': RECIPES.playSnapEngage,
  'charge steps': RECIPES.playChargeLevel,
  'stress voice': RECIPES.playStress,
  'clear fanfare': RECIPES.playFanfare,
  'polarity hum': HumVoice,
  'gust lead': WindVoice,
};

/** The touch witnesses: haptics that exist in code, no-op safe where the host has none. */
export const HAPTIC_WITNESSES: Readonly<Record<string, unknown>> = {
  'the full-charge tap': vibrateCharge,
};

/** The chirp words the critical moments speak; typed against the voice's own vocabulary. */
export const CHIRP_WITNESSES: readonly ChirpName[] = ['focused', 'uh-oh', 'whee', 'wary'];

export const CUE_ROWS: readonly CueRow[] = [
  {
    cue: 'polarity flipped',
    event: 'attach',
    visual: 'field lines',
    audio: 'polarity hum',
  },
  {
    cue: 'charge full',
    event: 'chargeLevel',
    visual: 'field lines',
    audio: 'charge steps',
    haptic: 'the full-charge tap',
  },
  {
    cue: 'gust incoming',
    event: null,
    visual: 'wind streaks',
    audio: 'gust lead',
  },
  {
    cue: 'the save window is open',
    event: 'snapArm',
    visual: 'field lines',
    audio: 'snap voice',
  },
  {
    cue: 'weak metal about to give',
    event: 'crumbleWarn',
    visual: 'the rig',
    audio: 'stress voice',
  },
  {
    cue: 'big fall under way',
    event: 'slowMo',
    visual: 'the burst stack',
    audio: 'uh-oh',
  },
  {
    cue: 'catch landed',
    event: 'snapEngage',
    visual: 'the burst stack',
    audio: 'snap voice',
  },
  {
    cue: 'launch released',
    event: 'repel',
    visual: 'the burst stack',
    audio: 'launch voice',
  },
  {
    cue: 'summit reached',
    event: 'summit',
    visual: 'the burst stack',
    audio: 'clear fanfare',
  },
];

/**
 * The cues that are one sense on purpose, with the reason on record. The audit
 * holds this list to at most two entries and requires a reason for each, so a
 * new single-channel cue is a conscious decision, never an accident.
 */
export const SINGLE_CHANNEL_CUES: readonly { cue: string; reason: string }[] = [
  {
    cue: 'the next unlock dangled',
    reason: 'the clear card\'s own line, written where the eyes already are — the fanfare the card rides is its audio witness',
  },
];
