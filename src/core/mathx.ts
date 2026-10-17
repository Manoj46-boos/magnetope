export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => (a === b ? 0 : clamp((v - a) / (b - a), 0, 1));
export const smoothstep = (a: number, b: number, v: number): number => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};
export const approach = (current: number, target: number, maxDelta: number): number =>
  Math.abs(target - current) <= maxDelta ? target : current + Math.sign(target - current) * maxDelta;
export const damp = (current: number, target: number, rate: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-rate * dt));
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Shortest signed angle from `a` to `b`, in (-PI, PI]. */
export const angleDelta = (a: number, b: number): number => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d <= -Math.PI) d += TAU;
  return d;
};

export interface Vec2 {
  x: number;
  y: number;
}
export const v2 = (x = 0, y = 0): Vec2 => ({ x, y });
export const dot2 = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const len2 = (a: Vec2): number => Math.hypot(a.x, a.y);
/** Length of (x, y) without the heap allocation `Math.hypot` makes on every call; for per-frame code that does not feed the simulation. */
export const hypot2 = (x: number, y: number): number => Math.sqrt(x * x + y * y);
export const norm2 = (a: Vec2): Vec2 => {
  const l = len2(a);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
export const perp2 = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });
