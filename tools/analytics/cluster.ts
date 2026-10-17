import { Rng } from '@/core/rng';
import type { Vec2 } from '@/core/mathx';

export interface Cluster {
  center: Vec2;
  size: number;
  /** Share of all clustered points. */
  share: number;
  /** Mean distance of members from the centre, in metres. */
  spread: number;
}

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** k-means++ seeding, then Lloyd iterations; deterministic for a given seed. */
export function kmeans(points: readonly Vec2[], k: number, seed = 1): { centers: Vec2[]; assignment: number[] } {
  const rng = new Rng(seed);
  const centers: Vec2[] = [{ ...points[Math.floor(rng.next() * points.length)]! }];
  while (centers.length < k) {
    const weights = points.map((p) => Math.min(...centers.map((c) => distance(p, c) ** 2)));
    const total = weights.reduce((a, b) => a + b, 0);
    if (total === 0) break;
    let pick = rng.next() * total;
    let chosen = 0;
    for (let i = 0; i < weights.length; i++) {
      pick -= weights[i]!;
      if (pick <= 0) {
        chosen = i;
        break;
      }
    }
    centers.push({ ...points[chosen]! });
  }

  let assignment = new Array<number>(points.length).fill(0);
  for (let round = 0; round < 60; round++) {
    const next = points.map((p) => nearest(p, centers));
    const settled = next.every((value, i) => value === assignment[i]);
    assignment = next;
    centers.forEach((center, index) => {
      const members = points.filter((_, i) => assignment[i] === index);
      if (members.length === 0) return;
      center.x = members.reduce((sum, p) => sum + p.x, 0) / members.length;
      center.y = members.reduce((sum, p) => sum + p.y, 0) / members.length;
    });
    if (settled) break;
  }
  return { centers, assignment };
}

function nearest(point: Vec2, centers: readonly Vec2[]): number {
  let best = 0;
  let bestDistance = Infinity;
  centers.forEach((center, index) => {
    const d = distance(point, center);
    if (d < bestDistance) {
      bestDistance = d;
      best = index;
    }
  });
  return best;
}

/** Mean silhouette: 1 for tight, well separated groups, near 0 for overlapping ones. */
export function silhouette(points: readonly Vec2[], assignment: readonly number[], k: number): number {
  if (k < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const sums = new Array<number>(k).fill(0);
    const counts = new Array<number>(k).fill(0);
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      sums[assignment[j]!]! += distance(points[i]!, points[j]!);
      counts[assignment[j]!]!++;
    }
    const own = assignment[i]!;
    if (counts[own] === 0) continue;
    const a = sums[own]! / counts[own]!;
    let b = Infinity;
    for (let c = 0; c < k; c++) if (c !== own && counts[c]! > 0) b = Math.min(b, sums[c]! / counts[c]!);
    if (Number.isFinite(b)) total += (b - a) / Math.max(a, b, 1e-9);
  }
  return total / points.length;
}

export interface ClusterOptions {
  maxK?: number;
  /** Below this silhouette the falls are one diffuse smear rather than distinct trouble spots. Evenly spread points still split in two at about 0.57, so the bar sits above that. */
  minSilhouette?: number;
  /** Larger sets are sampled evenly so the quadratic silhouette stays cheap. */
  maxPoints?: number;
  seed?: number;
}

const summarise = (points: readonly Vec2[], centers: readonly Vec2[], assignment: readonly number[]): Cluster[] =>
  centers
    .map((center, index) => {
      const members = points.filter((_, i) => assignment[i] === index);
      const spread = members.length ? members.reduce((sum, p) => sum + distance(p, center), 0) / members.length : 0;
      return { center: { ...center }, size: members.length, share: members.length / points.length, spread };
    })
    .filter((c) => c.size > 0)
    .sort((a, b) => b.size - a.size);

/** Clusters fall positions, choosing k by silhouette score (PRD 11.3). */
export function clusterFalls(points: readonly Vec2[], options: ClusterOptions = {}): Cluster[] {
  const { maxK = 6, minSilhouette = 0.65, maxPoints = 600, seed = 7 } = options;
  if (points.length === 0) return [];
  const stride = Math.max(1, Math.ceil(points.length / maxPoints));
  const sample = points.filter((_, i) => i % stride === 0);
  const whole = (): Cluster[] => {
    const center = {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    };
    return summarise(points, [center], new Array(points.length).fill(0));
  };
  if (sample.length < 6) return whole();

  let best: { k: number; score: number; centers: Vec2[] } | null = null;
  for (let k = 2; k <= Math.min(maxK, Math.floor(sample.length / 3)); k++) {
    const { centers, assignment } = kmeans(sample, k, seed);
    const score = silhouette(sample, assignment, k);
    if (!best || score > best.score + 1e-9) best = { k, score, centers };
  }
  if (!best || best.score < minSilhouette) return whole();
  return summarise(points, best.centers, points.map((p) => nearest(p, best.centers)));
}
