export const MAX_FAN_EDGE = 720;

export type DecodedFanImage = {
  source: CanvasImageSource | object;
  width: number;
  height: number;
  dispose(): void;
};

export interface FanImageCodec {
  decode(file: File): Promise<DecodedFanImage>;
  encode(source: CanvasImageSource | object, width: number, height: number, mime: 'image/webp' | 'image/jpeg', quality: number): Promise<Blob | null>;
}

export type OptimizedFanImage = {
  blob: Blob;
  width: number;
  height: number;
  mimeType: 'image/webp' | 'image/jpeg';
};

export const browserFanImageCodec: FanImageCodec = {
  async decode(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
  },
  async encode(source, width, height, mime, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D context is unavailable');
      context.drawImage(source as CanvasImageSource, 0, 0, width, height);
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  },
};

export class FanImageDecodeError extends Error {
  constructor(cause: unknown) {
    super('Image decoding failed', { cause });
    this.name = 'FanImageDecodeError';
  }
}

export async function optimizeFanImage(file: File, codec: FanImageCodec = browserFanImageCodec): Promise<OptimizedFanImage> {
  let decoded: DecodedFanImage;
  try {
    decoded = await codec.decode(file);
  } catch (error) {
    throw new FanImageDecodeError(error);
  }
  try {
    const scale = Math.min(1, MAX_FAN_EDGE / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    let blob = await codec.encode(decoded.source, width, height, 'image/webp', 0.70);
    let mimeType: OptimizedFanImage['mimeType'] = 'image/webp';
    if (blob?.type !== 'image/webp') {
      blob = await codec.encode(decoded.source, width, height, 'image/jpeg', 0.72);
      mimeType = 'image/jpeg';
    }
    if (!blob || blob.type !== mimeType) throw new Error('Image encoding failed');
    return { blob, width, height, mimeType };
  } finally {
    decoded.dispose();
  }
}
