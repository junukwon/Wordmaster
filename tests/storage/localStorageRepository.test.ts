import type { StudySession, WordProgress } from '../../src/domain/types';
import { LocalStorageProgressRepository } from '../../src/storage/LocalStorageProgressRepository';

const now = '2026-07-10T09:00:00.000Z';

function progress(wordId = '0001'): WordProgress {
  return {
    wordId,
    stage: 'recognized',
    confidence: 'strong',
    correctCount: 1,
    incorrectCount: 0,
    reviewStep: 1,
    nextReviewAt: '2026-07-11T09:00:00.000Z',
    lastReviewedAt: now,
    updatedAt: now,
  };
}

function session(): StudySession {
  return {
    id: 'session-1',
    date: '2026-07-10',
    targetDayIds: [1, 2, 3, 4, 5],
    targetWordIds: ['0001'],
    queue: ['0001'],
    currentIndex: 0,
    phase: 'diagnosis',
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

beforeEach(() => localStorage.clear());

test('returns a default unseen record without storing it', () => {
  const repository = new LocalStorageProgressRepository(localStorage);
  expect(repository.getWordProgress('0251')).toMatchObject({
    wordId: '0251',
    stage: 'unseen',
    confidence: 'unknown',
    correctCount: 0,
    incorrectCount: 0,
    reviewStep: 0,
    nextReviewAt: null,
  });
  expect(repository.getAllWordProgress()).toEqual([]);
});

test('saved progress survives a new repository instance', () => {
  new LocalStorageProgressRepository(localStorage).saveWordProgress(progress());
  expect(new LocalStorageProgressRepository(localStorage).getWordProgress('0001')).toEqual(progress());
});

test('active session can be saved and cleared', () => {
  const repository = new LocalStorageProgressRepository(localStorage);
  repository.saveActiveSession(session());
  expect(repository.loadActiveSession()).toEqual(session());
  repository.saveActiveSession(null);
  expect(repository.loadActiveSession()).toBeNull();
});

test('legacy stored sessions without selection still load', () => {
  const legacy = { ...session() };
  delete (legacy as Partial<StudySession>).selection;
  localStorage.setItem('wordmaster:v1', JSON.stringify({
    version: 1,
    progress: {},
    activeSession: legacy,
    testAttempts: [],
  }));
  expect(new LocalStorageProgressRepository(localStorage).loadActiveSession()).toMatchObject({ targetDayIds: [1, 2, 3, 4, 5] });
});

test('malformed JSON is backed up and reset safely', () => {
  localStorage.setItem('wordmaster:v1', '{bad json');
  const repository = new LocalStorageProgressRepository(localStorage);
  expect(repository.getAllWordProgress()).toEqual([]);
  expect(localStorage.getItem('wordmaster:v1:corrupt')).toBe('{bad json');
  expect(repository.getLastError()).toMatch(/복구/);
});

test('requesting a new vocabulary ID never deletes existing progress', () => {
  const repository = new LocalStorageProgressRepository(localStorage);
  repository.saveWordProgress(progress('0001'));
  expect(repository.getWordProgress('0251').stage).toBe('unseen');
  expect(repository.getWordProgress('0001')).toEqual(progress('0001'));
});

test('repairs only a malformed session while preserving valid word progress', () => {
  localStorage.setItem('wordmaster:v1', JSON.stringify({
    version: 1,
    progress: { '0001': progress('0001') },
    activeSession: {},
    testAttempts: [],
  }));
  const repository = new LocalStorageProgressRepository(localStorage);
  expect(repository.getWordProgress('0001')).toEqual(progress('0001'));
  expect(repository.loadActiveSession()).toBeNull();
  expect(repository.getLastError()).toMatch(/일부/);
  expect(localStorage.getItem('wordmaster:v1:corrupt')).not.toBeNull();
});

test('keeps sanitized progress in memory when repaired storage cannot be written', () => {
  const raw = JSON.stringify({
    version: 1,
    progress: { '0001': progress('0001') },
    activeSession: {},
    testAttempts: [],
  });
  const readOnlyStorage: Storage = {
    length: 1,
    clear: () => { throw new Error('read only'); },
    getItem: (key) => key === 'wordmaster:v1' ? raw : null,
    key: () => 'wordmaster:v1',
    removeItem: () => { throw new Error('read only'); },
    setItem: () => { throw new Error('read only'); },
  };
  const repository = new LocalStorageProgressRepository(readOnlyStorage);
  expect(repository.getWordProgress('0001')).toEqual(progress('0001'));
  expect(repository.loadActiveSession()).toBeNull();
  expect(repository.getLastError()).toMatch(/메모리/);
});
