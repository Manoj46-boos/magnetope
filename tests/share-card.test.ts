import { describe, expect, it, vi } from 'vitest';
import { SHARE_HEIGHT, SHARE_WIDTH, buildShareCard, deliverShareCard, type ShareCardSpec } from '@/game/share-card';
import { TABLES, LOCALES } from '@/locale/strings';

const spec = (over: Partial<ShareCardSpec> = {}, locale: (typeof LOCALES)[number] = 'en'): ShareCardSpec => ({
  grade: 'SSS',
  heightMeters: 41.7,
  bounces: 9,
  junk: 14,
  levelName: 'Crusher Row',
  biome: 'scrapyard',
  labels: { fall: TABLES[locale].fallHeight, bounces: TABLES[locale].bounces, junk: TABLES[locale].junk, meters: TABLES[locale].meters },
  ...over,
});

describe('share card layout', () => {
  it('is a 9:16 portrait', () => {
    expect(SHARE_WIDTH / SHARE_HEIGHT).toBeCloseTo(9 / 16, 3);
  });

  it('shows the grade, the height with its unit, and both stats', () => {
    const texts = buildShareCard(spec()).flatMap((o) => (o.op === 'text' ? [o.text] : []));
    expect(texts).toEqual(expect.arrayContaining(['SSS', '41.7 m', '9', '14', 'MAGNETOPE', 'Crusher Row']));
  });

  it.each(LOCALES)('keeps every text run inside the frame in %s', (locale) => {
    for (const op of buildShareCard(spec({}, locale))) {
      if (op.op !== 'text') continue;
      expect(op.maxWidth).toBeLessThanOrEqual(SHARE_WIDTH - 2 * 60);
      expect(op.y).toBeGreaterThan(0);
      expect(op.y).toBeLessThan(SHARE_HEIGHT);
      expect(op.x).toBeGreaterThan(0);
      expect(op.x).toBeLessThan(SHARE_WIDTH);
    }
  });

  it('is a pure function of its input and themes itself by biome', () => {
    expect(buildShareCard(spec())).toEqual(buildShareCard(spec()));
    expect(buildShareCard(spec({ biome: 'stratosphere' }))).not.toEqual(buildShareCard(spec()));
  });

  it('carries no links or external references', () => {
    expect(JSON.stringify(buildShareCard(spec()))).not.toMatch(/https?:|www\./i);
  });
});

describe('delivering the card', () => {
  const blob = new Blob(['png'], { type: 'image/png' });
  const doc = () => {
    const link = { click: vi.fn(), remove: vi.fn(), href: '', download: '', rel: '' };
    return {
      link,
      document: { createElement: () => link, body: { appendChild: vi.fn() } } as unknown as Document,
      urls: { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() },
    };
  };

  it('uses the share sheet where files can be shared', async () => {
    const { document, urls } = doc();
    const share = vi.fn().mockResolvedValue(undefined);
    const outcome = await deliverShareCard(blob, 'a.png', { navigator: { canShare: () => true, share }, document, urls });
    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledOnce();
  });

  it('treats dismissing the share sheet as cancelling, not as an error or a download', async () => {
    const { document, urls, link } = doc();
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    const outcome = await deliverShareCard(blob, 'a.png', { navigator: { canShare: () => true, share }, document, urls });
    expect(outcome).toBe('cancelled');
    expect(link.click).not.toHaveBeenCalled();
  });

  it('falls back to a local download on desktop', async () => {
    const { document, urls, link } = doc();
    const outcome = await deliverShareCard(blob, 'fall.png', { navigator: undefined, document, urls });
    expect(outcome).toBe('saved');
    expect(link.download).toBe('fall.png');
    expect(link.click).toHaveBeenCalledOnce();
  });
});
