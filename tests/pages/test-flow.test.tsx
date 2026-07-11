import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import words from '../../src/content/vocabulary.json';
import type { TestAttempt } from '../../src/domain/types';
import { TestSetupPage } from '../../src/pages/TestSetupPage';
import { TestPage } from '../../src/pages/TestPage';
import { TestResultPage } from '../../src/pages/TestResultPage';

vi.mock('../../src/components/FanThemeImage', () => ({
  FanThemeImage: ({ contextKey }: { contextKey: string }) => <div data-testid="fan-theme-frame" data-context-key={contextKey} />,
}));

const now = new Date('2026-07-10T09:00:00.000Z');
const identity = <T,>(items: T[]) => items;

function TestFlow() {
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [result, setResult] = useState<TestAttempt | null>(null);
  const [action, setAction] = useState('');
  if (result) return <><TestResultPage attempt={result} words={words} onRetryWrong={() => setAction('retry')} onPracticeWrong={() => setAction('practice')} /><output>{action}</output></>;
  if (attempt) return <TestPage initialAttempt={attempt} words={words} onAttemptChange={setAttempt} onComplete={setResult} now={() => now} />;
  return <TestSetupPage words={words} progress={[]} shuffle={identity} now={() => now} onStart={setAttempt} />;
}

test('configures and completes a mixed 10-word test with result actions', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><TestFlow /></MemoryRouter>);
  expect(document.querySelector('.test-question-card [data-testid^="fan-theme-"]')).toBeNull();
  expect(screen.getByRole('heading', { name: '수시 단어 테스트' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'DAY 01' })).toBeChecked();
  await user.selectOptions(screen.getByLabelText('문제 유형'), 'mixed');
  await user.selectOptions(screen.getByLabelText('문제 수'), '10');
  await user.selectOptions(screen.getByLabelText('출제 순서'), 'number');
  expect(screen.getByText(/10문제/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '테스트 시작하기' }));

  for (let index = 0; index < 10; index += 1) {
    expect(document.querySelector('.test-question-card [data-testid^="fan-theme-"]')).toBeNull();
    await user.click(screen.getByRole('button', { name: '정답 보기' }));
    await user.click(screen.getByRole('button', { name: index === 0 ? '틀림' : '맞음' }));
  }

  expect(screen.getByRole('heading', { name: '테스트 결과' })).toBeInTheDocument();
  expect(screen.getByText('90점')).toBeInTheDocument();
  expect(screen.getByText(/DAY별 결과/)).toBeInTheDocument();
  expect(screen.getByText(/유형별 결과/)).toBeInTheDocument();
  expect(screen.getByText('knee')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '틀린 단어만 다시 테스트' }));
  expect(screen.getByText('retry')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '틀린 단어만 필기 연습' }));
  expect(screen.getByText('practice')).toBeInTheDocument();
});

test('preselects the DAYs that contain retry-only words', () => {
  render(<MemoryRouter><TestSetupPage words={words} progress={[]} shuffle={identity} now={() => now} onStart={() => {}} initialWordIds={['0126']} /></MemoryRouter>);
  expect(screen.getByRole('checkbox', { name: 'DAY 06' })).toBeChecked();
  expect(screen.getByText(/1문제/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '테스트 시작하기' })).toBeEnabled();
});
