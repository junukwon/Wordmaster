import words from '../../src/content/vocabulary.json';
import offlineWords from '../../public/data/vocabulary.json';
import dayCatalog from '../../src/content/day-catalog.json';
import offlineDayCatalog from '../../public/data/day-catalog.json';

test('build input includes DAY 01 through DAY 20 with 500 words', () => {
  expect(words).toHaveLength(500);
  expect(words[0]).toMatchObject({ id: '0001', term: 'knee', day: 1 });
  expect(words[499]).toMatchObject({ id: '0500', day: 20 });
  for (let day = 1; day <= 20; day += 1) {
    expect(words.filter((word) => word.day === day)).toHaveLength(25);
  }
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
