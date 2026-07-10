import type { QuestionType, Rating, WordProgress } from './types';
import { scheduleNextReview } from './reviewScheduler';

export type LearningOutcome = {
  progress: WordProgress;
  requeue: 'soon' | 'end_of_day' | 'scheduled' | 'none';
};

const REQUIRED_TYPES: QuestionType[] = ['en_to_ko', 'ko_to_en', 'spelling'];

function advanceStage(progress: WordProgress, questionType: QuestionType): WordProgress['stage'] {
  if (questionType === 'en_to_ko' && progress.stage === 'unseen') return 'recognized';
  if (questionType === 'ko_to_en' && progress.stage === 'recognized') return 'recalled';
  if (questionType === 'spelling' && progress.stage === 'recalled') return 'spelled';
  return progress.stage;
}

export function applyLearningResult(
  progress: WordProgress,
  questionType: QuestionType,
  rating: Rating,
  now: Date,
): LearningOutcome {
  const timestamp = now.toISOString();

  if (rating === 'weak') {
    const failed = scheduleNextReview(
      {
        ...progress,
        confidence: 'weak',
        incorrectCount: progress.incorrectCount + 1,
        lastReviewedAt: timestamp,
        updatedAt: timestamp,
      },
      'weak',
      now,
    );
    return { progress: failed, requeue: 'soon' };
  }

  if (rating === 'uncertain') {
    return {
      progress: {
        ...progress,
        confidence: 'uncertain',
        lastReviewedAt: timestamp,
        updatedAt: timestamp,
      },
      requeue: 'end_of_day',
    };
  }

  if (progress.stage === 'mastered_today' || progress.stage === 'long_term') {
    const scheduled = scheduleNextReview(
      { ...progress, correctCount: progress.correctCount + 1 },
      'strong',
      now,
    );
    return { progress: scheduled, requeue: scheduled.stage === 'long_term' ? 'none' : 'scheduled' };
  }

  const successfulQuestionTypes = [
    ...new Set([...(progress.successfulQuestionTypes ?? []), questionType]),
  ];
  const hasAllRequiredTypes = REQUIRED_TYPES.every((type) => successfulQuestionTypes.includes(type));
  const advanced: WordProgress = {
    ...progress,
    stage: hasAllRequiredTypes ? 'mastered_today' : advanceStage(progress, questionType),
    confidence: 'strong',
    correctCount: progress.correctCount + 1,
    lastReviewedAt: timestamp,
    updatedAt: timestamp,
    successfulQuestionTypes,
  };

  if (hasAllRequiredTypes) {
    return { progress: scheduleNextReview(advanced, 'strong', now), requeue: 'scheduled' };
  }
  return { progress: advanced, requeue: 'none' };
}
