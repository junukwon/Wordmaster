import type { LearningOutcome } from './masteryEngine';
import { isReviewDue } from './reviewScheduler';
import type {
  QuestionType,
  StudyPhase,
  StudySession,
  VocabularyWord,
  WordProgress,
} from './types';
import type { StudyTarget } from './studySelection';

export type Shuffle = <T>(items: T[]) => T[];

export type StudySessionCreationOptions = {
  includeDueReviews?: boolean;
};

export type StudyQueueItem = {
  wordId: string;
  questionType: QuestionType;
  phase: StudyPhase;
  blockId: string;
  day: number;
  isReview: boolean;
  isRetry: boolean;
};

export type SessionSummary = {
  target: number;
  strong: number;
  uncertain: number;
  weak: number;
  remaining: number;
};

const DELIMITER = '~';

function encodeQueueItem(item: StudyQueueItem): string {
  return [
    item.wordId,
    item.questionType,
    item.phase,
    item.blockId,
    item.day,
    item.isReview ? '1' : '0',
    item.isRetry ? '1' : '0',
  ].join(DELIMITER);
}

function decodeQueueItem(token: string): StudyQueueItem {
  const [wordId, questionType, phase, blockId, day, isReview, isRetry] = token.split(DELIMITER);
  return {
    wordId,
    questionType: questionType as QuestionType,
    phase: phase as StudyPhase,
    blockId,
    day: Number(day),
    isReview: isReview === '1',
    isRetry: isRetry === '1',
  };
}

function phaseFor(questionType: QuestionType): StudyPhase {
  if (questionType === 'en_to_ko') return 'recognition';
  if (questionType === 'ko_to_en') return 'recall';
  return 'spelling';
}

function questionForProgress(progress: WordProgress): QuestionType {
  if (progress.stage === 'unseen') return 'en_to_ko';
  if (progress.stage === 'recognized') return 'ko_to_en';
  return 'spelling';
}

export const fisherYatesShuffle: Shuffle = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

export function normalizeTargetDays(
  words: VocabularyWord[],
  requestedDayIds: number[],
): number[] {
  const availableDays = new Set(words.map((word) => word.day));
  return [...new Set(requestedDayIds)]
    .filter((day) => Number.isInteger(day) && availableDays.has(day))
    .sort((left, right) => left - right);
}

export function createStudySession(
  words: VocabularyWord[],
  targetDayIds: number[],
  progressList: WordProgress[],
  now: Date,
  shuffle: Shuffle = fisherYatesShuffle,
): StudySession {
  const selectedDays = [...new Set(targetDayIds)].sort((a, b) => a - b);
  const selection = {
    mode: 'range' as const,
    startDay: selectedDays[0] ?? 0,
    endDay: selectedDays[selectedDays.length - 1] ?? 0,
  };
  // This compatibility API historically treated targetDayIds as a filter.  In
  // particular, callers may pass sparse or not-yet-loaded DAY ids; missing days
  // are simply ignored and must not make session creation fail.  The strict
  // validation for the new selection modes lives in resolveStudySelection and
  // createStudySessionFromTarget's callers.
  const compatibilityTarget: StudyTarget = {
    targetDayIds: selectedDays,
    targetWordIds: words.filter((word) => selectedDays.includes(word.day)).map((word) => word.id),
    selection,
  };
  return createStudySessionFromTarget(
    words,
    compatibilityTarget,
    progressList,
    now,
    shuffle,
    { includeDueReviews: true },
  );
}

