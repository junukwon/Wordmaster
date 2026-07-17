import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomeDayToolbar } from '../../src/components/HomeDayToolbar';

const ranges = [
  { start: 1, end: 20, label: 'DAY 01–20' },
  { start: 21, end: 40, label: '21–40' },
];

test('shows one status legend and changes the selected DAY range', async () => {
  const user = userEvent.setup();
  const onQueryChange = vi.fn();
  const onRangeChange = vi.fn();
  render(
    <HomeDayToolbar
      query=""
      ranges={ranges}
      selectedRangeStart={1}
      onQueryChange={onQueryChange}
      onRangeChange={onRangeChange}
    />,
  );

  expect(screen.getByLabelText('DAY 또는 주제 검색')).toBeInTheDocument();
  expect(screen.getByRole('list', { name: '학습 상태 범례' })).toHaveTextContent('숙달학습 중미학습');
  expect(screen.getByRole('button', { name: 'DAY 01–20' })).toHaveAttribute('aria-pressed', 'true');

  await user.click(screen.getByRole('button', { name: '21–40' }));
  expect(onRangeChange).toHaveBeenCalledWith(21);
  await user.type(screen.getByLabelText('DAY 또는 주제 검색'), '학교');
  expect(onQueryChange).toHaveBeenLastCalledWith('교');
});
