import { createContext, useContext } from 'react';
import type { FanThemeStatus } from './types';

export type FanThemeContextValue = {
  status: FanThemeStatus;
  importFiles(files: readonly File[]): Promise<void>;
  setEnabled(enabled: boolean): Promise<void>;
  deletePack(): Promise<void>;
  loadImageBlob(contextKey: string): Promise<Blob | null>;
};

export const FanThemeContext = createContext<FanThemeContextValue | null>(null);

export function useFanTheme(): FanThemeContextValue {
  const value = useContext(FanThemeContext);
  if (!value) throw new Error('useFanTheme must be used inside FanThemeProvider');
  return value;
}
