import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { FanThemeProvider } from '../../src/fanTheme/FanThemeProvider';
import { useFanTheme } from '../../src/fanTheme/useFanTheme';
import type { FanThemeImportResult, FanThemePackMeta, FanThemeRepository } from '../../src/fanTheme/types';

const pack: FanThemePackMeta = { id: 'active', status: 'active', imageCount: 7, totalBytes: 99, createdAt: 'now', mimeType: 'image/webp' };

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
    expect(repo.getImage).toHaveBeenCalledWith('active', expect.any(Number));
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
});
