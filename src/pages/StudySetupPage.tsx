import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  buildDaySummaries,
  buildFiveDayBundles,
  formatSelectionSummary,
  resolveStudySelection,
  type DaySummary,
  type StudySelection,
  type StudyTarget,
} from '../domain/studySelection';
import type { VocabularyWord, WordProgress } from '../domain/types';
import { DayBundleList } from '../components/DayBundleList';
import { DayRangePicker } from '../components/DayRangePicker';
import { RandomStudyPicker, type RandomStudyMode } from '../components/RandomStudyPicker';
import { SessionReplacementDialog } from '../components/SessionReplacementDialog';
import type { StudySession } from '../domain/types';

export type StudySetupPageProps = {
  words: VocabularyWord[];
  progress: WordProgress[];
  dayCatalog: DaySummary[];
  onStart: (target: StudyTarget) => void;
  activeSession?: StudySession | null;
  onContinue?: () => void;
};

type SetupMode = 'bundle' | 'range' | 'random';
const RANDOM_WORD_COUNTS = [10, 25, 50, 125] as const;

function defaultRandomWordCount(total: number): number {
  if (total >= 25) return 25;
  return RANDOM_WORD_COUNTS.filter((count) => count <= total).at(-1) ?? 10;
}

function seededRandom(seed: string) {
  let state = 0;
  for (let index = 0; index < seed.length; index += 1) state = (state * 31 + seed.charCodeAt(index)) >>> 0;
  return (maxExclusive: number) => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return maxExclusive ? (state / 0x100000000) * maxExclusive : 0;
  };
}

