import words from '../../src/content/vocabulary.json';
import type { WordProgress } from '../../src/domain/types';
import {
  applyTestResultToProgress,
  createTestAttempt,
  summarizeTestAttempt,
  type TestConfig,
} from '../../src/domain/testEngine';

const now = new Date('2026-07-10T09:00:00.000Z');
const identity = <T,>(items: T[]) => items;
const reverse = <T,>(items: T[]) => [...items].reverse();

function progress(wordId: string, confidence: WordProgress['confidence'], lastReviewedAt = now.toISOString()): WordProgress {
  return { wordId, stage: 'recognized', confidence, correctCount: 1, incorrectCount: 0, reviewStep: 3, nextReviewAt: '2026-07-13T09:00:00.000Z', lastReviewedAt, updatedAt: now.toISOString() };
}

function config(overrides: Partial<TestConfig> = {}): TestConfig {
  return { dayIds: [1, 2, 3, 4, 5], wordSet: 'all', mode: 'mixed', count: 10, order: 'number', ...overrides };
}

test('filters selected DAYs and all supported progress sets', () => {
  const progressList = [progress('0001', 'weak'), progress('0002', 'uncertain'), progress('0026', 'strong')];
  expect(createTestAttempt(config({ dayIds: [2], count: 25 }), words, progressList, identity, now).wordIds.every((id) => Number(id) >= 26 && Number(id) <= 50)).toBe(true);
  expect(createTestAttempt(config({ wordSet: 'weak' }), words, progressList, identity, now).wordIds).toEqual(['0001']);
  expect(createTestAttempt(config({ wordSet: 'uncertain' }), words, progressList, identity, now).wordIds).toEqual(['0002']);
  expect(createTestAttempt(config({ wordSet: 'recent' }), words, progressList, identity, now).wordIds).toEqual(['0001', '0002', '0026']);
});

test.each([10, 25, 50, 125] as const)('creates exactly %i unique questions when available', (count) => {
  const attempt = createTestAttempt(config({ count }), words, [], identity, now);
  expect(attempt.wordIds).toHaveLength(count);
  expect(new Set(attempt.wordIds).size).toBe(count);
});

test('uses injected shuffle for deterministic random order', () => {
  const attempt = createTestAttempt(config({ order: 'random' }), words, [], reverse, now);
  expect(attempt.wordIds.slice(0, 3)).toEqual(['0125', '0124', '0123']);
});

test('mixed mode distributes all three question types', () => {
  const attempt = createTestAttempt(config({ count: 10, mode: 'mixed' }), words, [], identity, now);
  expect(new Set(attempt.questions.map((question) => question.questionType))).toEqual(new Set(['en_to_ko', 'ko_to_en', 'spelling']));
});

test('incorrect and uncertain update review without regular mastery, while correct preserves schedule', () => {
  const base = progress('0001', 'strong');
  const incorrect = applyTestResultToProgress(base, 'incorrect', now);
  expect(incorrect).toMatchObject({ stage: 'recognized', confidence: 'weak', incorrectCount: 1, reviewStep: 1 });
  const uncertain = applyTestResultToProgress({ ...base, reviewStep: 14, nextReviewAt: '2026-07-24T09:00:00.000Z' }, 'uncertain', now);
  expect(uncertain.reviewStep).toBe(3);
  expect(new Date(uncertain.nextReviewAt!).getTime()).toBeLessThanOrEqual(new Date('2026-07-13T09:00:00.000Z').getTime());
  expect(applyTestResultToProgress(base, 'correct', now).nextReviewAt).toBe(base.nextReviewAt);
});

test('summarizes score and separate uncertain/incorrect categories', () => {
  const attempt = createTestAttempt(config({ count: 10 }), words, [], identity, now);
  attempt.answers = attempt.questions.map((question, index) => ({ ...question, result: index < 7 ? 'correct' : index < 9 ? 'uncertain' : 'incorrect' }));
  const summary = summarizeTestAttempt(attempt, words);
  expect(summary).toMatchObject({ total: 10, correct: 7, uncertain: 2, incorrect: 1, score: 70 });
  expect(summary.byDay[1]).toBeDefined();
  expect(summary.byType.en_to_ko).toBeDefined();
});
