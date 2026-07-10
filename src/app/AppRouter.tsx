import { useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { HomePage, type HomeViewModel } from '../pages/HomePage';
import { StudyPage } from '../pages/StudyPage';
import { TestPage } from '../pages/TestPage';
import { TestResultPage } from '../pages/TestResultPage';
import { TestSetupPage } from '../pages/TestSetupPage';
import { fisherYatesShuffle } from '../domain/sessionEngine';
import type { QuestionType, TestAttempt, VocabularyWord } from '../domain/types';
import type { ProgressRepository } from '../storage/ProgressRepository';
import type { SpeechPlayer } from '../speech/SpeechPlayer';

type AppRouterProps = {
  homeViewModel: HomeViewModel;
  words: VocabularyWord[];
  repository: ProgressRepository;
  speechPlayer: SpeechPlayer;
  onStartStudy: () => void;
  onDataChanged: () => void;
};

export function AppRouter({ homeViewModel, words, repository, speechPlayer, onStartStudy, onDataChanged }: AppRouterProps) {
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [result, setResult] = useState<TestAttempt | null>(null);
  const [limitedWordIds, setLimitedWordIds] = useState<string[] | undefined>();
  const [setupMode, setSetupMode] = useState<QuestionType | 'mixed'>('mixed');

  const startTest = (nextAttempt: TestAttempt) => {
    repository.saveTestAttempt(nextAttempt);
    setAttempt(nextAttempt);
    setResult(null);
    navigate('/test/run');
  };

  const completeTest = (completed: TestAttempt) => {
    repository.saveTestAttempt(completed);
    setResult(completed);
    onDataChanged();
    navigate('/test/result');
  };

  const retry = (wordIds: string[], mode: QuestionType | 'mixed') => {
    setLimitedWordIds(wordIds);
    setSetupMode(mode);
    setAttempt(null);
    setResult(null);
    navigate('/test/setup');
  };

  return (
    <Routes>
      <Route path="/" element={<HomePage viewModel={homeViewModel} onStartStudy={onStartStudy} />} />
      <Route path="/study" element={<StudyPage words={words} repository={repository} speechPlayer={speechPlayer} onProgressChange={onDataChanged} />} />
      <Route path="/test/setup" element={<TestSetupPage words={words} progress={repository.getAllWordProgress()} shuffle={fisherYatesShuffle} onStart={startTest} initialWordIds={limitedWordIds} initialMode={setupMode} />} />
      <Route path="/test/run" element={attempt ? <TestPage initialAttempt={attempt} words={words} repository={repository} onAttemptChange={setAttempt} onComplete={completeTest} /> : <Navigate to="/test/setup" replace />} />
      <Route path="/test/result" element={result ? <TestResultPage attempt={result} words={words} onRetryWrong={(ids) => retry(ids, 'mixed')} onPracticeWrong={(ids) => retry(ids, 'spelling')} /> : <Navigate to="/test/setup" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
