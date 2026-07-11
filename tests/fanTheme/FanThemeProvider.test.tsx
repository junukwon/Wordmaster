import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { FanThemeProvider } from '../../src/fanTheme/FanThemeProvider';
import { selectFanImageIndex } from '../../src/fanTheme/selection';
import { useFanTheme } from '../../src/fanTheme/useFanTheme';
import type { FanThemeImportResult, FanThemePackMeta, FanThemeRepository } from '../../src/fanTheme/types';

const pack: FanThemePackMeta = { id: 'active', status: 'active', imageCount: 7, totalBytes: 99, createdAt: 'now', mimeType: 'image/webp' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function repository(active: FanThemePackMeta | null = pack, enabled = true): FanThemeRepository {
  return {
    initialize: vi.fn(async () => undefined), beginPack: vi.fn(), addStagedImage: vi.fn(), activatePack: vi.fn(), abortPack: vi.fn(),
    getActivePack: vi.fn(async () => active), getImage: vi.fn(async (_id, index) => ({ packId: 'active', index, blob: new Blob([`${index}`]), width: 1, height: 1 })),
    getEnabled: vi.fn(async () => enabled), setEnabled: vi.fn(async () => undefined), deleteActivePack: vi.fn(async () => undefined),
  };
}

let api: ReturnType<typeof useFanTheme>;
function Probe() {
  api = useFanTheme();
  return <output data-testid="status">{JSON.stringify(api.status)}</output>;
}

describe('FanThemeProvider', () => {
  test('initializes storage and exposes active metadata without blocking its children', async () => {
    const repo = repository();
    render(<FanThemeProvider repository={repo}><Probe /></FanThemeProvider>);
    expect(screen.getByTestId('status')).toHaveTextContent('"ready":false');
    await waitFor(() => expect(api.status).toMatchObject({ ready: true, enabled: true, imageCount: 7, totalBytes: 99 }));
    expect(repo.initialize).toHaveBeenCalledBefore(vi.mocked(repo.getActivePack));
  });

  test('loads only the deterministically selected image record', async () => {
    const repo = repository();
    render(<FanThemeProvider repository={repo}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));
    const blob = await api.loadImageBlob('home:2026-07-11');
    expect(blob).toBeInstanceOf(Blob);
    expect(repo.getImage).toHaveBeenCalledTimes(1);
    expect(repo.getImage).toHaveBeenCalledWith('active', selectFanImageIndex('home:2026-07-11', pack.imageCount));
  });

  test('rejects an image read that finishes after the active pack is replaced', async () => {
    const repo = repository();
    const staleRead = deferred<Awaited<ReturnType<FanThemeRepository['getImage']>>>();
    vi.mocked(repo.getImage).mockImplementationOnce(async () => staleRead.promise);
    const replacement = { ...pack, id: 'replacement', imageCount: pack.imageCount };
    vi.mocked(repo.getActivePack).mockResolvedValueOnce(pack).mockResolvedValue(replacement);
    const importer = vi.fn(async () => ({ imported: replacement.imageCount, skipped: 0, totalBytes: replacement.totalBytes }));
    render(<FanThemeProvider repository={repo} importer={importer}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));
    const read = api.loadImageBlob('home:key');
    await act(() => api.importFiles([new File(['x'], 'x.jpg')]));
    staleRead.resolve({ packId: pack.id, index: 0, blob: new Blob(['stale']), width: 1, height: 1 });
    await expect(read).resolves.toBeNull();
    expect(api.packRevision).toBe('replacement');
  });

  test('reports import progress then refreshes metadata and enables the theme', async () => {
    const repo = repository(null, false);
    const importedPack = { ...pack, imageCount: 2, totalBytes: 20 };
    vi.mocked(repo.getActivePack).mockResolvedValueOnce(null).mockResolvedValue(importedPack);
    let finish!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    const importer = vi.fn(async (_files, _repo, options): Promise<FanThemeImportResult> => {
      options?.onProgress?.({ processed: 1, total: 2 });
      await gate;
      return { imported: 2, skipped: 1, totalBytes: 20 };
    });
    render(<FanThemeProvider repository={repo} importer={importer}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));
    let importPromise!: Promise<void>;
    act(() => { importPromise = api.importFiles([new File(['x'], 'x.jpg')]); });
    await waitFor(() => expect(api.status).toMatchObject({ importing: true, processed: 1, total: 2 }));
    finish();
    await act(() => importPromise);
    expect(repo.setEnabled).toHaveBeenCalledWith(true);
    expect(api.status).toMatchObject({ ready: true, enabled: true, imageCount: 2, totalBytes: 20, importing: false });
    expect(api.status.notice).toContain('2');
    expect(api.status.notice).toContain('1');
  });

  test('preserves prior ready state and adds a Korean notice when import fails', async () => {
    const repo = repository();
    const importer = vi.fn(async () => { throw new Error('nope'); });
    render(<FanThemeProvider repository={repo} importer={importer}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));
    await act(() => api.importFiles([]));
    expect(api.status).toMatchObject({ ready: true, enabled: true, imageCount: 7, totalBytes: 99, importing: false });
    expect(api.status.notice).toMatch(/[가-힣]/);
  });

  test('persists toggles and deletes only the active fan pack', async () => {
    const repo = repository();
    render(<FanThemeProvider repository={repo}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));
    await act(() => api.setEnabled(false));
    expect(repo.setEnabled).toHaveBeenCalledWith(false);
    await act(() => api.deletePack());
    expect(repo.deleteActivePack).toHaveBeenCalledOnce();
    expect(api.status).toMatchObject({ enabled: false, imageCount: 0, totalBytes: 0 });
  });

  test('preserves confirmed enabled state and reports a toggle storage failure without rejecting', async () => {
    const repo = repository();
    vi.mocked(repo.setEnabled).mockRejectedValueOnce(new Error('storage closed'));
    render(<FanThemeProvider repository={repo}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));

    await expect(act(() => api.setEnabled(false))).resolves.toBeUndefined();
    expect(api.status).toMatchObject({ enabled: true, imageCount: 7, totalBytes: 99 });
    expect(api.status.notice).toMatch(/[가-힣]/);
  });

  test('preserves active pack and reports a delete storage failure without rejecting', async () => {
    const repo = repository();
    vi.mocked(repo.deleteActivePack).mockRejectedValueOnce(new Error('storage closed'));
    render(<FanThemeProvider repository={repo}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));

    await expect(act(() => api.deletePack())).resolves.toBeUndefined();
    expect(api.status).toMatchObject({ enabled: true, imageCount: 7, totalBytes: 99 });
    expect(api.status.notice).toMatch(/[가-힣]/);
  });

  test('ignores import progress and completion from a replaced repository', async () => {
    const repoA = repository();
    const repoBPack = { ...pack, id: 'repo-b', imageCount: 3, totalBytes: 30 };
    const repoB = repository(repoBPack, true);
    const importGate = deferred<FanThemeImportResult>();
    let progress: ((value: { processed: number; total: number }) => void) | undefined;
    const importer = vi.fn(async (_files, _repo, options) => {
      progress = options?.onProgress;
      return importGate.promise;
    });
    const view = render(<FanThemeProvider repository={repoA} importer={importer}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));
    act(() => { void api.importFiles([new File(['a'], 'a.jpg')]); });
    view.rerender(<FanThemeProvider repository={repoB} importer={importer}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status).toMatchObject({ ready: true, imageCount: 3, totalBytes: 30 }));
    act(() => progress?.({ processed: 1, total: 9 }));
    expect(api.status).toMatchObject({ imageCount: 3, importing: false, processed: 0 });
    importGate.resolve({ imported: 9, skipped: 0, totalBytes: 90 });
    await act(async () => { await importGate.promise; });
    expect(api.status).toMatchObject({ ready: true, imageCount: 3, totalBytes: 30, enabled: true });
    await api.loadImageBlob('x');
    expect(repoB.getImage).toHaveBeenCalledWith('repo-b', selectFanImageIndex('x', 3));
  });

  test('applies delete after an earlier pending import', async () => {
    const repo = repository();
    const gate = deferred<FanThemeImportResult>();
    const importer = vi.fn(async () => gate.promise);
    render(<FanThemeProvider repository={repo} importer={importer}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));
    act(() => { void api.importFiles([new File(['a'], 'a.jpg')]); void api.deletePack(); });
    expect(repo.deleteActivePack).not.toHaveBeenCalled();
    gate.resolve({ imported: 1, skipped: 0, totalBytes: 10 });
    await waitFor(() => expect(repo.deleteActivePack).toHaveBeenCalledOnce());
    expect(repo.setEnabled).toHaveBeenCalledBefore(vi.mocked(repo.deleteActivePack));
    expect(api.status).toMatchObject({ enabled: false, imageCount: 0, totalBytes: 0 });
  });

  test('serializes rapid enable toggles in invocation order', async () => {
    const repo = repository();
    const first = deferred<void>();
    vi.mocked(repo.setEnabled).mockImplementationOnce(async () => first.promise).mockResolvedValueOnce(undefined);
    render(<FanThemeProvider repository={repo}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));
    act(() => { void api.setEnabled(false); void api.setEnabled(true); });
    await waitFor(() => expect(repo.setEnabled).toHaveBeenCalledTimes(1));
    first.resolve();
    await waitFor(() => expect(repo.setEnabled).toHaveBeenCalledTimes(2));
    expect(vi.mocked(repo.setEnabled).mock.calls.map(([value]) => value)).toEqual([false, true]);
    await waitFor(() => expect(api.status.enabled).toBe(true));
  });

  test('serializes overlapping imports so the later invocation remains authoritative', async () => {
    const repo = repository();
    const first = deferred<FanThemeImportResult>();
    const second = deferred<FanThemeImportResult>();
    const firstPack = { ...pack, id: 'first', imageCount: 1, totalBytes: 10 };
    const secondPack = { ...pack, id: 'second', imageCount: 2, totalBytes: 20 };
    vi.mocked(repo.getActivePack).mockResolvedValueOnce(pack).mockResolvedValueOnce(firstPack).mockResolvedValueOnce(secondPack);
    const importer = vi.fn()
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise);
    render(<FanThemeProvider repository={repo} importer={importer}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));
    act(() => { void api.importFiles([new File(['a'], 'a.jpg')]); void api.importFiles([new File(['b'], 'b.jpg')]); });
    await waitFor(() => expect(importer).toHaveBeenCalledTimes(1));
    first.resolve({ imported: 1, skipped: 0, totalBytes: 10 });
    await waitFor(() => expect(importer).toHaveBeenCalledTimes(2));
    second.resolve({ imported: 2, skipped: 0, totalBytes: 20 });
    await waitFor(() => expect(api.status).toMatchObject({ imageCount: 2, totalBytes: 20, importing: false }));
  });

  test('reconciles imported pack metadata before a queued disable and later re-enable', async () => {
    const repo = repository();
    const importedPack = { ...pack, id: 'new-pack', imageCount: 4, totalBytes: 40 };
    vi.mocked(repo.getActivePack).mockResolvedValueOnce(pack).mockResolvedValue(importedPack);
    const gate = deferred<FanThemeImportResult>();
    const importer = vi.fn(async () => gate.promise);
    render(<FanThemeProvider repository={repo} importer={importer}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));
    act(() => { void api.importFiles([new File(['a'], 'a.jpg')]); void api.setEnabled(false); });
    gate.resolve({ imported: 4, skipped: 0, totalBytes: 40 });
    await waitFor(() => expect(api.status).toMatchObject({ enabled: false, imageCount: 4, totalBytes: 40, importing: false }));
    await act(() => api.setEnabled(true));
    await api.loadImageBlob('re-enabled');
    expect(repo.getImage).toHaveBeenCalledWith('new-pack', selectFanImageIndex('re-enabled', 4));
  });

  test('preserves successful import A when queued import B fails', async () => {
    const repo = repository();
    const importedPack = { ...pack, id: 'pack-a', imageCount: 5, totalBytes: 50 };
    vi.mocked(repo.getActivePack).mockResolvedValueOnce(pack).mockResolvedValue(importedPack);
    const first = deferred<FanThemeImportResult>();
    const second = deferred<FanThemeImportResult>();
    const importer = vi.fn()
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise);
    render(<FanThemeProvider repository={repo} importer={importer}><Probe /></FanThemeProvider>);
    await waitFor(() => expect(api.status.ready).toBe(true));
    act(() => { void api.importFiles([new File(['a'], 'a.jpg')]); void api.importFiles([new File(['b'], 'b.jpg')]); });
    first.resolve({ imported: 5, skipped: 0, totalBytes: 50 });
    await waitFor(() => expect(importer).toHaveBeenCalledTimes(2));
    second.reject(new Error('B failed'));
    await waitFor(() => expect(api.status.importing).toBe(false));
    expect(api.status).toMatchObject({ enabled: true, imageCount: 5, totalBytes: 50 });
    expect(api.status.notice).toMatch(/[가-힣]/);
    await api.loadImageBlob('after-b');
    expect(repo.getImage).toHaveBeenCalledWith('pack-a', selectFanImageIndex('after-b', 5));
  });
});
