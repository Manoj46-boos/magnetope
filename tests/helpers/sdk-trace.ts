/** What a recorded SDK run is made of: platform calls, ad windows, and the player's own inputs. */
export type TraceEntry = 'start' | 'stop' | 'ad+' | 'ad-' | 'input';

/** The rules from PRD Table 10.3 and the Poki requirements, checked over a recorded run. */
export function violations(entries: readonly TraceEntry[]): string[] {
  const out: string[] = [];
  let playing = false;
  let inAd = false;
  let inputSinceStop = true;
  entries.forEach((entry, i) => {
    const at = `#${i} (${entries.slice(Math.max(0, i - 4), i + 1).join(' > ')})`;
    if (entry === 'input') {
      inputSinceStop = true;
    } else if (entry === 'ad+') {
      if (inAd) out.push(`second ad opened inside an ad ${at}`);
      if (playing) out.push(`ad opened while gameplay was running ${at}`);
      inAd = true;
    } else if (entry === 'ad-') {
      inAd = false;
    } else if (entry === 'start') {
      if (inAd) out.push(`gameplayStart during an ad ${at}`);
      if (playing) out.push(`double gameplayStart ${at}`);
      if (!inputSinceStop) out.push(`gameplayStart without a player input ${at}`);
      playing = true;
    } else if (entry === 'stop') {
      if (inAd) out.push(`gameplayStop during an ad ${at}`);
      if (!playing) out.push(`gameplayStop while not playing ${at}`);
      playing = false;
      inputSinceStop = false;
    }
  });
  return out;
}
