import type { DayBundle } from '../domain/studySelection';

export type DayBundleListProps = {
  bundles: DayBundle[];
  value: number | null;
  onChange: (bundleStartDay: number) => void;
};

export function DayBundleList({ bundles, value, onChange }: DayBundleListProps) {
  return (
    <div className="choice-grid choice-grid--days" aria-label="DAY 묶음 목록">
      {bundles.map((bundle) => {
        const first = bundle.dayNumbers[0];
        const last = bundle.dayNumbers[bundle.dayNumbers.length - 1];
        const label = `DAY ${String(first).padStart(2, '0')}–${String(last).padStart(2, '0')} · ${bundle.wordCount}단어`;
        return (
          <button
            className={`button button--secondary ${value === first ? 'is-selected' : ''}`}
            type="button"
            key={bundle.bundleId}
            aria-pressed={value === first}
            onClick={() => onChange(first)}
          >
            {label}
          </button>
        );
      })}
      {bundles.length === 0 && <p role="status">선택할 DAY가 없습니다.</p>}
    </div>
  );
}
