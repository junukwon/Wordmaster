import words from '../../src/content/vocabulary.json';

test('contains the approved 250 words', () => {
  expect(words).toHaveLength(250);
  expect(words[0]).toMatchObject({ id: '0001', term: 'knee', day: 1 });
  expect(words[249]).toMatchObject({ id: '0250', term: 'stay up (late)', day: 10 });
});

test('has unique ids and 25 words per day', () => {
  expect(new Set(words.map((word) => word.id)).size).toBe(250);
  for (let day = 1; day <= 10; day += 1) {
    expect(words.filter((word) => word.day === day)).toHaveLength(25);
  }
});
