import { Rng } from '@/core/rng';
import { PALETTES, type Hsl } from '@/render/palette';
import type { BiomeId } from '@/sim/types';

export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1920;
const MARGIN = 72;

export interface ShareCardSpec {
  grade: string;
  heightMeters: number;
  bounces: number;
  junk: number;
  levelName: string;
  biome: BiomeId;
  labels: { fall: string; bounces: string; junk: string; meters: string };
}

export type DrawOp =
  | { op: 'gradient'; stops: Array<[number, string]> }
  | { op: 'polygon'; points: number[]; fill: string }
  | { op: 'circle'; x: number; y: number; r: number; fill: string }
  | { op: 'arc'; x: number; y: number; r: number; from: number; to: number; stroke: string; width: number }
  | { op: 'roundRect'; x: number; y: number; w: number; h: number; r: number; fill: string }
  | { op: 'path'; d: string; x: number; y: number; rotate: number; scale: number; fill?: string; stroke?: string; width?: number }
  | { op: 'text'; text: string; x: number; y: number; size: number; weight: number; color: string; align: 'left' | 'center' | 'right'; maxWidth: number; shadow?: boolean };

const css = (c: Hsl, lShift = 0, alpha = 1): string =>
  `hsl(${Math.round(c.h)} ${Math.round(c.s)}% ${Math.max(0, Math.min(100, Math.round(c.l + lShift)))}% / ${alpha})`;

const GRADE_COLOR: Record<string, string> = {
  C: '#f4efe5',
  B: '#c9f2d4',
  A: '#9fe7ff',
  S: '#ffd96b',
  SS: '#ffb347',
  SSS: '#ff8a5c',
};

/** A ridge line across the card: jagged peaks that fall away to the edges. */
function ridge(rng: Rng, baseY: number, peak: number, fill: string, steps = 9): DrawOp {
  const points: number[] = [0, SHARE_HEIGHT];
  for (let i = 0; i <= steps; i++) {
    const x = (SHARE_WIDTH * i) / steps;
    const lift = Math.sin((i / steps) * Math.PI) * peak * (0.55 + rng.next() * 0.45);
    points.push(x, baseY - lift);
  }
  points.push(SHARE_WIDTH, SHARE_HEIGHT);
  return { op: 'polygon', points, fill };
}

/** MAGNO mid-tumble: round body, one eye, horseshoe head. Drawn from the same shapes as the loading mark. */
const MAGNO_BODY = 'M0 -62 C34 -62 48 -26 48 8 C48 46 28 66 0 66 C-28 66 -48 46 -48 8 C-48 -26 -34 -62 0 -62 Z';
const MAGNO_EYE_WHITE = 'M0 -14 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0';
const MAGNO_PUPIL = 'M3 -13 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0';
const MAGNO_HEAD = 'M-30 -52 L-30 -74 A30 30 0 0 1 30 -74 L30 -52';
const MAGNO_TIP_LEFT = 'M-30 -52 L-30 -66';
const MAGNO_TIP_RIGHT = 'M30 -52 L30 -66';
const MAGNO_EYE = 'M0 -14 m-18 0 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0';

/** The biome backdrop every card shares: sky, sun, three ridges, field arcs and MAGNO mid-tumble. */
function backdrop(biome: BiomeId, seed: number): DrawOp[] {
  const palette = PALETTES[biome];
  const rng = new Rng(seed);
  const ops: DrawOp[] = [
    {
      op: 'gradient',
      stops: [
        [0, css(palette.skyTop)],
        [0.55, css(palette.skyHorizon)],
        [1, css(palette.fog, -6)],
      ],
    },
    { op: 'circle', x: 820, y: 560, r: 150, fill: css(palette.sunColor, 4, 0.22) },
    { op: 'circle', x: 820, y: 560, r: 96, fill: css(palette.sunColor, 8, 0.38) },
    ridge(rng, 1500, 420, css(palette.dominant, -14, 0.55)),
    ridge(rng, 1640, 360, css(palette.dominant, -24, 0.8)),
    ridge(rng, 1780, 300, css(palette.dominant, -34, 1)),
  ];

  for (let i = 0; i < 4; i++) {
    ops.push({
      op: 'arc',
      x: 250,
      y: 1640,
      r: 150 + i * 62,
      from: Math.PI * 1.08,
      to: Math.PI * 1.92,
      stroke: css(palette.accent, 22, 0.7 - i * 0.14),
      width: 9,
    });
  }

  const at = { x: 250, y: 1640, rotate: -0.42, scale: 1.7 };
  ops.push(
    { op: 'path', d: MAGNO_BODY, ...at, fill: '#cfd6df' },
    { op: 'path', d: MAGNO_EYE, ...at, fill: '#10161f' },
    { op: 'path', d: MAGNO_EYE_WHITE, ...at, fill: '#f7f4ee' },
    { op: 'path', d: MAGNO_PUPIL, ...at, fill: '#0c1118' },
    { op: 'path', d: MAGNO_HEAD, ...at, stroke: '#e9edf2', width: 20 },
    { op: 'path', d: MAGNO_TIP_LEFT, ...at, stroke: '#e5484d', width: 20 },
    { op: 'path', d: MAGNO_TIP_RIGHT, ...at, stroke: '#e5484d', width: 20 },
  );
  return ops;
}

