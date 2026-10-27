import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The dependency license scan (R-CM-02). Runtime dependencies are the only
 * third-party code in the bundle, so they are the only set the notice must
 * answer for: each one is read from node_modules with its license field, its
 * licence file, and checked against the allow list, and THIRD_PARTY.md must
 * name every one of them. Dev dependencies never reach the player and are
 * deliberately not scanned.
 *
 *   npm run licenses
 */

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Licenses that carry no terms a closed web game cannot ship under. */
export const ALLOWED_LICENSES: readonly string[] = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'Zlib',
  'CC0-1.0',
  'Unlicense',
];

export interface DependencyLicense {
  /** The npm package name, as written in package.json's dependencies. */
  name: string;
  version: string;
  license: string;
  /** The licence file the package ships, relative to its own directory. */
  file: string;
}

/** Licences named by the notice but not installed through npm (the font). */
export const NON_NPM_LICENSES: readonly { name: string; license: string; file: string }[] = [
  { name: 'Fredoka', license: 'OFL-1.1', file: 'public/fonts/OFL.txt' },
];

const LICENSE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'COPYING', 'COPYING.txt'];

export function scanLicenses(dir = root): { dependencies: DependencyLicense[]; problems: string[] } {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
  const dependencies: DependencyLicense[] = [];
  const problems: string[] = [];

  for (const name of Object.keys(pkg.dependencies ?? {})) {
    const manifest = join(dir, 'node_modules', name, 'package.json');
    if (!existsSync(manifest)) {
      problems.push(`${name} is a declared dependency but is not installed`);
      continue;
    }
    const meta = JSON.parse(readFileSync(manifest, 'utf8')) as { version?: string; license?: string };
    const license = meta.license ?? 'UNLICENSED';
    const file = LICENSE_FILES.find((f) => existsSync(join(dir, 'node_modules', name, f))) ?? '';
    if (!file) problems.push(`${name} ships no licence file`);
    if (!ALLOWED_LICENSES.includes(license)) problems.push(`${name} is ${license}, which is not on the allow list`);
    dependencies.push({ name, version: meta.version ?? '?', license, file: file ? join(name, file) : '' });
  }

  const notice = readFileSync(join(dir, 'THIRD_PARTY.md'), 'utf8');
  for (const dep of [...dependencies, ...NON_NPM_LICENSES]) {
    if (!notice.includes(dep.name)) problems.push(`THIRD_PARTY.md does not name ${dep.name}`);
  }
  for (const extra of NON_NPM_LICENSES) {
    if (!existsSync(join(dir, extra.file))) problems.push(`${extra.name}'s licence file (${extra.file}) is missing from the repo`);
  }

  return { dependencies, problems };
}

if (process.argv[1]?.endsWith('license-scan.ts')) {
  const { dependencies, problems } = scanLicenses();
  for (const dep of dependencies) console.log(`${dep.license.padEnd(11)} ${dep.name}@${dep.version}  (${dep.file})`);
  for (const extra of NON_NPM_LICENSES) console.log(`${extra.license.padEnd(11)} ${extra.name}  (${extra.file})`);
  if (problems.length) {
    console.error(`\nLicense scan FAILED:\n - ${problems.join('\n - ')}`);
    process.exit(1);
  }
  console.log('\nLicense scan passed.');
}
