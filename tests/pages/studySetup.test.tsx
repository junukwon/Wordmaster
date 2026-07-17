import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StudySetupPage } from '../../src/pages/StudySetupPage';
import { buildDaySummaries } from '../../src/domain/studySelection';
import type { VocabularyWord } from '../../src/domain/types';

function makeWords(dayCount: number): VocabularyWord[] {
  return Array.from({ length: dayCount * 25 }, (_, index) => ({
    id: String(index + 1).padStart(4, '0'),
    day: Math.floor(index / 25) + 1,
    topic: `DAY ${Math.floor(index / 25) + 1}`,
    term: `word-${index + 1}`,
    partOfSpeech: ['명사'],
    meanings: [`뜻-${index + 1}`],
  }));
}

const setupWords = makeWords(20);
const setupProps = {
  words: setupWords,
  progress: [],
  dayCatalog: buildDaySummaries(setupWords, []),
  onStart: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

test('shows bundle, range and random modes', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><StudySetupPage {...setupProps} /></MemoryRouter>);
  expect(screen.getByRole('tab', { name: '묶음으로 선택' })).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: '범위로 선택' }));
  expect(screen.getByLabelText('시작 DAY')).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: '랜덤으로 선택' }));
  expect(screen.getByLabelText('랜덤 단어 수')).toHaveValue('25');
});

test('setup tabs expose controlled panel semantics and a visible start action', () => {
  render(<MemoryRouter><StudySetupPage {...setupProps} /></MemoryRouter>);
  const bundleTab = screen.getByRole('tab', { name: '묶음으로 선택' });
  expect(bundleTab).toHaveAttribute('aria-selected', 'true');
  expect(bundleTab).toHaveAttribute('aria-controls', 'study-setup-panel-bundle');
  expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'study-setup-panel-bundle');
  expect(screen.getByRole('button', { name: '선택한 범위로 학습 시작' })).toBeVisible();
});

test('displays a clear summary and passes a target on start', async () => {
  const user = userEvent.setup();
  const onStart = vi.fn();
  render(<MemoryRouter><StudySetupPage {...setupProps} onStart={onStart} /></MemoryRouter>);
  await user.click(screen.getByRole('button', { name: /DAY 01.*05/ }));
  expect(screen.getByText('125단어를 학습합니다.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '선택한 범위로 학습 시작' }));
  expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ targetDayIds: [1, 2, 3, 4, 5] }));
});

test('disables start for an empty selection and lets random selection be regenerated', async () => {
  const user = userEvent.setup();
  const onStart = vi.fn();
  render(<MemoryRouter><StudySetupPage {...setupProps} onStart={onStart} /></MemoryRouter>);
  await user.click(screen.getByRole('tab', { name: '범위로 선택' }));
  const start = screen.getByLabelText('시작 DAY');
  await user.selectOptions(start, '');
  expect(screen.getByRole('button', { name: '선택한 범위로 학습 시작' })).toBeDisabled();
  const end = screen.getByLabelText('종료 DAY');
  await user.selectOptions(start, '1');
  await user.selectOptions(end, '1');
  expect(screen.getByRole('button', { name: '선택한 범위로 학습 시작' })).toBeEnabled();
  await user.click(screen.getByRole('tab', { name: '랜덤으로 선택' }));
  expect(screen.getByRole('button', { name: '다시 뽑기' })).toBeInTheDocument();
});
