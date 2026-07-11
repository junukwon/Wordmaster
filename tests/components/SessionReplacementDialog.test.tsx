import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { SessionReplacementDialog } from '../../src/components/SessionReplacementDialog';

describe('SessionReplacementDialog', () => {
  test('wraps focus forward from the last action to the first action', async () => {
    const user = userEvent.setup();
    render(
      <SessionReplacementDialog
        activeDayIds={[1]}
        newDayIds={[2]}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
        onReplace={vi.fn()}
      />,
    );
    const actions = screen.getAllByRole('button');
    actions[2].focus();
    await user.tab();
    expect(actions[0]).toHaveFocus();
  });

  test('wraps focus backward from the first action to the last action', async () => {
    const user = userEvent.setup();
    render(
      <SessionReplacementDialog
        activeDayIds={[1]}
        newDayIds={[2]}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
        onReplace={vi.fn()}
      />,
    );
    const actions = screen.getAllByRole('button');
    expect(actions[0]).toHaveFocus();
    await user.tab({ shift: true });
    expect(actions[2]).toHaveFocus();
  });

  test('restores focus to the previously focused element when unmounted', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const { unmount } = render(
      <SessionReplacementDialog
        activeDayIds={[1]}
        newDayIds={[2]}
        onCancel={vi.fn()}
        onContinue={vi.fn()}
        onReplace={vi.fn()}
      />,
    );
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

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

    const dialog = screen.getByRole('dialog', { name: '진행 중인 학습이 있어요' });
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

  test('gives each dialog a distinct title id and the correct accessible name', () => {
    const callbacks = {
      onCancel: vi.fn(),
      onContinue: vi.fn(),
      onReplace: vi.fn(),
    };
    render(
      <>
        <SessionReplacementDialog activeDayIds={[1]} newDayIds={[2]} {...callbacks} />
        <SessionReplacementDialog activeDayIds={[3]} newDayIds={[4]} {...callbacks} />
      </>,
    );

    const dialogs = screen.getAllByRole('dialog', { name: '진행 중인 학습이 있어요' });
    const titleIds = dialogs.map((dialog) => dialog.getAttribute('aria-labelledby'));

    expect(titleIds[0]).toBeTruthy();
    expect(titleIds[1]).toBeTruthy();
    expect(titleIds[0]).not.toBe(titleIds[1]);
    expect(document.getElementById(titleIds[0]!)).toHaveTextContent('진행 중인 학습이 있어요');
    expect(document.getElementById(titleIds[1]!)).toHaveTextContent('진행 중인 학습이 있어요');
  });
});
