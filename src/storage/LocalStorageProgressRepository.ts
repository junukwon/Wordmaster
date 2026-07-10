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

function isWordProgress(value: unknown): value is WordProgress {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<WordProgress>;
  return typeof item.wordId === 'string'
    && ['unseen', 'recognized', 'recalled', 'spelled', 'mastered_today', 'long_term'].includes(item.stage ?? '')
    && ['unknown', 'weak', 'uncertain', 'strong'].includes(item.confidence ?? '')
    && typeof item.correctCount === 'number'
    && typeof item.incorrectCount === 'number'
    && [0, 1, 3, 7, 14].includes(item.reviewStep ?? -1)
    && (item.nextReviewAt === null || typeof item.nextReviewAt === 'string')
    && (item.lastReviewedAt === null || typeof item.lastReviewedAt === 'string')
    && typeof item.updatedAt === 'string';
}

function isStudySession(value: unknown): value is StudySession {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StudySession>;
  return typeof item.id === 'string'
    && typeof item.date === 'string'
    && Array.isArray(item.targetDayIds) && item.targetDayIds.every((day) => typeof day === 'number')
    && Array.isArray(item.targetWordIds) && item.targetWordIds.every((id) => typeof id === 'string')
    && Array.isArray(item.queue) && item.queue.every((token) => typeof token === 'string')
    && typeof item.currentIndex === 'number'
    && ['diagnosis', 'recognition', 'recall', 'spelling', 'mixed', 'reinforcement'].includes(item.phase ?? '')
    && typeof item.startedAt === 'string'
    && typeof item.updatedAt === 'string'
    && (item.completedAt === null || typeof item.completedAt === 'string');
}

function isTestAttempt(value: unknown): value is TestAttempt {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<TestAttempt>;
  return typeof item.id === 'string'
    && Array.isArray(item.dayIds)
    && Array.isArray(item.wordIds)
    && Array.isArray(item.questions)
    && Array.isArray(item.answers)
    && ['en_to_ko', 'ko_to_en', 'spelling', 'mixed'].includes(item.mode ?? '')
    && ['number', 'random'].includes(item.order ?? '')
    && typeof item.startedAt === 'string'
    && (item.completedAt === null || typeof item.completedAt === 'string');
}

function sanitizeStoredState(value: unknown): { state: StoredStateV1; repaired: boolean } | null {
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) return null;
  const raw = value as Partial<StoredStateV1>;
  const progressEntries = raw.progress && typeof raw.progress === 'object' ? Object.entries(raw.progress) : [];
  const validProgress = progressEntries.filter(([, progress]) => isWordProgress(progress));
  const rawAttempts = Array.isArray(raw.testAttempts) ? raw.testAttempts : [];
  const validAttempts = rawAttempts.filter(isTestAttempt);
  const activeSession = raw.activeSession === null || isStudySession(raw.activeSession) ? raw.activeSession : null;
  return {
    state: {
      version: 1,
      progress: Object.fromEntries(validProgress),
      activeSession: activeSession ?? null,
      testAttempts: validAttempts,
    },
    repaired: validProgress.length !== progressEntries.length
      || !raw.progress || typeof raw.progress !== 'object'
      || validAttempts.length !== rawAttempts.length
      || !Array.isArray(raw.testAttempts)
      || activeSession !== raw.activeSession,
  };
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
      const sanitized = sanitizeStoredState(parsed);
      if (!sanitized) throw new Error('Invalid stored state');
      if (sanitized.repaired) {
        this.storage.setItem(CORRUPT_KEY, raw);
        this.storage.setItem(STORAGE_KEY, JSON.stringify(sanitized.state));
        this.lastError = '학습 기록의 일부 손상된 항목을 백업하고 복구했습니다.';
      }
      return sanitized.state;
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
