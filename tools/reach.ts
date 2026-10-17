import { loadRapier } from '@/sim/rapier';
import { Simulation } from '@/sim/simulation';
import type { InputFrame, LevelDef } from '@/sim/types';

/**
 * How far one flip can carry MAGNO at a given gravity scale, with the stick held
 * up all the way (air steering is part of the move): the apex of a full-charge
 * repel, and the highest ledge a flip plus a snap can still catch. Level authors
 * keep fixed ledges further apart than the second number so a moving, tilting or
 * blinking prop in between is the only way up.
 *
 *   npm run reach -- 1 0.66 0.5
 *   npm run reach -- 1 --hold=0     (a bare tap instead of a full charge)
 */

const holdArg = process.argv.find((a) => a.startsWith('--hold='))?.split('=')[1];
const scales = process.argv.slice(2).map(Number).filter((n) => n > 0);
const SNAP_DELAYS_MS = [150, 220, 320, 420, 520, 640, 800];
const HOLDS_MS = holdArg === undefined ? [900, 640, 380] : [Number(holdArg)];
const LEANS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.7, 0.7],
  [-0.7, 0.7],
  [1, 0],
];
const ledgeTop = (height: number): number => height + 0.2;

const frame = (flipHeld: boolean, prev: boolean, tiltX: number, tiltY: number): InputFrame => ({
  tiltX,
  tiltY,
  flipHeld,
  flipDown: flipHeld && !prev,
  flipUp: !flipHeld && prev,
});

function levelWith(gravityScale: number, ledgeHeight: number | null): LevelDef {
  return {
    id: 'reach',
    biome: 'scrapyard',
    index: 0,
    name: 'Reach',
    parSeconds: 60,
    spawn: { x: 0, y: 0 },
    summit: { x: 0, y: 900, radius: 1 },
    checkpoints: [],
    killY: -300,
    bounds: { minX: -400, maxX: 400 },
    fallRateTarget: 0.1,
    gravityScale,
    props: [
      { kind: 'plate', x: 0, y: -0.4, w: 16, h: 0.8 },
      ...(ledgeHeight === null ? [] : [{ kind: 'girder', x: 0, y: ledgeHeight, w: 14, h: 0.4 }]),
    ],
  };
}

class Pilot {
  private held = false;

  constructor(readonly sim: Simulation) {}

  step(n: number, flipHeld: boolean, tiltX = 0, tiltY = 0): void {
    for (let i = 0; i < n; i++) {
      this.sim.step(frame(flipHeld, this.held, tiltX, tiltY));
      this.held = flipHeld;
    }
  }
}

const ticksOf = (ms: number): number => Math.round((ms * 60) / 1000);

async function apexOf(gravityScale: number): Promise<number> {
  const sim = new Simulation(await loadRapier(), levelWith(gravityScale, null));
  const pilot = new Pilot(sim);
  pilot.step(42, false);
  pilot.step(holdArg === undefined ? 60 : Math.max(1, ticksOf(Number(holdArg))), true);
  pilot.step(1, false, 0, 1);
  let apex = 0;
  for (let i = 0; i < 60 * 60 && !(sim.magno.view.velocity.y < -1 && apex > 3); i++) {
    pilot.step(1, false, 0, 1);
    apex = Math.max(apex, sim.magno.view.position.y);
  }
  sim.dispose();
  return apex;
}

/** True when some charge, lean and snap timing lets one flip catch a ledge `height` metres up. */
async function catches(gravityScale: number, height: number): Promise<boolean> {
  const rapier = await loadRapier();
  for (const hold of HOLDS_MS) {
    for (const [lx, ly] of LEANS) {
      for (const delay of SNAP_DELAYS_MS) {
        const sim = new Simulation(rapier, levelWith(gravityScale, height));
        const pilot = new Pilot(sim);
        pilot.step(42, false);
        pilot.step(ticksOf(hold), true);
        pilot.step(1, false, lx, ly);
        pilot.step(ticksOf(delay), false, lx, ly);
        pilot.step(4, true, lx, Math.max(ly, 0.7));
        pilot.step(1, false, lx, ly);
        let caught = false;
        for (let i = 0; i < 60 * 25 && !caught; i++) {
          pilot.step(1, false, lx, ly);
          caught = sim.magno.view.state === 'attached' && sim.magno.view.position.y > ledgeTop(height) - 1;
        }
        sim.dispose();
        if (caught) return true;
      }
    }
  }
  return false;
}

async function highestCatch(gravityScale: number): Promise<number> {
  let low = 2;
  let high = 140;
  while (high - low > 0.5) {
    const mid = (low + high) / 2;
    if (await catches(gravityScale, mid)) low = mid;
    else high = mid;
  }
  return low;
}

for (const scale of scales.length ? scales : [1]) {
  const apex = await apexOf(scale);
  const catchable = await highestCatch(scale);
  console.log(`gravity x${scale}: apex ${apex.toFixed(1)} m, highest ledge a flip and snap can catch ${catchable.toFixed(1)} m`);
}
