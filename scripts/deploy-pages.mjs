import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Publishes the production build to the project page so the game stays
 * playable while the funnel runs (SUBMISSION.md section 12, the runbook's
 * "playtest immediately" leg). The build is relative (vite's base is './'),
 * so the same Poki bundle serves from any path the host gives it. The
 * gh-pages branch is an artifact, not a record: each publish replaces its
 * history wholesale, and a .nojekyll marker rides along so the host serves
 * the files exactly as built. Pages itself is enabled once, with gh-pages
 * as its source; the branch is what this script owns.
 *
 *   node scripts/deploy-pages.mjs              # build fresh, then publish
 *   node scripts/deploy-pages.mjs --no-build   # publish dist as it stands
 *
 * Pushes to origin by default; PAGES_REMOTE overrides it for token pushes.
 */

const root = resolve(import.meta.dirname, '..');
const remote = process.env.PAGES_REMOTE ?? 'origin';
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: 'inherit' });

if (!process.argv.includes('--no-build')) {
  run('npm', ['run', 'build:poki']);
}

const stage = mkdtempSync(resolve(tmpdir(), 'magnetope-pages-'));
try {
  cpSync(resolve(root, 'dist'), stage, { recursive: true });
  writeFileSync(resolve(stage, '.nojekyll'), '');

  run('git', ['init', '--quiet', '--initial-branch=gh-pages'], stage);
  run('git', ['config', 'user.name', execFileSync('git', ['config', 'user.name'], { cwd: root }).toString().trim()], stage);
  run('git', ['config', 'user.email', execFileSync('git', ['config', 'user.email'], { cwd: root }).toString().trim()], stage);
  run('git', ['add', '--all'], stage);
  run('git', ['commit', '--quiet', '--message', `Publish the production build to the project page (${new Date().toISOString().slice(0, 10)})`], stage);
  run('git', ['push', '--force', remote, 'gh-pages:gh-pages'], stage);
} finally {
  rmSync(stage, { recursive: true, force: true });
}

console.log('\nPublished to the gh-pages branch. The game serves at https://manoj46-boos.github.io/magnetope/ once Pages has it built (a minute or two after the first push).');
