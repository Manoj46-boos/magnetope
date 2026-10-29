import { DEG, type Vec2 } from '@/core/mathx';
import { MATERIALS } from '@/config/materials';
import { propKind } from '@/config/props';
import type { BuiltProp } from '@/sim/world';
import type { PropPlacement } from '@/sim/types';
import { prop } from '@/levels/author';
import type { MagnoView } from '@/sim/magno';
import type { Hsl } from './palette';
import type { Framing } from './mountain';

/**
 * The store-card composition scene (PRD 17.3, R-TH-01/03): one module owns every
 * number behind the card, so the thumbnail is a designed frame the engine renders,
 * not a screenshot luck produced. It stages a real level's geometry and drives the
 * same rig, field lines and post pass gameplay uses — nothing on the card is drawn
 * by a separate pipeline, so the store frame can never drift from the game.
 *
 * The animated ident (R-TH-10) is the Cooper structure played on the hero
 * composition: a 0.5 s flip-in hook, the catch with its flash by 2.0 s, then a
 * settle and a blink, loop-clean at 3.0 s.
 */

/** The face the card performs, above whatever the staged view alone would earn. Card-only — the rig's gameplay vocabulary is untouched. */
export type CardFace = 'panic';

export type ThumbnailVariant = 'panic-launch' | 'fall-comedy' | 'tower-scale';

export const THUMBNAIL_VARIANTS: readonly ThumbnailVariant[] = ['panic-launch', 'fall-comedy', 'tower-scale'];

export function thumbnailVariant(id: string): ThumbnailVariant | null {
  return (THUMBNAIL_VARIANTS as readonly string[]).includes(id) ? (id as ThumbnailVariant) : null;
}

/** The level whose geometry dresses each variant; capture boots it before entering the stage. */
export function thumbnailLevel(variant: ThumbnailVariant): string {
  return SPECS[variant].level;
}

/**
 * Where the subject sits on the card, as 0-1 UV with y growing down: the contrast
 * and legibility audits measure this box against the ring around it (R-TH-05).
 * The box is centred on the subject point — a body in flight extends every way
 * from where it stands, and the audit must contain whichever way the pose swings.
 * Derived from the spec's own numbers, so the audit can never drift from the shot.
 */
export function thumbnailSubjectBox(variant: ThumbnailVariant): { x: number; y: number; w: number; h: number } {
  const { framing, view, subjectMargin } = SPECS[variant];
  const center = SPECS[variant].subject ?? view.position;
  const size = (2 * subjectMargin) / framing.visibleHeight;
  return {
    x: 0.5 + (center.x - framing.center.x) / framing.visibleHeight - size / 2,
    y: 0.5 - (center.y - framing.center.y) / framing.visibleHeight - size / 2,
    w: size,
    h: size,
  };
}

/**
 * The card's sky grade: burnt amber at the horizon into deep teal at the zenith.
 * The sky shader's authored lightness survives the output encode roughly as a
 * linear value, so these read far deeper than the biome numbers suggest; the
 * dusk is what lets the lit body and the arc separate (R-TH-01/05).
 */
export const CARD_SKY = { top: { h: 206, s: 62, l: 20 }, horizon: { h: 28, s: 88, l: 14 }, sun: { h: 30, s: 90, l: 30 } } as const;

/**
 * The panic family's ramp (rebuild PRD 1.4.3): deep indigo at the zenith, hot
 * coral at the horizon, an amber sun — every hue biased away from mint, the
 * saturation a fifth over the dusk grade it replaces, so a shrunken card still
 * reads lit against the shelf. The fall card wears the same ramp with the
 * horizon shifted to violet dusk, so the pair reads as siblings at a glance.
 */
export const PANIC_SKY = { top: { h: 222, s: 68, l: 12 }, horizon: { h: 356, s: 92, l: 16 }, sun: { h: 45, s: 95, l: 28 } } as const;
export const FALL_SKY = { top: { h: 228, s: 60, l: 13 }, horizon: { h: 258, s: 78, l: 15 }, sun: { h: 45, s: 95, l: 28 } } as const;

export type CardSky = typeof CARD_SKY | typeof PANIC_SKY | typeof FALL_SKY;

/** Ident timing, ms. The hook must land inside half a second or the loop is skipped (Cooper, R-TH-10). */
export const IDENT_HOOK_MS = 500;
export const IDENT_CATCH_MS = 2000;
export const IDENT_MS = 3000;

