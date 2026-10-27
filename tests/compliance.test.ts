import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { audsRecordFor, parseAudsRecord, type AudsGhostRecord } from '@/platform/auds';
import { MemoryBackend, SaveStore, freshSave, sanitizeSave } from '@/platform/storage';
import { scrapForClear } from '@/game/progress';
import { encodeGhostCode } from '@/sim/ghost-code';
import type { GhostTrack } from '@/sim/ghost';
import { ALLOWED_LICENSES, scanLicenses } from '../tools/license-scan';

/**
 * The compliance chapter (premium PRD W15, R-CM-01…06 + R-RT-08): the laws that
 * make the game shippable as an honest, closed, human-directed product. The
 * licenses, the AUDS record schema, the guilt-pattern ban's structural legs,
 * the signed safety audit and the completed ledger all live here, because they
 * are one promise — nothing in the bundle, the save or the social surface is
 * something the developer would not put their name to.
 */

const here = __dirname;
const root = resolve(here, '..');

describe('license hygiene (R-CM-02)', () => {
  it('passes against the installed tree: every runtime dependency is on the allow list', () => {
    const { dependencies, problems } = scanLicenses(root);
    expect(problems).toEqual([]);
    expect(dependencies.map((d) => d.name).sort()).toEqual(['@dimforge/rapier3d-compat', 'three']);
  });

  it('keeps the allow list free of anything a closed web game may not ship under', () => {
    const forbidden = /GPL|AGPL|LGPL|SSPL|BUSL| Commons-Clause|UNLICENSED/i;
    for (const license of ALLOWED_LICENSES) expect(forbidden.test(license), `${license} joined the allow list`).toBe(false);
  });

  it('names every piece with its license in the repo notice, font included', () => {
    const notice = readFileSync(join(root, 'THIRD_PARTY.md'), 'utf8');
    for (const piece of ['three.js', 'MIT', 'Rapier', 'Apache License, Version 2.0', 'Fredoka', 'SIL Open Font License']) {
      expect(notice, `the notice must say "${piece}"`).toContain(piece);
    }
    expect(existsSync(join(root, 'public/fonts/OFL.txt'))).toBe(true);
  });
});

describe('the AUDS record schema (R-CM-06)', () => {
  const track: GhostTrack = { version: 1, levelId: 'scrapyard-00', durationMs: 41_000, x: [0, 1, 2, 3], y: [0, 2, 1, 3] };

  it('accepts a real encoded ghost on a campaign level', async () => {
    const code = await encodeGhostCode(track, 'a friend');
    const result = audsRecordFor('scrapyard-00', code);
    expect(result.ok).toBe(true);
  });

  it('carries exactly a level and a code, and refuses every other shape whole', async () => {
    const code = await encodeGhostCode(track, 'a friend');
    const good: unknown = { level: 'scrapyard-00', code };
    const parsed = parseAudsRecord(good) as { ok: true; record: AudsGhostRecord };
    expect(Object.keys(parsed.record).sort()).toEqual(['code', 'level']);

    for (const bad of [
      { level: 'scrapyard-00', code, name: 'someone' },
      { level: 'scrapyard-00', code, device: 'desktop' },
      { level: 'scrapyard-00' },
      { code },
      { level: 'scrapyard-00', code: 3 },
      [code],
      'MGH1.x',
      null,
    ]) {
      const result = parseAudsRecord(bad);
      expect(result, `${JSON.stringify(bad).slice(0, 60)} must be refused`).toEqual({ ok: false, reason: 'shape' });
    }
  });

  it('refuses levels outside the campaign and strings that are not ghost codes', () => {
    expect(parseAudsRecord({ level: 'suburbia-99', code: 'MGH1.aGVsbG8' })).toEqual({ ok: false, reason: 'level' });
    expect(parseAudsRecord({ level: 'news', code: 'MGH1.aGVsbG8' })).toEqual({ ok: false, reason: 'level' });
    expect(parseAudsRecord({ level: 'scrapyard-00', code: 'not a code' })).toEqual({ ok: false, reason: 'code' });
    expect(parseAudsRecord({ level: 'scrapyard-00', code: 'aGVsbG8' })).toEqual({ ok: false, reason: 'code' });
    expect(parseAudsRecord({ level: 'scrapyard-00', code: 'MGH1.!!!' })).toEqual({ ok: false, reason: 'code' });
    expect(parseAudsRecord({ level: 'scrapyard-00', code: 'MGH1.' + 'a'.repeat(48_001) })).toEqual({ ok: false, reason: 'code' });
  });
});

