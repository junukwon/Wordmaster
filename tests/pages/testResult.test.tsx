import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import words from '../../src/content/vocabulary.json';
import type { TestAttempt } from '../../src/domain/types';
import { TestResultPage } from '../../src/pages/TestResultPage';

vi.mock('../../src/components/FanThemeImage', () => ({
  FanThemeImage: ({ contextKey }: { contextKey: string }) => <div data-testid="fan-theme-frame" data-context-key={contextKey} />,
}));

const baseAttempt: TestAttempt = {
  id: 'attempt-fixed', dayIds: [1], wordIds: ['0001'], questions: [{ wordId: '0001', questionType: 'en_to_ko' }],
  mode: 'en_to_ko', order: 'number', answers: [{ wordId: '0001', questionType: 'en_to_ko', result: 'correct' }],
  startedAt: '2026-07-10T09:00:00.000Z', completedAt: '2026-07-10T09:01:00.000Z',
};

test.each(['correct', 'incorrect'] as const)('uses only attempt id for a %s-scored result image', (result) => {
  const attempt = { ...baseAttempt, answers: [{ ...baseAttempt.answers[0], result }] };
  render(<MemoryRouter><TestResultPage attempt={attempt} words={words} onRetryWrong={() => {}} onPracticeWrong={() => {}} /></MemoryRouter>);
  expect(screen.getByTestId('fan-theme-frame')).toHaveAttribute('data-context-key', 'test-result:attempt-fixed');
});

test('keeps retry and practice actions unchanged', async () => {
  const retry = vi.fn();
  const practice = vi.fn();
  const attempt = { ...baseAttempt, answers: [{ ...baseAttempt.answers[0], result: 'incorrect' as const }] };
  render(<MemoryRouter><TestResultPage attempt={attempt} words={words} onRetryWrong={retry} onPracticeWrong={practice} /></MemoryRouter>);
  await userEvent.click(screen.getAllByRole('button')[0]);
  await userEvent.click(screen.getAllByRole('button')[1]);
  expect(retry).toHaveBeenCalledWith(['0001']);
  expect(practice).toHaveBeenCalledWith(['0001']);
});
