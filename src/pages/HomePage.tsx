import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DaySelectionGrid } from '../components/DaySelectionGrid';
import { SessionReplacementDialog } from '../components/SessionReplacementDialog';
import type { DaySummary } from '../domain/daySelection';
import type { StudySession } from '../domain/types';

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
};

export function HomePage({ viewModel, onStartStudy, onOpenTest }: HomePageProps) {
  const [selectedDayIds, setSelectedDayIds] = useState<number[]>([]);
  const [replacementOpen, setReplacementOpen] = useState(false);
  const navigate = useNavigate();
  const selectedWordCount = selectedDayIds.reduce((total, day) =>
    total + (viewModel.days.find((summary) => summary.day === day)?.total ?? 0), 0);
  const selectionText = `${selectedDayIds.length}개 선택 · 신규 ${selectedWordCount}개 · 복습 ${viewModel.dueReviews}개`;

  const replace = () => {
    if (onStartStudy?.(selectedDayIds)) navigate('/study');
  };

  const start = () => {
    if (viewModel.activeSession) setReplacementOpen(true);
    else replace();
  };

  return (
    <main className="page home-page">
      <header className="brand-bar">
        <h1 className="brand">WordMaster</h1>
        <p>오늘 외운 단어가 오래 남도록</p>
      </header>
      {viewModel.storageError && <p className="storage-alert" role="alert">{viewModel.storageError}</p>}

      <section className="routine-card" aria-labelledby="today-heading">
        <div className="routine-card__eyebrow">오늘의 집중 학습</div>
        <div className="routine-card__title-row">
          <div>
            <h2 id="today-heading">학습할 DAY를 선택하세요</h2>
            <p>원하는 DAY를 자유롭게 조합해 학습할 수 있어요.</p>
          </div>
          <span className="review-pill">오늘 복습 {viewModel.dueReviews}개</span>
        </div>
        <DaySelectionGrid summaries={viewModel.days} selectedDayIds={selectedDayIds} onChange={setSelectedDayIds} />
        <p className="selection-summary">{selectionText}</p>
        <div className="home-actions">
          <button className="button button--primary" type="button" disabled={selectedDayIds.length === 0} onClick={start}>
            {selectedWordCount}개 학습 시작하기
          </button>
          <Link className="button button--secondary" to="/test/setup" onClick={onOpenTest}>수시 단어 테스트</Link>
        </div>
      </section>

      {replacementOpen && viewModel.activeSession && (
        <SessionReplacementDialog
          activeDayIds={viewModel.activeSession.targetDayIds}
          newDayIds={selectedDayIds}
          onCancel={() => setReplacementOpen(false)}
          onContinue={() => navigate('/study')}
          onReplace={replace}
        />
      )}
    </main>
  );
}
