import type { SimEvents } from '@/sim/simulation';

/**
 * The Feel Bible's own table (R-GF-14): one row for every simulation event that
 * carries feel, naming the transition it answers, the juice stack it spends,
 * the voices it plays and what the stack costs. The event names are typed
 * against the simulation's own vocabulary, so a row for an event the sim never
 * emits fails to compile, and the doc suite fails the build if a listener
 * appears in the render, game or audio layers without a row here. The doc is
 * rendered from this table by `npm run docs` and never edited by hand.
 */

export type SimEventName = keyof SimEvents;

/** Game-level beats that carry feel without being simulation events. */
export type GameBeatName =
  | 'boot'
  | 'opener'
  | 'biome card'
  | 'clear card'
  | 'star stamp'
  | 'fall card'
  | 'pause'
  | 'retry'
  | 'ending cue'
  | 'ad break'
  | 'reward toast';

export interface FeelRow {
  event: SimEventName | GameBeatName;
  /** The state change the event answers, in the sim's own words. */
  transition: string;
  /** The juice stack, in spend order. */
  juice: string;
  /** Recipe and voice names as they exist in the audio modules. */
  audio: readonly string[];
  /** What the stack costs: particles, rig time, voices. */
  budget: string;
}

/**
 * The simulation's whole event vocabulary, held here so the doc suite can
 * subscribe to every name on a live run. The Record satisfies the type union
 * both ways, so an event the sim gains or drops fails the compile here.
 */
const NAMES = {
  attach: 1,
  detach: 1,
  chargeLevel: 1,
  repel: 1,
  snapArm: 1,
  snapEngage: 1,
  snapWhiff: 1,
  impact: 1,
  limp: 1,
  recoverBegin: 1,
  recoverEnd: 1,
  weakCrumble: 1,
  boing: 1,
  fall: 1,
  slowMo: 1,
  saved: 1,
  crumbleWarn: 1,
  crumble: 1,
  restore: 1,
  followerMove: 1,
  runStart: 1,
  summit: 1,
  checkpoint: 1,
  respawn: 1,
  glassBreak: 1,
} as const satisfies Record<SimEventName, number>;

export const SIM_EVENT_NAMES: readonly SimEventName[] = Object.keys(NAMES) as readonly SimEventName[];

export const FEEL_ROWS: readonly FeelRow[] = [
  {
    event: 'attach',
    transition: 'airborne → attached',
    juice: 'squash inside 120 ms, an arrival-speed burst, the caught surface lit by a squashed cyan patch; a snap catch adds the white snap-line ring and the ident flash, then the wobble spends the flight momentum inside three cycles',
    audio: ['playAttach', 'playTick'],
    budget: 'one particle burst inside the tier ceiling; rig springs, 100-230 bytes a frame',
  },
  {
    event: 'detach',
    transition: 'attached → airborne (lost, weak-failed)',
    juice: 'nothing staged — the losing itself is the beat, and the fall tracker picks the story up',
    audio: [],
    budget: 'free',
  },
  {
    event: 'chargeLevel',
    transition: 'attached → charging, meter crossing a segment',
    juice: 'the meter segment punches through, the rig coils tighter, the shiver holds at full charge',
    audio: ['playChargeLevel'],
    budget: 'rig only',
  },
  {
    event: 'repel',
    transition: 'charging → repelled → airborne',
    juice: 'full power earns the freeze: hit-stop, the camera lunge along the flight vector, the +3° lens pop, the origin burst with its white-hot core, and the rig stretching out of its coil; the charge dolly pays itself back',
    audio: ['playRepel'],
    budget: 'the release stack: one burst, one ring, the freeze and camera springs, all inside the release frame',
  },
  {
    event: 'snapArm',
    transition: 'aim layer, no state change',
    juice: 'the snap reticle reads the candidate; quiet by design so the engage lands',
    audio: [],
    budget: 'free',
  },
  {
    event: 'snapEngage',
    transition: 'airborne → attached (snap)',
    juice: 'the catch relief stack: squash, glow patch, ring, ident flash, camera settle, momentum carried through the friction ramp',
    audio: ['playSnapEngage', 'playAttach'],
    budget: 'see attach; the ident veil rides ~50 ms',
  },
  {
    event: 'snapWhiff',
    transition: 'airborne, the snap spent on nothing',
    juice: 'none stacked — a whiff must not dress itself as a catch',
    audio: ['playSnapWhiff'],
    budget: 'free',
  },
  {
    event: 'impact',
    transition: 'any → hard landing scrambles the rig',
    juice: 'dust at the contact, the shake grammar scaled by speed, the scramble wobble through its window',
    audio: ['playImpact'],
    budget: 'dust burst; the freeze only if a slow-mo beat is live',
  },
  {
    event: 'limp',
    transition: '→ recovering',
    juice: 'the rig goes limp; comedy is held back until the card',
    audio: [],
    budget: 'free',
  },
  {
    event: 'recoverBegin',
    transition: 'recovering, the get-up starts',
    juice: 'the procedural get-up plays out — no skip, the struggle is the joke',
    audio: [],
    budget: 'rig only',
  },
  {
    event: 'recoverEnd',
    transition: 'recovering → attached',
    juice: 'control returns with the settle bounce',
    audio: ['playGetUp'],
    budget: 'free',
  },
  {
    event: 'weakCrumble',
    transition: 'a weak metal prop gives way under MAGNO',
    juice: 'the prop breaks apart where he stood',
    audio: ['playCrumble'],
    budget: 'one debris burst',
  },
  {
    event: 'boing',
    transition: 'landing on a boing surface',
    juice: 'the surface throws him back, each bounce lower',
    audio: ['playBoing'],
    budget: 'one bounce burst',
  },
  {
    event: 'fall',
    transition: '→ airborne, the drop scoring begins',
    juice: 'the fall card after the settle: height, bounces, junk displaced and the grade badges',
    audio: ['WhistleVoice'],
    budget: 'the card; the whistle voice is continuous',
  },
  {
    event: 'slowMo',
    transition: 'a fall crosses the cinematic threshold',
    juice: 'the world drops to 0.35 times, ramping in; the whistle glides and the score darkens — only when the ledger has room',
    audio: ['WhistleVoice', 'WindVoice'],
    budget: 'the one beat that yields to the 20 s spacing ledger',
  },
  {
    event: 'saved',
    transition: 'a surface caught before landing',
    juice: 'the slow-mo releases without the card — relief without the ceremony',
    audio: [],
    budget: 'free',
  },
  {
    event: 'crumbleWarn',
    transition: 'a crumbling surface is carrying weight',
    juice: 'the prop shivers under load — the honest telegraph',
    audio: ['playStress'],
    budget: 'free',
  },
  {
    event: 'crumble',
    transition: 'the crumbling surface gives way',
    juice: 'it breaks apart and re-forms once nobody stands in its way',
    audio: ['playCrumble', 'playIceBreak'],
    budget: 'one debris burst',
  },
  {
    event: 'restore',
    transition: 'the crumbling surface re-forms',
    juice: 'quiet reassembly',
    audio: ['playTick'],
    budget: 'free',
  },
  {
    event: 'followerMove',
    transition: 'a follower prop answers its rider or its call box',
    juice: 'the drawer, the lift, the shelf slides home',
    audio: ['playSlide'],
    budget: 'free',
  },
  {
    event: 'runStart',
    transition: 'idle → play, the first input lands',
    juice: 'the hazard clock unfreezes; the HUD is already up',
    audio: [],
    budget: 'free',
  },
  {
    event: 'summit',
    transition: 'play → cleared',
    juice: 'the flash, the confetti, the clear card with its stamps; the last level hands over to the film',
    audio: ['playFanfare', 'playStarStamp'],
    budget: 'confetti burst; the card',
  },
  {
    event: 'checkpoint',
    transition: 'a checkpoint crossed',
    juice: 'none staged — the checkpoints serve the hazard clock and the fairness law, not the screen',
    audio: [],
    budget: 'free',
  },
  {
    event: 'respawn',
    transition: 'void or second wind, the level rebuilds MAGNO',
    juice: 'the camera snaps to him and the frame draws at once — no loading beat',
    audio: [],
    budget: 'one capture step',
  },
  {
    event: 'glassBreak',
    transition: 'MAGNO or a body breaks a pane',
    juice: 'the shards leave the world and the screen together',
    audio: ['playGlassBreak'],
    budget: 'one shard burst',
  },
];

