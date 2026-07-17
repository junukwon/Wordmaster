import type { VocabularyWord, WordProgress } from './types';

export type DaySummary = {
  day: number;
  topic: string;
  total: number;
  mastered: number;
  learning: number;
  unseen: number;
};

export function buildDaySummaries(
  words: VocabularyWord[],
  progressList: WordProgress[],
): DaySummary[] {
  const progressById = new Map(progressList.map((progress) => [progress.wordId, progress]));
  const days = [...new Set(words.map((word) => word.day))].sort((left, right) => left - right);

  return days.map((day) => {
    const dayWords = words.filter((word) => word.day === day);
    const progress = dayWords.map((word) => progressById.get(word.id));
    const mastered = progress.filter(
      (item) => item?.stage === 'mastered_today' || item?.stage === 'long_term',
    ).length;
    const learning = progress.filter(
      (item) => item && item.stage !== 'mastered_today' && item.stage !== 'long_term',
    ).length;

    return {
      day,
      topic: dayWords[0]?.topic ?? `DAY ${String(day).padStart(2, '0')}`,
      total: dayWords.length,
      mastered,
      learning,
      unseen: dayWords.length - mastered - learning,
    };
  });
}
