import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Vec2 } from '@/core/mathx';
import { ALL_LEVELS } from '@/levels';
import { GhostRecorder, encodeGhost, type GhostTrack } from '@/sim/ghost';
import { ReplayPlayer, decodeRecording, type Recording } from '@/sim/replay';
import { loadRapier } from '@/sim/rapier';
import { Simulation } from '@/sim/simulation';
import type { InputFrame, LevelDef } from '@/sim/types';

/**
 * Builds each level's par ghost (PRD 5.5) from the planner's stored route.
 *
 * The planner is faster than a human par, so the ghost rests wherever MAGNO
 * hangs motionless on steel right before a launch. The rest is written into the
 * ghost's timeline rather than the simulated inputs: a pause there is just a
 * motionless hang, and re-simulating a longer route is fragile because the
 * planner's routes thread tight timing windows. Levels with scripted hazards
 * keep the planner's own pace so the ghost stays in step with the platforms.
 */

const here = dirname(fileURLToPath(import.meta.url));
const routesDir = resolve(here, '../src/levels/routes');
const ghostsDir = resolve(here, '../src/levels/ghosts');

const TICK_MS = 1000 / 60;
const MARGIN_MS = 400;
const MIN_GAP_TICKS = 30;
const LOOKAHEAD_TICKS = 14;
const MAX_REST_TICKS = 15 * 60;

interface Capture {
  positions: Vec2[];
  /** Indices into `positions` where a motionless hang precedes a launch. */
  rests: number[];
  clearMs: number;
  cleared: boolean;
}

const expand = (recording: Recording): InputFrame[] => {
  const player = new ReplayPlayer(recording);
  const frames: InputFrame[] = [];
  while (!player.done) frames.push(player.next());
  return frames;
};

/** True when the inputs from `tick` are neutral until the next press, which comes within the look-ahead window. */
function launchesSoon(frames: InputFrame[], tick: number): boolean {
  for (let i = tick; i < Math.min(frames.length, tick + LOOKAHEAD_TICKS); i++) {
    const f = frames[i]!;
    if (f.flipDown) return true;
    if (f.flipHeld || f.flipUp || f.tiltX !== 0 || f.tiltY !== 0) return false;
  }
  return false;
}

async function capture(level: LevelDef, recording: Recording): Promise<Capture> {
  const rapier = await loadRapier();
  const sim = new Simulation(rapier, level);
  const player = new ReplayPlayer(recording);
  const frames = expand(recording);
  const positions: Vec2[] = [];
  const rests: number[] = [];
  let lastRest = -MIN_GAP_TICKS;

  for (let tick = 0; tick < frames.length && !sim.run.cleared; tick++) {
    const view = sim.magno.view;
    const attach = sim.magno.data.attach;
    const hanging = view.state === 'attached' && attach && !attach.weak && Math.hypot(view.velocity.x, view.velocity.y) < 0.25;
    const rest = Boolean(hanging) && sim.run.started && tick - lastRest >= MIN_GAP_TICKS && launchesSoon(frames, tick);
    sim.step(player.next());
    if (sim.run.started && !sim.run.cleared) {
      if (rest) {
        rests.push(positions.length);
        lastRest = tick;
      }
      positions.push({ ...sim.magno.view.position });
    }
  }

  const result = { positions, rests, clearMs: sim.run.timeMs, cleared: sim.run.cleared };
  positions.push({ ...sim.magno.view.position });
  sim.dispose();
  return result;
}

/** Moving platforms, flickering signs, swings and wind run on the run clock, so a padded ghost would drift off them. */
const runsOnHazardClock = (level: LevelDef): boolean => Boolean(level.wind) || level.props.some((p) => p.motion || p.cycle || p.hinge || p.follow);

function pace(level: LevelDef, run: Capture): GhostTrack {
  const spare = level.parSeconds * 1000 - MARGIN_MS - run.clearMs;
  const perRest = run.rests.length && !runsOnHazardClock(level) ? Math.max(0, Math.min(MAX_REST_TICKS, Math.floor(spare / TICK_MS / run.rests.length))) : 0;
  const recorder = new GhostRecorder();
  const at = new Set(run.rests);
  const lastIndex = run.positions.length - 1;
  let ticks = 0;
  run.positions.forEach((position, index) => {
    if (index === lastIndex) return;
    const copies = at.has(index) ? perRest + 1 : 1;
    for (let i = 0; i < copies; i++) {
      recorder.push(position);
      ticks++;
    }
  });
  return recorder.finish(level.id, ticks * TICK_MS, run.positions[lastIndex]!);
}

mkdirSync(ghostsDir, { recursive: true });
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const targets = ids.length ? ALL_LEVELS.filter((l) => ids.includes(l.id)) : ALL_LEVELS;

for (const level of targets) {
  process.stdout.write(`${level.id} ... `);
  const recording = decodeRecording(readFileSync(resolve(routesDir, `${level.id}.json`), 'utf8'));
  const run = await capture(level, recording);
  if (!run.cleared) throw new Error(`${level.id}: stored route no longer clears the level; run npm run solve`);
  const track = pace(level, run);
  writeFileSync(resolve(ghostsDir, `${level.id}.json`), encodeGhost(track));
  console.log(`${(track.durationMs / 1000).toFixed(1)}s of ${level.parSeconds}s par, ${run.rests.length} rests, ${track.x.length} samples`);
}
