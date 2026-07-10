# Flexible DAY Selection Study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed five-DAY/125-word routine with an iPad-friendly DAY 01~10 card grid that creates a protected study session from any selected DAY combination.

**Architecture:** Keep DAY selection as transient `HomePage` state, derive per-DAY progress in a focused domain module, and pass validated DAY IDs into the existing session engine. Preserve the single active-session storage model; the home screen owns replacement confirmation while `App` performs the atomic save and reports success before navigation.

**Tech Stack:** React 19, TypeScript, React Router hash routing, Vitest, Testing Library, Playwright, Vite PWA, localStorage

## Global Constraints

- DAY 01~10 contains exactly 250 words, 25 words per DAY; do not change vocabulary content.
- Any one or more DAYs may be selected, including non-contiguous combinations.
- Normalize selected DAYs to unique ascending IDs before session creation.
- Due reviews run before selected new words and never count toward the new-word target.
- Preserve word progress, confidence, D+1·3·7·14 schedules, and test attempts when replacing an active session.
- Keep Apple Pencil writing, local English speech preference, on-demand tests, PWA caching, and offline operation intact.
- Do not add login, a server, handwriting recognition, speech recognition, or pronunciation scoring.
- Use tests-first development for every behavior change and commit each task separately.
- Do not stage or alter the user-owned untracked files `2026-07-10-vocabulary-study-webapp-design.md`, `source/`, or `영어_단어_DAY01-10.md`.

---

## File Structure

- Create `src/domain/daySelection.ts`: derive stable DAY card summaries from vocabulary and saved progress.
- Create `tests/domain/daySelection.test.ts`: specify DAY summary classification and ordering.
- Create `src/components/DaySelectionGrid.tsx`: render selectable DAY cards with an explicit pressed state.
- Create `tests/components/DaySelectionGrid.test.tsx`: specify card content and selection behavior.
- Create `src/components/SessionReplacementDialog.tsx`: accessible confirmation UI for preserving or replacing the active session.
- Create `tests/components/SessionReplacementDialog.test.tsx`: specify focus, Escape, and action callbacks.
- Modify `src/domain/sessionEngine.ts`: normalize arbitrary DAY inputs and reject empty valid selections.
- Modify `tests/domain/sessionEngine.test.ts`: cover non-contiguous, duplicate, and invalid DAY inputs.
- Modify `src/pages/HomePage.tsx`: compose active-session banner, DAY grid, selection summary, start action, and replacement dialog.
- Modify `tests/pages/home.test.tsx`: cover dynamic totals, resume, replacement, and disabled states.
- Modify `src/app/App.tsx`: build DAY summaries and persist only confirmed valid sessions.
- Modify `src/app/AppRouter.tsx`: pass the selected DAY callback through to the home route.
- Modify `src/pages/StudyPage.tsx`: show exact selected DAYs and dynamic target labels.
- Modify `tests/pages/study.test.tsx`: cover 50- and 75-word session headers and progress labels.
- Modify `src/styles/global.css`: add responsive DAY grid, sticky summary, active-session banner, and dialog styles.
- Modify `tests/e2e/wordmaster.spec.ts`: update journeys to select DAY cards and verify replacement, iPad layout, and offline selection.
- Modify `README.md`: describe selectable 25~250-word sessions instead of a fixed 125-word routine.

---

### Task 1: Validate and Normalize Arbitrary DAY Combinations

**Files:**
- Modify: `src/domain/sessionEngine.ts`
- Test: `tests/domain/sessionEngine.test.ts`

**Interfaces:**
- Produces: `normalizeTargetDays(words: VocabularyWord[], requestedDayIds: number[]): number[]`
- Changes: `createStudySession(...)` throws `RangeError('하나 이상의 유효한 DAY를 선택해 주세요.')` when normalization leaves no DAY.
- Preserves: the existing `createStudySession`, queue encoding, retry, review, and summary interfaces.

- [ ] **Step 1: Write failing normalization and arbitrary-selection tests**

Add these tests and remove the obsolete test that expects automatic five-DAY block selection:

