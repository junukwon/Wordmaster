import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { SessionReplacementDialog } from '../../src/components/SessionReplacementDialog';

describe('SessionReplacementDialog', () => {
  test('describes both sessions and exposes all three safe actions', async () => {
    const onCancel = vi.fn();
    const onContinue = vi.fn();
    const onReplace = vi.fn();
    render(
      <SessionReplacementDialog
        activeDayIds={[2, 7]}
        newDayIds={[1, 4, 10]}
        onCancel={onCancel}
        onContinue={onContinue}
        onReplace={onReplace}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('DAY 02 · DAY 07');
    expect(dialog).toHaveTextContent('DAY 01 · DAY 04 · DAY 10');
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: '기존 학습 이어하기' }));
    expect(onContinue).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '새 학습으로 교체' }));
    expect(onReplace).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('removes the Escape listener when unmounted', () => {
    const onCancel = vi.fn();
    const { unmount } = render(
      <SessionReplacementDialog
        activeDayIds={[1]}
        newDayIds={[2]}
        onCancel={onCancel}
        onContinue={vi.fn()}
        onReplace={vi.fn()}
      />,
    );

    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
