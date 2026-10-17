import { describe, expect, it } from 'vitest';
import type { PropPlacement } from '@/sim/types';
import { Driver, createSim, makeLevel } from './helpers/harness';

const surface = (kind: string, w: number, h: number): PropPlacement => ({ kind, x: 0, y: -h / 2, w, h });

/** Drops MAGNO from `height` metres and reports how high the first bounce carries him. */
async function firstBounceApex(prop: PropPlacement, height: number) {
  const sim = await createSim(makeLevel([prop], { spawn: { x: 0, y: height }, bounds: { minX: -30, maxX: 30 } }));
  const d = new Driver(sim);
  let impacted = false;
  let wentLimp = false;
  sim.events.on('impact', () => (impacted = true));
  sim.events.on('limp', () => (wentLimp = true));
  let apex = -Infinity;
  let attached = false;
  for (let i = 0; i < 60 * 4; i++) {
    d.tick();
    if (d.view.state === 'attached') attached = true;
    if (impacted) apex = Math.max(apex, d.view.position.y);
  }
  return { apex, attached, wentLimp, sim, d };
}

describe('bounce materials', () => {
  it('throws MAGNO back up almost as high as he fell off a trampoline', async () => {
    const { apex } = await firstBounceApex(surface('trampoline', 4, 0.5), 6);
    expect(apex).toBeGreaterThan(4.6);
  });

  it('bounces higher off a trampoline than a mattress, and higher off a mattress than wood', async () => {
    const trampoline = (await firstBounceApex(surface('trampoline', 4, 0.5), 6)).apex;
    const mattress = (await firstBounceApex(surface('mattress', 4, 0.55), 6)).apex;
    const wood = (await firstBounceApex(surface('plank', 4, 0.3), 6)).apex;
    expect(trampoline).toBeGreaterThan(mattress + 0.8);
    expect(mattress).toBeGreaterThan(wood + 1);
  });

  it('never lets MAGNO stick to the trampoline', async () => {
    const { attached } = await firstBounceApex(surface('trampoline', 4, 0.5), 6);
    expect(attached).toBe(false);
  });

  it('catches a long drop without knocking him limp', async () => {
    const { sim, wentLimp } = await firstBounceApex(surface('trampoline', 4, 0.5), 14);
    expect(wentLimp).toBe(false);
    expect(sim.run.fallCount).toBe(0);
  });

  it('still knocks him limp on a hard floor from the same height', async () => {
    const { wentLimp } = await firstBounceApex(surface('slab', 12, 1.2), 14);
    expect(wentLimp).toBe(true);
  });

  it('counts the bounce apex, not the original perch, as the height to fall from', async () => {
    const sim = await createSim(makeLevel([surface('trampoline', 4, 0.5)], { spawn: { x: 0, y: 14 } }));
    const d = new Driver(sim);
    let impacts = 0;
    sim.events.on('impact', () => impacts++);
    d.until(() => impacts >= 1, 4000);
    d.ms(150);
    expect(d.view.dropMeters).toBeLessThan(2);
  });
});