const CONTENT_WIDTH = SHARE_WIDTH - MARGIN * 2;

const masthead = (levelName: string): DrawOp[] => [
  { op: 'text', text: 'MAGNETOPE', x: SHARE_WIDTH / 2, y: 190, size: 96, weight: 900, color: '#ffffff', align: 'center', maxWidth: CONTENT_WIDTH, shadow: true },
  { op: 'text', text: levelName, x: SHARE_WIDTH / 2, y: 262, size: 46, weight: 600, color: 'rgba(255,255,255,0.85)', align: 'center', maxWidth: CONTENT_WIDTH },
];

/** Two stat chips side by side on the right, as the fall card and the duel card both lay them out. */
function chipRow(chips: ReadonlyArray<readonly [string, string]>): DrawOp[] {
  const chipW = 360;
  const right = SHARE_WIDTH - MARGIN;
  const ops: DrawOp[] = [];
  chips.forEach(([label, value], i) => {
    const x = right - chipW * (chips.length - i) - 28 * (chips.length - 1 - i);
    ops.push(
      { op: 'roundRect', x, y: 1250, w: chipW, h: 150, r: 34, fill: 'rgba(10,14,22,0.55)' },
      { op: 'text', text: value, x: x + chipW / 2, y: 1334, size: 76, weight: 900, color: '#ffffff', align: 'center', maxWidth: chipW - 40 },
      { op: 'text', text: label.toUpperCase(), x: x + chipW / 2, y: 1378, size: 28, weight: 700, color: 'rgba(255,255,255,0.7)', align: 'center', maxWidth: chipW - 40 },
    );
  });
  return ops;
}

/**
 * Lays out the 9:16 share card (PRD 15.3) as a list of draw operations. The
 * layout is pure data, so it is testable without a canvas and every text run
 * carries a width cap that keeps long translations inside the frame.
 */
export function buildShareCard(spec: ShareCardSpec): DrawOp[] {
  const gradeColor = GRADE_COLOR[spec.grade] ?? GRADE_COLOR.C!;
  return [
    ...backdrop(spec.biome, spec.biome.length * 977 + Math.round(spec.heightMeters * 10)),
    ...masthead(spec.levelName),
    { op: 'text', text: spec.grade, x: SHARE_WIDTH / 2, y: 880, size: 560, weight: 900, color: gradeColor, align: 'center', maxWidth: CONTENT_WIDTH - 60, shadow: true },
    { op: 'text', text: spec.labels.fall.toUpperCase(), x: SHARE_WIDTH / 2, y: 1000, size: 44, weight: 700, color: 'rgba(255,255,255,0.8)', align: 'center', maxWidth: CONTENT_WIDTH },
    {
      op: 'text',
      text: `${spec.heightMeters.toFixed(1)} ${spec.labels.meters}`,
      x: SHARE_WIDTH / 2,
      y: 1130,
      size: 150,
      weight: 900,
      color: '#ffffff',
      align: 'center',
      maxWidth: CONTENT_WIDTH,
      shadow: true,
    },
    ...chipRow([
      [spec.labels.bounces, String(spec.bounces)],
      [spec.labels.junk, String(spec.junk)],
    ]),
  ];
}

export interface DuelCardSpec {
  friend: string;
  /** The player's clear time and the friend's, in milliseconds. */
  timeMs: number;
  friendMs: number;
  levelName: string;
  biome: BiomeId;
  /** `title` already carries the friend's name, e.g. "Beat Sam". */
  labels: { title: string; ahead: string; you: string };
}

const seconds = (ms: number): string => (ms / 1000).toFixed(2);

