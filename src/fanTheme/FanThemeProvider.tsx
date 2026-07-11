import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { importFanThemePack, type FanThemeImportOptions } from './importFanThemePack';
import { selectFanImageIndex } from './selection';
import type { FanThemeImportResult, FanThemePackMeta, FanThemeRepository, FanThemeStatus } from './types';
import { FanThemeContext } from './useFanTheme';

type Importer = (files: readonly File[], repository: FanThemeRepository, options?: FanThemeImportOptions) => Promise<FanThemeImportResult>;

const initialStatus: FanThemeStatus = {
  ready: false, enabled: false, imageCount: 0, totalBytes: 0,
  importing: false, processed: 0, total: 0, notice: null,
};

export function FanThemeProvider({ repository, importer = importFanThemePack, children }: PropsWithChildren<{ repository: FanThemeRepository; importer?: Importer }>) {
  const [status, setStatus] = useState(initialStatus);
  const statusRef = useRef(status);
  const packRef = useRef<FanThemePackMeta | null>(null);
  const mountedRef = useRef(true);
  statusRef.current = status;

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    void (async () => {
      try {
        await repository.initialize();
        const [pack, enabled] = await Promise.all([repository.getActivePack(), repository.getEnabled()]);
        if (!active) return;
        packRef.current = pack;
        setStatus({ ...initialStatus, ready: true, enabled: enabled && pack !== null, imageCount: pack?.imageCount ?? 0, totalBytes: pack?.totalBytes ?? 0 });
      } catch {
        if (active) setStatus({ ...initialStatus, ready: true, notice: '팬 테마를 불러오지 못했습니다.' });
      }
    })();
    return () => { active = false; mountedRef.current = false; };
  }, [repository]);

  const importFiles = useCallback(async (files: readonly File[]) => {
    const previous = statusRef.current;
    setStatus({ ...previous, importing: true, processed: 0, total: files.length, notice: null });
    try {
      const result = await importer(files, repository, {
        onProgress: progress => {
          if (mountedRef.current) setStatus(current => ({ ...current, importing: true, ...progress }));
        },
      });
      const pack = await repository.getActivePack();
      await repository.setEnabled(true);
      if (!mountedRef.current) return;
      packRef.current = pack;
      setStatus({
        ready: true, enabled: pack !== null, imageCount: pack?.imageCount ?? 0, totalBytes: pack?.totalBytes ?? result.totalBytes,
        importing: false, processed: files.length, total: files.length,
        notice: `${result.imported}개를 가져왔고 ${result.skipped}개를 건너뛰었습니다.`,
      });
    } catch {
      if (mountedRef.current) setStatus({ ...previous, importing: false, notice: '팬 테마를 가져오지 못했습니다.' });
    }
  }, [importer, repository]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    await repository.setEnabled(enabled);
    if (mountedRef.current) setStatus(current => ({ ...current, enabled: enabled && packRef.current !== null }));
  }, [repository]);

  const deletePack = useCallback(async () => {
    await repository.deleteActivePack();
    if (!mountedRef.current) return;
    packRef.current = null;
    setStatus(current => ({ ...current, enabled: false, imageCount: 0, totalBytes: 0, notice: null }));
  }, [repository]);

  const loadImageBlob = useCallback(async (contextKey: string) => {
    const current = statusRef.current;
    const pack = packRef.current;
    if (!current.ready || !current.enabled || !pack) return null;
    const index = selectFanImageIndex(contextKey, pack.imageCount);
    if (index === null) return null;
    return (await repository.getImage(pack.id, index))?.blob ?? null;
  }, [repository]);

  const value = useMemo(() => ({ status, importFiles, setEnabled, deletePack, loadImageBlob }), [status, importFiles, setEnabled, deletePack, loadImageBlob]);
  return <FanThemeContext.Provider value={value}>{children}</FanThemeContext.Provider>;
}