interface VariantSpec {
  /** Real level that dresses the shot; the card never invents a world (R-TH-03). */
  level: string;
  framing: Framing;
  joy: number;
  view: MagnoView;
  /** Half-size of the subject's box in metres: MAGNO for the close cards, the climb itself for the wide one. */
  subjectMargin: number;
  /** Where the subject's box centers when it is not MAGNO himself; the wide card measures its wall. */
  subject?: Vec2;
  /** Visual-only props the renderer stages on top of the level, dressed by the same prop kit. */
  dress: PropPlacement[];
  /** Where the camera sits on the climb, 0 to 1: the sky shader leans on it for the horizon band. */
  altitude: number;
  /** The wide ambience card keeps the game's silhouettes and clouds; the close cards compose their own sky. */
  ambientSky: boolean;
  /** The close cards' own grade; the ambience card keeps the game's sky. */
  sky: CardSky;
  /** The face performed above what the staged view earns on its own; null leaves the rig to the view. */
  face: CardFace | null;
  /** The card's key light as a share of the biome sun: the panic ramp's spec demands a hotter key than dusk ever needed, so the near-white body reads near-white against the indigo. */
  key: number;
}

/** A prop for the staged card: the world's dressing rules with no physics body under it. */
export function cardDressProp(placement: PropPlacement, index: number): BuiltProp {
  const kind = propKind(placement.kind);
  const shape = kind.shape;
  const width = shape.type === 'box' ? (placement.w ?? shape.w) : (placement.r ?? shape.r) * 2;
  return {
    index,
    placement,
    kind,
    material: MATERIALS[placement.material ?? kind.material],
    width,
    height: shape.type === 'box' ? (placement.h ?? shape.h) : width,
    radius: shape.type === 'disc' ? (placement.r ?? shape.r) : 0,
    colliderHandle: -1,
    bodyHandle: -1,
    dynamic: false,
    moving: false,
  };
}

/** Body lean the simulation would show: upright is 0, leaning into travel is negative. */
function leanInto(vx: number, vy: number): number {
  return -Math.atan2(vx, vy);
}

function stagedView(over: Partial<MagnoView>): MagnoView {
  return {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    angle: 0,
    visualAngle: 0,
    state: 'airborne',
    polarity: 'attract',
    charge01: 0,
    chargeLevel: 0,
    snapArmed: false,
    snapEngaged: false,
    snapTarget: null,
    attachNormal: null,
    limp: false,
    scramble: false,
    recoverPhase: 0,
    grounded: false,
    chaining: false,
    dropMeters: 0,
    ...over,
  };
}

/**
 * The panic launch (rebuild PRD 1.4): the primary card. MAGNO flung along the
 * 38-degree vector off the junk he scattered, one enormous eye wide and
 * already on the beam end waiting upper right — the launch, the destination
 * and the drop below him in a single read. The framing is the concept card's
 * own law, rescaled to the rig's real body: two metres of visible height put
 * him past half the card, where the encyclopedia's 4.2 m left the engine's
 * smaller body reading at a tenth. The staged view carries no engagement: he
 * is mid-flight, which is the whole story.
 */
function panicLaunch(): VariantSpec {
  const velocity = { x: 3.94, y: 3.08 };
  return {
    level: 'scrapyard-04',
    framing: { center: { x: -0.16, y: 16.04 }, visibleHeight: 2.0, rollDeg: -6 },
    joy: 0,
    subjectMargin: 0.45,
    dress: PANIC_DRESS,
    altitude: 0.3,
    ambientSky: false,
    sky: PANIC_SKY,
    face: 'panic',
    key: 3.6,
    view: stagedView({
      position: { x: -0.4, y: 15.8 },
      velocity,
      visualAngle: -18 * DEG,
      polarity: 'repel',
      snapTarget: DESTINATION,
    }),
  };
}

/**
 * The blooper reel card: a flip that never connected, MAGNO windmilling with the
 * wide-eye panic the fall animation already owns, amber repel glow behind him,
 * the calm stack beside him for scale. The panic face rides the card too — the
 * fall earns it honestly, and the card grades it up so the pair matches.
 */
function fallComedy(): VariantSpec {
  const velocity = { x: 1.4, y: -12.5 };
  return {
    level: 'scrapyard-04',
    framing: { center: { x: 0.25, y: 16.4 }, visibleHeight: 3.4, rollDeg: 5 },
    joy: 0,
    subjectMargin: 0.55,
    dress: JUNK_STACK,
    altitude: 0.3,
    ambientSky: false,
    sky: FALL_SKY,
    face: 'panic',
    key: 2.6,
    view: stagedView({
      position: { x: -0.75, y: 16.45 },
      velocity,
      visualAngle: 2.35,
      polarity: 'repel',
      dropMeters: 9,
    }),
  };
}

