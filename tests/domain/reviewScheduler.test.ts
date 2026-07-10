import type { Rating, ReviewStep, WordProgress } from '../../src/domain/types';
import { isReviewDue, nextReviewStep, scheduleNextReview } from '../../src/domain/reviewScheduler';

test.each<[ReviewStep, Rating, ReviewStep]>([
  [0, 'strong', 1],
  [1, 'strong', 3],
  [3, 'strong', 7],
  [7, 'strong', 14],
  [14, 'strong', 14],
  [7, 'uncertain', 3],
  [7, 'weak', 1],
])('moves review step %s with %s to %s days', (step, rating, expected) => {
  expect(nextReviewStep(step, rating)).toBe(expected);
});

test('uses local calendar date arithmetic across month boundaries', () => {
  const progress: WordProgress = {
    wordId: '0001', stage: 'mastered_today', confidence: 'strong', correctCount: 3,
    incorrectCount: 0, reviewStep: 0, nextReviewAt: null, lastReviewedAt: null,
    updatedAt: '2026-07-31T20:00:00.000Z',
  };
  const scheduled = scheduleNextReview(progress, 'strong', new Date(2026, 6, 31, 23, 30));
  const reviewDate = new Date(scheduled.nextReviewAt!);
  expect([reviewDate.getFullYear(), reviewDate.getMonth(), reviewDate.getDate()]).toEqual([2026, 7, 1]);
});

test('detects due and overdue reviews at the supplied time', () => {
  expect(isReviewDue({ nextReviewAt: '2026-07-10T09:00:00.000Z' }, new Date('2026-07-10T09:00:00.000Z'))).toBe(true);
  expect(isReviewDue({ nextReviewAt: '2026-07-11T09:00:00.000Z' }, new Date('2026-07-10T09:00:00.000Z'))).toBe(false);
  expect(isReviewDue({ nextReviewAt: null }, new Date('2026-07-10T09:00:00.000Z'))).toBe(false);
});
