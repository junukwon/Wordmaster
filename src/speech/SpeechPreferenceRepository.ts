export type VoicePreference =
  | { mode: 'auto' }
  | { mode: 'manual'; voiceURI: string; name: string; lang: string };

const STORAGE_KEY = 'wordmaster-speech-preference-v1';

export class SpeechPreferenceRepository {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultStorage()) {}

  load(): VoicePreference {
    try {
      const value = this.storage?.getItem(STORAGE_KEY);
      if (!value) return { mode: 'auto' };
      const parsed: unknown = JSON.parse(value);
      if (isVoicePreference(parsed)) return parsed;
    } catch {
      // Storage can be disabled or contain data written by an older version.
    }
    return { mode: 'auto' };
  }

  save(preference: VoicePreference): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(preference));
    } catch {
      // Speech remains usable when local persistence is unavailable.
    }
  }
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isVoicePreference(value: unknown): value is VoicePreference {
  if (!value || typeof value !== 'object' || !('mode' in value)) return false;
  if (value.mode === 'auto') return true;
  return value.mode === 'manual'
    && 'voiceURI' in value && typeof value.voiceURI === 'string'
    && 'name' in value && typeof value.name === 'string'
    && 'lang' in value && typeof value.lang === 'string';
}
