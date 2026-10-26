import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import { BUDGET, CLASS_BUDGETS, auditBuild } from '../scripts/check-budget.mjs';

const root = resolve(__dirname, '..');
let outDir = '';
let pokiDir = '';

/** Inline data: URIs, such as the favicon, carry namespace strings that are not requests. */
const withoutInlineData = (html: string): string => html.replace(/data:[^"]*/g, '');

const build = (dir: string, mode: string) =>
  execFileSync(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'build', '--mode', mode, '--outDir', dir, '--emptyOutDir'], {
    cwd: root,
    stdio: 'pipe',
  });

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'magnetope-prod-'));
  pokiDir = mkdtempSync(join(tmpdir(), 'magnetope-poki-'));
  build(outDir, 'production');
  build(pokiDir, 'poki');
}, 120_000);

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
  rmSync(pokiDir, { recursive: true, force: true });
});

describe('production build (Poki QA gates)', () => {
  it('stays inside the initial byte budget', () => {
    const { total } = auditBuild(outDir);
    expect(total).toBeLessThan(BUDGET.initial);
    expect(total).toBeLessThan(BUDGET.hardInitial);
  });

  // R-PE-01: the per-class red line. The class table is the published budget
  // (docs/PERF_BUDGET.md renders it), so both builds must sit under every line.
  it('keeps every asset class inside its own line, in both builds', () => {
    for (const dir of [outDir, pokiDir]) {
      const { classes } = auditBuild(dir, { allowPokiSdk: dir === pokiDir });
      const names = Object.keys(CLASS_BUDGETS);
      expect(Object.keys(classes).sort()).toEqual([...names].sort());
      for (const name of names) {
        expect(classes[name], `${dir} ${name}`).toBeLessThan(CLASS_BUDGETS[name]);
      }
    }
  });

  // R-PE-07: the engine arrives as a file the browser compiles while it
  // downloads, and the audit asserts the streaming loader survived the build.
  it('ships the physics engine streaming and inside its growth line', () => {
    const { sizes, classes } = auditBuild(outDir);
    const wasm = sizes.find((s: { file: string }) => s.file.endsWith('.wasm'));
    expect(wasm).toBeDefined();
    expect(classes.wasm).toBeLessThanOrEqual(CLASS_BUDGETS.wasm);
    expect(auditBuild(outDir).problems).toEqual([]);
  });

  it('passes the full audit: no maps, no external requests, no dev hooks, no Google', () => {
    const { problems } = auditBuild(outDir);
    expect(problems).toEqual([]);
  });

  it('makes zero external requests from the HTML in the standard build', () => {
    const html = withoutInlineData(readFileSync(join(outDir, 'index.html'), 'utf8'));
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/poki-sdk/);
  });

  it('adds only the official Poki SDK script in the Poki build', () => {
    const html = withoutInlineData(readFileSync(join(pokiDir, 'index.html'), 'utf8'));
    const urls = [...html.matchAll(/https?:\/\/[^"']+/g)].map((m) => m[0]);
    expect(urls).toEqual(['https://game-cdn.poki.com/scripts/v2/poki-sdk.js']);
    expect(auditBuild(pokiDir, { allowPokiSdk: true }).problems).toEqual([]);
  });

  it('ships no logo outside the loading screen and no outbound anchors', () => {
    const { sizes } = auditBuild(outDir);
    expect(sizes.some((s: { file: string }) => /\.(png|jpe?g|svg|gif)$/.test(s.file))).toBe(false);
  });
});
