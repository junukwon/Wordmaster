import { useRef, useState } from 'react';
import { DrawingCanvas, type DrawingCanvasHandle } from '../drawing/DrawingCanvas';
import { applyLearningResult } from '../domain/masteryEngine';
import { applySessionOutcome, getNextStudyItem } from '../domain/sessionEngine';
import type { Rating, StudySession, VocabularyWord } from '../domain/types';
import type { ProgressRepository } from '../storage/ProgressRepository';
import type { SpeechPlayer } from '../speech/SpeechPlayer';
import { ProgressBar } from '../components/ProgressBar';
import { RatingButtons } from '../components/RatingButtons';

export type StudyScreenState = 'prompting' | 'revealed' | 'saving' | 'complete';

type StudyPageProps = {
  words: VocabularyWord[];
  repository: ProgressRepository;
  speechPlayer: Pick<SpeechPlayer, 'speak' | 'isAvailable' | 'getNotice'>;
  initialSession?: StudySession;
  now?: () => Date;
};

export function StudyPage({
  words,
  repository,
  speechPlayer,
  initialSession,
  now = () => new Date(),
}: StudyPageProps) {
  const [session, setSession] = useState<StudySession | null>(
    () => initialSession ?? repository.loadActiveSession(),
  );
  const [screenState, setScreenState] = useState<StudyScreenState>(session ? 'prompting' : 'complete');
  const drawingRef = useRef<DrawingCanvasHandle>(null);
  const item = session ? getNextStudyItem(session) : null;
  const word = item ? words.find((candidate) => candidate.id === item.wordId) : null;

  if (!session || !item || !word || screenState === 'complete') {
    return (
      <main className="page study-page study-page--complete">
        <h1>집중 학습</h1>
        <p>{session?.completedAt ? '오늘의 학습을 마쳤어요.' : '이어갈 학습 세션이 없습니다.'}</p>
        <a className="button button--primary" href="/">홈으로 돌아가기</a>
      </main>
    );
  }

  const dayStart = Math.min(...session.targetDayIds);
  const dayEnd = Math.max(...session.targetDayIds);
  const promptIsEnglish = item.questionType === 'en_to_ko';
  const isRevealed = screenState === 'revealed' || screenState === 'saving';

  const rate = (rating: Rating) => {
    if (screenState === 'saving' || (!isRevealed && rating !== 'weak')) return;
    setScreenState('saving');
    const timestamp = now();
    const currentProgress = repository.getWordProgress(word.id);
    const outcome = applyLearningResult(currentProgress, item.questionType, rating, timestamp);
    repository.saveWordProgress(outcome.progress);
    const updatedSession = applySessionOutcome(session, outcome, timestamp);
    repository.saveActiveSession(updatedSession.completedAt ? null : updatedSession);
    drawingRef.current?.clear();
    setSession(updatedSession);
    setScreenState(updatedSession.completedAt ? 'complete' : 'prompting');
  };

  return (
    <main className="page study-page">
      <header className="study-header">
        <div>
          <a className="back-link" href="/" aria-label="홈으로 돌아가기">← 홈</a>
          <p className="study-kicker">DAY {String(dayStart).padStart(2, '0')}–{String(dayEnd).padStart(2, '0')}</p>
          <h1>집중 학습</h1>
        </div>
        <div className="study-progress" aria-live="polite">
          <strong>문제 {session.currentIndex + 1}</strong>
          <ProgressBar value={Math.min(session.currentIndex, session.targetWordIds.length)} max={session.targetWordIds.length} label="125개 신규 단어 진행률" />
        </div>
      </header>

      <div className="study-layout">
        <section className="prompt-card" aria-label="현재 문제">
          <span className="question-type">
            {promptIsEnglish ? '영어를 보고 뜻을 떠올려 보세요' : item.questionType === 'spelling' ? '뜻을 보고 철자를 써 보세요' : '뜻을 보고 영어를 떠올려 보세요'}
          </span>
          {promptIsEnglish ? (
            <p className="prompt-term">{word.term}</p>
          ) : (
            <>
              <p className="prompt-meaning">{word.meanings.join(', ')}</p>
              <div className="part-of-speech">{word.partOfSpeech.map((part) => <span key={part}>{part}</span>)}</div>
            </>
          )}

          <button className="speech-button" type="button" onClick={() => speechPlayer.speak(word.term)} disabled={!speechPlayer.isAvailable()} aria-label="발음 듣기">
            <span aria-hidden="true">🔊</span> 발음 듣기
          </button>
          {speechPlayer.getNotice() && <p className="inline-notice">{speechPlayer.getNotice()}</p>}

          {isRevealed && (
            <div className="answer-panel" aria-live="polite">
              <span>정답</span>
              <strong>{promptIsEnglish ? word.meanings.join(', ') : word.term}</strong>
              {word.inflection && <small>{word.inflection}</small>}
            </div>
          )}
        </section>

        <section className="writing-card" aria-label="철자 필기">
          <div className="writing-card__header">
            <div><strong>Apple Pencil 필기</strong><small>필기는 저장되지 않아요.</small></div>
            <div className="canvas-actions">
              <button type="button" onClick={() => drawingRef.current?.undo()} aria-label="마지막 획 되돌리기">되돌리기</button>
              <button type="button" onClick={() => drawingRef.current?.clear()} aria-label="필기 전체 지우기">전체 지우기</button>
            </div>
          </div>
          <DrawingCanvas ref={drawingRef} />
        </section>
      </div>

      <div className="study-actions">
        {!isRevealed ? (
          <>
            <button className="button button--secondary" type="button" onClick={() => rate('weak')}>모르겠어요</button>
            <button className="button button--primary" type="button" onClick={() => setScreenState('revealed')}>정답 보기</button>
          </>
        ) : (
          <RatingButtons disabled={screenState === 'saving'} onRate={rate} />
        )}
      </div>
    </main>
  );
}
