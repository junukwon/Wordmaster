import type { Rating, ReviewStep, WordProgress } from './types';

export const REVIEW_STEPS = [0, 1, 3, 7, 14] as const;

export function nextReviewStep(current: ReviewStep, rating: Rating): ReviewStep {
  if (rating === 'weak') return 1;
  const index = REVIEW_STEPS.indexOf(current);
  if (rating === 'uncertain') {
    return REVIEW_STEPS[Math.max(1, index - 1)] as ReviewStep;
  }
  return REVIEW_STEPS[Math.min(REVIEW_STEPS.length - 1, index + 1)] as ReviewStep;
}

export function addLocalCalendarDays(now: Date, days: number): Date {
  const result = new Date(now);
  result.setDate(result.getDate() + days);
  return result;
}

export function scheduleNextReview(
  progress: WordProgress,
  rating: Rating,
  now: Date,
): WordProgress {
  const completedLongTerm = progress.reviewStep === 14 && rating === 'strong';
  const reviewStep = nextReviewStep(progress.reviewStep, rating);
  return {
    ...progress,
    stage: completedLongTerm ? 'long_term' : progress.stage,
    confidence: rating,
    reviewStep,
    nextReviewAt: completedLongTerm ? null : addLocalCalendarDays(now, reviewStep).toISOString(),
    lastReviewedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function isReviewDue(
  progress: Pick<WordProgress, 'nextReviewAt'>,
  now: Date,
): boolean {
  if (!progress.nextReviewAt) return false;
  return new Date(progress.nextReviewAt).getTime() <= now.getTime();
}