export function StudySetupPage({
  words,
  progress,
  dayCatalog,
  onStart,
  activeSession = null,
  onContinue,
}: StudySetupPageProps) {
  const days = dayCatalog.length ? dayCatalog : buildDaySummaries(words, progress);
  const bundles = useMemo(() => buildFiveDayBundles(days), [days]);
  const firstDay = days[0]?.dayNumber ?? null;
  const [mode, setMode] = useState<SetupMode>('bundle');
  const [bundleStartDay, setBundleStartDay] = useState<number | null>(bundles[0]?.dayNumbers[0] ?? null);
  const [startDay, setStartDay] = useState<number | null>(firstDay);
  const [endDay, setEndDay] = useState<number | null>(firstDay);
  const [randomMode, setRandomMode] = useState<RandomStudyMode>('random-days');
  const [dayCount, setDayCount] = useState(1);
  const [wordCount, setWordCount] = useState(defaultRandomWordCount(words.length));
  const [seed, setSeed] = useState('initial');
  const [searchQuery, setSearchQuery] = useState('');
  const [replacementOpen, setReplacementOpen] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filteredBundles = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ko');
    if (!query) return bundles;
    const numericMatch = query.match(/^(?:day\s*)?0*(\d+)$/i);
    const requestedDay = numericMatch ? Number(numericMatch[1]) : null;
    return bundles.filter((bundle) => (
      requestedDay !== null
        ? bundle.dayNumbers.includes(requestedDay)
        : bundle.days.some((day) => day.title?.toLocaleLowerCase('ko').includes(query))
    ));
  }, [bundles, searchQuery]);

  const selection = useMemo<StudySelection | null>(() => {
    if (mode === 'bundle' && bundleStartDay !== null) return { mode: 'bundle', bundleStartDay };
    if (mode === 'range' && startDay !== null && endDay !== null) return { mode: 'range', startDay, endDay };
    if (mode === 'random' && randomMode === 'random-days') return { mode: 'random-days', dayCount, seed };
    if (mode === 'random' && randomMode === 'random-words') return { mode: 'random-words', wordCount, seed };
    return null;
  }, [mode, bundleStartDay, startDay, endDay, randomMode, dayCount, wordCount, seed]);

  const target = useMemo(() => {
    if (!selection) return null;
    try {
      return resolveStudySelection(selection, words, selection.mode.startsWith('random') ? seededRandom(seed) : undefined);
    } catch {
      return null;
    }
  }, [selection, words, seed]);

  const startStudy = () => {
    if (!target) return;
    if (activeSession?.completedAt === null) {
      setReplacementOpen(true);
      return;
    }
    onStart(target);
  };
  const reroll = () => setSeed((current) => `${current}-${Date.now()}-${Math.random()}`);
  const startLabel = '선택한 범위로 학습 시작';
  const modes: Array<{ value: SetupMode; label: string }> = [
    { value: 'bundle', label: '묶음으로 선택' },
    { value: 'range', label: '범위로 선택' },
    { value: 'random', label: '랜덤으로 선택' },
  ];
  const selectTab = (nextIndex: number) => {
    const next = modes[nextIndex];
    setMode(next.value);
    tabRefs.current[nextIndex]?.focus();
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % modes.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + modes.length) % modes.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = modes.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(nextIndex);
  };

  return (
    <main className="page study-setup-page">
      <Link className="back-link" to="/">← 홈</Link>
      <header className="test-header">
        <p className="study-kicker">오늘 공부할 범위를 골라보세요</p>
        <h1>학습 범위 설정</h1>
        <p>DAY 묶음, 원하는 범위, 또는 무작위 단어로 시작할 수 있어요.</p>
      </header>
      <label className="study-day-search">
        <span>DAY 번호 또는 주제 검색</span>
        <input
          type="search"
          aria-label="DAY 번호 또는 주제 검색"
          placeholder="예: 12, 여행"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </label>
      <div className="choice-grid study-mode-tabs" role="tablist" aria-label="학습 범위 선택 방식">
        {modes.map(({ value, label }, index) => (
          <button
            key={value}
            ref={(element) => { tabRefs.current[index] = element; }}
            id={`study-setup-tab-${value}`}
            role="tab"
            type="button"
            aria-selected={mode === value}
            aria-controls={`study-setup-panel-${value}`}
            tabIndex={mode === value ? 0 : -1}
            className="button button--secondary"
            onClick={() => setMode(value)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {label}
          </button>
        ))}
      </div>

      <section
        className="test-settings study-setup-panel"
        id={`study-setup-panel-${mode}`}
        role="tabpanel"
        aria-labelledby={`study-setup-tab-${mode}`}
        aria-live="polite"
      >
        {mode === 'bundle' && <DayBundleList bundles={filteredBundles} value={bundleStartDay} onChange={setBundleStartDay} />}
        {mode === 'range' && <DayRangePicker days={days} startDay={startDay} endDay={endDay} onStartChange={setStartDay} onEndChange={setEndDay} />}
        {mode === 'random' && <RandomStudyPicker mode={randomMode} dayCount={dayCount} wordCount={wordCount} availableDayCount={days.length} availableWordCount={words.length} onModeChange={setRandomMode} onDayCountChange={setDayCount} onWordCountChange={setWordCount} onReroll={reroll} />}
      </section>

      <section className="test-summary selection-summary" id="study-selection-summary" aria-live="polite">
        <div><strong>{target ? formatSelectionSummary(target) : '학습 범위를 선택하세요'}</strong>{target && <span>{target.targetWordIds.length}단어를 학습합니다.</span>}</div>
        <button className="button button--primary" type="button" aria-describedby="study-selection-summary" disabled={!target} onClick={startStudy}>{startLabel}</button>
      </section>
      {replacementOpen && target && activeSession?.completedAt === null && (
        <SessionReplacementDialog
          activeDayIds={activeSession.targetDayIds}
          newDayIds={target.targetDayIds}
          onCancel={() => setReplacementOpen(false)}
          onContinue={() => {
            setReplacementOpen(false);
            onContinue?.();
          }}
          onReplace={() => {
            setReplacementOpen(false);
            onStart(target);
          }}
        />
      )}
    </main>
  );
}
