import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createTestAttempt, type TestConfig, type TestWordSet } from '../domain/testEngine';
import type { QuestionType, TestAttempt, VocabularyWord, WordProgress } from '../domain/types';
import type { Shuffle } from '../domain/sessionEngine';

type TestSetupPageProps = {
  words: VocabularyWord[];
  progress: WordProgress[];
  shuffle: Shuffle;
  now?: () => Date;
  onStart: (attempt: TestAttempt) => void;
  initialWordIds?: string[];
  initialMode?: QuestionType | 'mixed';
};

export function TestSetupPage({
  words,
  progress,
  shuffle,
  now = () => new Date(),
  onStart,
  initialWordIds,
  initialMode = 'mixed',
}: TestSetupPageProps) {
  const availableDays = [...new Set(words.map((word) => word.day))].sort((a, b) => a - b);
  const retryDays = initialWordIds
    ? [...new Set(words.filter((word) => initialWordIds.includes(word.id)).map((word) => word.day))].sort((a, b) => a - b)
    : [];
  const [dayIds, setDayIds] = useState<number[]>(retryDays.length ? retryDays : availableDays.slice(0, 5));
  const [wordSet, setWordSet] = useState<TestWordSet>('all');
  const [mode, setMode] = useState<QuestionType | 'mixed'>(initialMode);
  const [count, setCount] = useState<TestConfig['count']>(10);
  const [order, setOrder] = useState<TestConfig['order']>('random');
  const config: TestConfig = { dayIds, wordSet, mode, count, order, onlyWordIds: initialWordIds };
  const previewCount = useMemo(
    () => createTestAttempt(config, words, progress, (items) => items, now()).wordIds.length,
    [dayIds, wordSet, mode, count, order, initialWordIds, words, progress],
  );

  const toggleDay = (day: number) => {
    setDayIds((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((a, b) => a - b));
  };

  return (
    <main className="page test-setup-page">
      <Link className="back-link" to="/">← 홈</Link>
      <header className="test-header">
        <p className="study-kicker">원할 때 언제든 확인</p>
        <h1>수시 단어 테스트</h1>
        <p>범위와 유형을 고르면 학습 진도와 별개로 테스트할 수 있어요.</p>
      </header>

      <div className="test-settings">
        <fieldset>
          <legend><span>1</span> 범위</legend>
          <div className="choice-grid choice-grid--days">
            {availableDays.map((day) => (
              <label key={day}><input type="checkbox" checked={dayIds.includes(day)} onChange={() => toggleDay(day)} /> DAY {String(day).padStart(2, '0')}</label>
            ))}
          </div>
        </fieldset>

        <label className="setting-row"><span><b>2</b> 단어 집합</span>
          <select aria-label="단어 집합" value={wordSet} onChange={(event) => setWordSet(event.target.value as TestWordSet)}>
            <option value="all">전체</option><option value="recent">최근 학습</option><option value="uncertain">헷갈림</option><option value="weak">모름</option><option value="random">무작위</option>
          </select>
        </label>
        <label className="setting-row"><span><b>3</b> 문제 유형</span>
          <select aria-label="문제 유형" value={mode} onChange={(event) => setMode(event.target.value as QuestionType | 'mixed')}>
            <option value="en_to_ko">영어 → 뜻</option><option value="ko_to_en">뜻 → 영어</option><option value="spelling">철자 쓰기</option><option value="mixed">혼합</option>
          </select>
        </label>
        <label className="setting-row"><span><b>4</b> 문제 수</span>
          <select aria-label="문제 수" value={count} onChange={(event) => setCount(Number(event.target.value) as TestConfig['count'])}>
            {[10, 25, 50, 125].map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
        <label className="setting-row"><span><b>5</b> 출제 순서</span>
          <select aria-label="출제 순서" value={order} onChange={(event) => setOrder(event.target.value as TestConfig['order'])}>
            <option value="number">번호순</option><option value="random">무작위</option>
          </select>
        </label>
      </div>

      <section className="test-summary" aria-live="polite">
        <div><strong>{previewCount}문제</strong><span>예상 {Math.max(3, Math.ceil(previewCount * .5))}분</span></div>
        {previewCount < count && <p>조건에 맞는 단어가 {previewCount}개여서 모두 출제합니다.</p>}
        <button className="button button--primary" type="button" disabled={previewCount === 0 || dayIds.length === 0} onClick={() => onStart(createTestAttempt(config, words, progress, shuffle, now()))}>테스트 시작하기</button>
      </section>
    </main>
  );
}
