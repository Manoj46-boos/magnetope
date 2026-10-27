import { ALL_LEVELS } from '@/levels';
import { MAX_CODE_CHARS, PREFIX } from '@/sim/ghost-code';

/**
 * The payload schema for ghost records in the platform's arbitrary user data
 * store (R-CM-06, PRD 29.4). The store is the only social surface this game
 * will ever have, so the record is closed by construction: a campaign level id
 * and one opaque ghost code, nothing else. No names ride in the record — the
 * name a friend's code carries is only ever shown for ghosts the player pasted
 * themselves, and regional ghosts display nameless by default. Anything the
 * store hands back that carries a field outside this shape is refused whole
 * rather than read partially, so the schema cannot be widened by data.
 *
 * The SDK wiring itself waits for a developer account; when it lands, it goes
 * through this module and nowhere else.
 */

export interface AudsGhostRecord {
  level: string;
  code: string;
}

export type AudsParseFailure = 'shape' | 'level' | 'code';

export type AudsParseResult = { ok: true; record: AudsGhostRecord } | { ok: false; reason: AudsParseFailure };

const isCampaignLevel = (id: string): boolean => ALL_LEVELS.some((l) => l.id === id);

/**
 * The cheap half of the code check: the version prefix and the URL-safe base64
 * alphabet, at the length ceiling the exchange itself enforces. The full decode
 * (checksum, magic, plausibility) stays where it belongs in the ghost vetting
 * path the moment a record is actually raced.
 */
const looksLikeGhostCode = (code: string): boolean =>
  code.startsWith(PREFIX) && code.length <= MAX_CODE_CHARS && /^[A-Za-z0-9_-]+$/.test(code.slice(PREFIX.length));

export function parseAudsRecord(input: unknown): AudsParseResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, reason: 'shape' };
  const keys = Object.keys(input);
  if (keys.length !== 2 || !('level' in input) || !('code' in input)) return { ok: false, reason: 'shape' };
  const { level, code } = input as Record<string, unknown>;
  if (typeof level !== 'string' || typeof code !== 'string') return { ok: false, reason: 'shape' };
  if (!isCampaignLevel(level)) return { ok: false, reason: 'level' };
  if (!looksLikeGhostCode(code)) return { ok: false, reason: 'code' };
  return { ok: true, record: { level, code } };
}

/** Builds a record for the store from a level and a ghost this game encoded. */
export function audsRecordFor(levelId: string, code: string): AudsParseResult {
  return parseAudsRecord({ level: levelId, code });
}
