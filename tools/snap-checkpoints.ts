import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_LEVELS } from '../src/levels';
import { candidateSpots, holdShare, type Point } from './respawn-probe';

/**
 * Moves every checkpoint onto ground the level really has. Candidates are the places the stored
 * route comes to rest; each is tried nearest-first to the checkpoint's old height and kept only if
 * MAGNO stays put after a respawn at several moments of the hazard clock.
 *
 *   npx tsx tools/snap-checkpoints.ts            report only
 *   npx tsx tools/snap-checkpoints.ts --write    rewrite the level files
 *   npx tsx tools/snap-checkpoints.ts scrapyard-03 --write
 */

const write = process.argv.includes('--write');
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = ids.length ? ALL_LEVELS.filter((l) => ids.includes(l.id)) : ALL_LEVELS;
const MIN_GAP = 2;
/** A checkpoint that has to move further than this from its intended height is left for a designer. */
const MAX_SHIFT = Number(process.argv.find((a) => a.startsWith('--shift='))?.split('=')[1] ?? 7);

const round = (n: number): number => Math.round(n * 10) / 10;
const files = new Map<string, string>();
const fileFor = (biome: string): string => fileURLToPath(new URL(`../src/levels/${biome}.ts`, import.meta.url));

function rewrite(levelId: string, biome: string, checkpoints: Point[]): void {
  const path = fileFor(biome);
  const source = files.get(path) ?? readFileSync(path, 'utf8');
  const at = source.indexOf(`id: '${levelId}'`);
  const open = source.indexOf('checkpoints: [', at);
  if (at < 0 || open < 0) throw new Error(`No checkpoint list found for ${levelId}`);
  const close = source.indexOf(']', open);
  const body = checkpoints.map((c) => `{ x: ${round(c.x)}, y: ${round(c.y)} }`).join(', ');
  files.set(path, `${source.slice(0, open)}checkpoints: [${body}${source.slice(close)}`);
}

let moved = 0;
let kept = 0;
let partial = 0;
for (const level of targets) {
  const spots = await candidateSpots(level);
  const chosen: Point[] = [];
  const order = [...level.checkpoints].sort((a, b) => a.y - b.y);
  const notes: string[] = [];
  for (const old of order) {
    const candidates = spots
      .filter((c) => Math.abs(c.y - old.y) <= MAX_SHIFT && chosen.every((k) => Math.abs(k.y - c.y) >= MIN_GAP))
      .sort((a, b) => Math.abs(a.y - old.y) - Math.abs(b.y - old.y));
    let picked: Point = old;
    let bestShare = 0;
    for (const candidate of [old, ...candidates.slice(0, 90)]) {
      const share = await holdShare(level, candidate);
      if (share > bestShare) {
        bestShare = share;
        picked = candidate;
      }
      if (share === 1) break;
    }
    if (bestShare < 1) {
      partial++;
      notes.push(`best footing holds at ${Math.round(bestShare * 100)}% of clock readings`);
    }
    chosen.push(picked);
    if (picked === old) kept++;
    else {
      moved++;
      notes.push(`(${old.x}, ${old.y}) -> (${round(picked.x)}, ${round(picked.y)})`);
    }
  }
  console.log(`${level.id.padEnd(16)}${notes.join('; ') || 'ok'}`);
  if (write && chosen.some((c, i) => c !== order[i])) rewrite(level.id, level.biome, chosen);
}

console.log(`\nkept ${kept}, moved ${moved}, not fully stable ${partial}`);
if (write) for (const [path, text] of files) writeFileSync(path, text);
