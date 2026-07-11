import { describe, expect, test, vi } from 'vitest';
import { detectStaticFanImageFormat } from '../../src/fanTheme/imageFormat';
import { optimizeFanImage, type FanImageCodec } from '../../src/fanTheme/imageOptimizer';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (value: string) => new TextEncoder().encode(value);

describe('static fan image format detection', () => {
  test.each([
    ['jpeg', new File([bytes(0xff, 0xd8, 0xff, 0xdb)], 'photo.jpg'), 'image/jpeg'],
    ['png', new File([bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)], 'photo.png'), 'image/png'],
    ['static WebP', new File([ascii('RIFF'), bytes(0, 0, 0, 0), ascii('WEBPVP8 ')], 'photo.webp'), 'image/webp'],
  ])('accepts %s by file signature', async (_label, file, expected) => {
    await expect(detectStaticFanImageFormat(file)).resolves.toBe(expected);
  });

  test.each([
    ['GIF', new File([ascii('GIF89a')], 'moving.gif')],
    ['animated PNG', new File([bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), ascii('acTL')], 'moving.png')],
    ['animated WebP', new File([ascii('RIFF'), bytes(0, 0, 0, 0), ascii('WEBP'), ascii('ANIM'), bytes(0, 0, 0, 0)], 'moving.webp')],
  ])('rejects %s', async (_label, file) => {
    await expect(detectStaticFanImageFormat(file)).rejects.toThrow();
  });
});

describe('fan image optimizer', () => {
  function codec(width: number, height: number, webp: Blob | null = new Blob(['webp'], { type: 'image/webp' })) {
    const dispose = vi.fn();
    const value: FanImageCodec = {
      decode: vi.fn(async () => ({ source: {}, width, height, dispose })),
      encode: vi.fn(async (_source, _width, _height, mime) => mime === 'image/webp' ? webp : new Blob(['jpg'], { type: mime })),
    };
    return { value, dispose };
  }

  test.each([[1440, 720, 720, 360], [300, 200, 300, 200]])('scales %sx%s to %sx%s', async (width, height, targetWidth, targetHeight) => {
    const { value, dispose } = codec(width, height);
    const optimized = await optimizeFanImage(new File([bytes(0xff, 0xd8, 0xff)], 'photo.jpg'), value);
    expect(optimized).toMatchObject({ width: targetWidth, height: targetHeight, mimeType: 'image/webp' });
    expect(value.encode).toHaveBeenCalledWith(expect.anything(), targetWidth, targetHeight, 'image/webp', 0.70);
    expect(dispose).toHaveBeenCalledOnce();
  });

  test('falls back to JPEG at quality 0.72 when WebP encoding returns null', async () => {
    const { value } = codec(100, 50, null);
    const optimized = await optimizeFanImage(new File([bytes(0xff, 0xd8, 0xff)], 'photo.jpg'), value);
    expect(optimized.mimeType).toBe('image/jpeg');
    expect(value.encode).toHaveBeenLastCalledWith(expect.anything(), 100, 50, 'image/jpeg', 0.72);
  });

  test('disposes a decoded image when encoding fails', async () => {
    const { value, dispose } = codec(100, 50);
    vi.mocked(value.encode).mockRejectedValue(new Error('encode failed'));
    await expect(optimizeFanImage(new File([bytes(0xff, 0xd8, 0xff)], 'photo.jpg'), value)).rejects.toThrow('encode failed');
    expect(dispose).toHaveBeenCalledOnce();
  });
});
