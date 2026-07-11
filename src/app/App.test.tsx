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

test('a storage failure stays on home and displays an error', async () => {
  const user = userEvent.setup();
  render(<App />);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await user.click(screen.getByRole('button', { name: /DAY 02/ }));
  await user.click(screen.getByRole('button', { name: '25개 학습 시작하기' }));
  expect(screen.getByRole('heading', { name: 'WordMaster' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
