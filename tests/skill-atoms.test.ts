import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_LEVELS } from '@/levels';
import { levelSkills, type SkillId } from '@/levels/skills';

/**
 * Cook's law for the skill-atom table (R-LD-01/09): the stamped rows on the
 * routes are the reviewed source of truth, and this suite holds them to what
 * the level data can prove — nothing is examined before the level that teaches
 * it, every taught atom meets its bench before its biome closes, and the
 * ledger doc in docs/LEVELS.md carries the same rows the routes do.
 */

const routesDir = resolve(__dirname, '../src/levels/routes');
const ledger = resolve(__dirname, '../docs/LEVELS.md');

interface StampedAtom {
  teaches: SkillId | null;
  practices: SkillId | null;
  examines: SkillId | null;
}

interface StampedPhase {
  establish: number;
  twist: number;
  escalate: number;
  resolve: number;
}

const readRoute = (id: string): Record<string, unknown> => JSON.parse(readFileSync(resolve(routesDir, `${id}.json`), 'utf8'));
const readAtom = (id: string): StampedAtom => {
  const atom = readRoute(id).skillAtom as StampedAtom | undefined;
  expect(atom, `${id}: skillAtom`).toBeDefined();
  expect(atom!.examines === null || typeof atom!.examines === 'string', `${id}: examines`).toBe(true);
  expect(atom!.practices === null || typeof atom!.practices === 'string', `${id}: practices`).toBe(true);
  return atom!;
};
const readPhase = (id: string): StampedPhase => {
  const phase = readRoute(id).phase as StampedPhase | undefined;
  expect(phase, `${id}: phase`).toBeDefined();
  for (const key of ['establish', 'twist', 'escalate', 'resolve'] as const) {
    expect(typeof phase![key], `${id}: phase.${key}`).toBe('number');
  }
  return phase!;
};

const skillsByLevel = new Map<string, SkillId[]>(
  ALL_LEVELS.map((level) => [level.id, levelSkills(level, { snaps: 1, launches: 1 })]),
);
const firstSeen = (skill: SkillId): number => ALL_LEVELS.findIndex((level) => skillsByLevel.get(level.id)!.includes(skill));

describe('the skill-atom table', () => {
  it('stamps every level with a well-formed atom row and phase plan', () => {
    for (const level of ALL_LEVELS) {
      expect(existsSync(resolve(routesDir, `${level.id}.json`)), `${level.id}: route`).toBe(true);
      readAtom(level.id);
      readPhase(level.id);
    }
  });

  it('teaches only atoms the level is first to carry', () => {
    for (const level of ALL_LEVELS) {
      const atom = readAtom(level.id);
      const carried = new Set<SkillId>();
      for (const earlier of ALL_LEVELS.slice(0, ALL_LEVELS.indexOf(level))) {
        for (const skill of skillsByLevel.get(earlier.id)!) carried.add(skill);
      }
      const fresh = skillsByLevel.get(level.id)!.filter((s) => !carried.has(s));
      if (atom.teaches === null) {
        expect(fresh, `${level.id}: teaches nothing while introducing ${fresh.join(', ')}`).toHaveLength(0);
      } else {
        expect(fresh, `${level.id}: teaches ${atom.teaches} un-freshly`).toContain(atom.teaches);
      }
    }
  });

  it('never examines an atom before the level that teaches it', () => {
    for (const level of ALL_LEVELS) {
      const atom = readAtom(level.id);
      if (atom.examines === null) continue;
      expect(skillsByLevel.get(level.id)!, `${level.id}: examines ${atom.examines} it never carries`).toContain(atom.examines);
      expect(firstSeen(atom.examines), `${level.id}: examines ${atom.examines} early`).toBeLessThanOrEqual(ALL_LEVELS.indexOf(level));
    }
  });

  it('puts every taught atom on an exam bench before its biome closes', () => {
    const seen = new Set<SkillId>();
    const examined = new Map<SkillId, string>();
    for (const level of ALL_LEVELS) {
      for (const skill of skillsByLevel.get(level.id)!) {
        if (seen.has(skill)) continue;
        seen.add(skill);
        for (const later of ALL_LEVELS.slice(ALL_LEVELS.indexOf(level))) {
          if (later.biome !== level.biome) continue;
          const atom = readAtom(later.id);
          if (atom.examines === skill) {
            examined.set(skill, later.id);
            break;
          }
        }
      }
    }
    for (const skill of seen) {
      expect(examined.has(skill), `${skill} never meets an exam bench in its biome`).toBe(true);
    }
  });

  it('drills an atom the level actually carries', () => {
    for (const level of ALL_LEVELS) {
      const atom = readAtom(level.id);
      if (atom.practices === null) continue;
      expect(skillsByLevel.get(level.id)!, `${level.id}: practices ${atom.practices} without carrying it`).toContain(atom.practices);
    }
  });

  it('carries the same rows in the ledger doc as on the routes', () => {
    const doc = readFileSync(ledger, 'utf8');
    const rowFor = new Map<string, string>();
    for (const line of doc.split('\n')) {
      const match = line.match(/^\| ([a-z]+-\d+) (.+?) \| (\d+)s \|/);
      if (match) rowFor.set(match[1]!, line);
    }
    expect(rowFor.size, 'the ledger table parses one row per level').toBe(ALL_LEVELS.length);
    for (const level of ALL_LEVELS) {
      const row = rowFor.get(level.id);
      expect(row, `${level.id}: ledger row`).toBeDefined();
      const atom = readAtom(level.id);
      const phase = readPhase(level.id);
      const dash = '—';
      expect(row!, `${level.id}: par`).toContain(`| ${level.parSeconds}s |`);
      expect(row!, `${level.id}: teach`).toContain(`| ${atom.teaches ?? dash} | ${atom.practices ?? dash} | ${atom.examines ?? dash} |`);
      expect(row!, `${level.id}: clockwork`).toContain(
        `${phase.establish.toFixed(2)} · ${phase.twist.toFixed(2)} · ${phase.escalate.toFixed(2)} · ${phase.resolve.toFixed(2)}`,
      );
      expect(row!, `${level.id}: fall band`).toContain(`${Math.round(level.fallRateTarget * 100)}%`);
      expect(row!, `${level.id}: prop budget`).toContain(`${level.props.length}/260`);
    }
  });
});