/**
 * The ambience card: the whole Tin Roof shaft, summit beacon lit, drifting
 * clouds and backdrop ridges, MAGNO small on his beam up the left wall. The
 * world tour sells this one.
 */
function towerScale(): VariantSpec {
  const velocity = { x: -2.8, y: 3.4 };
  return {
    level: 'scrapyard-04',
    framing: { center: { x: 0.4, y: 14.6 }, visibleHeight: 24.5, rollDeg: 0 },
    joy: 0,
    subjectMargin: 1.2,
    subject: { x: 4.7, y: 22 },
    dress: [],
    altitude: 0.69,
    ambientSky: true,
    sky: CARD_SKY,
    face: null,
    key: 2.6,
    view: stagedView({
      position: { x: -3.6, y: 10.2 },
      velocity,
      visualAngle: leanInto(velocity.x, velocity.y),
      snapArmed: true,
      snapEngaged: true,
      snapTarget: { x: -4.3, y: 13.2 },
    }),
  };
}

/** The hero and blooper cards share one junk pile: a barrel poking in from the edge, a crate, a tilted washer breaking the top, a locker above it. */
const JUNK_STACK: PropPlacement[] = [
  prop.barrel(1.85, 15.45),
  prop.crate(0.95, 15.7, { w: 1.9, h: 1.6 }),
  prop.washer(1.1, 17.45, { rot: 0.12 }),
  prop.locker(0.95, 20.0, { rot: -0.08 }),
];

/** Where the panic launch is headed: the end of the girder staged inside the upper right of the tight frame, the bullseye's own anchor. */
const DESTINATION = { x: 0.55, y: 16.6 };

/**
 * The panic card's dressing: the destination girder poking its end into the
 * upper right, and the junk the launch knocked loose — a fridge laid over and
 * a tire frozen mid-tumble at the frame's bottom band, with the crate he left
 * on the lower left. Every piece is the world's own kit; the card invents
 * nothing.
 */
const PANIC_DRESS: PropPlacement[] = [
  prop.girder(2.55, 16.6, 4.0, { rot: 0.05 }),
  prop.fridge(-0.05, 13.85, { rot: 1.2 }),
  prop.tire(-0.75, 14.5, { rot: 2.0 }),
  prop.crate(-1.5, 14.6, { w: 1.7, h: 1.7, rot: -0.12 }),
];

const SPECS: Record<ThumbnailVariant, VariantSpec> = {
  'panic-launch': panicLaunch(),
  'fall-comedy': fallComedy(),
  'tower-scale': towerScale(),
};

export interface ThumbnailFrame {
  framing: Framing;
  view: MagnoView;
  joy: number;
  /** One-shot flash amount for this frame; 0 when nothing fired. */
  flash: number;
  /** Requests the rig's blink pulse on this frame. */
  blink: boolean;
  /** The card's own face for this frame; null leaves the rig to the view. */
  face: CardFace | null;
}

/** Position on a quadratic bend from `a` to `c`, bowing out through `b`. */
function bend(a: Vec2, b: Vec2, c: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    y: u * u * a.y + 2 * u * t * b.y + t * t * c.y,
  };
}

const easeOut = (t: number): number => 1 - (1 - t) ** 3;
const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/**
 * Feeds the renderer a staged frame every tick. Static variants hold their pose;
 * the ident plays the Cooper timeline over the panic composition — tumble in,
 * launch, catch, settle — and holds its final frame past the loop point so a
 * paused capture lands on the settle.
 */
export class ThumbnailStage {
  private readonly spec: VariantSpec;
  private readonly ident: boolean;
  private phaseMs = 0;
  private flashed = false;
  private blinked = false;

  constructor(variant: ThumbnailVariant, ident = false) {
    this.spec = SPECS[variant];
    this.ident = ident && variant === 'panic-launch';
  }

  get level(): string {
    return this.spec.level;
  }

  /** Sky override the renderer grades the backdrop with while the stage is live. */
  get sky(): { top: Hsl; horizon: Hsl; sun: Hsl } {
    const { top, horizon, sun } = this.spec.sky;
    return { top: { ...top }, horizon: { ...horizon }, sun: { ...sun } };
  }

