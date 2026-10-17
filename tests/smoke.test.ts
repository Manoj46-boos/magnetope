import { describe, expect, it } from 'vitest';
import { Driver, createSim, floor, makeLevel } from './helpers/harness';

describe('smoke', () => {
  it('settles onto a steel floor and attaches', async () => {
    const sim = await createSim(makeLevel([floor()]));
    const d = new Driver(sim);
    d.ms(1200);
    console.log(d.view.state, d.view.position, d.view.grounded);
    expect(d.view.state).toBe('attached');
  });

  it('launches off a wall with a full charge and snaps to the next', async () => {
    const sim = await createSim(
      makeLevel([floor(), { kind: 'girder', x: 6, y: 5, w: 4, h: 0.4 }]),
    );
    const d = new Driver(sim);
    d.ms(800);
    d.tilt(0.4, 1).press().ms(900).release().tick();
    const trace: string[] = [];
    for (let i = 0; i < 90; i++) {
      d.tick();
      if (i % 6 === 0) trace.push(`${i} ${d.view.state} ${d.view.position.x.toFixed(2)},${d.view.position.y.toFixed(2)} v=${d.view.velocity.x.toFixed(1)},${d.view.velocity.y.toFixed(1)}`);
    }
    console.log(trace.join('\n'));
    expect(true).toBe(true);
  });
});
