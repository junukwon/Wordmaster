import type {
  FanThemeImageRecord,
  FanThemePackMeta,
  FanThemeRepository,
} from './types';

const PACKS_STORE = 'packs';
const IMAGES_STORE = 'images';
const SETTINGS_STORE = 'settings';
const ACTIVE_PACK_KEY = 'activePackId';
const ENABLED_KEY = 'enabled';

type SettingRecord = { key: string; value: unknown };

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

function deleteImagesForPack(store: IDBObjectStore, packId: string): void {
  const request = store.index('packId').openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    if ((cursor.value as FanThemeImageRecord).packId === packId) cursor.delete();
    cursor.continue();
  };
}

export class IndexedDbFanThemeRepository implements FanThemeRepository {
  constructor(
    private readonly indexedDBFactory: IDBFactory = window.indexedDB,
    private readonly databaseName = 'wordmaster-fan-theme-v1',
  ) {}

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.indexedDBFactory.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        database.createObjectStore(PACKS_STORE, { keyPath: 'id' });
        const images = database.createObjectStore(IMAGES_STORE, { keyPath: ['packId', 'index'] });
        images.createIndex('packId', 'packId');
        database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async initialize(): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction([PACKS_STORE, IMAGES_STORE], 'readwrite');
    const packs = transaction.objectStore(PACKS_STORE);
    const images = transaction.objectStore(IMAGES_STORE);
    const request = packs.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const pack = cursor.value as FanThemePackMeta;
      if (pack.status === 'staging') {
        cursor.delete();
        deleteImagesForPack(images, pack.id);
      }
      cursor.continue();
    };
    await transactionDone(transaction);
    database.close();
  }

  async beginPack(packId: string, createdAt: string): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(PACKS_STORE, 'readwrite');
    transaction.objectStore(PACKS_STORE).put({
      id: packId,
      status: 'staging',
      imageCount: 0,
      totalBytes: 0,
      createdAt,
      mimeType: 'mixed',
    } satisfies FanThemePackMeta);
    await transactionDone(transaction);
    database.close();
  }

  async addStagedImage(record: FanThemeImageRecord): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction([PACKS_STORE, IMAGES_STORE], 'readwrite');
    const packRequest = transaction.objectStore(PACKS_STORE).get(record.packId);
    packRequest.onsuccess = () => {
      const pack = packRequest.result as FanThemePackMeta | undefined;
      if (!pack || pack.status !== 'staging') {
        transaction.abort();
        return;
      }
      const images = transaction.objectStore(IMAGES_STORE);
      const previousRequest = images.get([record.packId, record.index]);
      previousRequest.onsuccess = () => {
        const previous = previousRequest.result as FanThemeImageRecord | undefined;
        images.put(record);
        transaction.objectStore(PACKS_STORE).put({
          ...pack,
          imageCount: pack.imageCount + (previous ? 0 : 1),
          totalBytes: pack.totalBytes - (previous?.blob.size ?? 0) + record.blob.size,
        } satisfies FanThemePackMeta);
      };
    };
    await transactionDone(transaction);
    database.close();
  }

  async activatePack(meta: FanThemePackMeta): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction([PACKS_STORE, IMAGES_STORE, SETTINGS_STORE], 'readwrite');
    const packs = transaction.objectStore(PACKS_STORE);
    const images = transaction.objectStore(IMAGES_STORE);
    const settings = transaction.objectStore(SETTINGS_STORE);
    let validationError: Error | null = null;

    const stagedRequest = packs.get(meta.id);
    stagedRequest.onsuccess = () => {
      const staged = stagedRequest.result as FanThemePackMeta | undefined;
      if (!staged || staged.status !== 'staging') {
        validationError = new Error('Pack must be staged before activation');
        transaction.abort();
        return;
      }

      let imageCount = 0;
      const imageRequest = images.index('packId').openCursor();
      imageRequest.onsuccess = () => {
        const cursor = imageRequest.result;
        if (cursor) {
          const image = cursor.value as FanThemeImageRecord;
          if (image.packId === meta.id) {
            imageCount += 1;
          }
          cursor.continue();
          return;
        }

        if (meta.status !== 'active' || imageCount !== meta.imageCount || staged.totalBytes !== meta.totalBytes) {
          validationError = new Error('Staged image data does not match pack metadata');
          transaction.abort();
          return;
        }

        const activeRequest = settings.get(ACTIVE_PACK_KEY);
        activeRequest.onsuccess = () => {
          const previousId = (activeRequest.result as SettingRecord | undefined)?.value;
          packs.put(meta);
          settings.put({ key: ACTIVE_PACK_KEY, value: meta.id } satisfies SettingRecord);
          if (typeof previousId === 'string' && previousId !== meta.id) {
            packs.delete(previousId);
            deleteImagesForPack(images, previousId);
          }
        };
      };
    };

    try {
      await transactionDone(transaction);
    } catch (error) {
      throw validationError ?? error;
    } finally {
      database.close();
    }
  }

  async abortPack(packId: string): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction([PACKS_STORE, IMAGES_STORE], 'readwrite');
    transaction.objectStore(PACKS_STORE).delete(packId);
    deleteImagesForPack(transaction.objectStore(IMAGES_STORE), packId);
    await transactionDone(transaction);
    database.close();
  }

  async getActivePack(): Promise<FanThemePackMeta | null> {
    const database = await this.openDatabase();
    const transaction = database.transaction([PACKS_STORE, SETTINGS_STORE]);
    const active = await requestResult(transaction.objectStore(SETTINGS_STORE).get(ACTIVE_PACK_KEY)) as SettingRecord | undefined;
    const pack = typeof active?.value === 'string'
      ? await requestResult(transaction.objectStore(PACKS_STORE).get(active.value)) as FanThemePackMeta | undefined
      : undefined;
    await transactionDone(transaction);
    database.close();
    return pack ?? null;
  }

  async getImage(packId: string, index: number): Promise<FanThemeImageRecord | null> {
    const database = await this.openDatabase();
    const transaction = database.transaction(IMAGES_STORE);
    const image = await requestResult(transaction.objectStore(IMAGES_STORE).get([packId, index])) as FanThemeImageRecord | undefined;
    await transactionDone(transaction);
    database.close();
    return image ?? null;
  }

  async getEnabled(): Promise<boolean> {
    const database = await this.openDatabase();
    const transaction = database.transaction(SETTINGS_STORE);
    const setting = await requestResult(transaction.objectStore(SETTINGS_STORE).get(ENABLED_KEY)) as SettingRecord | undefined;
    await transactionDone(transaction);
    database.close();
    return setting?.value === true;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction(SETTINGS_STORE, 'readwrite');
    transaction.objectStore(SETTINGS_STORE).put({ key: ENABLED_KEY, value: enabled } satisfies SettingRecord);
    await transactionDone(transaction);
    database.close();
  }

  async deleteActivePack(): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction([PACKS_STORE, IMAGES_STORE, SETTINGS_STORE], 'readwrite');
    const packs = transaction.objectStore(PACKS_STORE);
    const images = transaction.objectStore(IMAGES_STORE);
    const settings = transaction.objectStore(SETTINGS_STORE);
    const activeRequest = settings.get(ACTIVE_PACK_KEY);
    activeRequest.onsuccess = () => {
      const activeId = (activeRequest.result as SettingRecord | undefined)?.value;
      if (typeof activeId === 'string') {
        packs.delete(activeId);
        deleteImagesForPack(images, activeId);
      }
      settings.delete(ACTIVE_PACK_KEY);
      settings.put({ key: ENABLED_KEY, value: false } satisfies SettingRecord);
    };
    await transactionDone(transaction);
    database.close();
  }
}
