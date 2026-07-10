export class SpeechPlayer {
  constructor(private readonly host: Window = window) {}

  isAvailable(): boolean {
    return this.englishVoices().length > 0 && typeof this.utteranceConstructor() === 'function';
  }

  speak(term: string): boolean {
    const synthesis = this.synthesis();
    const Utterance = this.utteranceConstructor();
    const voices = this.englishVoices();
    if (!synthesis || !Utterance || voices.length === 0) return false;

    const voice = voices.find((candidate) => candidate.localService) ?? voices[0];
    const utterance = new Utterance(term);
    utterance.voice = voice;
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    synthesis.cancel();
    synthesis.speak(utterance);
    return true;
  }

  getNotice(): string | null {
    const synthesis = this.synthesis();
    if (!synthesis || !this.utteranceConstructor()) {
      return '이 브라우저는 음성 재생을 지원하지 않습니다. 발음 없이도 학습할 수 있어요.';
    }
    const voices = this.englishVoices();
    if (voices.length === 0) {
      return '영어 시스템 음성을 찾을 수 없습니다. 기기에 영어 음성을 설치한 뒤 다시 시도해 주세요.';
    }
    if (!voices.some((voice) => voice.localService)) {
      return '로컬 영어 음성이 없어 발음 재생에 인터넷 연결이 필요할 수 있습니다. 오프라인 사용을 위해 영어 음성을 설치해 주세요.';
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

  private englishVoices(): SpeechSynthesisVoice[] {
    return this.synthesis()?.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en')) ?? [];
  }
}
