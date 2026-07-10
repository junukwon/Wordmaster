# WordMaster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `C:\dev\wordmaster`에 중학생 한 명이 하루 125개 단어를 집중 학습하고 Apple Pencil 필기, 발음 듣기, 간격 복습, 수시 테스트를 사용할 수 있는 반응형 웹앱을 구축한다.

**Architecture:** React 화면은 순수 TypeScript 학습 엔진과 저장소 인터페이스를 호출한다. 단어 콘텐츠는 Markdown 원본에서 검증된 JSON으로 변환하고, 학습 기록은 `ProgressRepository` 뒤의 `localStorage` 구현에 저장한다. Canvas 필기와 Web Speech API는 각각 독립 어댑터로 격리하여 학습 규칙과 분리한다.

**Tech Stack:** React, TypeScript, Vite, CSS Grid/Flexbox, Vitest, Testing Library, Playwright, HTML Canvas, Pointer Events, Web Speech API

## Global Constraints

- 프로젝트 루트는 정확히 `C:\dev\wordmaster`이다.
- 초기 버전에는 서버, 데이터베이스, 로그인, 기기 간 동기화를 넣지 않는다.
- 주 기기는 iPad mini + Apple Pencil이며 가로 화면에 최적화하되 세로·스마트폰·PC도 지원한다.
- 하루 기본 신규 목표는 DAY 5개분인 125개이며 권장 학습 시간은 90~120분이다.
- 숙달 기준은 영어→뜻, 뜻→영어, 철자 필기를 모두 통과하는 것이다.
- 손글씨 인식, 철자 자동 채점, 음성 인식, 발음 평가는 구현하지 않는다.
- 발음은 사용자가 버튼을 누를 때만 Web Speech API로 재생한다.
- 정규 루틴과 수시 테스트를 분리하고 테스트 정답으로 예정 복습을 제거하지 않는다.
- 테스트 오답은 취약 단어와 복습 일정에 반영한다.
- 당일 숙달 뒤 기본 복습 간격은 D+1, D+3, D+7, D+14이다.
- 기존 사용자 파일과 변경 사항이 있으면 덮어쓰기 전에 반드시 확인한다.

---

## File Structure

```text
C:\dev\wordmaster
├─ content/source/영어_단어_DAY01-10.md
├─ docs/design/wordmaster-design.md
├─ scripts/build-vocabulary.mjs
├─ public/
│  └─ icons/
├─ src/
│  ├─ app/App.tsx
│  ├─ app/AppRouter.tsx
│  ├─ content/vocabulary.json
│  ├─ content/vocabulary.ts
│  ├─ domain/types.ts
│  ├─ domain/reviewScheduler.ts
│  ├─ domain/masteryEngine.ts
│  ├─ domain/sessionEngine.ts
│  ├─ domain/testEngine.ts
│  ├─ storage/ProgressRepository.ts
│  ├─ storage/LocalStorageProgressRepository.ts
│  ├─ speech/SpeechPlayer.ts
│  ├─ drawing/DrawingCanvas.tsx
│  ├─ pages/HomePage.tsx
│  ├─ pages/StudyPage.tsx
│  ├─ pages/TestSetupPage.tsx
│  ├─ pages/TestPage.tsx
│  ├─ pages/TestResultPage.tsx
│  ├─ components/ProgressBar.tsx
│  ├─ components/RatingButtons.tsx
│  ├─ styles/tokens.css
│  ├─ styles/global.css
│  ├─ main.tsx
│  └─ test/setup.ts
├─ tests/
│  ├─ content/build-vocabulary.test.ts
│  ├─ domain/reviewScheduler.test.ts
│  ├─ domain/masteryEngine.test.ts
│  ├─ domain/sessionEngine.test.ts
│  ├─ domain/testEngine.test.ts
│  ├─ storage/localStorageRepository.test.ts
│  ├─ pages/home.test.tsx
│  ├─ pages/study.test.tsx
│  ├─ pages/test-flow.test.tsx
│  └─ e2e/wordmaster.spec.ts
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ playwright.config.ts
```

---

### Task 1: Project Foundation and Test Harness

