import { ALL_LEVELS } from '@/levels';
import type { StringKey } from '@/locale';
import type { SaveStore } from '@/platform/storage';
import { decodeGhost, encodeGhost } from '@/sim/ghost';
import { cleanName, decodeGhostCode, encodeGhostCode, type GhostCodeFailure } from '@/sim/ghost-code';
import { vetGhost, type VetFailure } from '@/sim/ghost-vet';

export interface ExchangeView {
  levelName: string;
  /** Time of the player's own ghost, or null until par has been beaten. */
  personalMs: number | null;
  friend: { name: string; durationMs: number } | null;
  alias: string;
}

export type ImportOutcome = { ok: true; name: string; level: string } | { ok: false; message: StringKey };

const DEFAULT_FRIEND = 'Friend';

const CODE_MESSAGES: Record<GhostCodeFailure, StringKey> = {
  format: 'ghostErrFormat',
  checksum: 'ghostErrChecksum',
  'too-large': 'ghostErrTooLarge',
  unsupported: 'ghostErrUnsupported',
};

const VET_MESSAGES: Record<VetFailure, StringKey> = {
  level: 'ghostErrFormat',
  start: 'ghostErrImplausible',
  summit: 'ghostErrImplausible',
  jump: 'ghostErrImplausible',
  bounds: 'ghostErrImplausible',
  duration: 'ghostErrImplausible',
};

/**
 * The rules of the ghost exchange (PRD 5.5, 15.3): turn the player's ghost into
 * a code, and turn a friend's code into a ghost that races on the matching
 * level, after checking that it could be a real run of that level.
 */
export class GhostExchange {
  constructor(
    private readonly save: SaveStore,
    private readonly onFriendChanged: (levelId: string) => void = () => undefined,
  ) {}

  view(levelId: string): ExchangeView {
    const level = ALL_LEVELS.find((l) => l.id === levelId);
    const personal = this.save.data.ghosts[levelId];
    const friend = this.save.data.friends[levelId];
    const personalTrack = personal ? decodeGhost(personal, levelId) : null;
    const friendTrack = friend ? decodeGhost(friend.ghost, levelId) : null;
    return {
      levelName: level?.name ?? levelId,
      personalMs: personalTrack?.durationMs ?? null,
      friend: friend && friendTrack ? { name: friend.name, durationMs: friendTrack.durationMs } : null,
      alias: this.save.data.alias,
    };
  }

  async exportCode(levelId: string, alias: string): Promise<string | null> {
    const stored = this.save.data.ghosts[levelId];
    const track = stored ? decodeGhost(stored, levelId) : null;
    if (!track) return null;
    const name = cleanName(alias);
    if (name !== this.save.data.alias) this.save.update((s) => void (s.alias = name));
    return encodeGhostCode(track, name);
  }

  async importCode(code: string): Promise<ImportOutcome> {
    const decoded = await decodeGhostCode(code);
    if (!decoded.ok) return { ok: false, message: CODE_MESSAGES[decoded.reason] };
    const level = ALL_LEVELS.find((l) => l.id === decoded.track.levelId);
    if (!level) return { ok: false, message: 'ghostErrFormat' };
    const verdict = vetGhost(decoded.track, level);
    if (!verdict.ok) return { ok: false, message: VET_MESSAGES[verdict.reason] };

    const name = cleanName(decoded.name, DEFAULT_FRIEND);
    this.save.update((s) => {
      s.friends[level.id] = { name, ghost: encodeGhost(decoded.track) };
    });
    this.onFriendChanged(level.id);
    return { ok: true, name, level: level.name };
  }

  removeFriend(levelId: string): void {
    if (!this.save.data.friends[levelId]) return;
    this.save.update((s) => {
      delete s.friends[levelId];
    });
    this.onFriendChanged(levelId);
  }
}
