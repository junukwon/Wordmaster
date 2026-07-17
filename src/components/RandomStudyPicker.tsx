export type RandomStudyMode = 'random-days' | 'random-words';

export type RandomStudyPickerProps = {
  mode: RandomStudyMode;
  dayCount: number;
  wordCount: number;
  availableDayCount: number;
  availableWordCount: number;
  onModeChange: (mode: RandomStudyMode) => void;
  onDayCountChange: (count: number) => void;
  onWordCountChange: (count: number) => void;
  onReroll: () => void;
};

export function RandomStudyPicker({
  mode,
  dayCount,
  wordCount,
  availableDayCount,
  availableWordCount,
  onModeChange,
  onDayCountChange,
  onWordCountChange,
  onReroll,
}: RandomStudyPickerProps) {
  const wordOptions = [10, 25, 50, 125].filter((count) => count <= availableWordCount);
  return (
    <div className="test-settings">
      <fieldset>
        <legend>무작위 방식</legend>
        <label className="setting-row">
          <span><input type="radio" name="random-study-mode" value="random-days" checked={mode === 'random-days'} onChange={() => onModeChange('random-days')} /> 랜덤 DAY 묶음</span>
          <select aria-label="랜덤 DAY 수" value={dayCount} onChange={(event) => onDayCountChange(Number(event.target.value))} disabled={mode !== 'random-days'}>
            {Array.from({ length: availableDayCount }, (_, index) => index + 1).map((count) => <option value={count} key={count}>{count}개</option>)}
          </select>
        </label>
        <label className="setting-row">
          <span><input type="radio" name="random-study-mode" value="random-words" checked={mode === 'random-words'} onChange={() => onModeChange('random-words')} /> 랜덤 단어 세트</span>
          <select aria-label="랜덤 단어 수" value={wordCount} onChange={(event) => onWordCountChange(Number(event.target.value))} disabled={mode !== 'random-words'}>
            {wordOptions.map((count) => <option value={count} key={count}>{count}개</option>)}
          </select>
        </label>
      </fieldset>
      <button type="button" className="button button--secondary" onClick={onReroll}>다시 뽑기</button>
    </div>
  );
}
