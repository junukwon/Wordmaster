import words from '../../src/content/vocabulary.json';
import { buildDaySummaries } from '../../src/domain/daySelection';
import type { WordProgress } from '../../src/domain/types';

const base = (wordId: string): WordProgress => ({
  wordId,
  stage: 'recognized',
  confidence: 'uncertain',
  correctCount: 1,
  incorrectCount: 0,
  reviewStep: 0,
  nextReviewAt: null,
  lastReviewedAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
});

test('builds ordered 25-word summaries with mastered, learning and unseen counts', () => {
  const progress = [
    { ...base('0001'), stage: 'mastered_today' as const },
    { ...base('0002'), stage: 'long_term' as const },
    base('0003'),
  ];
  const summaries = buildDaySummaries(words, progress);
  expect(summaries).toHaveLength(10);
  expect(summaries[0]).toEqual({
    day: 1,
    topic: '사람 묘사 I',
    total: 25,
    mastered: 2,
    learning: 1,
    unseen: 22,
  });
  expect(summaries.map((summary) => summary.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
