import { useEffect, useId, useRef } from 'react';

interface SessionReplacementDialogProps {
  activeDayIds: number[];
  newDayIds: number[];
  onCancel: () => void;
  onContinue: () => void;
  onReplace: () => void;
}

function formatDays(dayIds: number[]): string {
  return [...dayIds]
    .sort((left, right) => left - right)
    .map((dayId) => `DAY ${String(dayId).padStart(2, '0')}`)
    .join(' · ');
}

export function SessionReplacementDialog({
  activeDayIds,
  newDayIds,
  onCancel,
  onContinue,
  onReplace,
}: SessionReplacementDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const replaceRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;

      const firstAction = cancelRef.current;
      const lastAction = replaceRef.current;
      if (!firstAction || !lastAction) return;

      if (event.shiftKey && document.activeElement === firstAction) {
        event.preventDefault();
        lastAction.focus();
      } else if (!event.shiftKey && document.activeElement === lastAction) {
        event.preventDefault();
        firstAction.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onCancel]);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="session-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>진행 중인 학습이 있어요</h2>
        <p>
          기존 {formatDays(activeDayIds)} 학습을 이어가거나 새 {formatDays(newDayIds)} 학습으로
          교체할 수 있어요.
        </p>
        <div className="session-dialog__actions">
          <button ref={cancelRef} type="button" onClick={onCancel}>취소</button>
          <button ref={continueRef} type="button" onClick={onContinue}>기존 학습 이어하기</button>
          <button ref={replaceRef} type="button" onClick={onReplace}>새 학습으로 교체</button>
        </div>
      </section>
    </div>
  );
}
