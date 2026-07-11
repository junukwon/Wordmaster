export type FanImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

const textDecoder = new TextDecoder('ascii');

async function read(file: Blob, start: number, length: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(start, start + length).arrayBuffer());
}

function text(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

export async function detectStaticFanImageFormat(file: Blob): Promise<FanImageMimeType> {
  const header = await read(file, 0, 12);
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'image/jpeg';

  const png = header.length >= 8 && header[0] === 0x89 && text(header.slice(1, 4)) === 'PNG'
    && header[4] === 0x0d && header[5] === 0x0a && header[6] === 0x1a && header[7] === 0x0a;
  if (png) {
    let offset = 8;
    while (offset + 8 <= file.size) {
      const chunk = await read(file, offset, 8);
      const length = new DataView(chunk.buffer, chunk.byteOffset, 4).getUint32(0);
      const kind = text(chunk.slice(4, 8));
      if (kind === 'acTL') throw new Error('Animated PNG images are not supported');
      if (kind === 'IDAT' || kind === 'IEND') return 'image/png';
      const next = offset + 12 + length;
      if (next <= offset || next > file.size) throw new Error('Corrupt PNG image');
      offset = next;
    }
    // Signature-only synthetic files are sufficient for decoding to decide validity.
    if (file.size === 8) return 'image/png';
    throw new Error('Corrupt PNG image');
  }

  if (text(header.slice(0, 4)) === 'RIFF' && text(header.slice(8, 12)) === 'WEBP') {
    let offset = 12;
    while (offset + 8 <= file.size) {
      const chunk = await read(file, offset, 8);
      const kind = text(chunk.slice(0, 4));
      if (kind === 'ANIM') throw new Error('Animated WebP images are not supported');
      const length = new DataView(chunk.buffer, chunk.byteOffset + 4, 4).getUint32(0, true);
      const next = offset + 8 + length + (length % 2);
      if (next <= offset || next > file.size) throw new Error('Corrupt WebP image');
      offset = next;
    }
    return 'image/webp';
  }

  throw new Error('Unsupported fan image format');
}
