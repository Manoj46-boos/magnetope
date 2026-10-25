import type { BeatKind } from '@/game/spectacle';

/**
 * The aesthetics table (R-SM-07): every signature beat named with the emotion
 * it aims for, the composition stack it spends, what the stack costs and the
 * test that holds it. The scripted beats are the ledger's `BeatKind`s plus the
 * two the game composes without asking the ledger (the full-power release and
 * the snap ident, both dense enough to space themselves by their own nature).
 * The doc is rendered from this table by `npm run docs`; the suite holds the
 * doc to the table and the table to the code.
 */

export interface SpectacleBeat {
  /** The ledger's own name where the beat is one of its kinds. */
  kind: BeatKind | 'release' | 'snap-ident' | 'clear-card';
  /** Whether the ledger records it, gates it, or it self-spaces. */
  rule: 'recorded' | 'gated' | 'self-spaced';
  /** The MDA aesthetic the beat serves, in one phrase. */
  emotion: string;
  composition: string;
  budget: string;
  test: string;
}

export const SPECTACLE_BEATS: readonly SpectacleBeat[] = [
  {
    kind: 'establish',
    rule: 'recorded',
    emotion: 'arrival — the world states its scale before it asks for a climb',
    composition: 'the biome establishing shot: the hero silhouette against its committed sky, the name card and its one-line promise',
    budget: 'the backdrop near layer; the title card',
    test: 'tests/backdrop.test.ts',
  },
  {
    kind: 'first-catch',
    rule: 'recorded',
    emotion: 'relief earned in the first ten seconds — the promise that the game catches you back',
    composition: 'the one-time opener beat: the scripted launch, the attention hop, the half-speed catch with its flash',
    budget: 'the opener owns the frame until the handoff',
    test: 'tests/opener.test.ts',
  },
  {
    kind: 'release',
    rule: 'self-spaced',
    emotion: 'power — the player authored the throw and the world answers at full volume',
    composition: 'the Nijman stack: hit-stop, the flight-vector lunge, the +3° lens pop, the white-hot origin burst, the rig stretching out of its coil',
    budget: 'one burst, one ring, the freeze and camera springs',
    test: 'tests/juice.test.ts',
  },
  {
    kind: 'snap-ident',
    rule: 'self-spaced',
    emotion: 'identity — every catch stamps the wordmark, the game repeating its own name',
    composition: 'the ident flash: the veil plus the bloom halo, with only the ident riding the bloom',
    budget: 'the veil rides ~50 ms; only the ident path lifts',
    test: 'tests/snap-juice.test.ts',
  },
  {
    kind: 'slow-mo',
    rule: 'gated',
    emotion: 'comic dread turning to comedy — the fall made cinema before the verdict',
    composition: 'the big-fall slow motion: 0.35 times, the whistle glide, the score closing its filter, released by the impact flash or a save',
    budget: 'the one beat that yields when a staged moment just played',
    test: 'tests/spectacle-spacing.test.ts',
  },
  {
    kind: 'clear-card',
    rule: 'recorded',
    emotion: 'pride and release — the summit proven, the stamps landing one by one',
    composition: 'the clear card: the flash, the confetti, the star stamps on the score\'s own tonic, the par ghost verdict, the next-level path',
    budget: 'confetti burst; the card is the breathing space between beats',
    test: 'tests/game-rules.test.ts',
  },
  {
    kind: 'ending',
    rule: 'recorded',
    emotion: 'quiet homecoming — sixty wordless seconds that pay the whole climb off',
    composition: 'the film: the core seats into MAGNO, the dipole bloom across the sky, the pullback over the five-band mountain, the credits card',
    budget: 'the film owns the frame; four score cues over the adaptive bed',
    test: 'tests/ending.test.ts',
  },
];
