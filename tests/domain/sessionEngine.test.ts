import words from '../../src/content/vocabulary.json';
import type { LearningOutcome } from '../../src/domain/masteryEngine';
import type { VocabularyWord, WordProgress } from '../../src/domain/types';
import {
  applySessionOutcome,
  createStudySession,
  createStudySessionFromTarget,
  getNextStudyItem,
  getSessionQueueItems,
  getSessionSummary,
  selectTargetDays,
} from '../../src/domain/sessionEngine';

const now = new Date('2026-07-10T09:00:00.000Z');
const identity = <T,>(items: T[]) => items;

const sparseWords: VocabularyWord[] = [
  { id: 'sparse-1', day: 1, topic: 'Sparse', term: 'alpha', partOfSpeech: ['noun'], meanings: ['알파'] },
];

function progress(wordId: string, confidence: WordProgress['confidence'] = 'unknown'): WordProgress {
  return {
    wordId, stage: 'unseen', confidence, correctCount: 0, incorrectCount: 0,
    reviewStep: 0, nextReviewAt: null, lastReviewedAt: null, updatedAt: now.toISOString(),
  };
}

test('selecting DAY 1 through 5 creates 125 unique targets', () => {
  const session = createStudySession(words, [1, 2, 3, 4, 5], [], now, identity);
  expect(session.targetWordIds).toHaveLength(125);
  expect(new Set(session.targetWordIds).size).toBe(125);
});

test('random target session keeps exactly the selected word ids', () => {
  const target = {
    targetDayIds: [1, 2],
    targetWordIds: ['0001', '0026'],
    selection: { mode: 'random-words' as const, wordCount: 2 },
  };
  const session = createStudySessionFromTarget(words, target, [], now, identity);
  expect(session.targetWordIds).toEqual(['0001', '0026']);
  expect(session.selection).toEqual(target.selection);
});

test('legacy DAY filtering tolerates sparse or missing DAY ids', () => {
  const sparseTarget = createStudySession(sparseWords, [1, 2], [], now, identity);
  expect(sparseTarget.targetDayIds).toEqual([1, 2]);
  expect(sparseTarget.targetWordIds).toEqual(['sparse-1']);
  expect(getSessionQueueItems(sparseTarget).every((item) => item.wordId === 'sparse-1')).toBe(true);

  const missingTarget = createStudySession(sparseWords, [2], [], now, identity);
  expect(missingTarget.targetDayIds).toEqual([2]);
  expect(missingTarget.targetWordIds).toEqual([]);
  expect(getSessionQueueItems(missingTarget)).toEqual([]);
});

test('explicit target ids preserve their order within a queue block', () => {
  const target = {
    targetDayIds: [1],
    targetWordIds: ['0002', '0001'],
    selection: { mode: 'range' as const, startDay: 1, endDay: 1 },
  };
  const session = createStudySessionFromTarget(words, target, [], now, identity);
  expect(session.targetWordIds).toEqual(['0002', '0001']);
  expect(getSessionQueueItems(session).slice(0, 2).map((item) => item.wordId)).toEqual(['0002', '0001']);
});

test('initial learning operates in groups of five through three recall types', () => {
  const items = getSessionQueueItems(createStudySession(words, [1, 2, 3, 4, 5], [], now, identity));
  expect(new Set(items.slice(0, 15).map((item) => item.wordId))).toEqual(new Set(['0001', '0002', '0003', '0004', '0005']));
  expect(items.slice(0, 15).map((item) => item.questionType)).toEqual([
    ...Array(5).fill('en_to_ko'), ...Array(5).fill('ko_to_en'), ...Array(5).fill('spelling'),
  ]);
});

test('soon items return inside the current five-word block', () => {
  const session = createStudySession(words, [1, 2, 3, 4, 5], [], now, identity);
  const current = getNextStudyItem(session)!;
  const outcome: LearningOutcome = { progress: progress(current.wordId, 'weak'), requeue: 'soon' };
  const updated = applySessionOutcome(session, outcome);
  const remaining = getSessionQueueItems(updated).slice(updated.currentIndex);
  expect(remaining.findIndex((item) => item.wordId === current.wordId)).toBeLessThan(
    remaining.findIndex((item) => item.wordId === '0006'),
  );
});

test('end-of-day items return before the next DAY starts', () => {
  const session = createStudySession(words, [1, 2, 3, 4, 5], [], now, identity);
  const current = getNextStudyItem(session)!;
  const outcome: LearningOutcome = { progress: progress(current.wordId, 'uncertain'), requeue: 'end_of_day' };
  const updated = applySessionOutcome(session, outcome);
  const remaining = getSessionQueueItems(updated).slice(updated.currentIndex);
  const retryIndex = remaining.findIndex((item) => item.wordId === current.wordId && item.isRetry);
  const nextDayIndex = remaining.findIndex((item) => item.day === 2);
  expect(retryIndex).toBeGreaterThanOrEqual(0);
  expect(retryIndex).toBeLessThan(nextDayIndex);
});

test('finishing a DAY mixes a sample from earlier DAYs', () => {
  const items = getSessionQueueItems(createStudySession(words, [1, 2, 3, 4, 5], [], now, identity));
  const firstDay3 = items.findIndex((item) => item.day === 3 && item.phase !== 'mixed');
  expect(items.slice(0, firstDay3).some((item) => item.phase === 'mixed' && item.day === 1)).toBe(true);
});

test('resume-ready state preserves index, phase and queue', () => {
  const session = createStudySession(words, [1, 2, 3, 4, 5], [], now, identity);
  session.currentIndex = 7;
  session.phase = 'recall';
  const serialized = JSON.parse(JSON.stringify(session));
  expect(serialized).toMatchObject({ currentIndex: 7, phase: 'recall', queue: session.queue });
  expect(getNextStudyItem(serialized)).toEqual(getNextStudyItem(session));
});

test('summary categories always add up to the 125 target words', () => {
  const session = createStudySession(words, [1, 2, 3, 4, 5], [], now, identity);
  const progressList = [progress('0001', 'strong'), progress('0002', 'uncertain'), progress('0003', 'weak')];
  const summary = getSessionSummary(session, progressList);
  expect(summary).toEqual({ target: 125, strong: 1, uncertain: 1, weak: 1, remaining: 122 });
  expect(summary.strong + summary.uncertain + summary.weak + summary.remaining).toBe(125);
});

test('due reviews appear before new words without reducing the new target', () => {
  const due = { ...progress('0201', 'strong'), nextReviewAt: '2026-07-09T09:00:00.000Z', reviewStep: 1 as const };
  const session = createStudySession(words, [1, 2, 3, 4, 5], [due], now, identity);
  expect(session.targetWordIds).toHaveLength(125);
  expect(getNextStudyItem(session)).toMatchObject({ wordId: '0201', isReview: true });
});

test('selects the next five-DAY block after the first block is mastered', () => {
  expect(selectTargetDays(words, [])).toEqual([1, 2, 3, 4, 5]);
  const mastered = words.filter((word) => word.day <= 5).map((word) => ({
    ...progress(word.id, 'strong'), stage: 'mastered_today' as const,
  }));
  expect(selectTargetDays(words, mastered)).toEqual([6, 7, 8, 9, 10]);
});
