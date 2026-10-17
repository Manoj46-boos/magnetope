import { describe, expect, it } from 'vitest';
import { violations, type TraceEntry } from './helpers/sdk-trace';

/** The fuzz run is only worth something if its judge can say no. */
describe('the SDK trace judge', () => {
  const ok = (entries: TraceEntry[]) => expect(violations(entries)).toEqual([]);
  const bad = (entries: TraceEntry[], pattern: RegExp) => expect(violations(entries).join('\n')).toMatch(pattern);

  it('accepts a normal session: input, start, stop, ad, input, start', () => {
    ok(['input', 'start', 'stop', 'ad+', 'ad-', 'input', 'start', 'stop']);
  });

  it('rejects a start that no input asked for', () => {
    bad(['input', 'start', 'stop', 'start'], /without a player input/);
  });

  it('rejects two starts or two stops in a row', () => {
    bad(['input', 'start', 'start'], /double gameplayStart/);
    bad(['input', 'start', 'stop', 'stop'], /gameplayStop while not playing/);
  });

  it('rejects any gameplay call while an ad plays', () => {
    bad(['input', 'ad+', 'start'], /gameplayStart during an ad/);
    bad(['input', 'start', 'stop', 'ad+', 'stop'], /gameplayStop during an ad/);
  });

  it('rejects an ad that opens while the game is still running, or inside another ad', () => {
    bad(['input', 'start', 'ad+'], /ad opened while gameplay was running/);
    bad(['input', 'ad+', 'ad+'], /second ad opened inside an ad/);
  });

  it('allows the first start straight after load, because the first input is what starts it', () => {
    ok(['input', 'start']);
  });
});
