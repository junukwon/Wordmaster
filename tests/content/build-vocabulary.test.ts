import words from '../../src/content/vocabulary.json';
import offlineWords from '../../public/data/vocabulary.json';
// @ts-expect-error The production content builder is intentionally plain JavaScript.
import { parseVocabularyMarkdown } from '../../scripts/build-vocabulary.mjs';

const fixtureRows = Array.from({ length: 25 }, (_, index) => {
  const id = String(index + 1).padStart(4, '0');
  return `| ${id} | ${index === 0 ? 'knee' : `word${id}`} | /niː/ | 명 | 뜻 | |`;
}).join('\n');

const fixture = `# Fixture

## DAY 01 — Test

| 번호 | 단어·표현 | 발음기호 | 품사 | 뜻 | 변화형·참고 |
|---:|---|---|---|---|---|
${fixtureRows}
`;

test('parses a required American IPA field', () => {
  expect(parseVocabularyMarkdown(fixture)[0]).toMatchObject({
    term: 'knee',
    phonetic: '/niː/',
  });
});

test.each([
  ['missing', '| 0001 | knee | | 명 | 무릎 | |'],
  ['malformed', '| 0001 | knee | niː | 명 | 무릎 | |'],
])('rejects %s IPA', (_label, row) => {
  expect(() => parseVocabularyMarkdown(fixture.replace('| 0001 | knee | /niː/ | 명 | 뜻 | |', row)))
    .toThrow('Invalid phonetic: 0001');
});

test('contains the approved 250 words', () => {
  expect(words).toHaveLength(250);
  expect(words[0]).toMatchObject({ id: '0001', term: 'knee', phonetic: '/niː/', day: 1 });
  expect(words[249]).toMatchObject({
    id: '0250', term: 'stay up (late)', phonetic: '/ˌsteɪ ˈʌp (ˈleɪt)/', day: 10,
  });
  expect(words.every((word) => /^\/.+\/$/.test(word.phonetic))).toBe(true);
  expect(new Set(words.map((word) => word.phonetic)).size).toBeGreaterThan(150);
});

test('contains reviewed American forms for phrases and meaning-sensitive entries', () => {
  const byTerm = new Map(words.map((word) => [word.term, word.phonetic]));
  expect(byTerm.get('tear')).toBe('/tɪr/');
  expect(byTerm.get('patient')).toBe('/ˈpeɪʃənt/');
  expect(byTerm.get('lie')).toBe('/laɪ/');
  expect(byTerm.get('excuse')).toBe('/ɪkˈskjuːs, ɪkˈskjuːz/');
  expect(byTerm.get('detail')).toBe('/ˈdiːteɪl/');
  expect(byTerm.get('be able to-v')).toBe('/bi ˈeɪbəl tə/');
  expect(byTerm.get("blow one's nose")).toBe('/ˌbloʊ wʌnz ˈnoʊz/');
  expect(byTerm.get('look forward to (v-ing)')).toBe('/lʊk ˈfɔrwərd tə/');
  expect(byTerm.get('by the way')).toBe('/baɪ ðə ˈweɪ/');
});

test('preserves reviewed citation stress for every affected multiword entry', () => {
  const byId = new Map(words.map((word) => [word.id, word.phonetic]));
  const expectedPhraseIpa = {
    '0025': '/ɡroʊ ˈʌp/',
    '0075': '/tʃɪr ˈʌp/',
    '0099': '/ˈkɛr fɔr/',
    '0100': '/ˌbloʊ wʌnz ˈnoʊz/',
    '0124': '/ˈdriːm əv/',
    '0148': '/ˌwɑtʃ ˈaʊt (fɔr)/',
    '0173': '/ˌfaɪnd ˈaʊt/',
    '0175': '/ˈθɪŋk əv/',
    '0198': '/ˌɡoʊ ˈɑn/',
    '0199': '/ˈæsk fɔr/',
    '0224': '/baɪ ðə ˈweɪ/',
    '0225': '/ænd ˌsoʊ ˈɑn/',
    '0248': '/ˌweɪk ˈʌp/',
    '0249': '/ˌkliːn ˈʌp/',
    '0250': '/ˌsteɪ ˈʌp (ˈleɪt)/',
  };

  expect(Object.fromEntries(
    Object.keys(expectedPhraseIpa).map((id) => [id, byId.get(id)]),
  )).toEqual(expectedPhraseIpa);
});

test('publishes the same DAY data as an offline-cacheable asset', () => {
  expect(offlineWords).toEqual(words);
});

test('has unique ids and 25 words per day', () => {
  expect(new Set(words.map((word) => word.id)).size).toBe(250);
  for (let day = 1; day <= 10; day += 1) {
    expect(words.filter((word) => word.day === day)).toHaveLength(25);
  }
});