```ts
test('normalizes duplicate, unordered and unknown DAY ids', () => {
  expect(normalizeTargetDays(words, [7, 2, 7, 999])).toEqual([2, 7]);
});

test('creates exact targets for non-contiguous DAY combinations', () => {
  const fifty = createStudySession(words, [7, 2], [], now, identity);
  expect(fifty.targetDayIds).toEqual([2, 7]);
  expect(fifty.targetWordIds).toHaveLength(50);
  expect(new Set(fifty.targetWordIds).size).toBe(50);
  expect(new Set(fifty.targetWordIds.map((id) => words.find((word) => word.id === id)!.day))).toEqual(new Set([2, 7]));

  const seventyFive = createStudySession(words, [10, 1, 4], [], now, identity);
  expect(seventyFive.targetDayIds).toEqual([1, 4, 10]);
  expect(seventyFive.targetWordIds).toHaveLength(75);
});

test('rejects a selection with no valid DAY', () => {
  expect(() => createStudySession(words, [], [], now, identity)).toThrow('하나 이상의 유효한 DAY');
  expect(() => createStudySession(words, [999], [], now, identity)).toThrow('하나 이상의 유효한 DAY');
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- tests/domain/sessionEngine.test.ts`

Expected: FAIL because `normalizeTargetDays` is not exported and invalid selections do not throw.

- [ ] **Step 3: Implement normalization at the session-engine boundary**

Add and use this function before target words are built:

```ts
export function normalizeTargetDays(
  words: VocabularyWord[],
  requestedDayIds: number[],
): number[] {
  const availableDays = new Set(words.map((word) => word.day));
  return [...new Set(requestedDayIds)]
    .filter((day) => Number.isInteger(day) && availableDays.has(day))
    .sort((left, right) => left - right);
}
```

In `createStudySession`, replace the current `selectedDays` assignment with:

```ts
const selectedDays = normalizeTargetDays(words, targetDayIds);
if (selectedDays.length === 0) {
  throw new RangeError('하나 이상의 유효한 DAY를 선택해 주세요.');
}
```

Remove `selectTargetDays` after its last consumer is removed in Task 5; until then, leave it exported so intermediate commits compile.

- [ ] **Step 4: Run focused and full domain tests to verify GREEN**

Run: `npm test -- tests/domain/sessionEngine.test.ts tests/domain/masteryEngine.test.ts tests/domain/reviewScheduler.test.ts`

Expected: all selected domain tests PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/domain/sessionEngine.ts tests/domain/sessionEngine.test.ts
git commit -m "feat: support arbitrary DAY study targets"
```

---

### Task 2: Derive DAY Card Progress Summaries

**Files:**
- Create: `src/domain/daySelection.ts`
- Create: `tests/domain/daySelection.test.ts`

**Interfaces:**
- Produces: `DaySummary = { day; topic; total; mastered; learning; unseen }`
- Produces: `buildDaySummaries(words: VocabularyWord[], progressList: WordProgress[]): DaySummary[]`
- Consumes: `VocabularyWord.stage` data through `WordProgress`, without writing to storage.

- [ ] **Step 1: Write the failing DAY summary test**

```ts
import words from '../../src/content/vocabulary.json';
import { buildDaySummaries } from '../../src/domain/daySelection';
import type { WordProgress } from '../../src/domain/types';

const base = (wordId: string): WordProgress => ({
  wordId,
  stage: 'recognized',
  confidence: 'uncertain',
  correctCount: 1,
  incorrectCount: 0,
  reviewStep: 0,
  nextReviewAt: null,
  lastReviewedAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
});

