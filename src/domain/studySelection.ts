import type { VocabularyWord, WordProgress } from './types';

export type SelectionRandom = (maxExclusive: number) => number;

export type DaySummary = {
  dayId: string;
  dayNumber: number;
  title?: string;
  wordCount: number;
  masteredCount: number;
  learningCount: number;
  unstartedCount: number;
};

export type DayBundle = {
  bundleId: string;
  dayNumbers: number[];
  days: DaySummary[];
  wordCount: number;
  masteredCount: number;
  learningCount: number;
  unstartedCount: number;
};

export type StudySelection =
  | { mode: 'bundle'; bundleStartDay: number }
  | { mode: 'range'; startDay: number; endDay: number }
  | { mode: 'random-days'; dayCount: number; seed?: string }
  | { mode: 'random-words'; wordCount: number; seed?: string };

export type StudyTarget = {
  targetDayIds: number[];
  targetWordIds: string[];
  selection: StudySelection;
};

const DEFAULT_RANDOM: SelectionRandom = (maxExclusive) => Math.floor(Math.random() * maxExclusive);
const MASTERED_STAGES = new Set(['mastered_today', 'long_term']);

function dayId(day: number): string {
  return `DAY${String(day).padStart(2, '0')}`;
}

function uniqueWords(words: VocabularyWord[]): VocabularyWord[] {
  const seen = new Set<string>();
  return words.filter((word) => {
    if (seen.has(word.id)) return false;
    seen.add(word.id);
    return true;
  });
}

function availableDayNumbers(words: VocabularyWord[]): number[] {
  return [...new Set(words.map((word) => word.day))].sort((a, b) => a - b);
}

function normalizeRandomIndex(random: SelectionRandom, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  const value = random(maxExclusive);
  if (!Number.isFinite(value)) return 0;
  return Math.min(maxExclusive - 1, Math.max(0, Math.floor(value)));
}

function validateInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`);
}

function shuffle<T>(items: T[], random: SelectionRandom): T[] {
  const result = [...items];
  for (let index = 0; index < result.length - 1; index += 1) {
    const swapIndex = index + normalizeRandomIndex(random, result.length - index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function summariesFromInput(input: DaySummary[] | VocabularyWord[]): DaySummary[] {
  if (input.length === 0) return [];
  if ('dayNumber' in input[0]) return [...(input as DaySummary[])].sort((a, b) => a.dayNumber - b.dayNumber);
  return buildDaySummaries(input as VocabularyWord[], []);
}

export function buildDaySummaries(words: VocabularyWord[], progress: WordProgress[]): DaySummary[] {
  const unique = uniqueWords(words);
  const progressByWordId = new Map(progress.map((item) => [item.wordId, item]));
  return availableDayNumbers(unique).map((day) => {
    const dayWords = unique.filter((word) => word.day === day);
    let masteredCount = 0;
    let learningCount = 0;
    dayWords.forEach((word) => {
      const stage = progressByWordId.get(word.id)?.stage;
      if (stage && MASTERED_STAGES.has(stage)) masteredCount += 1;
      else if (stage && stage !== 'unseen') learningCount += 1;
    });
    return {
      dayId: dayId(day),
      dayNumber: day,
      title: dayWords[0]?.topic || dayId(day),
      wordCount: dayWords.length,
      masteredCount,
      learningCount,
      unstartedCount: dayWords.length - masteredCount - learningCount,
    };
  });
}

export function buildFiveDayBundles(days: DaySummary[] | VocabularyWord[]): DayBundle[] {
  const summaries = summariesFromInput(days);
  const bundles: DayBundle[] = [];
  for (let index = 0; index < summaries.length; index += 5) {
    const selected = summaries.slice(index, index + 5);
    bundles.push({
      bundleId: `bundle-${selected[0].dayNumber}`,
      dayNumbers: selected.map((item) => item.dayNumber),
      days: selected,
      wordCount: selected.reduce((sum, item) => sum + item.wordCount, 0),
      masteredCount: selected.reduce((sum, item) => sum + item.masteredCount, 0),
      learningCount: selected.reduce((sum, item) => sum + item.learningCount, 0),
      unstartedCount: selected.reduce((sum, item) => sum + item.unstartedCount, 0),
    });
  }
  return bundles;
}

function targetForDays(selection: StudySelection, words: VocabularyWord[], targetDays: number[]): StudyTarget {
  const selectedDaySet = new Set(targetDays);
  const targetWords = uniqueWords(words).filter((word) => selectedDaySet.has(word.day));
  if (targetWords.length === 0) throw new Error('Selected DAY has no words');
  return {
    targetDayIds: [...new Set(targetDays)].sort((a, b) => a - b),
    targetWordIds: targetWords.map((word) => word.id),
    selection,
  };
}

export function resolveStudySelection(
  selection: StudySelection,
  words: VocabularyWord[],
  random: SelectionRandom = DEFAULT_RANDOM,
): StudyTarget {
  const vocabulary = uniqueWords(words);
  if (vocabulary.length === 0) throw new Error('Vocabulary is empty');
  const days = availableDayNumbers(vocabulary);
  if (days.length === 0) throw new Error('No DAY is available');

  switch (selection.mode) {
    case 'bundle': {
      validateInteger(selection.bundleStartDay, 'Bundle DAY');
      const bundle = buildFiveDayBundles(buildDaySummaries(vocabulary, []))
        .find((item) => item.dayNumbers[0] === selection.bundleStartDay);
      if (!bundle) throw new Error(`DAY ${selection.bundleStartDay} is not available`);
      return targetForDays(selection, vocabulary, bundle.dayNumbers);
    }
    case 'range': {
      validateInteger(selection.startDay, 'Start DAY');
      validateInteger(selection.endDay, 'End DAY');
      const start = Math.min(selection.startDay, selection.endDay);
      const end = Math.max(selection.startDay, selection.endDay);
      if (!days.includes(start) || !days.includes(end)) throw new Error('Selected DAY is not available');
      return targetForDays(selection, vocabulary, days.filter((day) => day >= start && day <= end));
    }
    case 'random-days': {
      validateInteger(selection.dayCount, 'DAY count');
      if (selection.dayCount < 1 || selection.dayCount > days.length) {
        throw new Error(`DAY count must be between 1 and ${days.length}`);
      }
      const selected = shuffle(days, random).slice(0, selection.dayCount).sort((a, b) => a - b);
      return targetForDays(selection, vocabulary, selected);
    }
    case 'random-words': {
      validateInteger(selection.wordCount, 'Word count');
      const allowedCounts = new Set([10, 25, 50, 125]);
      if (!allowedCounts.has(selection.wordCount) || selection.wordCount > vocabulary.length) {
        throw new Error(`Word count must be one of 10, 25, 50, or 125 and no more than ${vocabulary.length}`);
      }
      const selected = shuffle(vocabulary, random).slice(0, selection.wordCount);
      return {
        targetDayIds: [...new Set(selected.map((word) => word.day))].sort((a, b) => a - b),
        targetWordIds: selected.map((word) => word.id),
        selection,
      };
    }
    default:
      throw new Error('Unsupported study selection mode');
  }
}

export function formatSelectionSummary(target: StudyTarget): string {
  const count = target.targetWordIds.length;
  const firstDay = target.targetDayIds[0];
  const lastDay = target.targetDayIds[target.targetDayIds.length - 1];
  switch (target.selection.mode) {
    case 'random-words':
      return `전체 단어 중 랜덤 ${count}개 · ${count}단어`;
    case 'random-days':
      return `랜덤 DAY ${target.targetDayIds.length}개 · ${count}단어`;
    default:
      return `DAY ${String(firstDay).padStart(2, '0')}–${String(lastDay).padStart(2, '0')} · ${count}단어`;
  }
}
