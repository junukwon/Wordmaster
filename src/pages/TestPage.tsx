import { useRef, useState } from 'react';
import { DrawingCanvas, type DrawingCanvasHandle } from '../drawing/DrawingCanvas';
import { applyTestAnswer, applyTestResultToProgress } from '../domain/testEngine';
import type { TestAttempt, TestResult, VocabularyWord } from '../domain/types';
import type { ProgressRepository } from '../storage/ProgressRepository';
import { ProgressBar } from '../components/ProgressBar';

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
  const [revealed, setRevealed] = useState(false);
  const drawingRef = useRef<DrawingCanvasHandle>(null);
  const question = attempt.questions[attempt.answers.length];
  const word = words.find((candidate) => candidate.id === question?.wordId);
  if (!question || !word) return null;

  const promptIsEnglish = question.questionType === 'en_to_ko';
  const rate = (result: TestResult) => {
    if (!revealed) return;
    const timestamp = now();
    const updated = applyTestAnswer(attempt, result, timestamp);
    if (repository) {
      repository.saveWordProgress(applyTestResultToProgress(repository.getWordProgress(word.id), result, timestamp));
      repository.saveTestAttempt(updated);
    }
    drawingRef.current?.clear();
    setAttempt(updated);
    onAttemptChange(updated);
    setRevealed(false);
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
      <div className="test-answer-actions">
        {!revealed ? <button className="button button--primary" type="button" onClick={() => setRevealed(true)}>정답 보기</button> : (
          <>
            <button className="rating rating--weak" type="button" onClick={() => rate('incorrect')}>틀림</button>
            <button className="rating rating--uncertain" type="button" onClick={() => rate('uncertain')}>헷갈림</button>
            <button className="rating rating--strong" type="button" onClick={() => rate('correct')}>맞음</button>
          </>
        )}
      </div>
    </main>
  );
}
