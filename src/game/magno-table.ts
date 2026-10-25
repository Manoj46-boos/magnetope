import type { EyeState } from '@/render/magno-rig';
import type { ChirpName } from '@/audio/recipes';

/**
 * MAGNO's emotion table (R-CH-04): one row per word of the chirp language,
 * naming the face the rig performs, the pose it plays, the moment that
 * speaks, and the aesthetic the moment serves. The names are typed against
 * the rig's own EyeState union and the recipes' own ChirpName union, so a
 * face the rig cannot show or a word the recipes cannot speak fails the
 * compile before any test runs. docs/MAGNO.md is rendered from this table
 * by `npm run docs` and never edited by hand.
 */

export interface MagnoEmotion {
  /** The word of the language — one row per chirp, complete both ways. */
  word: ChirpName;
  /** The face the rig performs for the moment, from the rig's own vocabulary. */
  face: EyeState;
  /** The moment that speaks the word, in the game's own terms. */
  trigger: string;
  /** What the body plays while the eye carries the face. */
  pose: string;
  /** The MDA aesthetic the moment serves (PRD Ch. 16.1). */
  aesthetic: string;
  /** When the word holds its tongue — the rate and the gate that keep it rare. */
  discipline: string;
}

/**
 * The language's whole vocabulary, held here so the doc suite can prove the
 * table is complete. The Record satisfies the type union both ways, so a word
 * the recipes gain or drop fails the compile here.
 */
const WORDS = {
  curious: 1,
  focused: 1,
  whee: 1,
  'uh-oh': 1,
  ouch: 1,
  relief: 1,
  'ta-da': 1,
  deadpan: 1,
  weary: 1,
  wary: 1,
  miss: 1,
  home: 1,
} as const satisfies Record<ChirpName, number>;

export const CHIRP_WORDS: readonly ChirpName[] = Object.keys(WORDS) as readonly ChirpName[];

export const MAGNO_EMOTIONS: readonly MagnoEmotion[] = [
  {
    word: 'curious',
    face: 'curious',
    trigger: 'the idle character beat, about every twenty seconds of standing still',
    pose: 'the head sweeps its look-around, and for full motion a whole flip in place',
    aesthetic: 'wonder — the world is worth examining even while nothing happens',
    discipline: 'only while settled; never mid-climb, mid-charge or mid-fall',
  },
  {
    word: 'focused',
    face: 'focused',
    trigger: 'the charge meter tops out',
    pose: 'the coil at its deepest, the shiver holding, the pupil dilated to its widest',
    aesthetic: 'focus — the whole body is one held breath',
    discipline: 'named once at the top of the meter, not on every step of the climb',
  },
  {
    word: 'whee',
    face: 'whee',
    trigger: 'the full-power release',
    pose: 'the stretch out of the coil, the eye leading the line of flight',
    aesthetic: 'joy-grit — the throw that everything else was for',
    discipline: 'the same bar that earns the freeze; never a tap',
  },
  {
    word: 'uh-oh',
    face: 'panic',
    trigger: 'the fall crosses the cinematic threshold',
    pose: 'the windmill — the arms flailing at the passing air, the eye wide',
    aesthetic: 'comic panic — the drop is serious, the flailing is not',
    discipline: 'once per fall, at the crossing; the slow-mo may yield to the ledger, the voice still lands',
  },
  {
    word: 'ouch',
    face: 'wince',
    trigger: 'the bonk that dazes him',
    pose: 'the squeeze-shut of the landing, then the comic X or the seeing-stars pulse',
    aesthetic: 'slapstick — the hurt is a beat, never a wound',
    discipline: 'only the impact that takes him; a caught thud is the surface\u2019s own word',
  },
  {
    word: 'relief',
    face: 'relief',
    trigger: 'the save — a surface caught before the landing',
    pose: 'the catch squash, the wide-open eye coming back soft',
    aesthetic: 'relief — the held breath let out',
    discipline: 'a catch that ends a registered fall; routine catches keep their quiet',
  },
  {
    word: 'ta-da',
    face: 'pride',
    trigger: 'the third star lands on a three-star clear',
    pose: 'the gleam riding the eye through the pride window',
    aesthetic: 'pride — the full verdict, stated',
    discipline: 'three stars only, and never over the fanfare; when the fanfare still speaks, the fanfare is the pride',
  },
  {
    word: 'deadpan',
    face: 'dazed',
    trigger: 'the fall card\u2019s grade badge, on a spectacular fail',
    pose: 'the comic X (or the seeing-stars pulse) and the flat stare',
    aesthetic: 'deadpan — the verdict witnessed without comment',
    discipline: 'grade A or better; small stumbles keep their dignity',
  },
  {
    word: 'weary',
    face: 'weary',
    trigger: 'the get-up begins',
    pose: 'the procedural struggle, the arms pushing off the ground',
    aesthetic: 'effort — getting up costs something',
    discipline: 'once per recovery',
  },
  {
    word: 'wary',
    face: 'wary',
    trigger: 'the surface under him starts to fail',
    pose: 'the squint, the pupil darting to the very prop that warned',
    aesthetic: 'unease — the world gives its honest telegraph and he reads it',
    discipline: 'the same word twice inside two seconds is machine-gun fire, not speech',
  },
  {
    word: 'miss',
    face: 'whee',
    trigger: 'the snap spent on nothing',
    pose: 'none — a whiff must not dress itself as a catch',
    aesthetic: 'embarrassment — the small bwop of a promise kept to the air',
    discipline: 'the voice is the whiff\u2019s only comment',
  },
  {
    word: 'home',
    face: 'home',
    trigger: 'the ending\u2019s pull-back, the wide quiet shot',
    pose: 'the arms overhead, the gaze up toward the light',
    aesthetic: 'quiet homecoming — seventy levels of stubbornness, arrived',
    discipline: 'the film\u2019s own; never in play',
  },
];
