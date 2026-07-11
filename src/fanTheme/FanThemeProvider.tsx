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
  const generationRef = useRef(0);
  const operationRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  statusRef.current = status;

  useEffect(() => {
    const generation = ++generationRef.current;
    operationRef.current += 1;
    queueRef.current = Promise.resolve();
    packRef.current = null;
    setStatus(initialStatus);
    void (async () => {
      try {
        await repository.initialize();
        const [pack, enabled] = await Promise.all([repository.getActivePack(), repository.getEnabled()]);
        if (generationRef.current !== generation) return;
        packRef.current = pack;
        setStatus({ ...initialStatus, ready: true, enabled: enabled && pack !== null, imageCount: pack?.imageCount ?? 0, totalBytes: pack?.totalBytes ?? 0 });
      } catch {
        if (generationRef.current === generation) setStatus({ ...initialStatus, ready: true, notice: '팬 테마를 불러오지 못했습니다.' });
      }
    })();
    return () => { if (generationRef.current === generation) generationRef.current += 1; };
  }, [repository]);

  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const result = queueRef.current.then(task, task);
    queueRef.current = result.then(() => undefined, () => undefined);
    return result;
  }, []);

  const importFiles = useCallback((files: readonly File[]) => {
    const generation = generationRef.current;
    const operation = ++operationRef.current;
    const previous = statusRef.current;
    setStatus({ ...previous, importing: true, processed: 0, total: files.length, notice: null });
    return enqueue(async () => {
      try {
        const result = await importer(files, repository, {
          onProgress: progress => {
            if (generationRef.current === generation && operationRef.current === operation) {
              setStatus(current => ({ ...current, importing: true, ...progress }));
            }
          },
        });
        if (generationRef.current !== generation) return;
        const pack = await repository.getActivePack();
        if (generationRef.current !== generation) return;
        await repository.setEnabled(true);
        if (generationRef.current !== generation) return;
        packRef.current = pack;
        setStatus(current => ({
          ...current,
          ready: true,
          enabled: pack !== null,
          imageCount: pack?.imageCount ?? 0,
          totalBytes: pack?.totalBytes ?? result.totalBytes,
          ...(operationRef.current === operation ? {
            importing: false,
            processed: files.length,
            total: files.length,
            notice: `${result.imported}개를 가져왔고 ${result.skipped}개를 건너뛰었습니다.`,
          } : {}),
        }));
      } catch {
        if (generationRef.current === generation && operationRef.current === operation) {
          setStatus(current => ({ ...current, importing: false, notice: '팬 테마를 가져오지 못했습니다.' }));
        }
      }
    });
  }, [enqueue, importer, repository]);

  const setEnabled = useCallback((enabled: boolean) => {
    const generation = generationRef.current;
    const operation = ++operationRef.current;
    return enqueue(async () => {
      await repository.setEnabled(enabled);
      if (generationRef.current === generation && operationRef.current === operation) {
        const pack = packRef.current;
        setStatus(current => ({
          ...current,
          enabled: enabled && pack !== null,
          imageCount: pack?.imageCount ?? 0,
          totalBytes: pack?.totalBytes ?? 0,
          importing: false,
        }));
      }
    });
  }, [enqueue, repository]);

  const deletePack = useCallback(() => {
    const generation = generationRef.current;
    const operation = ++operationRef.current;
    return enqueue(async () => {
      await repository.deleteActivePack();
      if (generationRef.current !== generation || operationRef.current !== operation) return;
      packRef.current = null;
      setStatus(current => ({ ...current, enabled: false, imageCount: 0, totalBytes: 0, importing: false, notice: null }));
    });
  }, [enqueue, repository]);

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
