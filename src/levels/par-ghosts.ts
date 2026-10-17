import { decodeGhost, type GhostTrack } from '@/sim/ghost';

/** Developer ghosts ship as data next to the levels and load one level at a time. */
const sources = import.meta.glob<string>('./ghosts/*.json', { query: '?raw', import: 'default' });

export async function loadParGhost(levelId: string): Promise<GhostTrack | null> {
  const load = sources[`./ghosts/${levelId}.json`];
  if (!load) return null;
  try {
    return decodeGhost(await load(), levelId);
  } catch {
    return null;
  }
}
