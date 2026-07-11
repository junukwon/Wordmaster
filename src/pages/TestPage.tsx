import { useRef, useState } from 'react';
import { DrawingCanvas, type DrawingCanvasHandle } from '../drawing/DrawingCanvas';
import { applyTestAnswer, applyTestResultToProgress } from '../domain/testEngine';
import type { TestAttempt, TestResult, VocabularyWord } from '../domain/types';
import type { ProgressRepository } from '../storage/ProgressRepository';
import { ProgressBar } from '../components/ProgressBar';
import { useAnswerRevealGuard } from '../hooks/useAnswerRevealGuard';

type TestPageProps = {
  initialAttempt: TestAttempt;
  words: VocabularyWord[];
  repository?: ProgressRepository;
  onAttemptChange: (attempt: TestAttempt) => void;
  onComplete: (attempt: TestAttempt) => void;
  now?: () => Date;
};

export function TestPage({ initialAttempt, words, repository, onAttemptChange, onComplete, now = () => new Date() }: TestPageProps) {
  const [attempt, setAttempt] = useState(initialAttempt);
  const { revealed, ratingReady, reveal, reset } = useAnswerRevealGuard();
  const drawingRef = useRef<DrawingCanvasHandle>(null);
  const question = attempt.questions[attempt.answers.length];
  const word = words.find((candidate) => candidate.id === question?.wordId);
  if (!question || !word) return null;

  const promptIsEnglish = question.questionType === 'en_to_ko';
  const rate = (result: TestResult) => {
    if (!ratingReady) return;
    const timestamp = now();
    const updated = applyTestAnswer(attempt, result, timestamp);
    if (repository) {
      repository.saveWordProgress(applyTestResultToProgress(repository.getWordProgress(word.id), result, timestamp));
      repository.saveTestAttempt(updated);
    }
    drawingRef.current?.clear();
    setAttempt(updated);
    onAttemptChange(updated);
    reset();
    if (updated.completedAt) onComplete(updated);
  };

  return (
    <main className="page test-run-page">
      <header className="test-run-header">
        <div><span>수시 테스트</span><h1>문제 {attempt.answers.length + 1}</h1></div>
        <ProgressBar value={attempt.answers.length} max={attempt.questions.length} label="테스트 진행률" />
      </header>
      <section className="test-question-card">
        <span className="question-type">{promptIsEnglish ? '영어 → 뜻' : question.questionType === 'spelling' ? '철자 쓰기' : '뜻 → 영어'}</span>
        <p className="test-prompt">{promptIsEnglish ? word.term : word.meanings.join(', ')}</p>
        {question.questionType === 'spelling' && <DrawingCanvas ref={drawingRef} />}
        {revealed && <div className="answer-panel"><span>정답</span><strong>{promptIsEnglish ? word.meanings.join(', ') : word.term}</strong></div>}
      </section>
      <div className="test-answer-actions reveal-stage">
        {!revealed ? <button className="button button--primary" type="button" onClick={reveal}>정답 보기</button> : <span className="reveal-placeholder" aria-hidden="true" />}
      </div>
      {revealed && <div className="rating-stage">
        {!ratingReady && <p role="status">정답을 확인한 뒤 평가해 주세요.</p>}
        <div className="rating-buttons">
          <button className="rating rating--weak" type="button" disabled={!ratingReady} onClick={() => rate('incorrect')}>틀림</button>
          <button className="rating rating--uncertain" type="button" disabled={!ratingReady} onClick={() => rate('uncertain')}>헷갈림</button>
          <button className="rating rating--strong" type="button" disabled={!ratingReady} onClick={() => rate('correct')}>맞음</button>
        </div>
      </div>}
    </main>
  );
}