export function createStudySessionFromTarget(
  words: VocabularyWord[],
  target: StudyTarget,
  progressList: WordProgress[],
  now: Date,
  shuffle: Shuffle = fisherYatesShuffle,
  options: StudySessionCreationOptions = {},
): StudySession {
  const selectedDays = [...new Set(target.targetDayIds)].sort((a, b) => a - b);
  const wordsById = new Map(words.map((word) => [word.id, word]));
  const seenTargetIds = new Set<string>();
  const targetWords = target.targetWordIds
    .map((wordId) => wordsById.get(wordId))
    .filter((word): word is VocabularyWord => {
      if (!word || seenTargetIds.has(word.id)) return false;
      seenTargetIds.add(word.id);
      return selectedDays.includes(word.day);
    });
  const targetWordIds = targetWords.map((word) => word.id);
  const targetSet = new Set(targetWordIds);
  const queue: StudyQueueItem[] = [];

  const dueProgress = options.includeDueReviews
    ? progressList.filter(
      (progress) => isReviewDue(progress, now) && wordsById.has(progress.wordId) && !targetSet.has(progress.wordId),
    )
    : [];
  shuffle(dueProgress).forEach((progress) => {
    const word = wordsById.get(progress.wordId)!;
    queue.push({
      wordId: word.id,
      questionType: questionForProgress(progress),
      phase: 'reinforcement',
      blockId: 'due-review',
      day: word.day,
      isReview: true,
      isRetry: false,
    });
  });

  const earlierWords: VocabularyWord[] = [];
  selectedDays.forEach((day, dayIndex) => {
    const dayWords = shuffle(targetWords.filter((word) => word.day === day));
    for (let start = 0; start < dayWords.length; start += 5) {
      const block = dayWords.slice(start, start + 5);
      const blockId = `day-${day}-block-${Math.floor(start / 5)}`;
      (['en_to_ko', 'ko_to_en', 'spelling'] as QuestionType[]).forEach((questionType) => {
        block.forEach((word) => queue.push({
          wordId: word.id,
          questionType,
          phase: phaseFor(questionType),
          blockId,
          day,
          isReview: false,
          isRetry: false,
        }));
      });
    }

    if (dayIndex > 0 && earlierWords.length > 0) {
      shuffle(earlierWords).slice(0, 5).forEach((word, index) => queue.push({
        wordId: word.id,
        questionType: (['en_to_ko', 'ko_to_en', 'spelling'] as QuestionType[])[index % 3],
        phase: 'mixed',
        blockId: `day-${day}-cumulative`,
        day: word.day,
        isReview: false,
        isRetry: false,
      }));
    }
    earlierWords.push(...dayWords);
  });

  const timestamp = now.toISOString();
  return {
    id: `study-${now.getTime()}`,
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    targetDayIds: selectedDays,
    targetWordIds,
    queue: queue.map(encodeQueueItem),
    currentIndex: 0,
    phase: queue[0]?.phase ?? 'diagnosis',
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    dueReviewIds: dueProgress.map((progress) => progress.wordId),
    selection: target.selection,
  };
}

export function getSessionQueueItems(session: StudySession): StudyQueueItem[] {
  return session.queue.map(decodeQueueItem);
}

export function getNextStudyItem(session: StudySession): StudyQueueItem | null {
  const token = session.queue[session.currentIndex];
  return token ? decodeQueueItem(token) : null;
}

export function applySessionOutcome(
  session: StudySession,
  outcome: LearningOutcome,
  now: Date = new Date(),
): StudySession {
  const queue = [...session.queue];
  const current = decodeQueueItem(queue[session.currentIndex]);
  let insertionIndex = session.currentIndex + 1;

  if (outcome.requeue === 'soon') {
    const boundary = queue.findIndex((token, index) =>
      index > session.currentIndex && decodeQueueItem(token).blockId !== current.blockId,
    );
    insertionIndex = boundary === -1 ? queue.length : boundary;
  } else if (outcome.requeue === 'end_of_day') {
    const boundary = queue.findIndex((token, index) => {
      if (index <= session.currentIndex) return false;
      const item = decodeQueueItem(token);
      return item.phase === 'mixed' || item.day !== current.day;
    });
    insertionIndex = boundary === -1 ? queue.length : boundary;
  }

  if (outcome.requeue === 'soon' || outcome.requeue === 'end_of_day') {
    queue.splice(insertionIndex, 0, encodeQueueItem({ ...current, isRetry: true }));
  }

  const currentIndex = session.currentIndex + 1;
  const next = queue[currentIndex] ? decodeQueueItem(queue[currentIndex]) : null;
  return {
    ...session,
    queue,
    currentIndex,
    phase: next?.phase ?? session.phase,
    updatedAt: now.toISOString(),
    completedAt: next ? null : now.toISOString(),
  };
}

export function getSessionSummary(
  session: StudySession,
  progressList: WordProgress[],
): SessionSummary {
  const targetSet = new Set(session.targetWordIds);
  const byId = new Map(progressList.filter((item) => targetSet.has(item.wordId)).map((item) => [item.wordId, item]));
  const strong = [...byId.values()].filter((item) => item.confidence === 'strong').length;
  const uncertain = [...byId.values()].filter((item) => item.confidence === 'uncertain').length;
  const weak = [...byId.values()].filter((item) => item.confidence === 'weak').length;
  return {
    target: session.targetWordIds.length,
    strong,
    uncertain,
    weak,
    remaining: session.targetWordIds.length - strong - uncertain - weak,
  };
}