describe('no guilt, no debt — the structure (R-RT-08)', () => {
  /** Words a guilt mechanic needs to exist as state; none of them may name a save field. */
  const BANNED_FIELD_WORDS = ['streak', 'login', 'absence', 'absent', 'lastplayed', 'dayssince', 'awaydays', 'fomo'];

  const collectKeys = (value: unknown, into: string[] = []): string[] => {
    if (Array.isArray(value)) return into;
    if (typeof value === 'object' && value !== null) {
      for (const [key, nested] of Object.entries(value)) {
        into.push(key.toLowerCase());
        collectKeys(nested, into);
      }
    }
    return into;
  };

  it('carries no streak, login or absence field anywhere in the save schema', () => {
    for (const key of collectKeys(freshSave())) {
      for (const word of BANNED_FIELD_WORDS) {
        expect(key, `a save field called "${key}" is guilt vocabulary`).not.toContain(word);
      }
    }
  });

  it('loses nothing across a thirty-day absence: the aged save round-trips whole', () => {
    const aged = freshSave();
    aged.scrap = 500;
    aged.owned = [aged.owned[0]!, 'skin.antenna'];
    aged.stars = { 'scrapyard-00': 3, 'scrapyard-01': 2 };
    aged.bestMs = { 'scrapyard-00': 41_000 };
    aged.bestGrade = { 'scrapyard-00': 'B' };
    aged.ghosts = { 'scrapyard-00': 'MGH1.c29tZXRoaW5n' };
    aged.friends = { 'scrapyard-01': { name: 'a friend', ghost: 'MGH1ZnJpZW5k' } };
    aged.alias = 'mags';
    aged.clearTally = { 'scrapyard-00': { day: '2026-9-1', clears: 3 } };
    aged.adScrap = { day: '2026-9-1', earned: 200 };

    const backend = new MemoryBackend();
    backend.write(JSON.stringify(aged));
    const loaded = new SaveStore(backend).data;

    expect(loaded.scrap).toBe(500);
    expect(loaded.owned).toEqual([...aged.owned.slice(0, 1), 'field.classic', 'skin.antenna']);
    expect(loaded.stars).toEqual(aged.stars);
    expect(loaded.bestMs).toEqual(aged.bestMs);
    expect(loaded.bestGrade).toEqual(aged.bestGrade);
    expect(loaded.ghosts).toEqual(aged.ghosts);
    expect(loaded.friends).toEqual(aged.friends);
    expect(loaded.alias).toBe('mags');
    // the old day's tally survives as data, and today's replay pays in full
    // because the decay only ever counts clears on the day of the clear itself.
    expect(loaded.clearTally['scrapyard-00']).toEqual({ day: '2026-9-1', clears: 3 });
    const afterAbsence = scrapForClear(3, false, false, 0);
    expect(afterAbsence.amount).toBe(scrapForClear(3, false, false, 3).amount * 2);
    expect(sanitizeSave(JSON.parse(JSON.stringify(aged))).scrap).toBe(500);
  });

  /** The player-facing text surfaces; the wind gusts and the placement layer's retry moment are not guilt vocabulary. */
  const playerFacingSources = (): string[] => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : entry.name.endsWith('.ts') ? [full] : [];
      });
    return [...walk(resolve(root, 'src/ui')), ...walk(resolve(root, 'src/locale'))];
  };

  it('carries none of the guilt vocabulary in the text surfaces, identifiers included', () => {
    const banned = ['streak', 'countdown', 'lastchance', 'missedyou', 'comeback', 'fomo', 'loginbonus', 'dailyreward', 'dailybonus', 'lastplayed', 'dayssince', 'hurry', 'expires'];
    for (const file of playerFacingSources()) {
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const word of banned) {
        expect(text, `${resolve(root, file)} contains "${word}"`).not.toContain(word);
      }
    }
  });
});

describe('the AI ledger (R-CM-04)', () => {
  const ledger = readFileSync(join(root, 'docs/AI_LEDGER.md'), 'utf8');
  const rows = ledger
    .split('\n')
    .filter((line) => line.startsWith('| 202'))
    .map((line) => line.split('|').map((cell) => cell.trim()));

  it('is a table of dated rows with every human column filled', () => {
    // The record's size at completion: 12 pre-premium sessions (the font row
    // included), the visual renewal, the premium PRD, and the W1-W15 era with
    // its hardening rows — one row per session, never a summary.
    expect(rows.length).toBeGreaterThanOrEqual(25);
    for (const cells of rows) {
      expect(cells.length, 'every row has all five columns').toBe(7);
      const human = cells[5] ?? '';
      expect(human.length, `the row dated ${cells[1]} has an empty human column`).toBeGreaterThan(0);
      expect(human.toLowerCase()).not.toContain('to be filled in');
    }
  });

  it('names the gate wherever a verdict is still owed to a human', () => {
    const owed = rows.filter((cells) => (cells[5] ?? '').includes('Owed'));
    expect(owed.length).toBeGreaterThan(0);
    for (const cells of owed) {
      expect(cells[5], 'an owed verdict names the gate it is owed to').toContain('M5');
    }
  });

  it('carries the director of record\'s signature block', () => {
    expect(ledger).toContain('Director of record');
    expect(ledger).toMatch(/Signature: _{3,}/);
    expect(ledger).toMatch(/Date: _{3,}/);
  });

  it('covers every premium workstream the PRD ordered', () => {
    for (const week of ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14', 'W15', 'W16']) {
      expect(ledger, `${week} has no ledger row`).toContain(week);
    }
  });
});

describe('the submission dossier (R-CM-03, R-CM-05)', () => {
  const dossier = readFileSync(join(root, 'docs/SUBMISSION.md'), 'utf8');

  it('carries the content safety audit with all ten rows and the review signatures', () => {
    for (const row of ['Violence', 'Shock', 'Gambling', 'Language', 'Themes', 'Data', 'Ads coexistence', 'Sound', 'Fall "tone"', 'Exit safety']) {
      expect(dossier, `the safety audit is missing its ${row} row`).toContain(row);
    }
    expect(dossier).toContain('content safety audit');
    expect(dossier).toMatch(/Reviewed and signed: _{3,}/);
    expect(dossier).toMatch(/Date: _{3,}/);
  });

  it('carries the craft-signature review pack with its five moments and their evidence', () => {
    expect(dossier).toContain('Craft signatures');
    for (const [name, requirement] of [
      ['scripted first launch', 'R-SM-01'],
      ['junk orchestra', 'R-AU-04'],
      ['colour script', 'R-AR-05'],
      ['fall-grade comedy', 'R-GF-07'],
      ['wordless ending', 'R-SM-05'],
    ] as const) {
      expect(dossier, `the review pack must name the ${name}`).toContain(name);
      expect(dossier, `the ${name} row cites its requirement`).toContain(requirement);
    }
  });
});