test('builds ordered 25-word summaries with mastered, learning and unseen counts', () => {
  const progress = [
    { ...base('0001'), stage: 'mastered_today' as const },
    { ...base('0002'), stage: 'long_term' as const },
    base('0003'),
  ];
  const summaries = buildDaySummaries(words, progress);
  expect(summaries).toHaveLength(10);
  expect(summaries[0]).toEqual({
    day: 1,
    topic: '사람 묘사 I',
    total: 25,
    mastered: 2,
    learning: 1,
    unseen: 22,
  });
  expect(summaries.map((summary) => summary.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- tests/domain/daySelection.test.ts`

Expected: FAIL because `src/domain/daySelection.ts` does not exist.

- [ ] **Step 3: Implement the pure summary builder**

```ts
import type { VocabularyWord, WordProgress } from './types';

export type DaySummary = {
  day: number;
  topic: string;
  total: number;
  mastered: number;
  learning: number;
  unseen: number;
};

export function buildDaySummaries(
  words: VocabularyWord[],
  progressList: WordProgress[],
): DaySummary[] {
  const progressById = new Map(progressList.map((progress) => [progress.wordId, progress]));
  const days = [...new Set(words.map((word) => word.day))].sort((left, right) => left - right);
  return days.map((day) => {
    const dayWords = words.filter((word) => word.day === day);
    const progress = dayWords.map((word) => progressById.get(word.id));
    const mastered = progress.filter((item) =>
      item?.stage === 'mastered_today' || item?.stage === 'long_term'
    ).length;
    const learning = progress.filter((item) =>
      item && item.stage !== 'mastered_today' && item.stage !== 'long_term'
    ).length;
    return {
      day,
      topic: dayWords[0]?.topic ?? `DAY ${String(day).padStart(2, '0')}`,
      total: dayWords.length,
      mastered,
      learning,
      unseen: dayWords.length - mastered - learning,
    };
  });
}
```

- [ ] **Step 4: Run the focused test to verify GREEN**

Run: `npm test -- tests/domain/daySelection.test.ts`

Expected: 1 test PASS with 10 summaries and 25 words in DAY 01.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/domain/daySelection.ts tests/domain/daySelection.test.ts
git commit -m "feat: summarize progress by DAY"
```

---

### Task 3: Build the Selectable DAY Card Grid

**Files:**
- Create: `src/components/DaySelectionGrid.tsx`
- Create: `tests/components/DaySelectionGrid.test.tsx`

**Interfaces:**
- Consumes: `summaries: DaySummary[]`, `selectedDayIds: number[]`
- Produces: `onChange(nextDayIds: number[]): void` with unique ascending DAY IDs.
- Accessibility: each card is a `button` with `aria-pressed` and a label containing DAY, topic, and selection state.

- [ ] **Step 1: Write failing component tests**

```tsx
const summaries: DaySummary[] = [
  { day: 1, topic: '사람 묘사 I', total: 25, mastered: 8, learning: 5, unseen: 12 },
  { day: 7, topic: '사고, 생각', total: 25, mastered: 0, learning: 2, unseen: 23 },
];

test('renders DAY progress and toggles arbitrary cards in ascending order', async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  const view = render(<DaySelectionGrid summaries={summaries} selectedDayIds={[7]} onChange={onChange} />);
  expect(screen.getByRole('button', { name: /DAY 01 사람 묘사 I/ })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('button', { name: /DAY 07 사고, 생각/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('숙달 8')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /DAY 01 사람 묘사 I/ }));
  expect(onChange).toHaveBeenCalledWith([1, 7]);
  view.rerender(<DaySelectionGrid summaries={summaries} selectedDayIds={[1, 7]} onChange={onChange} />);
  await user.click(screen.getByRole('button', { name: /DAY 07 사고, 생각/ }));
  expect(onChange).toHaveBeenLastCalledWith([1]);
});
```

- [ ] **Step 2: Run the component test to verify RED**

Run: `npm test -- tests/components/DaySelectionGrid.test.tsx`

Expected: FAIL because `DaySelectionGrid` does not exist.

- [ ] **Step 3: Implement the grid with a controlled selection API**

```tsx
import type { DaySummary } from '../domain/daySelection';

type DaySelectionGridProps = {
  summaries: DaySummary[];
  selectedDayIds: number[];
  onChange(nextDayIds: number[]): void;
};

export function DaySelectionGrid({ summaries, selectedDayIds, onChange }: DaySelectionGridProps) {
  const selected = new Set(selectedDayIds);
  const toggle = (day: number) => {
    const next = new Set(selectedDayIds);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange([...next].sort((left, right) => left - right));
  };
  return (
    <div className="day-grid" aria-label="학습할 DAY 선택">
      {summaries.map((summary) => (
        <button
          className="day-card"
          data-selected={selected.has(summary.day)}
          type="button"
          aria-pressed={selected.has(summary.day)}
          aria-label={`DAY ${String(summary.day).padStart(2, '0')} ${summary.topic}`}
          key={summary.day}
          onClick={() => toggle(summary.day)}
        >
          <span className="day-card__check" aria-hidden="true">{selected.has(summary.day) ? '✓' : ''}</span>
          <strong>DAY {String(summary.day).padStart(2, '0')}</strong>
          <span>{summary.topic}</span>
          <small>{summary.total}개</small>
          <div className="day-card__progress">
            <span>숙달 {summary.mastered}</span>
            <span>학습 중 {summary.learning}</span>
            <span>미학습 {summary.unseen}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run component tests to verify GREEN**

Run: `npm test -- tests/components/DaySelectionGrid.test.tsx`

Expected: selection, removal, status copy, and `aria-pressed` assertions PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/components/DaySelectionGrid.tsx tests/components/DaySelectionGrid.test.tsx
git commit -m "feat: add selectable DAY cards"
```

---

### Task 4: Protect Active Sessions with an Accessible Dialog

**Files:**
- Create: `src/components/SessionReplacementDialog.tsx`
- Create: `tests/components/SessionReplacementDialog.test.tsx`

**Interfaces:**
- Consumes: `activeDayIds`, `newDayIds`, `onCancel`, `onContinue`, `onReplace`.
- Produces: no storage writes; it reports one explicit user choice.
- Accessibility: `role="dialog"`, `aria-modal="true"`, initial focus, and Escape cancellation.

- [ ] **Step 1: Write failing action, focus, and Escape tests**

```tsx
test('describes both sessions and exposes all three safe actions', async () => {
  const onCancel = vi.fn();
  const onContinue = vi.fn();
  const onReplace = vi.fn();
  render(<SessionReplacementDialog activeDayIds={[2, 7]} newDayIds={[1, 4, 10]} onCancel={onCancel} onContinue={onContinue} onReplace={onReplace} />);
  expect(screen.getByRole('dialog')).toHaveTextContent('DAY 02 · DAY 07');
  expect(screen.getByRole('dialog')).toHaveTextContent('DAY 01 · DAY 04 · DAY 10');
  expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: '기존 학습 이어하기' }));
  expect(onContinue).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: '새 학습으로 교체' }));
  expect(onReplace).toHaveBeenCalledOnce();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onCancel).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the dialog test to verify RED**

Run: `npm test -- tests/components/SessionReplacementDialog.test.tsx`

Expected: FAIL because the dialog component does not exist.

- [ ] **Step 3: Implement the dialog and focus lifecycle**

Use a cancel-button ref, register a `keydown` listener in `useEffect`, and render this action structure:

```tsx
<div className="dialog-backdrop" role="presentation">
  <section className="session-dialog" role="dialog" aria-modal="true" aria-labelledby="replace-title">
    <h2 id="replace-title">진행 중인 학습이 있어요</h2>
    <p>기존 {formatDays(activeDayIds)} 학습을 이어가거나 새 {formatDays(newDayIds)} 학습으로 교체할 수 있어요.</p>
    <div className="session-dialog__actions">
      <button ref={cancelRef} type="button" onClick={onCancel}>취소</button>
      <button type="button" onClick={onContinue}>기존 학습 이어하기</button>
      <button type="button" onClick={onReplace}>새 학습으로 교체</button>
    </div>
  </section>
</div>
```

Define `formatDays(dayIds)` in the same file as a private function that sorts and formats `DAY 02 · DAY 07`.

- [ ] **Step 4: Run the dialog test to verify GREEN**

Run: `npm test -- tests/components/SessionReplacementDialog.test.tsx`

Expected: dialog text, focus, three callbacks, and Escape behavior PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add src/components/SessionReplacementDialog.tsx tests/components/SessionReplacementDialog.test.tsx
git commit -m "feat: protect active study sessions"
```

---

### Task 5: Integrate DAY Selection into Home, App, and Study Screens

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `tests/pages/home.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/AppRouter.tsx`
- Modify: `src/pages/StudyPage.tsx`
- Modify: `tests/pages/study.test.tsx`
- Modify: `src/domain/sessionEngine.ts`
- Modify: `tests/domain/sessionEngine.test.ts`

**Interfaces:**
- Changes `HomeViewModel` to `{ days: DaySummary[]; dueReviews: number; activeSession: StudySession | null; storageError?: string | null }`.
- Changes `onStartStudy` to `(dayIds: number[]) => boolean`; `true` permits navigation and `false` leaves the user on home.
- Consumes `buildDaySummaries` and the validated `createStudySession` boundary.

- [ ] **Step 1: Replace fixed home expectations with failing flexible-selection tests**

Build a 10-entry `days` fixture and add tests that verify:

```tsx
expect(screen.getAllByRole('button', { name: /DAY \d{2}/ })).toHaveLength(10);
expect(screen.getByRole('button', { name: /학습 시작하기/ })).toBeDisabled();
await user.click(screen.getByRole('button', { name: /DAY 02/ }));
await user.click(screen.getByRole('button', { name: /DAY 07/ }));
expect(screen.getByText('2일 선택 · 신규 50개 · 복습 9개')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '50개 학습 시작하기' })).toBeEnabled();
```

For an active session, click start and assert the replacement dialog opens, cancellation preserves selected cards, `기존 학습 이어하기` navigates to `/study`, and `새 학습으로 교체` calls `onStartStudy([2, 7])` exactly once.

- [ ] **Step 2: Add failing dynamic study-header tests**

Create a session from `[2, 7]` and assert:

```tsx
expect(screen.getByText('DAY 02 · DAY 07')).toBeInTheDocument();
expect(screen.getByRole('progressbar', { name: '50개 신규 단어 진행률' })).toBeInTheDocument();
```

- [ ] **Step 3: Run the focused page tests to verify RED**

Run: `npm test -- tests/pages/home.test.tsx tests/pages/study.test.tsx`

Expected: FAIL because the home still renders a fixed 125-word routine and the study label is hard-coded.

- [ ] **Step 4: Recompose `HomePage` around controlled DAY cards**

Use `useState<number[]>([])` for `selectedDayIds`, `useState(false)` for the replacement dialog, and `useNavigate()` for successful start/resume. Calculate:

```ts
const selectedWordCount = selectedDayIds.reduce((total, day) =>
  total + (viewModel.days.find((summary) => summary.day === day)?.total ?? 0), 0);
const selectionText = `${selectedDayIds.length}일 선택 · 신규 ${selectedWordCount}개 · 복습 ${viewModel.dueReviews}개`;
```

Starting without an unfinished session calls `onStartStudy(selectedDayIds)` and navigates only when it returns `true`. Starting with an unfinished session opens `SessionReplacementDialog`. Cancel only closes the dialog. Continue navigates without changing storage. Replace calls `onStartStudy(selectedDayIds)` and navigates only on success.

- [ ] **Step 5: Build the App view model and safe persistence callback**

In `App`, derive `days` using `buildDaySummaries(vocabulary, progress)`. Implement:

```ts
const startStudy = useCallback((targetDays: number[]): boolean => {
  const previous = repository.loadActiveSession();
  try {
    const next = createStudySession(
      vocabulary,
      targetDays,
      repository.getAllWordProgress(),
      new Date(),
    );
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
```

Pass the new callback signature through `AppRouter`. Remove the `selectTargetDays` import and delete the now-unused function and its obsolete test from `sessionEngine` after compilation confirms no consumers remain.

- [ ] **Step 6: Make StudyPage labels exact and dynamic**

Replace the min/max range with:

```ts
const selectedDaysLabel = session.targetDayIds
  .map((day) => `DAY ${String(day).padStart(2, '0')}`)
  .join(' · ');
const targetLabel = `${session.targetWordIds.length}개 신규 단어 진행률`;
```

Render `selectedDaysLabel` in `.study-kicker` and pass `targetLabel` to `ProgressBar`.

- [ ] **Step 7: Run focused page and app tests to verify GREEN**

Run: `npm test -- tests/pages/home.test.tsx tests/pages/study.test.tsx src/app/App.test.tsx tests/domain/sessionEngine.test.ts`

Expected: home selection, replacement, dynamic study labels, app smoke test, and session validation all PASS.

- [ ] **Step 8: Commit Task 5**

```bash
git add src/pages/HomePage.tsx tests/pages/home.test.tsx src/app/App.tsx src/app/AppRouter.tsx src/pages/StudyPage.tsx tests/pages/study.test.tsx src/domain/sessionEngine.ts tests/domain/sessionEngine.test.ts
git commit -m "feat: start study from selected DAY cards"
```

---

### Task 6: Add Responsive Styling and End-to-End Coverage

**Files:**
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/wordmaster.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Preserves current iPad study-screen height rules and Pencil suppression styles.
- Adds stable E2E selectors through accessible roles and visible Korean labels, not implementation-only IDs.

- [ ] **Step 1: Update E2E tests first and verify failure**

Change every study journey to select DAY cards before starting. Add a replacement scenario:

```ts
await page.getByRole('button', { name: /DAY 02/ }).click();
await page.getByRole('button', { name: /DAY 07/ }).click();
await expect(page.getByText('2일 선택 · 신규 50개')).toBeVisible();
await page.getByRole('button', { name: '50개 학습 시작하기' }).click();
await expect(page.getByText('DAY 02 · DAY 07')).toBeVisible();
await page.getByRole('link', { name: '홈으로 돌아가기' }).click();
await page.getByRole('button', { name: /DAY 01/ }).click();
await page.getByRole('button', { name: '25개 학습 시작하기' }).click();
await expect(page.getByRole('dialog')).toBeVisible();
await page.getByRole('button', { name: '취소' }).click();
await expect(page.getByRole('link', { name: '이어서 학습하기' })).toBeVisible();
```

In the offline scenario, go offline before selecting DAY 01 and verify the 25-word session, Pencil stroke, saved progress, and on-demand test navigation. Extend the iPad Mini geometry test to assert the DAY grid and sticky selection summary fit without horizontal overflow.

Run: `npm run test:e2e`

Expected: FAIL against the pre-styling UI or reveal responsive overflow that the next step fixes.

- [ ] **Step 2: Add responsive DAY, summary, banner, and dialog styles**

Add these layout rules, matching existing tokens:

```css
.active-session-card { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; padding: 1rem 1.25rem; border-radius: var(--radius-md); background: var(--color-primary); color: white; }
.day-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: .75rem; }
.day-card { position: relative; display: grid; min-height: 176px; gap: .4rem; padding: 1rem; border: 2px solid var(--color-line); border-radius: var(--radius-md); background: white; color: inherit; text-align: left; cursor: pointer; }
.day-card[data-selected="true"] { border-color: var(--color-primary); background: #edf7f5; box-shadow: 0 0 0 2px rgba(23, 91, 84, .12); }
.day-card__check { position: absolute; top: .75rem; right: .75rem; display: grid; width: 28px; height: 28px; place-items: center; border-radius: 50%; background: var(--color-primary); color: white; }
.day-card__progress { display: grid; gap: .2rem; color: var(--color-muted); font-size: .85rem; }
.study-selection-summary { position: sticky; bottom: .75rem; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 1rem; padding: 1rem; border-radius: var(--radius-md); background: var(--color-primary-strong); color: white; box-shadow: var(--shadow-card); }
.dialog-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 1rem; background: rgba(13, 34, 46, .55); }
.session-dialog { width: min(100%, 520px); padding: 1.5rem; border-radius: var(--radius-lg); background: white; box-shadow: var(--shadow-card); }
.session-dialog__actions { display: grid; gap: .65rem; margin-top: 1rem; }
```

At `max-width: 759px`, force `.day-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }`, stack the active card and sticky summary actions, and retain 44px minimum control sizes. Verify no rule changes `.drawing-canvas`, `.study-layout`, or palm-rejection behavior.

- [ ] **Step 3: Update README behavior and operating instructions**

Replace fixed “DAY 5개분인 신규 단어 125개” wording with “DAY 01~10에서 원하는 DAY를 골라 25~250개”. Document that the active session is retained until the user confirms replacement and that all DAY selection features work offline after the first cached visit. Keep existing GitHub Pages, PWA installation, and local run commands unchanged.

- [ ] **Step 4: Run the full required verification suite**

Run each command separately and inspect its exit code:

```bash
npm run content:build
npm test
npm run build
npm run test:e2e
```

Expected:

- Content build reports exactly 250 records.
- All Vitest files pass with zero failures.
- TypeScript and Vite production build exit 0 and generate the service worker.
- Playwright reports all applicable Desktop Chrome, iPhone, and iPad Mini scenarios passing; only documented project-specific skips remain.

- [ ] **Step 5: Inspect scope and commit Task 6**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Confirm only intended tracked files are staged and the three user-owned untracked paths remain untouched. Then commit:

```bash
git add src/styles/global.css tests/e2e/wordmaster.spec.ts README.md
git commit -m "test: verify flexible DAY study flows"
```

---

## Final Review Checklist

- [ ] Every DAY card reports a 25-word total and the three progress categories sum to 25.
- [ ] DAY combinations are arbitrary, unique, ascending, and exact in both home and study screens.
- [ ] No fixed `125개` copy remains where the current session target is intended.
- [ ] Cancelling replacement leaves both the active session and selected DAY cards unchanged.
- [ ] Confirming replacement changes only `activeSession`; word progress and test attempts remain intact.
- [ ] DAY cards, dialog actions, and sticky start control are usable on iPad Mini portrait and landscape.
- [ ] Pencil drawing, speech, spaced review, on-demand tests, PWA installation, and offline use still pass their existing checks.
- [ ] The generated vocabulary remains exactly 250 records from `0001` through `0250`.
- [ ] Git includes only intentional tracked changes and preserves unrelated user files.
