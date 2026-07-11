import { describe, expect, test, vi } from 'vitest';
import { importFanThemePack, MAX_FAN_IMAGES, MAX_FAN_PACK_BYTES } from '../../src/fanTheme/importFanThemePack';
import type { FanImageCodec } from '../../src/fanTheme/imageOptimizer';
import type { FanThemeImageRecord, FanThemePackMeta, FanThemeRepository } from '../../src/fanTheme/types';

const jpeg = (name: string) => new File([new Uint8Array([0xff, 0xd8, 0xff])], name);

function fakeRepository(oldPack: FanThemePackMeta | null = null): FanThemeRepository & { staged: FanThemeImageRecord[] } {
  let active = oldPack;
  const staged: FanThemeImageRecord[] = [];
  return {
    staged,
    initialize: vi.fn(async () => undefined),
    beginPack: vi.fn(async () => undefined),
    addStagedImage: vi.fn(async record => { staged.push(record); }),
    activatePack: vi.fn(async meta => { active = meta; }),
    abortPack: vi.fn(async () => { staged.splice(0); }),
    getActivePack: vi.fn(async () => active), getImage: vi.fn(async () => null),
    getEnabled: vi.fn(async () => false), setEnabled: vi.fn(async () => undefined), deleteActivePack: vi.fn(async () => undefined),
  };
}

function codec(blobSize = 4): FanImageCodec & { maxConcurrent: () => number } {
  let concurrent = 0;
  let maximum = 0;
  return {
    maxConcurrent: () => maximum,
    decode: vi.fn(async () => {
      concurrent += 1;
      maximum = Math.max(maximum, concurrent);
      await Promise.resolve();
      concurrent -= 1;
      return { source: {}, width: 20, height: 10, dispose: vi.fn() };
    }),
    encode: vi.fn(async (_source, _width, _height, mime) => new Blob([new Uint8Array(blobSize)], { type: mime })),
  };
}

describe('fan theme pack import', () => {
  test('optimizes sequentially, skips unsupported files, reports progress, and activates once', async () => {
    const repository = fakeRepository();
    const imageCodec = codec();
    const progress = vi.fn();
    const result = await importFanThemePack([jpeg('one.jpg'), new File(['GIF89a'], 'moving.gif'), jpeg('two.jpg')], repository, {
      codec: imageCodec, onProgress: progress, now: () => new Date('2026-01-02T00:00:00Z'), randomUUID: () => 'test-id',
    });
    expect(result).toEqual({ imported: 2, skipped: 1, totalBytes: 8 });
    expect(imageCodec.maxConcurrent()).toBe(1);
    expect(progress.mock.calls.map(([value]) => value)).toEqual([{ processed: 1, total: 3 }, { processed: 2, total: 3 }, { processed: 3, total: 3 }]);
    expect(repository.activatePack).toHaveBeenCalledOnce();
    expect(repository.abortPack).not.toHaveBeenCalled();
  });

  test('skips files that cannot be decoded', async () => {
    const repository = fakeRepository();
    const imageCodec = codec();
    vi.mocked(imageCodec.decode).mockRejectedValueOnce(new Error('corrupt image'));
    await expect(importFanThemePack([jpeg('bad.jpg'), jpeg('good.jpg')], repository, { codec: imageCodec })).resolves.toMatchObject({ imported: 1, skipped: 1 });
  });

  test('rejects too many inputs before staging', async () => {
    const repository = fakeRepository();
    await expect(importFanThemePack(Array.from({ length: MAX_FAN_IMAGES + 1 }, (_, index) => jpeg(`${index}.jpg`)), repository, { codec: codec() })).rejects.toThrow();
    expect(repository.beginPack).not.toHaveBeenCalled();
  });

  test('aborts when optimized bytes exceed the pack limit', async () => {
    const repository = fakeRepository();
    await expect(importFanThemePack([jpeg('large.jpg')], repository, { codec: codec(MAX_FAN_PACK_BYTES + 1) })).rejects.toThrow();
    expect(repository.abortPack).toHaveBeenCalledOnce();
    expect(repository.activatePack).not.toHaveBeenCalled();
  });

  test('aborts on repository failure and preserves the previous active pack', async () => {
    const oldPack: FanThemePackMeta = { id: 'old', status: 'active', imageCount: 1, totalBytes: 4, createdAt: 'old', mimeType: 'image/webp' };
    const repository = fakeRepository(oldPack);
    vi.mocked(repository.addStagedImage).mockRejectedValue(new Error('storage failed'));
    await expect(importFanThemePack([jpeg('one.jpg')], repository, { codec: codec() })).rejects.toThrow('storage failed');
    expect(repository.abortPack).toHaveBeenCalledOnce();
    await expect(repository.getActivePack()).resolves.toBe(oldPack);
  });

  test('aborts when no static image imports successfully', async () => {
    const repository = fakeRepository();
    await expect(importFanThemePack([new File(['GIF89a'], 'moving.gif')], repository, { codec: codec() })).rejects.toThrow();
    expect(repository.abortPack).toHaveBeenCalledOnce();
  });
});