  /** Staged props for this variant; the renderer dresses them with the game's own kit. */
  get dress(): readonly PropPlacement[] {
    return this.spec.dress;
  }

  /** The bullseye for the beam: where the guide rings should pulse, or null. */
  get guide(): { x: number; y: number } | null {
    return this.spec.view.snapTarget;
  }

  /** Camera height on the climb, 0 to 1, fed to the sky shader instead of the frozen body's. */
  get altitude(): number {
    return this.spec.altitude;
  }

  /** Whether the game's silhouettes and clouds stay in the shot. */
  get ambientSky(): boolean {
    return this.spec.ambientSky;
  }

  /** The face this variant performs on its still; the ident frames it beat by beat. */
  get face(): CardFace | null {
    return this.spec.face;
  }

  /** The card's key light share of the biome sun. */
  get key(): number {
    return this.spec.key;
  }

  step(dtMs: number): ThumbnailFrame {
    this.phaseMs += dtMs;
    if (!this.ident) {
      const { framing, joy, view, face } = this.spec;
      return { framing, view, joy, flash: 0, blink: false, face };
    }
    return this.identFrame(this.phaseMs);
  }

  private identFrame(ms: number): ThumbnailFrame {
    const spec = this.spec;
    const fly = spec.view.position;
    const target = spec.view.snapTarget!;
    const settle = clamp01((ms - IDENT_CATCH_MS) / (IDENT_MS - IDENT_CATCH_MS));

    if (ms < IDENT_HOOK_MS) {
      // The hook: MAGNO tumbles in from off-frame below and left, the body
      // unwinding as he rises, the panic eye already wide (rebuild PRD 1.4.4).
      const e = easeOut(clamp01(ms / IDENT_HOOK_MS));
      const from = { x: fly.x - 2.4, y: fly.y - 2.8 };
      const at = bend(from, { x: fly.x - 0.9, y: fly.y + 0.6 }, fly, e);
      return {
        framing: spec.framing,
        joy: 0,
        flash: 0,
        blink: false,
        face: 'panic',
        view: stagedView({
          position: at,
          velocity: spec.view.velocity,
          visualAngle: spec.view.visualAngle - 2.2 * (1 - e),
          polarity: 'repel',
        }),
      };
    }

    if (ms < IDENT_CATCH_MS) {
      // The launch: up the 38-degree vector toward the beam end. The beam
      // connects in the last tenth of a second — arcs and glow arrive before
      // the flash peaks, so the catch frame is the energy's crest, not its
      // onset — and the flash itself fires exactly on the two-second mark,
      // never before and never again.
      const engaged = ms >= IDENT_CATCH_MS - 100;
      const e = easeOut(clamp01((ms - IDENT_HOOK_MS) / (IDENT_CATCH_MS - IDENT_HOOK_MS)));
      const at = bend(fly, { x: (fly.x + target.x) / 2 + 0.9, y: (fly.y + target.y) / 2 + 1.1 }, { x: target.x - 0.35, y: target.y - 0.75 }, e);
      return {
        framing: spec.framing,
        joy: 0,
        flash: 0,
        blink: false,
        face: 'panic',
        view: stagedView({
          position: at,
          velocity: spec.view.velocity,
          visualAngle: spec.view.visualAngle,
          polarity: 'repel',
          snapEngaged: engaged,
          snapTarget: target,
        }),
      };
    }

    // The catch and settle: on the beam end by the two-second mark, the flash
    // spent on that frame, stood against the steel face with arms up and one
    // blink before the loop holds clean.
    const flash = !this.flashed ? 1 : 0;
    if (flash > 0) this.flashed = true;
    const blink = ms >= IDENT_CATCH_MS + 560 && ms < IDENT_CATCH_MS + 700 && !this.blinked;
    if (blink) this.blinked = true;
    const at = bend({ x: target.x - 0.35, y: target.y - 0.75 }, { x: target.x - 0.38, y: target.y - 0.73 }, { x: target.x - 0.36, y: target.y - 0.74 }, easeOut(settle));
    return {
      framing: spec.framing,
      joy: 1,
      flash,
      blink,
      face: null,
      view: stagedView({
        position: at,
        velocity: { x: 0, y: 0 },
        visualAngle: 0,
        state: 'attached',
        attachNormal: { x: 1, y: 0 },
        snapEngaged: true,
        snapTarget: target,
      }),
    };
  }
}
