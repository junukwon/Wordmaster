export type FanThemePackMeta = {
  id: string;
  status: 'staging' | 'active';
  imageCount: number;
  totalBytes: number;
  createdAt: string;
  mimeType: 'image/webp' | 'image/jpeg' | 'mixed';
};

export type FanThemeImageRecord = {
  packId: string;
  index: number;
  blob: Blob;
  width: number;
  height: number;
};

export type FanThemeStatus = {
  ready: boolean;
  enabled: boolean;
  imageCount: number;
  totalBytes: number;
  importing: boolean;
  processed: number;
  total: number;
  notice: string | null;
};

export type FanThemeImportResult = {
  imported: number;
  skipped: number;
  totalBytes: number;
};

export interface FanThemeRepository {
  initialize(): Promise<void>;
  beginPack(packId: string, createdAt: string): Promise<void>;
  addStagedImage(record: FanThemeImageRecord): Promise<void>;
  activatePack(meta: FanThemePackMeta): Promise<void>;
  abortPack(packId: string): Promise<void>;
  getActivePack(): Promise<FanThemePackMeta | null>;
  getImage(packId: string, index: number): Promise<FanThemeImageRecord | null>;
  getEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  deleteActivePack(): Promise<void>;
}
