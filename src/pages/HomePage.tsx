import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DaySelectionGrid } from '../components/DaySelectionGrid';
import { SessionReplacementDialog } from '../components/SessionReplacementDialog';
import type { DaySummary } from '../domain/daySelection';
import type { StudySession } from '../domain/types';
import { PronunciationSettings, type PronunciationSpeechPlayer } from '../speech/PronunciationSettings';

export type HomeViewModel = {
  days: DaySummary[];
  dueReviews: number;
  activeSession: StudySession | null;
  storageError?: string | null;
};

type HomePageProps = {
  viewModel: HomeViewModel;
  onStartStudy?: (dayIds: number[]) => boolean;
  onOpenTest?: () => void;
  speechPlayer?: PronunciationSpeechPlayer;
};

export function HomePage({ viewModel, onStartStudy, onOpenTest, speechPlayer }: HomePageProps) {
  const [selectedDayIds, setSelectedDayIds] = useState<number[]>([]);
  const [replacementOpen, setReplacementOpen] = useState(false);
  const storageAlertRef = useRef<HTMLParagraphElement>(null);
  const previousStorageErrorRef = useRef<string | null | undefined>(undefined);
  const navigate = useNavigate();
  const activeSession = viewModel.activeSession?.completedAt === null ? viewModel.activeSession : null;
  const selectedWordCount = selectedDayIds.reduce((total, day) =>
    total + (viewModel.days.find((summary) => summary.day === day)?.total ?? 0), 0);
  const selectionText = `${selectedDayIds.length}개 선택 · 신규 ${selectedWordCount}개 · 복습 ${viewModel.dueReviews}개`;

  const replace = () => {
    if (onStartStudy?.(selectedDayIds)) {
      navigate('/study');
    } else {
      setReplacementOpen(false);
    }
  };

  useEffect(() => {
    if (viewModel.storageError && viewModel.storageError !== previousStorageErrorRef.current) {
      storageAlertRef.current?.focus();
    }
    previousStorageErrorRef.current = viewModel.storageError;
  }, [viewModel.storageError]);

  const start = () => {
    if (activeSession) setReplacementOpen(true);
    else replace();
  };

  const activeDaysLabel = activeSession?.targetDayIds
    .map((day) => `DAY ${String(day).padStart(2, '0')}`)
    .join(' · ');

  return (
    <main className="page home-page">
      <header className="brand-bar">
        <h1 className="brand">WordMaster</h1>
        <p>오늘 외운 단어가 오래 남도록</p>
      </header>
      {viewModel.storageError && (
        <p ref={storageAlertRef} className="storage-alert" role="alert" tabIndex={-1}>
          {viewModel.storageError}
        </p>
      )}

      {activeSession && (
        <section className="active-session-banner" aria-label="진행 중인 학습">
          <div>
            <strong>{activeDaysLabel}</strong>
            <span>신규 {activeSession.targetWordIds.length}개</span>
            <span>현재 진행 {activeSession.currentIndex} / {activeSession.queue.length}</span>
          </div>
          <Link className="button button--primary" to="/study">이어서 학습하기</Link>
        </section>
      )}

      <section className="routine-card" aria-labelledby="today-heading">
        <div className="routine-card__eyebrow">오늘의 집중 학습</div>
        <div className="routine-card__title-row">
          <div>
            <h2 id="today-heading">학습할 DAY를 선택하세요</h2>
            <p>원하는 DAY를 자유롭게 조합하거나 묶음·범위·랜덤 방식으로 선택할 수 있어요.</p>
          </div>
          <span className="review-pill">오늘 복습 {viewModel.dueReviews}개</span>
        </div>
        <DaySelectionGrid summaries={viewModel.days} selectedDayIds={selectedDayIds} onChange={setSelectedDayIds} />
        <p className="selection-summary">{selectionText}</p>
        <div className="home-actions">
          <button className="button button--primary" type="button" disabled={selectedDayIds.length === 0} onClick={start}>
            {selectedWordCount}개 학습 시작하기
          </button>
          {!activeSession && <Link className="button button--secondary" to="/study/setup">학습 범위 선택하기</Link>}
          <Link className="button button--secondary" to="/test/setup" onClick={onOpenTest}>수시 단어 테스트</Link>
        </div>
      </section>

      {speechPlayer && <PronunciationSettings speechPlayer={speechPlayer} />}

      {replacementOpen && activeSession && (
        <SessionReplacementDialog
          activeDayIds={activeSession.targetDayIds}
          newDayIds={selectedDayIds}
          onCancel={() => setReplacementOpen(false)}
          onContinue={() => navigate('/study')}
          onReplace={replace}
        />
      )}
    </main>
  );
}
