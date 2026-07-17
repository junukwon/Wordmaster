import type { DayRange } from '../domain/homeDayFilter';

export type HomeDayToolbarProps = {
  query: string;
  ranges: DayRange[];
  selectedRangeStart: number;
  onQueryChange(query: string): void;
  onRangeChange(start: number): void;
};

export function HomeDayToolbar({
  query,
  ranges,
  selectedRangeStart,
  onQueryChange,
  onRangeChange,
}: HomeDayToolbarProps) {
  return (
    <div className="home-day-toolbar">
      <label className="home-day-search">
        <span className="visually-hidden">DAY 또는 주제 검색</span>
        <input
          type="search"
          aria-label="DAY 또는 주제 검색"
          placeholder="DAY 또는 주제 검색"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <ul className="day-status-legend" aria-label="학습 상태 범례">
        <li><span className="status-dot status-dot--mastered" aria-hidden="true" />숙달</li>
        <li><span className="status-dot status-dot--learning" aria-hidden="true" />학습 중</li>
        <li><span className="status-dot status-dot--unseen" aria-hidden="true" />미학습</li>
      </ul>
      <div className="day-range-list" aria-label="DAY 구간">
        {ranges.map((range) => (
          <button
            key={range.start}
            type="button"
            aria-pressed={range.start === selectedRangeStart}
            onClick={() => onRangeChange(range.start)}
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  );
}