/** The card for beating a friend's ghost: who, by how much, and both times. */
export function buildDuelCard(spec: DuelCardSpec): DrawOp[] {
  const margin = Math.max(0, spec.friendMs - spec.timeMs);
  return [
    ...backdrop(spec.biome, spec.biome.length * 977 + Math.round(spec.timeMs / 10)),
    ...masthead(spec.levelName),
    { op: 'text', text: spec.labels.title, x: SHARE_WIDTH / 2, y: 640, size: 150, weight: 900, color: '#ffd96b', align: 'center', maxWidth: CONTENT_WIDTH, shadow: true },
    { op: 'text', text: `${seconds(margin)}s`, x: SHARE_WIDTH / 2, y: 1000, size: 330, weight: 900, color: '#ffffff', align: 'center', maxWidth: CONTENT_WIDTH - 60, shadow: true },
    { op: 'text', text: spec.labels.ahead.toUpperCase(), x: SHARE_WIDTH / 2, y: 1096, size: 44, weight: 700, color: 'rgba(255,255,255,0.8)', align: 'center', maxWidth: CONTENT_WIDTH },
    ...chipRow([
      [spec.labels.you, `${seconds(spec.timeMs)}s`],
      [spec.friend, `${seconds(spec.friendMs)}s`],
    ]),
  ];
}

type Ctx = CanvasRenderingContext2D;

/** Thin painter: every decision lives in `buildShareCard`. */
export function paintShareCard(ctx: Ctx, ops: readonly DrawOp[]): void {
  for (const op of ops) {
    ctx.save();
    switch (op.op) {
      case 'gradient': {
        const g = ctx.createLinearGradient(0, 0, 0, SHARE_HEIGHT);
        for (const [at, color] of op.stops) g.addColorStop(at, color);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
        break;
      }
      case 'polygon': {
        ctx.beginPath();
        for (let i = 0; i < op.points.length; i += 2) {
          if (i === 0) ctx.moveTo(op.points[0]!, op.points[1]!);
          else ctx.lineTo(op.points[i]!, op.points[i + 1]!);
        }
        ctx.closePath();
        ctx.fillStyle = op.fill;
        ctx.fill();
        break;
      }
      case 'circle':
        ctx.beginPath();
        ctx.arc(op.x, op.y, op.r, 0, Math.PI * 2);
        ctx.fillStyle = op.fill;
        ctx.fill();
        break;
      case 'arc':
        ctx.beginPath();
        ctx.arc(op.x, op.y, op.r, op.from, op.to);
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = op.width;
        ctx.lineCap = 'round';
        ctx.stroke();
        break;
      case 'roundRect':
        ctx.beginPath();
        ctx.roundRect(op.x, op.y, op.w, op.h, op.r);
        ctx.fillStyle = op.fill;
        ctx.fill();
        break;
      case 'path': {
        ctx.translate(op.x, op.y);
        ctx.rotate(op.rotate);
        ctx.scale(op.scale, op.scale);
        const path = new Path2D(op.d);
        if (op.fill) {
          ctx.fillStyle = op.fill;
          ctx.fill(path);
        }
        if (op.stroke) {
          ctx.strokeStyle = op.stroke;
          ctx.lineWidth = op.width ?? 2;
          ctx.stroke(path);
        }
        break;
      }
      case 'text':
        ctx.font = `${op.weight} ${op.size}px ui-rounded, 'SF Pro Rounded', 'Segoe UI', 'Trebuchet MS', system-ui, sans-serif`;
        ctx.textAlign = op.align;
        ctx.textBaseline = 'alphabetic';
        if (op.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.35)';
          ctx.shadowBlur = 28;
          ctx.shadowOffsetY = 8;
        }
        ctx.fillStyle = op.color;
        ctx.fillText(op.text, op.x, op.y, op.maxWidth);
        break;
    }
    ctx.restore();
  }
}

/** Renders a card's operations to a PNG. Resolves null where canvas export is unavailable. */
export function renderCardOps(ops: readonly DrawOp[], doc: Document = document): Promise<Blob | null> {
  const canvas = doc.createElement('canvas');
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  paintShareCard(ctx, ops);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

export const renderShareCard = (spec: ShareCardSpec, doc?: Document): Promise<Blob | null> => renderCardOps(buildShareCard(spec), doc);
export const renderDuelCard = (spec: DuelCardSpec, doc?: Document): Promise<Blob | null> => renderCardOps(buildDuelCard(spec), doc);

export interface ShareEnvironment {
  navigator: Pick<Navigator, 'canShare' | 'share'> | undefined;
  document: Document;
  urls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
}

export type ShareOutcome = 'shared' | 'saved' | 'cancelled';

/**
 * Hands the card to the player: the system share sheet where files can be
 * shared (phones), otherwise a plain download. Nothing is uploaded anywhere.
 */
export async function deliverShareCard(blob: Blob, filename: string, env: ShareEnvironment): Promise<ShareOutcome> {
  const nav = env.navigator;
  if (nav?.canShare && nav.share) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file] });
        return 'shared';
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') return 'cancelled';
      }
    }
  }
  const url = env.urls.createObjectURL(blob);
  const link = env.document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  env.document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => env.urls.revokeObjectURL(url), 4000);
  return 'saved';
}
