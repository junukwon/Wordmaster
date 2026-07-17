import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
import { RandomStudyPicker } from '../components/RandomStudyPicker';
import { SessionReplacementDialog } from '../components/SessionReplacementDialog';
import type { StudySession } from '../domain/types';
import {
  loadStudySetupDraft,
  saveStudySetupDraft,
  type StudySetupDraft,
} from '../storage/StudySetupDraftRepository';

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

function getSessionStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function normalizeDraft(
  draft: StudySetupDraft,
  defaults: StudySetupDraft,
  days: DaySummary[],
  bundles: ReturnType<typeof buildFiveDayBundles>,
  totalWords: number,
): StudySetupDraft {
  const dayNumbers = new Set(days.map((day) => day.dayNumber));
  const bundleStartDays = new Set(bundles.map((bundle) => bundle.dayNumbers[0]));
  const wordCounts = new Set(RANDOM_WORD_COUNTS.filter((count) => count <= totalWords));
  return {
    ...draft,
    bundleStartDay: draft.bundleStartDay === null || bundleStartDays.has(draft.bundleStartDay)
      ? draft.bundleStartDay : defaults.bundleStartDay,
    startDay: draft.startDay === null || dayNumbers.has(draft.startDay) ? draft.startDay : defaults.startDay,
    endDay: draft.endDay === null || dayNumbers.has(draft.endDay) ? draft.endDay : defaults.endDay,
    dayCount: draft.dayCount <= days.length ? draft.dayCount : defaults.dayCount,
    wordCount: wordCounts.has(draft.wordCount as typeof RANDOM_WORD_COUNTS[number])
      ? draft.wordCount : defaults.wordCount,
  };
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
  const defaults = useMemo<StudySetupDraft>(() => ({
    mode: 'bundle',
    bundleStartDay: bundles[0]?.dayNumbers[0] ?? null,
    startDay: firstDay,
    endDay: firstDay,
    randomMode: 'random-days',
    dayCount: 1,
    wordCount: defaultRandomWordCount(words.length),
    seed: 'initial',
    searchQuery: '',
  }), [bundles, firstDay, words.length]);
  const storage = getSessionStorage();
  const [draft, setDraft] = useState(() => normalizeDraft(
    loadStudySetupDraft(storage, defaults), defaults, days, bundles, words.length,
  ));
  const { mode, bundleStartDay, startDay, endDay, randomMode, dayCount, wordCount, seed, searchQuery } = draft;
  const [replacementOpen, setReplacementOpen] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    saveStudySetupDraft(storage, draft);
  }, [draft, storage]);

  const updateDraft = <Key extends keyof StudySetupDraft>(key: Key, value: StudySetupDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

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
  const reroll = () => setDraft((current) => ({
    ...current,
    seed: `${current.seed}-${Date.now()}-${Math.random()}`,
  }));
  const startLabel = '선택한 범위로 학습 시작';
  const modes: Array<{ value: SetupMode; label: string }> = [
    { value: 'bundle', label: '묶음으로 선택' },
    { value: 'range', label: '범위로 선택' },
    { value: 'random', label: '랜덤으로 선택' },
  ];
  const selectTab = (nextIndex: number) => {
    const next = modes[nextIndex];
    updateDraft('mode', next.value);
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
          onChange={(event) => updateDraft('searchQuery', event.target.value)}
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
            onClick={() => updateDraft('mode', value)}
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
        {mode === 'bundle' && <DayBundleList bundles={filteredBundles} value={bundleStartDay} onChange={(value) => updateDraft('bundleStartDay', value)} />}
        {mode === 'range' && <DayRangePicker days={days} startDay={startDay} endDay={endDay} onStartChange={(value) => updateDraft('startDay', value)} onEndChange={(value) => updateDraft('endDay', value)} />}
        {mode === 'random' && <RandomStudyPicker mode={randomMode} dayCount={dayCount} wordCount={wordCount} availableDayCount={days.length} availableWordCount={words.length} onModeChange={(value) => updateDraft('randomMode', value)} onDayCountChange={(value) => updateDraft('dayCount', value)} onWordCountChange={(value) => updateDraft('wordCount', value)} onReroll={reroll} />}
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
