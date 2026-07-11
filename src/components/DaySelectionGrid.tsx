import type { DaySummary } from '../domain/daySelection';

type DaySelectionGridProps = {
  summaries: DaySummary[];
  selectedDayIds: number[];
  onChange(nextDayIds: number[]): void;
};

export function DaySelectionGrid({
  summaries,
  selectedDayIds,
  onChange,
}: DaySelectionGridProps) {
  const selected = new Set(selectedDayIds);

  const toggle = (day: number) => {
    const next = new Set(selectedDayIds);

    if (next.has(day)) next.delete(day);
    else next.add(day);

    onChange([...next].sort((left, right) => left - right));
  };

  return (
    <div className="day-grid" aria-label="학습할 DAY 선택">
      {summaries.map((summary) => {
        const isSelected = selected.has(summary.day);
        const dayLabel = `DAY ${String(summary.day).padStart(2, '0')}`;

        return (
          <button
            className="day-card"
            data-selected={isSelected}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${dayLabel} ${summary.topic} ${isSelected ? '선택됨' : '선택 안 됨'}`}
            key={summary.day}
            onClick={() => toggle(summary.day)}
          >
            <span className="day-card__check" aria-hidden="true">
              {isSelected ? '✓' : ''}
            </span>
            <strong>{dayLabel}</strong>
            <span>{summary.topic}</span>
            <small>{summary.total}개</small>
            <div className="day-card__progress">
              <span>숙달 {summary.mastered}</span>
              <span>학습 중 {summary.learning}</span>
              <span>미학습 {summary.unseen}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
