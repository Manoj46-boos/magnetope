import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative, resolve } from 'node:path';

/**
 * Size and hygiene gate for a production build (PRD 10.3 and 14.1).
 *
 * Budgets are measured on gzipped bytes of everything the first screen needs.
 * The internal target is 4.0 MB against Poki's 5 MB hard limit; the whole game
 * must stay under 8 MB.
 */
const MB = 1024 * 1024;
export const BUDGET = { initial: 4.0 * MB, hardInitial: 5 * MB, total: 8 * MB };

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

export function auditBuild(dist, { allowPokiSdk = false } = {}) {
  if (!existsSync(dist)) throw new Error(`Build output not found at ${dist}`);
  const files = walk(dist);
  const sizes = files.map((file) => ({
    file: relative(dist, file).replaceAll('\\', '/'),
    raw: statSync(file).size,
    gzip: gzipSync(readFileSync(file)).length,
  }));
  const total = sizes.reduce((sum, f) => sum + f.gzip, 0);
  const problems = [];

  if (total > BUDGET.initial) problems.push(`initial payload ${(total / MB).toFixed(2)} MB exceeds the ${(BUDGET.initial / MB).toFixed(1)} MB internal target`);
  if (total > BUDGET.hardInitial) problems.push(`initial payload exceeds Poki's ${(BUDGET.hardInitial / MB).toFixed(0)} MB hard limit`);
  if (total > BUDGET.total) problems.push(`total payload exceeds ${(BUDGET.total / MB).toFixed(0)} MB`);

  for (const entry of sizes) {
    if (entry.file.endsWith('.map')) problems.push(`source map shipped: ${entry.file}`);
  }

  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const externalAsset = /(?:src|href)=["'](https?:)?\/\//gi;
  for (const match of html.matchAll(externalAsset)) {
    const tail = html.slice(match.index, match.index + 140);
    const isPokiSdk = /game-cdn\.poki\.com\/scripts\/v2\/poki-sdk\.js/.test(tail);
    if (!(allowPokiSdk && isPokiSdk)) problems.push(`external request in index.html: ${tail.split('"')[1] ?? tail.slice(0, 60)}`);
  }
  if (!allowPokiSdk && /poki-sdk/.test(html)) problems.push('Poki SDK tag present in a non-Poki build');

  const code = files.filter((f) => f.endsWith('.js') || f.endsWith('.css') || f.endsWith('.html'));
  const joined = code.map((f) => readFileSync(f, 'utf8')).join('\n');
  if (/__game\b/.test(joined)) problems.push('development hook (__game) leaked into the production bundle');
  if (/googleapis|gstatic|google-analytics|googletagmanager/i.test(joined)) problems.push('Google service reference found; Poki rejects them');
  if (/https?:\/\/(?!game-cdn\.poki\.com|www\.w3\.org|github\.com\/dimforge|threejs\.org|rapier\.rs|developers\.poki\.com|reactjs\.org|mths\.be|docs\.|www\.khronos\.org|registry\.khronos\.org|en\.wikipedia\.org|webglreport|get\.webgl\.org|bugzilla|crbug|bugs\.|issues\.|developer\.mozilla\.org|stackoverflow|gist\.github|raw\.githubusercontent|rollupjs|vite)[^\s"'`)]{4,}\/\S*\.(js|png|jpg|woff2?|json|mp3|ogg|wasm)\b/i.test(joined)) {
    problems.push('runtime reference to a remote asset found');
  }
  if (/\bfetch\s*\(\s*["'`]https?:/.test(joined)) problems.push('fetch to an absolute URL found');
  if (/<a\s[^>]*href=/i.test(joined)) problems.push('outbound anchor found in bundle');

  return { sizes, total, problems };
}

const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (invoked) {
  const dist = resolve(process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'dist');
  const { sizes, total, problems } = auditBuild(dist, { allowPokiSdk: process.argv.includes('--poki') });
  for (const f of sizes.sort((a, b) => b.gzip - a.gzip)) console.log(`${String(f.gzip).padStart(9)} B gzip  ${f.file}`);
  console.log(`\ninitial payload: ${(total / MB).toFixed(2)} MB gzipped (target <= 4.00, hard limit 5.00)`);
  if (problems.length) {
    console.error(`\nBuild audit FAILED:\n - ${problems.join('\n - ')}`);
    process.exit(1);
  }
  console.log('Build audit passed.');
}
