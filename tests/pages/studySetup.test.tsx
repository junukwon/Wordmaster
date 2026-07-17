import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StudySetupPage } from '../../src/pages/StudySetupPage';
import { buildDaySummaries } from '../../src/domain/studySelection';
import type { VocabularyWord } from '../../src/domain/types';
import type { StudySession } from '../../src/domain/types';

function makeWords(dayCount: number): VocabularyWord[] {
  return Array.from({ length: dayCount * 25 }, (_, index) => ({
    id: String(index + 1).padStart(4, '0'),
    day: Math.floor(index / 25) + 1,
    topic: `DAY ${Math.floor(index / 25) + 1}`,
    term: `word-${index + 1}`,
    phonetic: '',
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

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

test('shows bundle, range and random modes', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><StudySetupPage {...setupProps} /></MemoryRouter>);
  expect(screen.getByRole('tab', { name: '묶음으로 선택' })).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: '범위로 선택' }));
  expect(screen.getByLabelText('시작 DAY')).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: '랜덤으로 선택' }));
  expect(screen.getByLabelText('랜덤 단어 수')).toHaveValue('25');
});

test('restores the setup selection after leaving and returning', async () => {
  const user = userEvent.setup();
  const firstRender = render(<MemoryRouter><StudySetupPage {...setupProps} /></MemoryRouter>);
  await user.click(screen.getByRole('tab', { name: '범위로 선택' }));
  await user.selectOptions(screen.getByLabelText('시작 DAY'), '4');
  await user.selectOptions(screen.getByLabelText('종료 DAY'), '7');

  firstRender.unmount();
  render(<MemoryRouter><StudySetupPage {...setupProps} /></MemoryRouter>);

  expect(screen.getByRole('tab', { name: '범위로 선택' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByLabelText('시작 DAY')).toHaveValue('4');
  expect(screen.getByLabelText('종료 DAY')).toHaveValue('7');
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

test('searches bundle discovery by DAY number and Korean topic without changing the selected target', async () => {
  const user = userEvent.setup();
  const topicWords = setupWords.map((word) => ({
    ...word,
    topic: word.day === 12 ? '여행과 교통' : word.topic,
  }));
  render(
    <MemoryRouter>
      <StudySetupPage
        {...setupProps}
        words={topicWords}
        dayCatalog={buildDaySummaries(topicWords, [])}
      />
    </MemoryRouter>,
  );

  const search = screen.getByRole('searchbox', { name: 'DAY 번호 또는 주제 검색' });
  await user.clear(search);
  await user.type(search, '12');
  expect(screen.getByRole('button', { name: /DAY 11.*15/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /DAY 01.*05/ })).not.toBeInTheDocument();

  await user.clear(search);
  await user.type(search, '여행');
  expect(screen.getByRole('button', { name: /DAY 11.*15/ })).toBeInTheDocument();
  expect(screen.getByText('DAY 01–05 · 125단어')).toBeInTheDocument();
});

test('tab keys move focus and selection with arrows, Home and End', async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><StudySetupPage {...setupProps} /></MemoryRouter>);
  const bundle = screen.getByRole('tab', { name: '묶음으로 선택' });
  const range = screen.getByRole('tab', { name: '범위로 선택' });
  const random = screen.getByRole('tab', { name: '랜덤으로 선택' });

  bundle.focus();
  await user.keyboard('{ArrowRight}');
  expect(range).toHaveFocus();
  expect(range).toHaveAttribute('aria-selected', 'true');
  await user.keyboard('{End}');
  expect(random).toHaveFocus();
  expect(random).toHaveAttribute('aria-selected', 'true');
  await user.keyboard('{ArrowRight}');
  expect(bundle).toHaveFocus();
  await user.keyboard('{Home}');
  expect(bundle).toHaveFocus();
  await user.keyboard('{ArrowLeft}');
  expect(random).toHaveFocus();
});

test('protects an active session until replacement is explicitly confirmed', async () => {
  const user = userEvent.setup();
  const onStart = vi.fn();
  const onContinue = vi.fn();
  const activeSession = {
    id: 'active', date: '2026-07-17', targetDayIds: [9], targetWordIds: ['0201'], queue: [],
    currentIndex: 0, phase: 'recognition' as const, startedAt: '', updatedAt: '', completedAt: null,
  } satisfies StudySession;
  render(
    <MemoryRouter>
      <StudySetupPage
        {...setupProps}
        activeSession={activeSession}
        onStart={onStart}
        onContinue={onContinue}
      />
    </MemoryRouter>,
  );

  await user.click(screen.getByRole('button', { name: '선택한 범위로 학습 시작' }));
  expect(onStart).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '취소' }));
  expect(onStart).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: '선택한 범위로 학습 시작' }));
  await user.click(screen.getByRole('button', { name: '기존 학습 이어하기' }));
  expect(onContinue).toHaveBeenCalledOnce();
  expect(onStart).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: '선택한 범위로 학습 시작' }));
  await user.click(screen.getByRole('button', { name: '새 학습으로 교체' }));
  expect(onStart).toHaveBeenCalledOnce();
});
