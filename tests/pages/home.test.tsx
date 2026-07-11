import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { HomeViewModel } from '../../src/pages/HomePage';
import { HomePage } from '../../src/pages/HomePage';

const days = Array.from({ length: 10 }, (_, index) => ({
  day: index + 1,
  topic: `${index + 1}일차 주제`,
  total: 25,
  mastered: 0,
  learning: 0,
  unseen: 25,
}));

const activeSession = {
  id: 'active', date: '2026-07-10', targetDayIds: [1, 3], targetWordIds: ['0001', '0002'],
  queue: ['one', 'two', 'three', 'four'], currentIndex: 2, phase: 'recall' as const,
  startedAt: '', updatedAt: '', completedAt: null,
};

const viewModel: HomeViewModel = { days, dueReviews: 9, activeSession: null };

function renderHome(model = viewModel, onStartStudy = vi.fn(() => true)) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage viewModel={model} onStartStudy={onStartStudy} />} />
        <Route path="/study" element={<h2>집중 학습</h2>} />
        <Route path="/test/setup" element={<h2>테스트 설정 화면</h2>} />
      </Routes>
    </MemoryRouter>,
  );
  return onStartStudy;
}

test('selects any DAY cards and starts the exact selection', async () => {
  const user = userEvent.setup();
  const onStartStudy = renderHome();
  expect(screen.getAllByRole('button', { name: /DAY \d{2}/ })).toHaveLength(10);
  expect(screen.getByRole('button', { name: /학습 시작하기/ })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: /DAY 02/ }));
  await user.click(screen.getByRole('button', { name: /DAY 07/ }));
  expect(screen.getByText('2개 선택 · 신규 50개 · 복습 9개')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '50개 학습 시작하기' }));
  expect(onStartStudy).toHaveBeenCalledOnce();
  expect(onStartStudy).toHaveBeenCalledWith([2, 7]);
  expect(screen.getByRole('heading', { name: '집중 학습' })).toBeInTheDocument();
});

test('shows an unfinished session summary with a direct resume link', async () => {
  renderHome({ ...viewModel, activeSession });
  const banner = screen.getByRole('region', { name: '진행 중인 학습' });
  expect(banner).toHaveTextContent('DAY 01 · DAY 03');
  expect(banner).toHaveTextContent('신규 2개');
  expect(banner).toHaveTextContent('현재 진행 2 / 4');
  await userEvent.click(screen.getByRole('link', { name: '이어서 학습하기' }));
  expect(screen.getByRole('heading', { name: '집중 학습' })).toBeInTheDocument();
});

test('a completed saved session is stale and does not require replacement confirmation', async () => {
  const user = userEvent.setup();
  const onStartStudy = renderHome({
    ...viewModel,
    activeSession: { ...activeSession, completedAt: '2026-07-10T10:00:00.000Z' },
  });
  expect(screen.queryByRole('region', { name: '진행 중인 학습' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /DAY 02/ }));
  await user.click(screen.getByRole('button', { name: '25개 학습 시작하기' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(onStartStudy).toHaveBeenCalledWith([2]);
  expect(screen.getByRole('heading', { name: '집중 학습' })).toBeInTheDocument();
});

test('stays home and shows the storage error when starting fails', async () => {
  const user = userEvent.setup();
  const onStartStudy = vi.fn(() => false);
  const { rerender } = render(
    <MemoryRouter><HomePage viewModel={{ ...viewModel, storageError: '학습 기록을 저장하지 못했습니다.' }} onStartStudy={onStartStudy} /></MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: /DAY 02/ }));
  await user.click(screen.getByRole('button', { name: '25개 학습 시작하기' }));
  expect(onStartStudy).toHaveBeenCalledWith([2]);
  expect(screen.getByRole('heading', { name: 'WordMaster' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('학습 기록을 저장하지 못했습니다.');
  rerender(<></>);
});

test('cancels replacement without losing selection and continues the saved session', async () => {
  const user = userEvent.setup();
  const onStartStudy = renderHome({ ...viewModel, activeSession });
  await user.click(screen.getByRole('button', { name: /DAY 02/ }));
  await user.click(screen.getByRole('button', { name: /DAY 07/ }));
  await user.click(screen.getByRole('button', { name: '50개 학습 시작하기' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '취소' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /DAY 02/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: /DAY 07/ })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: '50개 학습 시작하기' }));
  await user.click(screen.getByRole('button', { name: '기존 학습 이어하기' }));
  expect(onStartStudy).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: '집중 학습' })).toBeInTheDocument();
});

test('replaces an unfinished session with the exact selected DAYs', async () => {
  const user = userEvent.setup();
  const onStartStudy = renderHome({ ...viewModel, activeSession });
  await user.click(screen.getByRole('button', { name: /DAY 02/ }));
  await user.click(screen.getByRole('button', { name: /DAY 07/ }));
  await user.click(screen.getByRole('button', { name: '50개 학습 시작하기' }));
  await user.click(screen.getByRole('button', { name: '새 학습으로 교체' }));
  expect(onStartStudy).toHaveBeenCalledOnce();
  expect(onStartStudy).toHaveBeenCalledWith([2, 7]);
  expect(screen.getByRole('heading', { name: '집중 학습' })).toBeInTheDocument();
});

test('navigates to on-demand test setup', async () => {
  renderHome();
  await userEvent.click(screen.getByRole('link', { name: '수시 단어 테스트' }));
  expect(screen.getByRole('heading', { name: '테스트 설정 화면' })).toBeInTheDocument();
});
