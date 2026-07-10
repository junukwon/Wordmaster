import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { HomeViewModel } from '../../src/pages/HomePage';
import { HomePage } from '../../src/pages/HomePage';

const viewModel: HomeViewModel = {
  target: 125,
  strong: 35,
  uncertain: 12,
  weak: 8,
  remaining: 70,
  dueReviews: 9,
  activeSession: {
    id: 'active', date: '2026-07-10', targetDayIds: [1, 2, 3, 4, 5], targetWordIds: [],
    queue: [], currentIndex: 20, phase: 'recall', startedAt: '', updatedAt: '', completedAt: null,
  },
};

test('renders the routine target, status counts, due reviews and resume action', () => {
  render(<MemoryRouter><HomePage viewModel={viewModel} /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: '125개 단어 도전' })).toBeInTheDocument();
  expect(screen.getByText('확실함').closest('article')).toHaveTextContent('35');
  expect(screen.getByText('헷갈림').closest('article')).toHaveTextContent('12');
  expect(screen.getByText('모름').closest('article')).toHaveTextContent('8');
  expect(screen.getByText('남음').closest('article')).toHaveTextContent('70');
  expect(screen.getByText(/오늘 복습 9개/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '이어서 학습하기' })).toBeInTheDocument();
});

test('navigates to on-demand test setup', async () => {
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<HomePage viewModel={{ ...viewModel, activeSession: null }} />} />
        <Route path="/test/setup" element={<h2>테스트 설정 화면</h2>} />
      </Routes>
    </MemoryRouter>,
  );
  await userEvent.click(screen.getByRole('link', { name: '수시 단어 테스트' }));
  expect(screen.getByRole('heading', { name: '테스트 설정 화면' })).toBeInTheDocument();
});
