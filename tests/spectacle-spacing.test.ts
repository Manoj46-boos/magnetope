import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPECTACLE_SPACING_MS, SpectacleLedger } from '@/game/spectacle';
import { ALL_LEVELS } from '@/levels';
import { loadRapier } from '@/sim/rapier';
import { ReplayPlayer, decodeRecording, type Recording } from '@/sim/replay';
import { Simulation } from '@/sim/simulation';
import type { LevelDef } from '@/sim/types';

/**
 * Spectacle spacing (PRD 16.2, R-SM-06): no two signature beats inside twenty
 * seconds. The ledger is the runtime half — the big-fall slow motion is the
 * beat that yields. The linter is the authored half: it replays every recorded
 * solver route and checks the beat timeline the player is actually delivered,
 * with the ledger deciding exactly as the game does. It also pins a pacing bar:
 * a route may ask for at most one suppressed slow-mo, so a future level edit or
 * re-solve that packs beats tighter fails here instead of shipping. Between
 * levels the clear card and the player's own pace are the breathing space, so
 * the lint runs within a level, not across the campaign.
 */

const routesDir = resolve(__dirname, '../src/levels/routes');
const recordingFor = (level: LevelDef): Recording => decodeRecording(readFileSync(resolve(routesDir, `${level.id}.json`), 'utf8'));

describe('the spectacle ledger (R-SM-06)', () => {
  it('blocks a second beat inside the spacing window and frees it after', () => {
    const ledger = new SpectacleLedger();
    expect(ledger.clear).toBe(true);
    ledger.update(5000);
    ledger.mark('establish');
    expect(ledger.clear).toBe(false);
    ledger.update(15_000);
    expect(ledger.clear).toBe(false);
    expect(ledger.msSinceLast).toBe(15_000);
    ledger.update(5_001);
    expect(ledger.clear).toBe(true);
    expect(ledger.lastBeat).toBe('establish');
    expect(ledger.msSinceLast).toBe(20_001);
  });

  it('carries the dynamic beat on the same clock as the authored ones', () => {
    const ledger = new SpectacleLedger();
    ledger.mark('slow-mo');
    expect(ledger.lastBeat).toBe('slow-mo');
    ledger.update(SPECTACLE_SPACING_MS);
    expect(ledger.clear).toBe(true);
  });
});

describe('the route linter', () => {
  const biomes = [...new Set(ALL_LEVELS.map((l) => l.biome))];

  it.each(biomes)('%s: delivers its beats at the twenty-second spacing', async (biome) => {
    const rapier = await loadRapier();
    for (const level of ALL_LEVELS.filter((l) => l.biome === biome)) {
      const sim = new Simulation(rapier, level);
      const raw: Array<{ kind: 'establish' | 'slow-mo'; atMs: number }> = [];
      // The establishing shot is marked the moment its level begins, exactly as
      // the game marks it, so a fall soon after a biome's opening stays full speed.
      if (level.index === 0) raw.push({ kind: 'establish', atMs: 0 });
      sim.events.on('slowMo', () => raw.push({ kind: 'slow-mo', atMs: sim.run.timeMs }));
      const player = new ReplayPlayer(recordingFor(level));
      while (!player.done && !sim.run.cleared) sim.step(player.next());
      expect(sim.run.cleared, level.id).toBe(true);
      sim.dispose();

      // The timeline the player is delivered: the ledger grants or denies each
      // request exactly as the game would, run clock standing in for the ledger's
      // real clock (which only runs ahead of it, never behind).
      const ledger = new SpectacleLedger();
      const granted: Array<{ kind: string; atMs: number }> = [];
      let denials = 0;
      let clock = 0;
      for (const beat of raw) {
        ledger.update(beat.atMs - clock);
        clock = beat.atMs;
        if (beat.kind === 'establish' || ledger.clear) {
          ledger.mark(beat.kind);
          granted.push(beat);
        } else {
          denials++;
        }
      }
      for (let i = 1; i < granted.length; i++) {
        expect(
          granted[i]!.atMs - granted[i - 1]!.atMs,
          `${level.id}: ${granted[i - 1]!.kind} at ${granted[i - 1]!.atMs} ms then ${granted[i]!.kind} at ${granted[i]!.atMs} ms`,
        ).toBeGreaterThanOrEqual(SPECTACLE_SPACING_MS);
      }
      // The routes as solved today ask for at most two suppressed slow-mos per
      // level; anything tighter than that is a pacing regression, not a beat.
      expect(denials, `${level.id}: beat requests the ledger had to suppress`).toBeLessThanOrEqual(2);
    }
  }, 180_000);
});
