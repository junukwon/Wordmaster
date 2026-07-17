import type { DaySummary } from '../domain/studySelection';

export type DayRangePickerProps = {
  days: DaySummary[];
  startDay: number | null;
  endDay: number | null;
  onStartChange: (day: number | null) => void;
  onEndChange: (day: number | null) => void;
};

export function DayRangePicker({ days, startDay, endDay, onStartChange, onEndChange }: DayRangePickerProps) {
  return (
    <div className="setting-row" role="group" aria-label="DAY 범위">
      <label>
        시작 DAY
        <select aria-label="시작 DAY" value={startDay ?? ''} onChange={(event) => onStartChange(event.target.value ? Number(event.target.value) : null)}>
          <option value="">선택</option>
          {days.map((day) => <option value={day.dayNumber} key={day.dayId}>DAY {String(day.dayNumber).padStart(2, '0')}</option>)}
        </select>
      </label>
      <span aria-hidden="true">–</span>
      <label>
        종료 DAY
        <select aria-label="종료 DAY" value={endDay ?? ''} onChange={(event) => onEndChange(event.target.value ? Number(event.target.value) : null)}>
          <option value="">선택</option>
          {days.map((day) => <option value={day.dayNumber} key={day.dayId}>DAY {String(day.dayNumber).padStart(2, '0')}</option>)}
        </select>
      </label>
    </div>
  );
}
