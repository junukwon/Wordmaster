import type { VoicePreference } from './SpeechPreferenceRepository';

const PREFERRED_FEMALE_NAMES = ['samantha', 'ava', 'allison', 'susan', 'zoe'];

export function rankEnglishVoices(
  voices: SpeechSynthesisVoice[],
  preference: VoicePreference,
): SpeechSynthesisVoice[] {
  const manualVoiceInstalled = preference.mode === 'manual'
    && voices.some((voice) => isEnglish(voice) && voice.voiceURI === preference.voiceURI);

  return voices
    .filter(isEnglish)
    .map((voice, index) => ({ voice, index, score: scoreVoice(voice, preference, manualVoiceInstalled) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ voice }) => voice);
}

function isEnglish(voice: SpeechSynthesisVoice): boolean {
  return voice.lang.toLowerCase().startsWith('en');
}

function scoreVoice(
  voice: SpeechSynthesisVoice,
  preference: VoicePreference,
  manualVoiceInstalled: boolean,
): number {
  if (manualVoiceInstalled && preference.mode === 'manual' && voice.voiceURI === preference.voiceURI) return -1;
  if (!voice.localService) return voice.lang.toLowerCase() === 'en-us' ? 30 : 40;
  if (voice.lang.toLowerCase() !== 'en-us') return 20;
  return isPreferredFemaleName(voice.name) ? 0 : 10;
}

function isPreferredFemaleName(name: string): boolean {
  const normalized = name.toLowerCase().trim().replace(/\s*(?:\([^)]*\)|\[[^\]]*\]|-\s.*)\s*$/, '');
  return PREFERRED_FEMALE_NAMES.includes(normalized);
}
