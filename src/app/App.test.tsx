import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
});

test('renders the WordMaster heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'WordMaster' })).toBeInTheDocument();
});

test('replacing a session preserves word progress and test attempts', async () => {
  const state = {
    version: 1,
    progress: {
      '0001': {
        wordId: '0001', stage: 'recognized', confidence: 'strong', correctCount: 1, incorrectCount: 0,
        reviewStep: 0, nextReviewAt: null, lastReviewedAt: '2026-07-10T09:00:00.000Z', updatedAt: '2026-07-10T09:00:00.000Z',
      },
    },
    activeSession: {
      id: 'old', date: '2026-07-10', targetDayIds: [1], targetWordIds: ['0001'], queue: [],
      currentIndex: 3, phase: 'recall', startedAt: '', updatedAt: '', completedAt: null,
    },
    testAttempts: [{
      id: 'attempt-1', dayIds: [1], wordIds: ['0001'], questions: [], answers: [], mode: 'mixed',
      order: 'random', startedAt: '2026-07-10T09:00:00.000Z', completedAt: null,
    }],
  };
  localStorage.setItem('wordmaster:v1', JSON.stringify(state));
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: /DAY 02/ }));
  await user.click(screen.getByRole('button', { name: /DAY 07/ }));
  await user.click(screen.getByRole('button', { name: '50개 학습 시작하기' }));
  await user.click(screen.getByRole('button', { name: '새 학습으로 교체' }));
  const saved = JSON.parse(localStorage.getItem('wordmaster:v1')!);
  expect(saved.activeSession.targetDayIds).toEqual([2, 7]);
  expect(saved.progress).toEqual(state.progress);
  expect(saved.testAttempts).toEqual(state.testAttempts);
});

test('a one-shot storage failure restores the previous session and keeps the first error visible', async () => {
  const previousSession = {
    id: 'old', date: '2026-07-10', targetDayIds: [1], targetWordIds: ['0001'], queue: ['saved'],
    currentIndex: 0, phase: 'recall', startedAt: '', updatedAt: '', completedAt: null,
  };
  localStorage.setItem('wordmaster:v1', JSON.stringify({
    version: 1, progress: {}, activeSession: previousSession, testAttempts: [],
  }));
  const user = userEvent.setup();
  render(<App />);
  const originalSetItem = Storage.prototype.setItem;
  let writes = 0;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    writes += 1;
    if (writes === 1) throw new Error('quota');
    return originalSetItem.call(this, key, value);
  });
  await user.click(screen.getByRole('button', { name: /DAY 02/ }));
  await user.click(screen.getByRole('button', { name: '25개 학습 시작하기' }));
  await user.click(screen.getByRole('button', { name: '새 학습으로 교체' }));
  expect(screen.getByRole('heading', { name: 'WordMaster' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('학습 기록을 저장하지 못했습니다.');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveFocus();
  expect(screen.getByRole('button', { name: /DAY 02/ })).toHaveAttribute('aria-pressed', 'true');
  expect(JSON.parse(localStorage.getItem('wordmaster:v1')!).activeSession).toEqual(previousSession);
});

test('opening setup through browser history does not replace an active session without confirmation', async () => {
  const previousSession = {
    id: 'old', date: '2026-07-10', targetDayIds: [1], targetWordIds: ['0001'], queue: ['saved'],
    currentIndex: 0, phase: 'recall', startedAt: '', updatedAt: '', completedAt: null,
  };
  localStorage.setItem('wordmaster:v1', JSON.stringify({
    version: 1, progress: {}, activeSession: previousSession, testAttempts: [],
  }));
  window.location.hash = '#/study/setup';
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: '선택한 범위로 학습 시작' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('wordmaster:v1')!).activeSession).toEqual(previousSession);
  await user.click(screen.getByRole('button', { name: '취소' }));
  expect(screen.getByRole('heading', { name: '학습 범위 설정' })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('wordmaster:v1')!).activeSession).toEqual(previousSession);
});