**Files:**
- Create: `C:\dev\wordmaster\package.json`
- Create: `C:\dev\wordmaster\index.html`
- Create: `C:\dev\wordmaster\tsconfig.json`
- Create: `C:\dev\wordmaster\vite.config.ts`
- Create: `C:\dev\wordmaster\src\main.tsx`
- Create: `C:\dev\wordmaster\src\app\App.tsx`
- Create: `C:\dev\wordmaster\src\test\setup.ts`
- Test: `C:\dev\wordmaster\src\app\App.test.tsx`

**Interfaces:**
- Produces: runnable Vite React app and `npm test`, `npm run build`, `npm run dev` commands.

- [x] **Step 1: Inspect and protect the target directory**

Run in PowerShell:

```powershell
New-Item -ItemType Directory -Force C:\dev\wordmaster | Out-Null
Set-Location C:\dev\wordmaster
Get-ChildItem -Force
if (-not (Test-Path .git)) { git init }
git status --short
```

Expected: existing files and Git state are known before any write. Preserve every unrelated file.

- [x] **Step 2: Initialize packages**

```powershell
npm init -y
npm install react react-dom react-router-dom
npm install -D typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/react-dom playwright @playwright/test
```

Expected: package installation succeeds without peer dependency errors.

- [x] **Step 3: Configure scripts and testing**

Set `package.json` scripts to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "content:build": "node scripts/build-vocabulary.mjs"
  }
}
```

Configure Vitest in `vite.config.ts` with `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, and `globals: true`.

- [x] **Step 4: Write the failing app smoke test**

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renders the WordMaster heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'WordMaster' })).toBeInTheDocument();
});
```

- [x] **Step 5: Run the test and verify failure**

Run: `npm test -- src/app/App.test.tsx`  
Expected: FAIL because `App` does not exist.

- [x] **Step 6: Add the minimal app shell**

```tsx
export function App() {
  return <h1>WordMaster</h1>;
}
```

- [x] **Step 7: Verify foundation**

Run:

```powershell
npm test
npm run build
```

Expected: all tests PASS and Vite creates `dist`.

- [x] **Step 8: Commit**

```powershell
git add package.json package-lock.json index.html tsconfig*.json vite.config.ts src
git commit -m "chore: initialize WordMaster web app"
```

---

### Task 2: Vocabulary Content Pipeline

**Files:**
- Create: `content/source/영어_단어_DAY01-10.md`
- Create: `scripts/build-vocabulary.mjs`
- Create: `src/content/vocabulary.json`
- Create: `src/content/vocabulary.ts`
- Create: `src/domain/types.ts`
- Test: `tests/content/build-vocabulary.test.ts`

**Interfaces:**
- Produces: `VocabularyWord`, `VocabularyDay`, `loadVocabulary(): VocabularyWord[]`.
- Validation: exactly 250 unique IDs from `0001` through `0250`, 25 entries per DAY.

- [x] **Step 1: Copy the approved source content**

Copy the supplied `영어_단어_DAY01-10.md` without changing its meanings into `content/source/영어_단어_DAY01-10.md`.

- [x] **Step 2: Define content types**

```ts
export type VocabularyWord = {
  id: string;
  day: number;
  topic: string;
  term: string;
  partOfSpeech: string[];
  meanings: string[];
  inflection?: string;
  note?: string;
};

export type VocabularyDay = {
  day: number;
  topic: string;
  words: VocabularyWord[];
};
```

- [x] **Step 3: Write failing content validation tests**

```ts
import words from '../../src/content/vocabulary.json';

test('contains the approved 250 words', () => {
  expect(words).toHaveLength(250);
  expect(words[0]).toMatchObject({ id: '0001', term: 'knee', day: 1 });
  expect(words[249]).toMatchObject({ id: '0250', term: 'stay up (late)', day: 10 });
});

test('has unique ids and 25 words per day', () => {
  expect(new Set(words.map(word => word.id)).size).toBe(250);
  for (let day = 1; day <= 10; day += 1) {
    expect(words.filter(word => word.day === day)).toHaveLength(25);
  }
});
```

- [x] **Step 4: Run and verify failure**

Run: `npm test -- tests/content/build-vocabulary.test.ts`  
Expected: FAIL because `vocabulary.json` is missing.

- [x] **Step 5: Implement the Markdown converter**

The script must:

1. Detect headings matching `## DAY NN — topic`.
2. Parse table rows whose first cell is a four-digit ID.
3. Split `명/형` into `['명', '형']`.
4. Preserve the printed meaning text and inflection text.
5. Reject duplicate IDs, empty terms, empty meanings, nonconsecutive IDs, or a DAY not containing 25 words.
6. Write formatted UTF-8 JSON to `src/content/vocabulary.json`.

