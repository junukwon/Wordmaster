import type { MasteryStage, WordProgress } from '../../src/domain/types';
import { applyLearningResult } from '../../src/domain/masteryEngine';

const now = new Date('2026-07-10T09:00:00.000Z');

function progress(stage: MasteryStage = 'unseen'): WordProgress {
  return {
    wordId: '0001', stage, confidence: 'unknown', correctCount: 0, incorrectCount: 0,
    reviewStep: 0, nextReviewAt: null, lastReviewedAt: null, updatedAt: now.toISOString(),
  };
}

test('English to Korean strong advances unseen to recognized', () => {
  expect(applyLearningResult(progress(), 'en_to_ko', 'strong', now).progress.stage).toBe('recognized');
});

test('Korean to English strong advances recognized to recalled', () => {
  expect(applyLearningResult(progress('recognized'), 'ko_to_en', 'strong', now).progress.stage).toBe('recalled');
});

test('spelling strong advances an isolated recalled word to spelled', () => {
  expect(applyLearningResult(progress('recalled'), 'spelling', 'strong', now).progress.stage).toBe('spelled');
});

test('success in all three required types produces mastered today', () => {
  let current = progress();
  current = applyLearningResult(current, 'en_to_ko', 'strong', now).progress;
  current = applyLearningResult(current, 'ko_to_en', 'strong', now).progress;
  current = applyLearningResult(current, 'spelling', 'strong', now).progress;
  expect(current.stage).toBe('mastered_today');
  expect(current.reviewStep).toBe(1);
});

test('uncertain does not advance and returns before the day ends', () => {
  const outcome = applyLearningResult(progress('recognized'), 'ko_to_en', 'uncertain', now);
  expect(outcome.progress.stage).toBe('recognized');
  expect(outcome.requeue).toBe('end_of_day');
});

test('weak increments incorrect count and schedules D+1', () => {
  const outcome = applyLearningResult(progress('recalled'), 'spelling', 'weak', now);
  expect(outcome.progress).toMatchObject({ confidence: 'weak', incorrectCount: 1, reviewStep: 1 });
  expect(outcome.requeue).toBe('soon');
  expect(new Date(outcome.progress.nextReviewAt!).getUTCDate()).toBe(11);
});

test('one correct answer never produces long term mastery and does not mutate input', () => {
  const input = progress();
  const outcome = applyLearningResult(input, 'en_to_ko', 'strong', now);
  expect(outcome.progress.stage).not.toBe('long_term');
  expect(input).toEqual(progress());
});
