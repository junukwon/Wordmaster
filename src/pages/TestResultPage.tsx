import { summarizeTestAttempt } from '../domain/testEngine';
import { Link } from 'react-router-dom';
import type { QuestionType, TestAttempt, VocabularyWord } from '../domain/types';
import { FanThemeImage } from '../components/FanThemeImage';

type TestResultPageProps = {
  attempt: TestAttempt;
  words: VocabularyWord[];
  onRetryWrong: (wordIds: string[]) => void;
  onPracticeWrong: (wordIds: string[]) => void;
};

const typeLabels: Record<QuestionType, string> = { en_to_ko: '영어 → 뜻', ko_to_en: '뜻 → 영어', spelling: '철자 쓰기' };

export function TestResultPage({ attempt, words, onRetryWrong, onPracticeWrong }: TestResultPageProps) {
  const summary = summarizeTestAttempt(attempt, words);
  const wordById = new Map(words.map((word) => [word.id, word]));
  return (
    <main className="page test-result-page">
      <header className="result-hero">
        <p>테스트를 마쳤어요</p><h1>테스트 결과</h1>
        <strong>{summary.score}점</strong>
        <span>{summary.correct} 맞음 · {summary.uncertain} 헷갈림 · {summary.incorrect} 틀림</span>
      </header>
      <FanThemeImage contextKey={`test-result:${attempt.id}`} className="test-result-theme" ariaLabel="테스트 결과 팬테마" />
      <div className="result-breakdowns">
        <section><h2>DAY별 결과</h2>{Object.entries(summary.byDay).map(([day, value]) => <p key={day}>DAY {String(day).padStart(2, '0')} <strong>{value.correct}/{value.total}</strong></p>)}</section>
        <section><h2>유형별 결과</h2>{Object.entries(summary.byType).filter(([, value]) => value.total > 0).map(([type, value]) => <p key={type}>{typeLabels[type as QuestionType]} <strong>{value.correct}/{value.total}</strong></p>)}</section>
      </div>
      <section className="wrong-list"><h2>틀린 단어</h2>{summary.incorrectWordIds.length === 0 ? <p>틀린 단어가 없어요.</p> : <ul>{summary.incorrectWordIds.map((id) => { const word = wordById.get(id); return <li key={id}><strong>{word?.term}</strong><span>{word?.meanings.join(', ')}</span></li>; })}</ul>}</section>
      <div className="result-actions">
        <button className="button button--primary" type="button" disabled={!summary.incorrectWordIds.length} onClick={() => onRetryWrong(summary.incorrectWordIds)}>틀린 단어만 다시 테스트</button>
        <button className="button button--secondary" type="button" disabled={!summary.incorrectWordIds.length} onClick={() => onPracticeWrong(summary.incorrectWordIds)}>틀린 단어만 필기 연습</button>
        <Link className="button button--secondary" to="/">홈으로 돌아가기</Link>
      </div>
    </main>
  );
}
