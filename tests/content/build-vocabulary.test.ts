import { readFileSync } from 'node:fs';
import path from 'node:path';
import words from '../../src/content/vocabulary.json';
import offlineWords from '../../public/data/vocabulary.json';
import dayCatalog from '../../src/content/day-catalog.json';
import offlineDayCatalog from '../../public/data/day-catalog.json';
import { parseVocabularyMarkdown } from '../../scripts/build-vocabulary.mjs';

const day11To20SourcePath = path.resolve(
  process.cwd(),
  'content/source/영어_단어_DAY11-20.md',
);

test('build input includes DAY 01 through DAY 20 with 500 words', () => {
  expect(words).toHaveLength(500);
  expect(words[0]).toMatchObject({ id: '0001', term: 'knee', day: 1 });
  expect(words[499]).toMatchObject({ id: '0500', day: 20 });
  for (let day = 1; day <= 20; day += 1) {
    expect(words.filter((word) => word.day === day)).toHaveLength(25);
  }
});

test('checked-in DAY 11 through DAY 20 source is included in generated output', () => {
  const sourceMarkdown = readFileSync(day11To20SourcePath, 'utf8');
  const sourceWords = parseVocabularyMarkdown(sourceMarkdown, { validate: false });

  expect(sourceWords).toHaveLength(250);
  expect(sourceWords[0]).toMatchObject({ id: '0251', day: 11 });
  expect(sourceWords.at(-1)).toMatchObject({ id: '0500', day: 20 });
  expect(words.filter((word) => word.day >= 11)).toEqual(sourceWords);
});

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

test('preserves approved IPA for the original 250 words', () => {
  expect(words[0]).toMatchObject({ id: '0001', term: 'knee', phonetic: '/niː/', day: 1 });
  expect(words[249]).toMatchObject({
    id: '0250', term: 'stay up (late)', phonetic: '/ˌsteɪ ˈʌp (ˈleɪt)/', day: 10,
  });
  const originalWords = words.slice(0, 250);
  expect(originalWords.every((word) => /^\/.+\/$/.test(word.phonetic))).toBe(true);
  expect(new Set(originalWords.map((word) => word.phonetic)).size).toBeGreaterThan(150);
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
  expect(offlineDayCatalog).toEqual(dayCatalog);
});

test('publishes a DAY catalog matching vocabulary', () => {
  expect(dayCatalog).toHaveLength(20);
  expect(dayCatalog[0]).toMatchObject({ day: 1, wordCount: 25 });
  expect(dayCatalog[19]).toMatchObject({ day: 20, wordCount: 25 });
});
