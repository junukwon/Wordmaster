import type { VoicePreference } from './SpeechPreferenceRepository';

const PREFERRED_FEMALE_NAMES = ['samantha', 'ava', 'allison', 'susan', 'zoe'];

export function rankEnglishVoices(
  voices: SpeechSynthesisVoice[],
  preference: VoicePreference,
): SpeechSynthesisVoice[] {
  const manualVoice = resolveManualVoice(voices, preference);

  return voices
    .filter(isEnglish)
    .map((voice, index) => ({ voice, index, score: scoreVoice(voice, manualVoice) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ voice }) => voice);
}

export function resolveManualVoice(
  voices: SpeechSynthesisVoice[],
  preference: VoicePreference,
): SpeechSynthesisVoice | null {
  if (preference.mode !== 'manual') return null;
  const englishVoices = voices.filter(isEnglish);
  const uriMatch = englishVoices.find((voice) => voice.voiceURI === preference.voiceURI);
  if (uriMatch) return uriMatch;

  const identityMatches = englishVoices.filter((voice) => voice.name === preference.name
    && normalizeLanguage(voice.lang) === normalizeLanguage(preference.lang));
  return identityMatches.length === 1 ? identityMatches[0] : null;
}

function isEnglish(voice: SpeechSynthesisVoice): boolean {
  return normalizeLanguage(voice.lang).startsWith('en');
}

function scoreVoice(
  voice: SpeechSynthesisVoice,
  manualVoice: SpeechSynthesisVoice | null,
): number {
  if (voice === manualVoice) return -1;
  if (!voice.localService) return normalizeLanguage(voice.lang) === 'en-us' ? 30 : 40;
  if (normalizeLanguage(voice.lang) !== 'en-us') return 20;
  return isPreferredFemaleName(voice.name) ? 0 : 10;
}

function normalizeLanguage(language: string): string {
  return language.trim().toLowerCase().replace(/_/g, '-');
}

function isPreferredFemaleName(name: string): boolean {
  const normalized = name.toLowerCase().trim().replace(/\s*(?:\([^)]*\)|\[[^\]]*\]|-\s.*)\s*$/, '');
  return PREFERRED_FEMALE_NAMES.includes(normalized);
}
