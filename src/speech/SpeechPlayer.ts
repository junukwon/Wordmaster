import { SpeechPreferenceRepository, type VoicePreference } from './SpeechPreferenceRepository';
import { rankEnglishVoices, resolveManualVoice } from './voiceSelection';

export class SpeechPlayer {
  private preference: VoicePreference;
  private playbackFailed = false;

  constructor(
    private readonly host: Window = window,
    private readonly preferenceRepository = new SpeechPreferenceRepository(safeStorage(host)),
  ) {
    this.preference = preferenceRepository.load();
  }

  isAvailable(): boolean {
    return this.getVoices().length > 0 && typeof this.utteranceConstructor() === 'function';
  }

  subscribe(listener: () => void): () => void {
    const synthesis = this.synthesis();
    if (!synthesis) return () => {};
    synthesis.addEventListener('voiceschanged', listener);
    return () => synthesis.removeEventListener('voiceschanged', listener);
  }

  speak(term: string): boolean {
    return this.play(term);
  }

  preview(): boolean {
    return this.play("Hello, let's study English.");
  }

  getVoices(): SpeechSynthesisVoice[] {
    return rankEnglishVoices(this.synthesis()?.getVoices() ?? [], this.preference);
  }

  getSelectedVoice(): SpeechSynthesisVoice | null {
    return this.getVoices()[0] ?? null;
  }

  setPreference(preference: VoicePreference): void {
    this.preference = preference;
    this.preferenceRepository.save(preference);
  }

  getPreference(): VoicePreference {
    return this.preference;
  }

  private play(text: string): boolean {
    const synthesis = this.synthesis();
    const Utterance = this.utteranceConstructor();
    const voice = this.getSelectedVoice();
    if (!synthesis || !Utterance || !voice) return false;

    this.playbackFailed = false;
    try {
      const utterance = new Utterance(text);
      utterance.voice = voice;
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      utterance.pitch = 1.05;
      synthesis.cancel();
      synthesis.speak(utterance);
      return true;
    } catch {
      this.playbackFailed = true;
      return false;
    }
  }

  getNotice(): string | null {
    if (this.playbackFailed) {
      return '발음을 재생할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    }
    const synthesis = this.synthesis();
    if (!synthesis || !this.utteranceConstructor()) {
      return '이 브라우저는 음성 재생을 지원하지 않습니다. 발음 없이도 학습할 수 있어요.';
    }
    const voices = this.getVoices();
    if (voices.length === 0) {
      return '영어 시스템 음성을 찾을 수 없습니다. 기기에 영어 음성을 설치한 뒤 다시 시도해 주세요.';
    }
    if (!voices.some((voice) => voice.localService)) {
      return '로컬 영어 음성이 없어 발음 재생에 인터넷 연결이 필요할 수 있습니다. 오프라인 사용을 위해 영어 음성을 설치해 주세요.';
    }
    if (this.preference.mode === 'manual'
      && !resolveManualVoice(voices, this.preference)) {
      return '저장된 음성을 찾을 수 없어 자동으로 선택한 영어 음성을 사용합니다.';
    }
    return null;
  }

  private synthesis(): SpeechSynthesis | null {
    return 'speechSynthesis' in this.host ? this.host.speechSynthesis : null;
  }

  private utteranceConstructor(): typeof SpeechSynthesisUtterance | null {
    const candidate = (this.host as Window & { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance })
      .SpeechSynthesisUtterance;
    return candidate ?? null;
  }

}

function safeStorage(host: Window): Storage | null {
  try {
    return 'localStorage' in host ? host.localStorage : null;
  } catch {
    return null;
  }
}
