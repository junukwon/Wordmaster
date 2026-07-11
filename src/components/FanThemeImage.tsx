import { useEffect, useState } from 'react';
import { useFanTheme } from '../fanTheme/useFanTheme';

export function FanThemeImage({ contextKey, className }: { contextKey: string; className?: string }) {
  const { status, packRevision, loadImageBlob } = useFanTheme();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    setObjectUrl(null);
    if (status.ready && status.enabled && status.imageCount > 0) {
      void loadImageBlob(contextKey).then(blob => {
        if (!active || !blob) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      }).catch(() => undefined);
    }
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [contextKey, loadImageBlob, packRevision, status.ready, status.enabled, status.imageCount]);

  if (!objectUrl) return null;
  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden' }}>
      <img data-testid="fan-theme-backdrop" src={objectUrl} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(18px)', transform: 'scale(1.08)' }} />
      <img data-testid="fan-theme-foreground" src={objectUrl} alt="" aria-hidden="true" style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
}
