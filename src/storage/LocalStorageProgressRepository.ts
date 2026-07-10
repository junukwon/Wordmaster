import type { StudySession, TestAttempt, WordProgress } from '../domain/types';
import type { ProgressRepository } from './ProgressRepository';

const STORAGE_KEY = 'wordmaster:v1';
const CORRUPT_KEY = 'wordmaster:v1:corrupt';

type StoredStateV1 = {
  version: 1;
  progress: Record<string, WordProgress>;
  activeSession: StudySession | null;
  testAttempts: TestAttempt[];
};

function cleanState(): StoredStateV1 {
  return { version: 1, progress: {}, activeSession: null, testAttempts: [] };
}

function isStoredState(value: unknown): value is StoredStateV1 {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<StoredStateV1>;
  return (
    state.version === 1 &&
    !!state.progress &&
    typeof state.progress === 'object' &&
    (state.activeSession === null || typeof state.activeSession === 'object') &&
    Array.isArray(state.testAttempts)
  );
}

export class LocalStorageProgressRepository implements ProgressRepository {
  private state: StoredStateV1;
  private lastError: string | null = null;

  constructor(private readonly storage: Storage = window.localStorage) {
    this.state = this.read();
  }

  getWordProgress(wordId: string): WordProgress {
    return (
      this.state.progress[wordId] ?? {
        wordId,
        stage: 'unseen',
        confidence: 'unknown',
        correctCount: 0,
        incorrectCount: 0,
        reviewStep: 0,
        nextReviewAt: null,
        lastReviewedAt: null,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  saveWordProgress(progress: WordProgress): void {
    this.state.progress[progress.wordId] = { ...progress };
    this.persist();
  }

  getAllWordProgress(): WordProgress[] {
    return Object.values(this.state.progress).map((progress) => ({ ...progress }));
  }

  loadActiveSession(): StudySession | null {
    return this.state.activeSession ? structuredClone(this.state.activeSession) : null;
  }

  saveActiveSession(session: StudySession | null): void {
    this.state.activeSession = session ? structuredClone(session) : null;
    this.persist();
  }

  saveTestAttempt(attempt: TestAttempt): void {
    const index = this.state.testAttempts.findIndex((item) => item.id === attempt.id);
    if (index >= 0) this.state.testAttempts[index] = structuredClone(attempt);
    else this.state.testAttempts.push(structuredClone(attempt));
    this.persist();
  }

  getTestAttempts(): TestAttempt[] {
    return structuredClone(this.state.testAttempts);
  }

  getLastError(): string | null {
    return this.lastError;
  }

  private read(): StoredStateV1 {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return cleanState();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredState(parsed)) throw new Error('Invalid stored state');
      return parsed;
    } catch {
      try {
        this.storage.setItem(CORRUPT_KEY, raw);
        this.storage.setItem(STORAGE_KEY, JSON.stringify(cleanState()));
      } catch {
        // Keep the clean in-memory state even when storage itself is unavailable.
      }
      this.lastError = '손상된 학습 기록을 백업하고 안전하게 복구했습니다.';
      return cleanState();
    }
  }

  private persist(): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.lastError = null;
    } catch {
      this.lastError = '학습 기록을 저장하지 못했습니다. 현재 화면에서는 계속 학습할 수 있습니다.';
    }
  }
}