export const FEEL_GAME_BEATS: readonly FeelRow[] = [
  {
    event: 'boot',
    transition: 'cold page → world',
    juice: 'the loading film, then the world with the opener already moving — no menu before the game',
    audio: [],
    budget: 'the opener sequence',
  },
  {
    event: 'opener',
    transition: 'first input → first catch',
    juice: 'the scripted first launch, the attention hop, the half-speed first catch, the nudge ladder — the ninety-second contract',
    audio: [],
    budget: 'the opener owns the frame until it hands the camera back',
  },
  {
    event: 'biome card',
    transition: 'one biome → the next',
    juice: 'the establishing shot: the hero silhouette in its sky, the name and its one-line promise',
    audio: [],
    budget: 'a staged beat, recorded by the ledger',
  },
  {
    event: 'clear card',
    transition: 'cleared → next level',
    juice: 'the stamps land one by one, the par ghost verdict, the next-level path — the breathing space the ledger banks on',
    audio: ['playStarStamp', 'playFanfare'],
    budget: 'the card',
  },
  {
    event: 'star stamp',
    transition: 'each earned star',
    juice: 'the stamp punch with the score\'s own tonic',
    audio: ['playStarStamp'],
    budget: 'free',
  },
  {
    event: 'fall card',
    transition: 'the settle after a fall',
    juice: 'the comedy verdict: height, bounces, junk, the grade badge — shame-free retry copy',
    audio: [],
    budget: 'the card',
  },
  {
    event: 'pause',
    transition: 'play → paused',
    juice: 'the world holds its breath; the menu offers controls, keys, ghosts, the locker',
    audio: [],
    budget: 'free',
  },
  {
    event: 'retry',
    transition: 'cleared or fallen → play again',
    juice: 'the rebuild, 19-37 ms on the heaviest levels, no menu on the way',
    audio: [],
    budget: 'the level rebuild',
  },
  {
    event: 'ending cue',
    transition: 'the film\'s four beats',
    juice: 'seat, bloom, pullback, credits — the wordless homecoming',
    audio: ['playCoreSeat', 'playBloomSwell', 'playPullbackPad', 'playFanfare'],
    budget: 'the film owns the frame',
  },
  {
    event: 'ad break',
    transition: 'a natural stop → the host\'s ad',
    juice: 'the bed ducks before the break, breathes out so no music tail crosses it, and returns clean',
    audio: ['setAdDuck'],
    budget: 'never mid-run',
  },
  {
    event: 'reward toast',
    transition: 'a reward path crossed',
    juice: 'the toast names the earned look and where to wear it',
    audio: ['playTick'],
    budget: 'the toast',
  },
];
