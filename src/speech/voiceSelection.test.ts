import { SpeechPreferenceRepository } from './SpeechPreferenceRepository';
import { rankEnglishVoices } from './voiceSelection';

function voice(name: string, lang: string, localService: boolean, voiceURI = name): SpeechSynthesisVoice {
  return { name, lang, localService, voiceURI, default: false };
}

test.each([
  ['Samantha', 'Samantha'],
  ['Ava (Enhanced)', 'Ava (Enhanced)'],
  ['Allison', 'Allison'],
  ['Susan', 'Susan'],
  ['Zoe', 'Zoe'],
])('preferred female voice %s beats an arbitrary local en-US voice', (name) => {
  const male = voice('Alex', 'en-US', true);
  const preferred = voice(name, 'en-US', true);
  expect(rankEnglishVoices([male, preferred], { mode: 'auto' })[0]).toBe(preferred);
});

test('an installed manual voice wins automatic ranking', () => {
  const male = voice('Alex', 'en-US', true, 'alex-uri');
  const samantha = voice('Samantha', 'en-US', true, 'samantha-uri');
  expect(rankEnglishVoices([samantha, male], {
    mode: 'manual', voiceURI: male.voiceURI, name: male.name, lang: male.lang,
  })[0]).toBe(male);
});

test('a manual voice falls back to exact name and normalized language when its URI changes', () => {
  const replacement = voice('Alex', 'EN_us', true, 'new-alex-uri');
  const samantha = voice('Samantha', 'en-US', true, 'samantha-uri');
  expect(rankEnglishVoices([samantha, replacement], {
    mode: 'manual', voiceURI: 'old-alex-uri', name: 'Alex', lang: 'en-US',
  })[0]).toBe(replacement);
});

test('manual fallback does not select a same-name voice in a different language', () => {
  const wrongLanguage = voice('Alex', 'en-GB', true, 'new-alex-uk-uri');
  const samantha = voice('Samantha', 'en-US', true, 'samantha-uri');
  expect(rankEnglishVoices([wrongLanguage, samantha], {
    mode: 'manual', voiceURI: 'old-alex-uri', name: 'Alex', lang: 'en-US',
  })[0]).toBe(samantha);
});

test('manual fallback is ignored when exact name and normalized language are ambiguous', () => {
  const firstAlex = voice('Alex', 'en-US', true, 'new-alex-1');
  const secondAlex = voice('Alex', 'en_us', true, 'new-alex-2');
  const samantha = voice('Samantha', 'en-US', true, 'samantha-uri');
  expect(rankEnglishVoices([firstAlex, secondAlex, samantha], {
    mode: 'manual', voiceURI: 'old-alex-uri', name: 'Alex', lang: 'en-US',
  })[0]).toBe(samantha);
});

test.each([
  [voice('US local', 'en-US', true), voice('UK local', 'en-GB', true)],
  [voice('English local', 'en-GB', true), voice('English remote', 'en-US', false)],
])('%s ranks ahead of %s', (winner, loser) => {
  expect(rankEnglishVoices([loser, winner], { mode: 'auto' })[0]).toBe(winner);
});

test('non-English voices are filtered and equal scores preserve input order', () => {
  const first = voice('First', 'en-AU', true);
  const second = voice('Second', 'en-AU', true);
  expect(rankEnglishVoices([voice('French', 'fr-FR', true), first, second], { mode: 'auto' }))
    .toEqual([first, second]);
});

test('a missing manual voice falls back to automatic ranking', () => {
  const male = voice('Alex', 'en-US', true);
  const samantha = voice('Samantha', 'en-US', true);
  expect(rankEnglishVoices([male, samantha], {
    mode: 'manual', voiceURI: 'missing', name: 'Missing', lang: 'en-US',
  })[0]).toBe(samantha);
});

test('preference repository persists preferences and tolerates malformed JSON', () => {
  const storage = new Map<string, string>();
  const localStorage: Pick<Storage, 'getItem' | 'setItem'> = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  };
  const repository = new SpeechPreferenceRepository(localStorage);
  const preference = { mode: 'manual' as const, voiceURI: 'ava', name: 'Ava', lang: 'en-US' };
  repository.save(preference);
  expect(storage.get('wordmaster-speech-preference-v1')).toBe(JSON.stringify(preference));
  expect(repository.load()).toEqual(preference);
  storage.set('wordmaster-speech-preference-v1', '{bad');
  expect(repository.load()).toEqual({ mode: 'auto' });
});
