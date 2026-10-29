/** Canonical logical stage sizes Poki requires the game to scale proportionally to. */
export const CANONICAL_SIZES = [
  { width: 640, height: 360 },
  { width: 836, height: 470 },
  { width: 1031, height: 580 },
] as const;

export interface StageLayout {
  /** Largest canonical size that fits inside the viewport. */
  canonical: { width: number; height: number };
  /** Full-bleed canvas size in CSS pixels; no bars on any device. */
  cssWidth: number;
  cssHeight: number;
  portrait: boolean;
  /** World extents at the player plane that the camera must always keep in frame. */
  minVisibleWidth: number;
  minVisibleHeight: number;
}

/** Portrait width is the climbing doctrine (P-MO-01): at 5 metres MAGNO reads at character scale, where 7.6 letterboxed him into a speck. */
const WORLD_FRAME = { landscapeHeight: 8.6, portraitWidth: 5.0 };

export function layoutStage(viewportWidth: number, viewportHeight: number): StageLayout {
  const w = Math.max(1, Math.floor(viewportWidth));
  const h = Math.max(1, Math.floor(viewportHeight));
  let canonical: { width: number; height: number } = CANONICAL_SIZES[0];
  for (const size of CANONICAL_SIZES) if (size.width <= w && size.height <= h) canonical = size;

  const portrait = h > w;
  const aspect = w / h;
  // The play frame is always guaranteed; extra screen area only reveals more world.
  const minVisibleHeight = portrait ? WORLD_FRAME.portraitWidth / aspect : WORLD_FRAME.landscapeHeight;
  const minVisibleWidth = portrait ? WORLD_FRAME.portraitWidth : WORLD_FRAME.landscapeHeight * (16 / 9);
  return { canonical, cssWidth: w, cssHeight: h, portrait, minVisibleWidth, minVisibleHeight };
}

/** Distance from the player plane needed to frame the guaranteed world extents. */
export function cameraDistance(layout: StageLayout, verticalFovDeg: number): number {
  const aspect = layout.cssWidth / layout.cssHeight;
  const tan = Math.tan((verticalFovDeg * Math.PI) / 360);
  const forHeight = layout.minVisibleHeight / (2 * tan);
  const forWidth = layout.minVisibleWidth / aspect / (2 * tan);
  return Math.max(forHeight, forWidth);
}

/** Dynamic resolution scale from a rolling 30-frame frame-time average (PRD 10.4). */
export class ResolutionGovernor {
  private samples: number[] = [];
  scale = 1;

  constructor(
    private readonly minScale: number,
    private readonly targetMs = 1000 / 55,
  ) {}

  push(frameMs: number): number {
    this.samples.push(frameMs);
    if (this.samples.length < 30) return this.scale;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples = [];
    if (avg > this.targetMs * 1.15) this.scale = Math.max(this.minScale, this.scale - 0.1);
    else if (avg < this.targetMs * 0.8) this.scale = Math.min(1, this.scale + 0.05);
    return this.scale;
  }
}
