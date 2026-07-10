import { Link } from 'react-router-dom';
import type { StudySession } from '../domain/types';
import { ProgressBar } from '../components/ProgressBar';

export type HomeViewModel = {
  target: number;
  strong: number;
  uncertain: number;
  weak: number;
  remaining: number;
  dueReviews: number;
  activeSession: StudySession | null;
  storageError?: string | null;
};

type HomePageProps = { viewModel: HomeViewModel; onStartStudy?: () => void; onOpenTest?: () => void };

export function HomePage({ viewModel, onStartStudy, onOpenTest }: HomePageProps) {
  const completed = viewModel.strong + viewModel.uncertain + viewModel.weak;
  const statusCards = [
    { label: '확실함', value: viewModel.strong, className: 'status-card--strong' },
    { label: '헷갈림', value: viewModel.uncertain, className: 'status-card--uncertain' },
    { label: '모름', value: viewModel.weak, className: 'status-card--weak' },
    { label: '남음', value: viewModel.remaining, className: 'status-card--remaining' },
  ];

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
            <h2 id="today-heading">{viewModel.target}개 단어 도전</h2>
            <p>DAY 5개를 5단어씩, 뜻부터 철자까지 차근차근 확인해요.</p>
          </div>
          <span className="review-pill">오늘 복습 {viewModel.dueReviews}개</span>
        </div>

        <ProgressBar value={completed} max={viewModel.target} />

        <div className="status-grid" aria-label="오늘의 단어 상태">
          {statusCards.map((card) => (
            <article className={`status-card ${card.className}`} key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>단어</small>
            </article>
          ))}
        </div>

        <div className="home-actions">
          <Link className="button button--primary" to="/study" onClick={onStartStudy}>
            {viewModel.activeSession ? '이어서 학습하기' : '오늘 학습 시작하기'}
          </Link>
          <Link className="button button--secondary" to="/test/setup" onClick={onOpenTest}>수시 단어 테스트</Link>
        </div>
      </section>
    </main>
  );
}
