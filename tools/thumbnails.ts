import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Produces the store thumbnails (PRD 6.6) from the running game: the static
 * 628 x 628 poster (also at 1256 for sharp stores) and the three second loop.
 * No text, no UI, no rim tint, so the palette stays off the Poki background hue.
 * The dev server must be running.
 *
 *   npx tsx tools/thumbnails.ts
 */

const out = resolve('thumbnails');
const frames = join(out, 'frames');
const level = 'scrapyard-04';
const framing = ['--center=2.6,4.6', '--height=9', '--roll=-7'];

function capture(args: string[]): void {
  execFileSync('npx', ['tsx', 'tools/capture.ts', `--level=${level}`, ...args], { stdio: 'inherit', shell: true });
}

function ffmpegPath(): string {
  const root = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  if (!existsSync(root)) return '';
  const folder = readdirSync(root).find((name) => name.startsWith('ffmpeg-'));
  const exe = folder ? join(root, folder, 'ffmpeg-win64.exe') : '';
  return exe && existsSync(exe) ? exe : '';
}

mkdirSync(out, { recursive: true });
rmSync(frames, { recursive: true, force: true });
rmSync(join(out, 'static'), { recursive: true, force: true });

for (const [scale, name] of [[1, 'thumbnail-628'], [2, 'thumbnail-1256']] as const) {
  capture([...framing, '--from=108', '--frames=1', '--size=628', `--scale=${scale}`, `--name=${name}`, `--out=${join(out, 'static')}`]);
}
capture(['--chase=2.4,2.0', '--height=9', '--roll=-7', '--from=70', '--frames=190', '--size=628', '--scale=1', `--out=${frames}`]);

for (const file of ['thumbnail-628.png', 'thumbnail-1256.png']) execFileSync('python', ['tools/check-thumbnail.py', join(out, 'static', file)], { stdio: 'inherit' });

const ffmpeg = ffmpegPath();
execFileSync('python', ['tools/assemble-thumbnail.py', frames, join(out, 'animated'), ...(ffmpeg ? [`--ffmpeg=${ffmpeg}`] : [])], { stdio: 'inherit' });