Implement `scripts/build-vocabulary.mjs` as:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseVocabularyMarkdown(markdown) {
  const words = [];
  let currentDay = null;
  let currentTopic = '';

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^## DAY (\d{2}) — (.+)$/);
    if (heading) {
      currentDay = Number(heading[1]);
      currentTopic = heading[2].trim();
      continue;
    }

    if (!/^\| \d{4} \|/.test(line) || currentDay === null) continue;
    const cells = line.slice(1, -1).split('|').map(cell => cell.trim());
    const [id, term, partOfSpeech, meaning, inflection] = cells;
    words.push({
      id,
      day: currentDay,
      topic: currentTopic,
      term,
      partOfSpeech: partOfSpeech.split('/').map(value => value.trim()),
      meanings: [meaning],
      ...(inflection ? { inflection } : {}),
    });
  }

  if (words.length === 0) throw new Error('No vocabulary rows found');
  const ids = new Set();
  words.forEach((word, index) => {
    const expectedId = String(index + 1).padStart(4, '0');
    if (word.id !== expectedId) throw new Error(`Expected ${expectedId}, got ${word.id}`);
    if (ids.has(word.id)) throw new Error(`Duplicate id: ${word.id}`);
    if (!word.term || !word.meanings[0]) throw new Error(`Empty content: ${word.id}`);
    ids.add(word.id);
  });
  const days = new Map();
  words.forEach(word => days.set(word.day, (days.get(word.day) ?? 0) + 1));
  for (const [day, count] of days) {
    if (count !== 25) throw new Error(`DAY ${day} has ${count} words`);
  }
  return words;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const root = path.resolve(path.dirname(scriptPath), '..');
  const input = path.join(root, 'content', 'source', '영어_단어_DAY01-10.md');
  const output = path.join(root, 'src', 'content', 'vocabulary.json');
  const words = parseVocabularyMarkdown(fs.readFileSync(input, 'utf8'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(words, null, 2)}\n`, 'utf8');
  console.log(`Generated ${words.length} vocabulary records`);
}
```

- [x] **Step 6: Build and verify content**

```powershell
npm run content:build
npm test -- tests/content/build-vocabulary.test.ts
```

Expected: `250` records generated and both tests PASS.

- [x] **Step 7: Add typed loader**

```ts
import rawWords from './vocabulary.json';
import type { VocabularyWord } from '../domain/types';

export function loadVocabulary(): VocabularyWord[] {
  return rawWords as VocabularyWord[];
}
```

- [x] **Step 8: Commit**

```powershell
git add content scripts src/content src/domain/types.ts tests/content
git commit -m "feat: add validated vocabulary content pipeline"
```

---

### Task 3: Local Progress Repository

**Files:**
- Create: `src/storage/ProgressRepository.ts`
- Create: `src/storage/LocalStorageProgressRepository.ts`
- Test: `tests/storage/localStorageRepository.test.ts`

**Interfaces:**
- Produces: `ProgressRepository`, `WordProgress`, `StudySession`, `TestAttempt`.
- Storage key: `wordmaster:v1`.

- [x] **Step 1: Define records and repository interface**

```ts
export type Confidence = 'unknown' | 'weak' | 'uncertain' | 'strong';
export type MasteryStage = 'unseen' | 'recognized' | 'recalled' | 'spelled' | 'mastered_today' | 'long_term';

export type WordProgress = {
  wordId: string;
  stage: MasteryStage;
  confidence: Confidence;
  correctCount: number;
  incorrectCount: number;
  reviewStep: 0 | 1 | 3 | 7 | 14;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
  updatedAt: string;
};

export interface ProgressRepository {
  getWordProgress(wordId: string): WordProgress;
  saveWordProgress(progress: WordProgress): void;
  getAllWordProgress(): WordProgress[];
  loadActiveSession(): StudySession | null;
  saveActiveSession(session: StudySession | null): void;
  saveTestAttempt(attempt: TestAttempt): void;
  getTestAttempts(): TestAttempt[];
}
```

- [x] **Step 2: Write failing persistence tests**

Test that a default unseen record is returned, saved progress survives a new repository instance, active session can be cleared, malformed JSON resets safely, and adding new vocabulary IDs does not delete existing records.

- [x] **Step 3: Run and verify failure**

Run: `npm test -- tests/storage/localStorageRepository.test.ts`  
Expected: FAIL because the repository implementation is missing.

- [x] **Step 4: Implement versioned storage**

Use this stored shape:

```ts
type StoredStateV1 = {
  version: 1;
  progress: Record<string, WordProgress>;
  activeSession: StudySession | null;
  testAttempts: TestAttempt[];
};
```

Parse in `try/catch`; on invalid data, retain a backup in `wordmaster:v1:corrupt`, initialize clean state, and expose an error message for the UI without crashing.

- [x] **Step 5: Verify**

Run: `npm test -- tests/storage/localStorageRepository.test.ts`  
Expected: all persistence tests PASS.

- [x] **Step 6: Commit**

```powershell
git add src/storage src/domain/types.ts tests/storage
git commit -m "feat: persist versioned local learning progress"
```

---

### Task 4: Mastery and Review Scheduling Engine

**Files:**
- Create: `src/domain/reviewScheduler.ts`
- Create: `src/domain/masteryEngine.ts`
- Test: `tests/domain/reviewScheduler.test.ts`
- Test: `tests/domain/masteryEngine.test.ts`

**Interfaces:**
- Produces: `scheduleNextReview(progress, rating, now)`, `applyLearningResult(progress, questionType, rating, now)`.

- [x] **Step 1: Write failing review date tests**

```ts
test.each([
  [0, 'strong', 1],
  [1, 'strong', 3],
  [3, 'strong', 7],
  [7, 'strong', 14],
  [14, 'strong', 14],
  [7, 'uncertain', 3],
  [7, 'weak', 1],
])('moves review step %s with %s to %s days', (step, rating, expected) => {
  expect(nextReviewStep(step, rating)).toBe(expected);
});
```

Also test date arithmetic from a fixed local date and overdue review detection.

- [x] **Step 2: Write failing mastery transition tests**

Verify:

- English→Korean strong moves `unseen` to `recognized`.
- Korean→English strong moves `recognized` to `recalled`.
- Spelling strong moves `recalled` to `spelled`.
- All three required successes produce `mastered_today`.
- `uncertain` does not advance a stage.
- `weak` increments incorrect count, sets confidence weak, and schedules D+1.
- One correct answer never produces `long_term`.

- [x] **Step 3: Run and verify failures**

Run: `npm test -- tests/domain/reviewScheduler.test.ts tests/domain/masteryEngine.test.ts`  
Expected: FAIL because both engines are missing.

- [x] **Step 4: Implement pure scheduling functions**

Use `const REVIEW_STEPS = [0, 1, 3, 7, 14] as const`. Avoid reading system time inside the engine; accept `now: Date` so tests remain deterministic.

- [x] **Step 5: Implement pure mastery transitions**

Do not mutate the input object. Return a new `WordProgress` and a queue hint:

```ts
type LearningOutcome = {
  progress: WordProgress;
  requeue: 'soon' | 'end_of_day' | 'scheduled' | 'none';
};
```

- [x] **Step 6: Verify**

Run: `npm test -- tests/domain/reviewScheduler.test.ts tests/domain/masteryEngine.test.ts`  
Expected: all scheduling and transition tests PASS.

- [x] **Step 7: Commit**

```powershell
git add src/domain tests/domain
git commit -m "feat: add mastery and spaced review engine"
```

---

### Task 5: 125-Word Study Session Engine

**Files:**
- Create: `src/domain/sessionEngine.ts`
- Test: `tests/domain/sessionEngine.test.ts`

**Interfaces:**
- Produces: `createStudySession`, `getNextStudyItem`, `applySessionOutcome`, `getSessionSummary`.
- Consumes: `VocabularyWord[]`, `WordProgress[]`, `LearningOutcome`.

- [x] **Step 1: Write failing session tests**

Test these exact rules:

- Selecting DAY 1–5 creates exactly 125 unique target IDs.
- Initial learning operates in groups of five.
- `soon` items return inside the current five-word block.
- `end_of_day` items return before the DAY completes.
- finishing a DAY mixes a sample from earlier DAYs.
- resuming preserves `currentIndex`, phase, and queue.
- progress counts satisfy `strong + uncertain + weak + remaining = 125`.
- due reviews appear before new words but do not reduce the 125-new-word target.

- [x] **Step 2: Run and verify failure**

Run: `npm test -- tests/domain/sessionEngine.test.ts`  
Expected: FAIL because `sessionEngine` is missing.

- [x] **Step 3: Implement deterministic queue generation**

Inject a shuffle function:

```ts
export type Shuffle = <T>(items: T[]) => T[];
```

Production uses Fisher–Yates; tests use identity shuffle or a seeded shuffle. Never use `array.sort(() => Math.random() - 0.5)`.

- [x] **Step 4: Implement save-ready session transitions**

Every `applySessionOutcome` call returns the entire updated `StudySession` so the caller can persist after each rated question.

- [x] **Step 5: Verify**

Run: `npm test -- tests/domain/sessionEngine.test.ts`  
Expected: all session tests PASS.

- [x] **Step 6: Commit**

```powershell
git add src/domain/sessionEngine.ts tests/domain/sessionEngine.test.ts
git commit -m "feat: orchestrate intensive 125-word sessions"
```

---

### Task 6: Responsive App Shell and Routine-Centered Home

**Files:**
- Create: `src/app/AppRouter.tsx`
- Create: `src/pages/HomePage.tsx`
- Create: `src/components/ProgressBar.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Modify: `src/app/App.tsx`
- Test: `tests/pages/home.test.tsx`

**Interfaces:**
- Home receives `HomeViewModel` with target, counts, due reviews, and active session.
- Navigation paths: `/`, `/study`, `/test/setup`, `/test/run`, `/test/result`.

- [x] **Step 1: Write failing home tests**

Verify the home renders `125개 단어 도전`, shows strong/uncertain/weak/remaining counts, shows due review count, displays `이어서 학습하기` when an active session exists, and navigates to test setup from `수시 단어 테스트`.

- [x] **Step 2: Run and verify failure**

Run: `npm test -- tests/pages/home.test.tsx`  
Expected: FAIL because home components are missing.

- [x] **Step 3: Implement the A-layout home screen**

Match the approved `홈화면_구성안.html` hierarchy:

1. `오늘의 집중 학습`
2. `125개 단어 도전`
3. progress bar
4. status count cards
5. primary continue/start button
6. secondary on-demand test link

Use CSS custom properties in `tokens.css` and keep every tap target at least 44×44px.

- [x] **Step 4: Add responsive behavior**

At widths under 760px, stack summary cards without horizontal overflow. At iPad landscape widths, center the content with a readable maximum width.

- [x] **Step 5: Verify**

Run:

```powershell
npm test -- tests/pages/home.test.tsx
npm run build
```

Expected: PASS and no TypeScript errors.

- [x] **Step 6: Commit**

```powershell
git add src/app src/pages/HomePage.tsx src/components src/styles tests/pages/home.test.tsx
git commit -m "feat: add routine-centered responsive home"
```

---

### Task 7: Speech and Apple Pencil Drawing Adapters

**Files:**
- Create: `src/speech/SpeechPlayer.ts`
- Create: `src/drawing/DrawingCanvas.tsx`
- Test: `src/speech/SpeechPlayer.test.ts`
- Test: `src/drawing/DrawingCanvas.test.tsx`

**Interfaces:**
- Produces: `SpeechPlayer.isAvailable()`, `SpeechPlayer.speak(term)`, `DrawingCanvasHandle.undo()`, `DrawingCanvasHandle.clear()`.

- [x] **Step 1: Write failing speech tests**

Mock `window.speechSynthesis` and verify English voice selection, fixed beginner-friendly rate, cancel-before-speak behavior, and graceful unavailable state.

- [x] **Step 2: Write failing canvas tests**

Verify pointer down/move/up creates strokes, `undo` removes only the last stroke, `clear` removes all strokes, and `touch-action: none` applies only to the canvas.

- [x] **Step 3: Run and verify failures**

Run: `npm test -- src/speech/SpeechPlayer.test.ts src/drawing/DrawingCanvas.test.tsx`  
Expected: FAIL because both adapters are missing.

- [x] **Step 4: Implement speech adapter**

Use `SpeechSynthesisUtterance`, choose a voice whose `lang` begins with `en`, set `lang = 'en-US'`, `rate = 0.8`, and call `speechSynthesis.cancel()` before `speak()`.

- [x] **Step 5: Implement drawing canvas**

Store strokes as arrays of `{ x, y, pressure }`. Scale pointer coordinates by the canvas bounding rectangle and device pixel ratio. Redraw from stroke state after resize, undo, and clear. Do not save stroke images to storage.

- [x] **Step 6: Verify**

Run: `npm test -- src/speech/SpeechPlayer.test.ts src/drawing/DrawingCanvas.test.tsx`  
Expected: PASS.

- [x] **Step 7: Commit**

```powershell
git add src/speech src/drawing
git commit -m "feat: add pronunciation and Pencil drawing support"
```

---

### Task 8: Study Page and Self-Rating Flow

**Files:**
- Create: `src/pages/StudyPage.tsx`
- Create: `src/components/RatingButtons.tsx`
- Test: `tests/pages/study.test.tsx`

**Interfaces:**
- Consumes: session engine, progress repository, speech player, drawing canvas.
- Produces: persisted outcome after every `모름`, `헷갈림`, or `기억남` response.

- [x] **Step 1: Write failing study flow tests**

Verify:

- meaning and part of speech render while spelling remains hidden;
- pronunciation button calls `speak(term)`;
- `정답 보기` reveals the term and rating buttons;
- rating is impossible before reveal;
- rating persists progress, clears canvas, and advances;
- `모르겠어요` records weak without exposing an accidental strong rating;
- refresh resumes the same session position.

- [x] **Step 2: Run and verify failure**

Run: `npm test -- tests/pages/study.test.tsx`  
Expected: FAIL because the study page is missing.

- [x] **Step 3: Implement approved study layout**

Match `학습화면_구성안.html`. In landscape use a two-column grid; below 760px use a single column. Keep progress and DAY range visible above the question.

- [x] **Step 4: Implement the reveal state machine**

Use explicit states:

```ts
type StudyScreenState = 'prompting' | 'revealed' | 'saving' | 'complete';
```

Disable duplicate taps while saving. Persist outcome and session before moving to the next word.

- [x] **Step 5: Verify**

Run:

```powershell
npm test -- tests/pages/study.test.tsx
npm run build
```

Expected: PASS and no hidden spelling appears in the prompting DOM.

- [x] **Step 6: Commit**

```powershell
git add src/pages/StudyPage.tsx src/components/RatingButtons.tsx tests/pages/study.test.tsx
git commit -m "feat: add Pencil-based recall study flow"
```

---

### Task 9: On-Demand Test Engine and Screens

**Files:**
- Create: `src/domain/testEngine.ts`
- Create: `src/pages/TestSetupPage.tsx`
- Create: `src/pages/TestPage.tsx`
- Create: `src/pages/TestResultPage.tsx`
- Test: `tests/domain/testEngine.test.ts`
- Test: `tests/pages/test-flow.test.tsx`

**Interfaces:**
- Produces: `createTestAttempt(config, words, progress, shuffle)`, `applyTestAnswer`, `summarizeTestAttempt`.

- [ ] **Step 1: Write failing test engine tests**

Verify filters for selected DAYs, recent/uncertain/weak/all sets, exact counts of 10/25/50/125 when available, deterministic random order, mixed question distribution, and no duplicate word IDs.

- [ ] **Step 2: Write failing screen flow tests**

Verify DAY multi-select, problem type, count and order selection; summary text; test start; answer progression; spelling self-rating; result score; DAY and type breakdown; `틀린 단어만 다시 테스트`; `틀린 단어만 필기 연습`.

- [ ] **Step 3: Run and verify failures**

Run: `npm test -- tests/domain/testEngine.test.ts tests/pages/test-flow.test.tsx`  
Expected: FAIL because test engine and pages are missing.

- [ ] **Step 4: Implement test engine**

If fewer words are available than the requested count, use all matching words and show the actual count before starting. Treat uncertain and incorrect as result categories separate from correct.

- [ ] **Step 5: Implement approved test setup screen**

Match `단어테스트_구성안.html`. Preserve the setting order: range, word set, question mode, count, order, summary, start.

- [ ] **Step 6: Integrate progress rules**

- Incorrect: set confidence weak, increment incorrect count, schedule D+1.
- Uncertain: set confidence uncertain and keep scheduled review no later than D+3.
- Correct: record in the attempt but do not remove or postpone an existing scheduled review.
- Never mark regular daily progress complete from an on-demand test.

- [ ] **Step 7: Verify**

Run:

```powershell
npm test -- tests/domain/testEngine.test.ts tests/pages/test-flow.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/domain/testEngine.ts src/pages/Test*.tsx tests/domain/testEngine.test.ts tests/pages/test-flow.test.tsx
git commit -m "feat: add configurable on-demand vocabulary tests"
```

---

### Task 10: Integration, Accessibility, and iPad E2E Verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/wordmaster.spec.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/global.css`
- Create: `README.md`

**Interfaces:**
- Produces: release-ready static build and reproducible manual iPad checklist.

- [ ] **Step 1: Configure Playwright projects**

Define Desktop Chrome, iPad Mini landscape-sized WebKit, and iPhone-sized WebKit projects. Start Vite through Playwright `webServer` using `npm run dev -- --host 127.0.0.1`.

- [ ] **Step 2: Write failing end-to-end journey**

The E2E test must:

1. open home;
2. begin DAY 01–05 session;
3. confirm the spelling is hidden;
4. reveal and rate a word;
5. reload and confirm the next saved position;
6. open test setup;
7. create a 10-word mixed test;
8. mark an answer incorrect;
9. finish and confirm it appears in weak words.

- [ ] **Step 3: Run and diagnose failures**

```powershell
npx playwright install
npm run test:e2e
```

Expected: initial failures identify missing integration wiring rather than environment errors.

- [ ] **Step 4: Wire production dependencies**

At app startup, construct one `LocalStorageProgressRepository`, load vocabulary once, and pass stable services through React context or explicit props. Do not instantiate a new repository during every render.

- [ ] **Step 5: Complete accessibility pass**

Add visible focus styles, accessible names for icon buttons, `aria-live='polite'` for progress changes, textual labels beside status colors, and a reduced-motion media query.

- [ ] **Step 6: Document exact usage**

`README.md` must include:

- setup commands;
- development and test commands;
- production build command;
- how to add a new DAY to the Markdown source and run `npm run content:build`;
- where browser progress is stored;
- how to clear progress intentionally;
- iPad mini Safari and Apple Pencil manual test checklist;
- known limitation that progress does not sync between devices.

- [ ] **Step 7: Run complete verification**

```powershell
npm run content:build
npm test
npm run build
npm run test:e2e
```

Expected: all unit/component/E2E tests PASS, TypeScript build succeeds, and `dist` is created.

- [ ] **Step 8: Manual iPad mini verification**

Serve the built app on the local network or deploy the static build. Verify Safari landscape and portrait, Pencil drawing, canvas-only scroll prevention, pronunciation button, resume after closing Safari, and no horizontal overflow.

- [ ] **Step 9: Commit**

```powershell
git add .
git commit -m "test: verify complete WordMaster learning journey"
```

---

## Final Acceptance Checklist

- [ ] DAY 01~10의 250개가 번호·뜻·품사·변화형과 함께 로드된다.
- [ ] DAY 5개를 고르면 신규 목표가 정확히 125개가 된다.
- [ ] 5개 묶음, DAY 확인, 누적 확인, 철자 회상 흐름이 작동한다.
- [ ] 모름·헷갈림·기억남이 재출제와 D+1·3·7·14 복습에 반영된다.
- [ ] iPad mini에서 Apple Pencil 필기, 되돌리기, 지우기가 작동한다.
- [ ] 정답 보기 전 영어 철자가 DOM과 화면에 노출되지 않는다.
- [ ] 발음 버튼이 지원되는 환경에서 영어 발음을 재생하고, 미지원 환경에서도 학습이 중단되지 않는다.
- [ ] 학습 중단 후 정확한 위치에서 이어진다.
- [ ] 수시 테스트 범위·유형·개수·순서를 선택할 수 있다.
- [ ] 테스트 오답은 취약 단어가 되며 정답은 예정 복습을 제거하지 않는다.
- [ ] 새 DAY를 추가해도 기존 진행 기록이 유지된다.
- [ ] 모든 자동 테스트와 실제 iPad 확인을 통과한다.
