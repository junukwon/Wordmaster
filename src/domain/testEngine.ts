import { addLocalCalendarDays, scheduleNextReview } from './reviewScheduler';
import type {
  QuestionType,
  TestAnswer,
  TestAttempt,
  TestResult,
  VocabularyWord,
  WordProgress,
} from './types';
import type { Shuffle } from './sessionEngine';

export type TestWordSet = 'all' | 'recent' | 'uncertain' | 'weak' | 'random';
export type TestConfig = {
  dayIds: number[];
  wordSet: TestWordSet;
  mode: QuestionType | 'mixed';
  count: 10 | 25 | 50 | 125;
  order: 'number' | 'random';
  onlyWordIds?: string[];
};

type Breakdown = { correct: number; uncertain: number; incorrect: number; total: number };
export type TestSummary = {
  total: number;
  correct: number;
  uncertain: number;
  incorrect: number;
  score: number;
  byDay: Record<number, Breakdown>;
  byType: Record<QuestionType, Breakdown>;
  incorrectWordIds: string[];
};

const QUESTION_TYPES: QuestionType[] = ['en_to_ko', 'ko_to_en', 'spelling'];

function emptyBreakdown(): Breakdown {
  return { correct: 0, uncertain: 0, incorrect: 0, total: 0 };
}

export function createTestAttempt(
  config: TestConfig,
  words: VocabularyWord[],
  progressList: WordProgress[],
  shuffle: Shuffle,
  now: Date = new Date(),
): TestAttempt {
  const selectedDays = new Set(config.dayIds);
  const onlyIds = config.onlyWordIds ? new Set(config.onlyWordIds) : null;
  const progressById = new Map(progressList.map((progress) => [progress.wordId, progress]));
  let pool = words.filter((word) => selectedDays.has(word.day) && (!onlyIds || onlyIds.has(word.id)));

  if (config.wordSet === 'recent') pool = pool.filter((word) => !!progressById.get(word.id)?.lastReviewedAt);
  if (config.wordSet === 'uncertain') pool = pool.filter((word) => progressById.get(word.id)?.confidence === 'uncertain');
  if (config.wordSet === 'weak') pool = pool.filter((word) => progressById.get(word.id)?.confidence === 'weak');

  if (config.wordSet === 'random' || config.order === 'random') pool = shuffle([...pool]);
  else pool = [...pool].sort((a, b) => a.id.localeCompare(b.id));

  let selected = pool.slice(0, config.count);
  if (config.wordSet === 'random' && config.order === 'number') {
    selected = selected.sort((a, b) => a.id.localeCompare(b.id));
  }
  const questions = selected.map((word, index) => ({
    wordId: word.id,
    questionType: config.mode === 'mixed' ? QUESTION_TYPES[index % QUESTION_TYPES.length] : config.mode,
  }));
  return {
    id: `test-${now.getTime()}`,
    dayIds: [...config.dayIds],
    wordIds: selected.map((word) => word.id),
    questions,
    mode: config.mode,
    order: config.order,
    answers: [],
    startedAt: now.toISOString(),
    completedAt: null,
  };
}

export function applyTestAnswer(
  attempt: TestAttempt,
  result: TestResult,
  now: Date = new Date(),
): TestAttempt {
  const question = attempt.questions[attempt.answers.length];
  if (!question || attempt.completedAt) return attempt;
  const answer: TestAnswer = { ...question, result };
  const answers = [...attempt.answers, answer];
  return {
    ...attempt,
    answers,
    completedAt: answers.length === attempt.questions.length ? now.toISOString() : null,
  };
}

export function applyTestResultToProgress(
  progress: WordProgress,
  result: TestResult,
  now: Date,
): WordProgress {
  if (result === 'correct') return { ...progress };
  if (result === 'incorrect') {
    return scheduleNextReview(
      { ...progress, incorrectCount: progress.incorrectCount + 1, confidence: 'weak' },
      'weak',
      now,
    );
  }

  const threeDays = addLocalCalendarDays(now, 3).toISOString();
  const existingIsEarlier = progress.nextReviewAt && new Date(progress.nextReviewAt) <= new Date(threeDays);
  return {
    ...progress,
    confidence: 'uncertain',
    reviewStep: progress.reviewStep > 0 && progress.reviewStep < 3 ? progress.reviewStep : 3,
    nextReviewAt: existingIsEarlier ? progress.nextReviewAt : threeDays,
    lastReviewedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function summarizeTestAttempt(attempt: TestAttempt, words: VocabularyWord[]): TestSummary {
  const wordById = new Map(words.map((word) => [word.id, word]));
  const byDay: Record<number, Breakdown> = {};
  const byType = Object.fromEntries(QUESTION_TYPES.map((type) => [type, emptyBreakdown()])) as Record<QuestionType, Breakdown>;
  const counts = { correct: 0, uncertain: 0, incorrect: 0 };

  for (const answer of attempt.answers) {
    counts[answer.result] += 1;
    const day = wordById.get(answer.wordId)?.day;
    if (day !== undefined) {
      byDay[day] ??= emptyBreakdown();
      byDay[day][answer.result] += 1;
      byDay[day].total += 1;
    }
    byType[answer.questionType][answer.result] += 1;
    byType[answer.questionType].total += 1;
  }

  const total = attempt.answers.length;
  return {
    total,
    ...counts,
    score: total === 0 ? 0 : Math.round((counts.correct / total) * 100),
    byDay,
    byType,
    incorrectWordIds: attempt.answers.filter((answer) => answer.result === 'incorrect').map((answer) => answer.wordId),
  };
}
