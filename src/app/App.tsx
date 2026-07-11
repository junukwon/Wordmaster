import { useCallback, useMemo, useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { loadVocabulary } from '../content/vocabulary';
import { buildDaySummaries } from '../domain/daySelection';
import { createStudySession } from '../domain/sessionEngine';
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
    return {
      days: buildDaySummaries(vocabulary, progress),
      dueReviews: progress.filter((item) => isReviewDue(item, new Date())).length,
      activeSession,
      storageError: repository.getLastError(),
    };
  }, [repository, revision]);

  const startStudy = useCallback((targetDays: number[]): boolean => {
    const previous = repository.loadActiveSession();
    try {
      const next = createStudySession(vocabulary, targetDays, repository.getAllWordProgress(), new Date());
      repository.saveActiveSession(next);
      if (repository.getLastError()) {
        repository.saveActiveSession(previous);
        refresh();
        return false;
      }
      refresh();
      return true;
    } catch {
      refresh();
      return false;
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
