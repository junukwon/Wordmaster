import { describe, expect, test } from 'vitest';
import type { VocabularyWord } from '../../src/domain/types';
import {
  buildDaySummaries,
  buildFiveDayBundles,
  formatSelectionSummary,
  resolveStudySelection,
} from '../../src/domain/studySelection';

function makeWords(dayCount: number): VocabularyWord[] {
  return Array.from({ length: dayCount * 5 }, (_, index) => ({
    id: String(index + 1).padStart(4, '0'),
    day: Math.floor(index / 5) + 1,
    topic: `DAY ${Math.floor(index / 5) + 1}`,
    term: `word-${index + 1}`,
    partOfSpeech: ['noun'],
    meanings: [`meaning-${index + 1}`],
  }));
}

describe('study selection engine', () => {
  test('creates five-day bundles and a final partial bundle', () => {
    const bundles = buildFiveDayBundles(makeWords(20));
    expect(bundles.map((item) => item.dayNumbers)).toEqual([
      [1, 2, 3, 4, 5],
      [6, 7, 8, 9, 10],
      [11, 12, 13, 14, 15],
      [16, 17, 18, 19, 20],
    ]);
  });

  test('scales five-day bundles to 100 DAYs without changing source words', () => {
    const words = makeWords(100);
    const originalIds = words.map((word) => word.id);
    const bundles = buildFiveDayBundles(words);
    expect(bundles).toHaveLength(20);
    expect(bundles[19].dayNumbers).toEqual([96, 97, 98, 99, 100]);
    expect(words.map((word) => word.id)).toEqual(originalIds);
  });

  test('builds day summaries with progress counts', () => {
    const words = makeWords(2);
    const progress = [
      {
        wordId: '0001', stage: 'mastered_today' as const, confidence: 'strong' as const,
        correctCount: 1, incorrectCount: 0, reviewStep: 0 as const, nextReviewAt: null,
        lastReviewedAt: null, updatedAt: '2026-07-17T00:00:00.000Z',
      },
      {
        wordId: '0006', stage: 'recognized' as const, confidence: 'uncertain' as const,
        correctCount: 1, incorrectCount: 0, reviewStep: 0 as const, nextReviewAt: null,
        lastReviewedAt: null, updatedAt: '2026-07-17T00:00:00.000Z',
      },
    ];
    expect(buildDaySummaries(words, progress)).toEqual([
      expect.objectContaining({ dayId: 'DAY01', dayNumber: 1, wordCount: 5, masteredCount: 1, learningCount: 0, unstartedCount: 4 }),
      expect.objectContaining({ dayId: 'DAY02', dayNumber: 2, wordCount: 5, masteredCount: 0, learningCount: 1, unstartedCount: 4 }),
    ]);
  });

  test('resolves reversed range inclusively without duplicates', () => {
    const target = resolveStudySelection({ mode: 'range', startDay: 4, endDay: 2 }, makeWords(20));
    expect(target.targetDayIds).toEqual([2, 3, 4]);
    expect(new Set(target.targetWordIds).size).toBe(target.targetWordIds.length);
    expect(target.targetWordIds).toHaveLength(15);
  });

  test('resolves a bundle from its first day', () => {
    const target = resolveStudySelection({ mode: 'bundle', bundleStartDay: 6 }, makeWords(20));
    expect(target.targetDayIds).toEqual([6, 7, 8, 9, 10]);
    expect(target.targetWordIds).toHaveLength(25);
  });

  test('random days select unique available days', () => {
    const target = resolveStudySelection({ mode: 'random-days', dayCount: 3 }, makeWords(20), () => 0);
    expect(target.targetDayIds).toEqual([1, 2, 3]);
    expect(new Set(target.targetWordIds).size).toBe(target.targetWordIds.length);
  });

  test('random words select the requested number from the whole vocabulary', () => {
    const target = resolveStudySelection({ mode: 'random-words', wordCount: 25 }, makeWords(100), () => 0);
    expect(target.targetWordIds).toHaveLength(25);
    expect(target.targetDayIds).toEqual([1, 2, 3, 4, 5]);
  });

  test('rejects invalid random counts and missing days', () => {
    expect(() => resolveStudySelection({ mode: 'random-words', wordCount: 0 }, makeWords(4))).toThrow(/word count/i);
    expect(() => resolveStudySelection({ mode: 'range', startDay: 8, endDay: 9 }, makeWords(4))).toThrow(/DAY/i);
    expect(() => resolveStudySelection({ mode: 'random-words', wordCount: 125 }, makeWords(4))).toThrow(/word count/i);
  });

  test('formats a human-readable selection summary', () => {
    const target = resolveStudySelection({ mode: 'range', startDay: 2, endDay: 4 }, makeWords(20));
    expect(formatSelectionSummary(target)).toMatch(/DAY 02\s*[–-]\s*04/);
    expect(formatSelectionSummary(target)).toMatch(/15/);
  });
});
