import { useCallback, useMemo, useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { loadVocabulary } from '../content/vocabulary';
import { createStudySession, selectTargetDays } from '../domain/sessionEngine';
import { isReviewDue } from '../domain/reviewScheduler';
import { LocalStorageProgressRepository } from '../storage/LocalStorageProgressRepository';
import { SpeechPlayer } from '../speech/SpeechPlayer';
import type { HomeViewModel } from '../pages/HomePage';
import { AppRouter } from './AppRouter';
import '../styles/global.css';

const vocabulary = loadVocabulary();

export function App() {
  const [repository] = useState(() => new LocalStorageProgressRepository());
  const [speechPlayer] = useState(() => new SpeechPlayer());
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const homeViewModel = useMemo<HomeViewModel>(() => {
    const activeSession = repository.loadActiveSession();
    const progress = repository.getAllWordProgress();
    const targetDays = activeSession?.targetDayIds ?? selectTargetDays(vocabulary, progress);
    const targetDaySet = new Set(targetDays);
    const targetIds = activeSession?.targetWordIds ?? vocabulary.filter((word) => targetDaySet.has(word.day)).map((word) => word.id);
    const targetSet = new Set(targetIds);
    const targetProgress = progress.filter((item) => targetSet.has(item.wordId));
    const strong = targetProgress.filter((item) => item.confidence === 'strong').length;
    const uncertain = targetProgress.filter((item) => item.confidence === 'uncertain').length;
    const weak = targetProgress.filter((item) => item.confidence === 'weak').length;
    return {
      target: targetIds.length,
      strong,
      uncertain,
      weak,
      remaining: targetIds.length - strong - uncertain - weak,
      dueReviews: progress.filter((item) => isReviewDue(item, new Date())).length,
      activeSession,
      storageError: repository.getLastError(),
    };
  }, [repository, revision]);

  const startStudy = useCallback(() => {
    if (!repository.loadActiveSession()) {
      const progress = repository.getAllWordProgress();
      repository.saveActiveSession(createStudySession(vocabulary, selectTargetDays(vocabulary, progress), progress, new Date()));
      refresh();
    }
  }, [repository, refresh]);

  return (
    <HashRouter>
      <AppRouter
        homeViewModel={homeViewModel}
        words={vocabulary}
        repository={repository}
        speechPlayer={speechPlayer}
        onStartStudy={startStudy}
        onDataChanged={refresh}
      />
    </HashRouter>
  );
}
