import { useCallback, useMemo, useState } from 'react';
import { HashRouter } from 'react-router-dom';
import dayCatalogData from '../content/day-catalog.json';
import { loadVocabulary } from '../content/vocabulary';
import { buildDaySummaries as buildHomeDaySummaries } from '../domain/daySelection';
import { isReviewDue } from '../domain/reviewScheduler';
import { createStudySession, createStudySessionFromTarget } from '../domain/sessionEngine';
import { buildDaySummaries as buildStudyDaySummaries, type StudyTarget } from '../domain/studySelection';
import type { HomeViewModel } from '../pages/HomePage';
import { SpeechPlayer } from '../speech/SpeechPlayer';
import { LocalStorageProgressRepository } from '../storage/LocalStorageProgressRepository';
import { AppRouter } from './AppRouter';
import '../styles/global.css';

const vocabulary = loadVocabulary();

export function App() {
  const [repository] = useState(() => new LocalStorageProgressRepository());
  const [speechPlayer] = useState(() => new SpeechPlayer());
  const [startError, setStartError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const homeViewModel = useMemo<HomeViewModel>(() => {
    const activeSession = repository.loadActiveSession();
    const progress = repository.getAllWordProgress();
    return {
      days: buildHomeDaySummaries(vocabulary, progress),
      dueReviews: progress.filter((item) => isReviewDue(item, new Date())).length,
      activeSession,
      storageError: startError ?? repository.getLastError(),
    };
  }, [repository, revision, startError]);

  const persistStudySession = useCallback((createSession: () => ReturnType<typeof createStudySession>): boolean => {
    const previous = repository.loadActiveSession();
    try {
      repository.saveActiveSession(createSession());
      const saveError = repository.getLastError();
      if (saveError) {
        repository.saveActiveSession(previous);
        setStartError(saveError);
        refresh();
        return false;
      }
      setStartError(null);
      refresh();
      return true;
    } catch {
      refresh();
      return false;
    }
  }, [repository, refresh]);

  const startStudy = useCallback((targetDays: number[]): boolean => (
    persistStudySession(() => createStudySession(
      vocabulary,
      targetDays,
      repository.getAllWordProgress(),
      new Date(),
    ))
  ), [persistStudySession, repository]);

  const startStudyTarget = useCallback((target: StudyTarget): boolean => (
    persistStudySession(() => createStudySessionFromTarget(
      vocabulary,
      target,
      repository.getAllWordProgress(),
      new Date(),
    ))
  ), [persistStudySession, repository]);

  const dayCatalog = useMemo(() => {
    const summaries = buildStudyDaySummaries(vocabulary, repository.getAllWordProgress());
    const metadata = new Map(dayCatalogData.map((item) => [item.day, item]));
    return summaries.map((summary) => ({
      ...summary,
      title: metadata.get(summary.dayNumber)?.topic ?? summary.title,
      wordCount: metadata.get(summary.dayNumber)?.wordCount ?? summary.wordCount,
    }));
  }, [repository, revision]);

  return (
    <HashRouter>
      <AppRouter
        homeViewModel={homeViewModel}
        words={vocabulary}
        dayCatalog={dayCatalog}
        repository={repository}
        speechPlayer={speechPlayer}
        onStartStudy={startStudy}
        onStartStudyTarget={startStudyTarget}
        onDataChanged={refresh}
      />
    </HashRouter>
  );
}
