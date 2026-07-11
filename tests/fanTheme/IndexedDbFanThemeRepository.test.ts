import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, test } from 'vitest';

import { IndexedDbFanThemeRepository } from '../../src/fanTheme/IndexedDbFanThemeRepository';

const now = '2026-07-11T00:00:00.000Z';

describe('IndexedDbFanThemeRepository', () => {
  let indexedDB: IDBFactory;
  let sequence: number;

  beforeEach(() => {
    indexedDB = new IDBFactory();
    sequence = 0;
  });

  function makeRepository() {
    sequence += 1;
    return new IndexedDbFanThemeRepository(indexedDB, `fan-theme-test-${sequence}`);
  }

  async function repositoryWithActivePack(id: string) {
    const repository = makeRepository();
    await repository.initialize();
    await repository.beginPack(id, now);
    await repository.addStagedImage({
      packId: id,
      index: 0,
      blob: new Blob(['a']),
      width: 10,
      height: 8,
    });
    await repository.activatePack({
      id,
      status: 'active',
      imageCount: 1,
      totalBytes: 1,
      createdAt: now,
      mimeType: 'image/webp',
    });
    return repository;
  }

  test('activates a complete staged pack and reads one indexed image', async () => {
    const repository = makeRepository();
    await repository.initialize();
    await repository.beginPack('new', now);
    await repository.addStagedImage({ packId: 'new', index: 0, blob: new Blob(['a']), width: 10, height: 8 });
    await repository.activatePack({ id: 'new', status: 'active', imageCount: 1, totalBytes: 1, createdAt: now, mimeType: 'image/webp' });
    expect(await repository.getActivePack()).toMatchObject({ id: 'new', imageCount: 1 });
    expect(await repository.getImage('new', 0)).toMatchObject({ width: 10, height: 8 });
  });

  test('keeps the old pack active when staging is aborted', async () => {
    const repository = await repositoryWithActivePack('old');
    await repository.beginPack('failed', now);
    await repository.addStagedImage({ packId: 'failed', index: 0, blob: new Blob(['x']), width: 1, height: 1 });
    await repository.abortPack('failed');
    expect((await repository.getActivePack())?.id).toBe('old');
    expect(await repository.getImage('failed', 0)).toBeNull();
  });

  test('preserves the active pack when an incoming pack reuses its id', async () => {
    const repository = await repositoryWithActivePack('same');

    await expect(repository.beginPack('same', now)).rejects.toThrow();
    await repository.abortPack('same');

    expect(await repository.getActivePack()).toMatchObject({ id: 'same', status: 'active' });
    expect(await repository.getImage('same', 0)).toMatchObject({ width: 10, height: 8 });
  });

  test('cleans incomplete staging packs during initialization', async () => {
    const repository = await repositoryWithActivePack('old');
    await repository.beginPack('orphan', now);
    await repository.addStagedImage({ packId: 'orphan', index: 0, blob: new Blob(['x']), width: 1, height: 1 });
    await repository.initialize();
    expect((await repository.getActivePack())?.id).toBe('old');
    expect(await repository.getImage('orphan', 0)).toBeNull();
  });

  test('preserves the old active pack when replacement validation fails', async () => {
    const repository = await repositoryWithActivePack('old');
    await repository.beginPack('incomplete', now);
    await repository.addStagedImage({ packId: 'incomplete', index: 0, blob: new Blob(['x']), width: 1, height: 1 });

    await expect(repository.activatePack({ id: 'incomplete', status: 'active', imageCount: 2, totalBytes: 2, createdAt: now, mimeType: 'image/webp' })).rejects.toThrow();

    expect((await repository.getActivePack())?.id).toBe('old');
    expect(await repository.getImage('old', 0)).not.toBeNull();
  });

  test('atomically replaces the old active pack and its images', async () => {
    const repository = await repositoryWithActivePack('old');
    await repository.beginPack('new', now);
    await repository.addStagedImage({ packId: 'new', index: 0, blob: new Blob(['b']), width: 2, height: 2 });
    await repository.activatePack({ id: 'new', status: 'active', imageCount: 1, totalBytes: 1, createdAt: now, mimeType: 'image/webp' });

    expect((await repository.getActivePack())?.id).toBe('new');
    expect(await repository.getImage('old', 0)).toBeNull();
  });

  test('deletes active pack data and disables the theme', async () => {
    const repository = await repositoryWithActivePack('old');
    await repository.setEnabled(true);
    await repository.deleteActivePack();

    expect(await repository.getActivePack()).toBeNull();
    expect(await repository.getImage('old', 0)).toBeNull();
    expect(await repository.getEnabled()).toBe(false);
  });
});
