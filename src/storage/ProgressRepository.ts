import type { StudySession, TestAttempt, WordProgress } from '../domain/types';

export interface ProgressRepository {
  getWordProgress(wordId: string): WordProgress;
  saveWordProgress(progress: WordProgress): void;
  getAllWordProgress(): WordProgress[];
  loadActiveSession(): StudySession | null;
  saveActiveSession(session: StudySession | null): void;
  saveTestAttempt(attempt: TestAttempt): void;
  getTestAttempts(): TestAttempt[];
  getLastError(): string | null;
}
