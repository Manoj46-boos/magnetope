import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { IDENT_MS, THUMBNAIL_VARIANTS, thumbnailSubjectBox, type ThumbnailVariant } from '@/render/thumbnail-scene';

/**
 * Produces the store thumbnail family (PRD 17.3) from the composition scene: the
 * three scored variants at 628 and 1256, the 3 s animated ident on the hero
 * composition, the audit pass on every card, and the panel-log scaffold. The dev
 * server must be running.
 *
 *   npm run thumbnails
 */

const out = resolve('thumbnails');
const frames = join(out, 'frames');
const statics = join(out, 'static');
/** Frames the pose springs settle before the still is grabbed. */
const SETTLE = 25;
const BASE: Record<ThumbnailVariant, string> = {
  'hero-launch': 'hero',
  'fall-comedy': 'fall',
  'tower-scale': 'tower',
};
const IDENT_FRAMES = (IDENT_MS / 1000) * 60;

function capture(args: string[]): void {
  execFileSync('npx', ['tsx', 'tools/capture.ts', ...args], { stdio: 'inherit', shell: true });
}

function ffmpegPath(): string {
  const roots = [join(homedir(), 'AppData', 'Local', 'ms-playwright'), join(homedir(), '.cache', 'ms-playwright')];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const folders = readdirSync(root).filter((name) => name.startsWith('ffmpeg-')).sort();
    for (const folder of folders.reverse()) {
      for (const exe of ['ffmpeg-win64.exe', 'ffmpeg-linux', 'ffmpeg-mac']) {
        const path = join(root, folder, exe);
        if (existsSync(path)) return path;
      }
    }
  }
  return '';
}

mkdirSync(out, { recursive: true });
rmSync(frames, { recursive: true, force: true });
rmSync(statics, { recursive: true, force: true });

writeFileSync(
  join(out, 'subjects.json'),
  JSON.stringify(
    Object.fromEntries(THUMBNAIL_VARIANTS.map((variant) => [variant, Object.values(thumbnailSubjectBox(variant))])),
    null,
    2,
  ),
);

for (const variant of THUMBNAIL_VARIANTS) {
  const base = BASE[variant];
  for (const [scale, suffix] of [[1, '628'], [2, '1256']] as const) {
    capture([`--thumb=${variant}`, `--from=${SETTLE}`, '--frames=1', '--size=628', `--scale=${scale}`, `--name=thumbnail-${base}-${suffix}`, `--out=${statics}`]);
  }
}

capture(['--thumb=hero-launch', '--ident', `--frames=${IDENT_FRAMES}`, '--size=628', '--scale=1', `--out=${frames}`]);
const captured = readdirSync(frames).filter((f) => f.endsWith('.png')).length;
if (captured !== IDENT_FRAMES) throw new Error(`ident captured ${captured} frames, expected ${IDENT_FRAMES} (3 s at 60 fps)`);

const ffmpeg = ffmpegPath();
execFileSync('python', ['tools/assemble-thumbnail.py', frames, join(out, 'animated'), ...(ffmpeg ? [`--ffmpeg=${ffmpeg}`] : [])], { stdio: 'inherit' });

// The report audits every card and the ident budgets, and exits non-zero when anything fails.
execFileSync('python', ['tools/check-thumbnail.py', `--report=${out}`], { stdio: 'inherit' });
