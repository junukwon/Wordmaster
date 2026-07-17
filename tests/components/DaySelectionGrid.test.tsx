import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { DaySelectionGrid } from '../../src/components/DaySelectionGrid';
import type { DaySummary } from '../../src/domain/daySelection';

const summaries: DaySummary[] = [
  { day: 1, topic: '사람 묘사 I', total: 25, mastered: 8, learning: 5, unseen: 12 },
  { day: 7, topic: '사고, 생각', total: 25, mastered: 0, learning: 2, unseen: 23 },
];

describe('DaySelectionGrid', () => {
  test('renders DAY progress and toggles arbitrary cards in ascending order', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <DaySelectionGrid summaries={summaries} selectedDayIds={[7]} onChange={onChange} />,
    );

    expect(screen.getByRole('button', { name: /DAY 01 사람 묘사 I/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /DAY 07 사고, 생각/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('숙달 8')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /DAY 01 사람 묘사 I/ }));
    expect(onChange).toHaveBeenCalledWith([1, 7]);

    view.rerender(
      <DaySelectionGrid summaries={summaries} selectedDayIds={[1, 7]} onChange={onChange} />,
    );
    await user.click(screen.getByRole('button', { name: /DAY 07 사고, 생각/ }));
    expect(onChange).toHaveBeenLastCalledWith([1]);
  });
});
