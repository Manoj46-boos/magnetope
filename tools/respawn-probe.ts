import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadRapier } from '../src/sim/rapier';
import { ReplayPlayer, decodeRecording } from '../src/sim/replay';
import { Simulation } from '../src/sim/simulation';
import { IDLE_INPUT, type LevelDef } from '../src/sim/types';

/**
 * Checks that a checkpoint is somewhere MAGNO can be put back. A respawn drops him 0.4 m above
 * the point with all momentum cleared; he must come to rest within a few centimetres of it, on
 * whatever the level has there, whatever the scripted hazards are doing at that moment.
 */

export interface Point {
  x: number;
  y: number;
}

export interface RespawnOutcome {
  /** How far below the checkpoint MAGNO ended up, in metres. Negative when he rests above it. */
  slip: number;
  falls: number;
  voids: number;
  /** True when MAGNO ends the settle standing or stuck to something. */
  supported: boolean;
}

/** Odd offsets on purpose: scripted hazards cycle in whole seconds, and round numbers would all sample the same phase. */
export const RESPAWN_CLOCKS_MS = [0, 1300, 2900, 4100, 5900, 7300, 8900, 10700];
export const SETTLE_MS = 1000;
export const MAX_SLIP_METERS = 0.5;

const TICK_MS = 1000 / 60;
/** Respawn height above the checkpoint: body radius, half height and the 0.1 m drop in `Simulation.respawn`. */
export const RESPAWN_LIFT = 0.4;

export async function probeRespawn(level: LevelDef, at: Point, clockMs: number): Promise<RespawnOutcome> {
  const sim = new Simulation(await loadRapier(), { ...level, checkpoints: [at] });
  try {
    sim.run.started = true;
    sim.run.timeMs = clockMs;
    sim.run.checkpoint = 0;
    let voids = 0;
    sim.events.on('respawn', (e) => {
      if (e.reason === 'void') voids++;
    });
    sim.respawn('second-wind');
    const fallsBefore = sim.run.fallCount;

    const total = Math.round(SETTLE_MS / TICK_MS);
    for (let tick = 0; tick < total; tick++) sim.step(IDLE_INPUT);
    const view = sim.magno.view;
    return { slip: at.y - view.position.y, falls: sim.run.fallCount - fallsBefore, voids, supported: view.grounded || view.attachNormal !== null };
  } finally {
    sim.dispose();
  }
}

export const holds = (outcome: RespawnOutcome): boolean =>
  outcome.supported && outcome.slip <= MAX_SLIP_METERS && outcome.falls === 0 && outcome.voids === 0;

/** Share of the clock readings at which a respawn at `at` comes to rest, 0 to 1. */
export async function holdShare(level: LevelDef, at: Point): Promise<number> {
  let held = 0;
  for (const clock of RESPAWN_CLOCKS_MS) if (holds(await probeRespawn(level, at, clock))) held++;
  return held / RESPAWN_CLOCKS_MS.length;
}

const GROUND_REACH = 4;
const SAMPLE_EVERY_TICKS = 4;
const GRID = 0.5;
const PATH_REACH = 2.4;
const SCAN_STEP = 0.75;

/**
 * Checkpoint candidates along the stored route: ground within reach below the path, and places
 * where MAGNO hangs nearly still. Each is the point a respawn should name, so a candidate that
 * holds drops him back where the route had him.
 */
export async function candidateSpots(level: LevelDef): Promise<Point[]> {
  const url = new URL(`../src/levels/routes/${level.id}.json`, import.meta.url);
  const player = new ReplayPlayer(decodeRecording(readFileSync(fileURLToPath(url), 'utf8')));
  const sim = new Simulation(await loadRapier(), level);
  const found = new Map<string, Point>();
  const floorY = level.spawn.y + 3;
  const ceilingY = level.summit.y - 6;
  const add = (x: number, y: number): void => {
    if (y < floorY || y > ceilingY) return;
    found.set(`${Math.round(x / GRID)}:${Math.round(y / GRID)}`, { x, y });
  };
  const path: Point[] = [];
  let still = 0;
  try {
    for (let tick = 0; !player.done; tick++) {
      sim.step(player.next());
      const view = sim.magno.view;
      const speed = Math.hypot(view.velocity.x, view.velocity.y);
      const held = view.grounded || view.attachNormal !== null;
      still = held && speed < 0.8 ? still + 1 : 0;
      if (tick % 2 === 0) path.push({ x: view.position.x, y: view.position.y });
      if (still === 6) add(view.position.x, view.position.y - RESPAWN_LIFT);
      if (tick % SAMPLE_EVERY_TICKS === 0 && speed < 12) {
        const drop = sim.physics.castDistance(view.position, { x: 0, y: -1 }, GROUND_REACH);
        if (Number.isFinite(drop)) add(view.position.x, view.position.y - drop);
      }
    }
    // Ground a short step off the path counts too: a ledge beside the climb is a fair place to wake up.
    for (let x = level.bounds.minX; x <= level.bounds.maxX; x += SCAN_STEP) {
      for (let y = floorY; y <= ceilingY; y += SCAN_STEP) {
        if (!path.some((q) => Math.hypot(q.x - x, q.y - y) <= PATH_REACH)) continue;
        const drop = sim.physics.castDistance({ x, y }, { x: 0, y: -1 }, GROUND_REACH);
        if (Number.isFinite(drop)) add(x, y - drop);
      }
    }
  } finally {
    sim.dispose();
  }
  return [...found.values()];
}
