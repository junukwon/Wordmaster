import { detectStaticFanImageFormat } from './imageFormat';
import { FanImageDecodeError, optimizeFanImage, type FanImageCodec } from './imageOptimizer';
import type { FanThemeImportResult, FanThemePackMeta, FanThemeRepository } from './types';

export const MAX_FAN_IMAGES = 150;
export const MAX_FAN_PACK_BYTES = 30 * 1024 * 1024;

export type FanThemeImportOptions = {
  codec?: FanImageCodec;
  onProgress?: (progress: { processed: number; total: number }) => void;
  now?: () => Date;
  randomUUID?: () => string;
};

const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export async function importFanThemePack(
  files: readonly File[],
  repository: FanThemeRepository,
  options: FanThemeImportOptions = {},
): Promise<FanThemeImportResult> {
  if (files.length > MAX_FAN_IMAGES) throw new Error(`Fan theme packs support at most ${MAX_FAN_IMAGES} images`);

  const packId = `pack-${(options.randomUUID ?? (() => crypto.randomUUID()))()}`;
  const createdAt = (options.now ?? (() => new Date()))().toISOString();
  let imported = 0;
  let skipped = 0;
  let totalBytes = 0;
  const mimeTypes = new Set<'image/webp' | 'image/jpeg'>();

  try {
    await repository.beginPack(packId, createdAt);
    for (let processed = 1; processed <= files.length; processed += 1) {
      const file = files[processed - 1];
      try {
        await detectStaticFanImageFormat(file);
        const optimized = await optimizeFanImage(file, options.codec);
        const prospectiveBytes = totalBytes + optimized.blob.size;
        if (prospectiveBytes > MAX_FAN_PACK_BYTES) throw new Error(`Fan theme pack exceeds ${MAX_FAN_PACK_BYTES} bytes`);
        await repository.addStagedImage({ packId, index: imported, blob: optimized.blob, width: optimized.width, height: optimized.height });
        imported += 1;
        totalBytes = prospectiveBytes;
        mimeTypes.add(optimized.mimeType);
      } catch (error) {
        if (error instanceof FanImageDecodeError || (error instanceof Error && /Unsupported|Animated|Corrupt/.test(error.message))) {
          skipped += 1;
        } else {
          throw error;
        }
      } finally {
        options.onProgress?.({ processed, total: files.length });
        await yieldToBrowser();
      }
    }

    if (imported === 0) throw new Error('No supported static images were imported');
    const mimeType: FanThemePackMeta['mimeType'] = mimeTypes.size === 1 ? [...mimeTypes][0] : 'mixed';
    await repository.activatePack({ id: packId, status: 'active', imageCount: imported, totalBytes, createdAt, mimeType });
    return { imported, skipped, totalBytes };
  } catch (error) {
    try {
      await repository.abortPack(packId);
    } catch {
      // Preserve the original import failure while still attempting rollback.
    }
    throw error;
  }
}
