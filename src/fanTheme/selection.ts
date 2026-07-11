export function selectFanImageIndex(contextKey: string, imageCount: number): number | null {
  if (imageCount <= 0) {
    return null;
  }

  let hash = 0x811c9dc5;
  for (let index = 0; index < contextKey.length; index += 1) {
    hash ^= contextKey.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0) % imageCount;
}

export function localDateThemeKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `home:${year}-${month}-${day}`;
}
