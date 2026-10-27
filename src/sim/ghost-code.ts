import { MAX_GHOST_SAMPLES, type GhostTrack } from './ghost';

/**
 * A ghost as a short text code a player can paste into a chat. Layout, before
 * compression: magic, level id, name, duration, sample count, then the x and y
 * steps as zigzag varints, closed by a CRC-32. The bytes are deflated and
 * written as URL-safe base64 behind a version prefix.
 */
export const PREFIX = 'MGH1.';
export const MAGIC = [0x4d, 0x47, 0x01];
export const MAX_NAME_LENGTH = 14;
export const MAX_CODE_CHARS = 48_000;
const MAX_RAW_BYTES = 96_000;
const MAX_ID_BYTES = 48;

export type GhostCodeFailure = 'format' | 'checksum' | 'too-large' | 'unsupported';

export type GhostCodeResult = { ok: true; track: GhostTrack; name: string } | { ok: false; reason: GhostCodeFailure };

/** Keeps a display name short, printable and on one line. */
export function cleanName(raw: string, fallback = ''): string {
  const flat = raw.replace(/[\p{C}\p{Z}]+/gu, ' ').trim();
  const name = [...flat].slice(0, MAX_NAME_LENGTH).join('').trim();
  return name || fallback;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: ArrayLike<number>, length = bytes.length): number => {
  let c = 0xffffffff;
  for (let i = 0; i < length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

class ByteWriter {
  private bytes: number[] = [];

  byte(value: number): void {
    this.bytes.push(value & 0xff);
  }

  varint(value: number): void {
    let v = value;
    while (v >= 0x80) {
      this.bytes.push((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    this.bytes.push(v);
  }

  signed(value: number): void {
    this.varint(value < 0 ? -value * 2 - 1 : value * 2);
  }

  text(value: string): void {
    const encoded = new TextEncoder().encode(value);
    this.varint(encoded.length);
    this.bytes.push(...encoded);
  }

  finish(): Uint8Array {
    const crc = crc32(this.bytes);
    for (let shift = 24; shift >= 0; shift -= 8) this.bytes.push((crc >>> shift) & 0xff);
    return Uint8Array.from(this.bytes);
  }
}

class ByteReader {
  private at = 0;

  constructor(
    private readonly bytes: Uint8Array,
    private readonly end: number,
  ) {}

  get done(): boolean {
    return this.at === this.end;
  }

  byte(): number {
    if (this.at >= this.end) throw new RangeError('end of data');
    return this.bytes[this.at++]!;
  }

  varint(): number {
    let value = 0;
    let scale = 1;
    for (let i = 0; i < 6; i++) {
      const b = this.byte();
      value += (b & 0x7f) * scale;
      if (b < 0x80) return value;
      scale *= 128;
    }
    throw new RangeError('varint too long');
  }

  signed(): number {
    const v = this.varint();
    return v % 2 === 0 ? v / 2 : -(v + 1) / 2;
  }

  text(maxBytes: number): string {
    const length = this.varint();
    if (length > maxBytes || this.at + length > this.end) throw new RangeError('bad text length');
    const out = new TextDecoder('utf-8', { fatal: true }).decode(this.bytes.subarray(this.at, this.at + length));
    this.at += length;
    return out;
  }
}

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
};

const streamsAvailable = (): boolean => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function deflate(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inflates with a hard output cap, so a tiny hostile code cannot expand into memory. */
async function inflate(packed: Uint8Array): Promise<Uint8Array | null> {
  const stream = new Blob([packed as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_RAW_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export async function encodeGhostCode(track: GhostTrack, name: string): Promise<string> {
  const w = new ByteWriter();
  MAGIC.forEach((b) => w.byte(b));
  w.text(track.levelId);
  w.text(cleanName(name));
  w.varint(Math.round(track.durationMs));
  w.varint(track.x.length);
  for (const series of [track.x, track.y]) {
    let previous = 0;
    for (const value of series) {
      w.signed(value - previous);
      previous = value;
    }
  }
  return PREFIX + toBase64Url(await deflate(w.finish()));
}

/** Everything a pasted code can get wrong ends in a typed failure; nothing throws. */
export async function decodeGhostCode(input: string): Promise<GhostCodeResult> {
  const code = input.replace(/\s+/g, '');
  if (code.length > MAX_CODE_CHARS) return { ok: false, reason: 'too-large' };
  if (!code.startsWith(PREFIX)) return { ok: false, reason: 'format' };
  const packed = fromBase64Url(code.slice(PREFIX.length));
  if (!packed || packed.length < 8) return { ok: false, reason: 'format' };
  if (!streamsAvailable()) return { ok: false, reason: 'unsupported' };

  let raw: Uint8Array | null;
  try {
    raw = await inflate(packed);
  } catch {
    return { ok: false, reason: 'format' };
  }
  if (!raw) return { ok: false, reason: 'too-large' };
  if (raw.length < MAGIC.length + 4) return { ok: false, reason: 'format' };

  const bodyLength = raw.length - 4;
  const stored = ((raw[bodyLength]! << 24) | (raw[bodyLength + 1]! << 16) | (raw[bodyLength + 2]! << 8) | raw[bodyLength + 3]!) >>> 0;
  if (stored !== crc32(raw, bodyLength)) return { ok: false, reason: 'checksum' };

  try {
    const r = new ByteReader(raw, bodyLength);
    if (MAGIC.some((b) => r.byte() !== b)) return { ok: false, reason: 'format' };
    const levelId = r.text(MAX_ID_BYTES);
    const name = cleanName(r.text(MAX_NAME_LENGTH * 4));
    const durationMs = r.varint();
    const count = r.varint();
    if (count < 2 || count > MAX_GHOST_SAMPLES || durationMs > 3_600_000) return { ok: false, reason: 'format' };
    const series: number[][] = [];
    for (let s = 0; s < 2; s++) {
      const values: number[] = [];
      let acc = 0;
      for (let i = 0; i < count; i++) {
        acc += r.signed();
        values.push(acc);
      }
      series.push(values);
    }
    if (!r.done) return { ok: false, reason: 'format' };
    return { ok: true, name, track: { version: 1, levelId, durationMs, x: series[0]!, y: series[1]! } };
  } catch {
    return { ok: false, reason: 'format' };
  }
}
