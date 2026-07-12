import { SpeechPlayer } from './SpeechPlayer';

type MockUtterance = { text: string; voice?: SpeechSynthesisVoice; lang?: string; rate?: number; pitch?: number };

function installSpeech(
  voices: Partial<SpeechSynthesisVoice>[],
  failures: { utterance?: Error; cancel?: Error; speak?: Error } = {},
) {
  const calls: string[] = [];
  const spoken: MockUtterance[] = [];
  const listeners = new Set<EventListener>();
  const synthesis = {
    getVoices: () => voices as SpeechSynthesisVoice[],
    cancel: () => { calls.push('cancel'); if (failures.cancel) throw failures.cancel; },
    speak: (utterance: MockUtterance) => {
      calls.push('speak');
      if (failures.speak) throw failures.speak;
      spoken.push(utterance);
    },
    addEventListener: (_name: string, listener: EventListener) => listeners.add(listener),
    removeEventListener: (_name: string, listener: EventListener) => listeners.delete(listener),
  };
  class Utterance implements MockUtterance {
    voice?: SpeechSynthesisVoice;
    lang?: string;
    rate?: number;
    pitch?: number;
    constructor(public text: string) { if (failures.utterance) throw failures.utterance; }
  }
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
  return { calls, spoken, emitVoicesChanged: () => listeners.forEach((listener) => listener(new Event('voiceschanged'))) };
}

afterEach(() => {
  window.localStorage.removeItem('wordmaster-speech-preference-v1');
  Reflect.deleteProperty(window, 'speechSynthesis');
  Reflect.deleteProperty(window, 'SpeechSynthesisUtterance');
  Reflect.deleteProperty(globalThis, 'SpeechSynthesisUtterance');
});

test('prefers a local English voice and uses a beginner-friendly rate', () => {
  const remoteEnglish = { name: 'Remote English', lang: 'en-GB', localService: false };
  const localEnglish = { name: 'Local English', lang: 'en-US', localService: true };
  const { calls, spoken } = installSpeech([remoteEnglish, localEnglish]);
  const player = new SpeechPlayer(window);
  expect(player.speak('knee')).toBe(true);
  expect(calls).toEqual(['cancel', 'speak']);
  expect(spoken[0]).toMatchObject({ text: 'knee', voice: localEnglish, lang: 'en-US', rate: 0.85, pitch: 1.05 });
  expect(player.getNotice()).toBeNull();
});

test('exposes voices and preference selection and previews through normal playback', () => {
  const alex = { voiceURI: 'alex', name: 'Alex', lang: 'en-US', localService: true } as SpeechSynthesisVoice;
  const samantha = { voiceURI: 'sam', name: 'Samantha', lang: 'en-US', localService: true } as SpeechSynthesisVoice;
  const { spoken } = installSpeech([alex, samantha]);
  const player = new SpeechPlayer(window);
  expect(player.getVoices()).toEqual([samantha, alex]);
  expect(player.getSelectedVoice()).toBe(samantha);
  player.setPreference({ mode: 'manual', voiceURI: alex.voiceURI, name: alex.name, lang: alex.lang });
  expect(player.getPreference()).toEqual({ mode: 'manual', voiceURI: 'alex', name: 'Alex', lang: 'en-US' });
  expect(player.getSelectedVoice()).toBe(alex);
  expect(player.preview()).toBe(true);
  expect(spoken.at(-1)).toMatchObject({ text: "Hello, let's study English.", voice: alex });
});

test('a missing saved voice reports a notice while fallback playback remains available', () => {
  installSpeech([{ voiceURI: 'sam', name: 'Samantha', lang: 'en-US', localService: true }]);
  const player = new SpeechPlayer(window);
  player.setPreference({ mode: 'manual', voiceURI: 'missing', name: 'Missing', lang: 'en-US' });
  expect(player.getNotice()).not.toBeNull();
  expect(player.speak('knee')).toBe(true);
});

test('a changed manual voice URI resolves by saved name and language without an unavailable notice', () => {
  const replacement = { voiceURI: 'new-alex', name: 'Alex', lang: 'en_US', localService: true } as SpeechSynthesisVoice;
  installSpeech([replacement, { voiceURI: 'sam', name: 'Samantha', lang: 'en-US', localService: true }]);
  const player = new SpeechPlayer(window);
  player.setPreference({ mode: 'manual', voiceURI: 'old-alex', name: 'Alex', lang: 'en-US' });
  expect(player.getSelectedVoice()).toBe(replacement);
  expect(player.getPreference()).toEqual({ mode: 'manual', voiceURI: 'old-alex', name: 'Alex', lang: 'en-US' });
  expect(player.getNotice()).toBeNull();
});

test.each([
  ['constructor', 'utterance'],
  ['cancel', 'cancel'],
  ['speak', 'speak'],
] as const)(
  'returns false when speech %s throws',
  (_boundary, failureKey) => {
    installSpeech(
      [{ voiceURI: 'sam', name: 'Samantha', lang: 'en-US', localService: true }],
      { [failureKey]: new Error(`${failureKey} failed`) },
    );
    const player = new SpeechPlayer(window);
    expect(() => player.speak('knee')).not.toThrow();
    expect(player.speak('knee')).toBe(false);
    expect(player.getNotice()).not.toBeNull();
  },
);

test('preview returns false when the shared playback boundary throws', () => {
  installSpeech(
    [{ voiceURI: 'sam', name: 'Samantha', lang: 'en-US', localService: true }],
    { speak: new Error('speak failed') },
  );
  const player = new SpeechPlayer(window);
  expect(() => player.preview()).not.toThrow();
  expect(player.preview()).toBe(false);
});

test('warns when only a non-local English voice is available', () => {
  installSpeech([{ name: 'Remote English', lang: 'en-US', localService: false }]);
  const player = new SpeechPlayer(window);
  expect(player.isAvailable()).toBe(true);
  expect(player.getNotice()).toMatch(/인터넷 연결|영어 음성 설치/);
});

test('is gracefully unavailable without speech synthesis', () => {
  const player = new SpeechPlayer({} as Window);
  expect(player.isAvailable()).toBe(false);
  expect(player.speak('knee')).toBe(false);
  expect(player.getNotice()).toMatch(/지원하지/);
});

test('notifies subscribers when asynchronously loaded voices change', () => {
  const { emitVoicesChanged } = installSpeech([]);
  const player = new SpeechPlayer(window);
  const listener = vi.fn();
  const unsubscribe = player.subscribe(listener);
  emitVoicesChanged();
  expect(listener).toHaveBeenCalledOnce();
  unsubscribe();
  emitVoicesChanged();
  expect(listener).toHaveBeenCalledOnce();
});
