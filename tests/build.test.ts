import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import { BUDGET, CLASS_BUDGETS, GIF_BUDGET, auditBuild, auditFonts } from '../scripts/check-budget.mjs';

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

  // The renewal's font law (visual renewal PRD 19.6): every family the shipped
  // bundle names is the self-hosted Comfortaa subset, and no font loads from
  // anywhere but the bundle.
  it('names only the self-hosted Comfortaa face in both builds', () => {
    for (const dir of [outDir, pokiDir]) {
      const code = [join(dir, 'index.html')];
      const { sizes } = auditBuild(dir);
      for (const entry of sizes) if (entry.file.endsWith('.css') || entry.file.endsWith('.js')) code.push(join(dir, entry.file));
      expect(auditFonts(dir, code)).toEqual([]);
      expect(sizes.some((s: { file: string }) => s.file.endsWith('comfortaa-latin.woff2'))).toBe(true);
    }
  });

  it('rejects a foreign family or a remote font URL, so the law cannot rot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'magnetope-fontlaw-'));
    try {
      writeFileSync(join(dir, 'bad.css'), "a { font-family: 'Fredoka'; }\nb { font-family: 'Comfortaa'; }");
      writeFileSync(join(dir, 'remote.css'), "@font-face { font-family: 'Comfortaa'; src: url(https://cdn.example.com/comfortaa.woff2); }");
      expect(auditFonts(dir, [join(dir, 'bad.css')])).toEqual(['font family "Fredoka" is not the self-hosted face (renewal 19.6)']);
      expect(auditFonts(dir, [join(dir, 'remote.css')])).toEqual(['remote font reference in remote.css: https://cdn.example.com/comfortaa.woff2']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // The renewal's GIF law (19.6): the animated card's GIF stays under 1 MB in
  // the shipped tree — the 6.2 MB card the review found cannot return.
  it('keeps the animated GIF under its line in the thumbnail tree', () => {
    const gif = 'thumbnails/animated/thumbnail-animated.gif';
    const raw = statSync(join(root, gif)).size;
    expect(raw).toBeLessThanOrEqual(GIF_BUDGET);
  });
});
