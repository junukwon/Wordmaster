# 확장형 학습 선택과 랜덤 학습 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DAY 01~20 콘텐츠와 향후 DAY 100까지 확장 가능한 묶음·범위·랜덤 학습 선택을 WordMaster에 추가하고 기존 진도/복습/오프라인 흐름을 유지한다.

**Architecture:** 콘텐츠 빌더가 여러 DAY Markdown 파일을 정렬해 하나의 정적 vocabulary JSON과 DAY 카탈로그를 생성한다. 선택 UI는 `StudySelection` 명령을 도메인 엔진에 전달하고, 엔진은 검증된 `StudyTarget`을 한 번 계산해 `StudySession.targetWordIds`에 고정한다. React 라우터는 홈 → 학습 설정 → 학습 흐름을 연결하며 기존 저장소 포맷은 선택 메타데이터를 선택적으로 보존해 하위 호환한다.

**Tech Stack:** React 19, TypeScript 7, React Router 7, Vite/VitePWA, Vitest + Testing Library, Playwright, Node Markdown build script.

## Global Constraints

- DAY 01~20 콘텐츠는 각 DAY 25단어, ID는 전역 유일·연속이어야 한다.
- 묶음 모드는 5 DAY 단위이며 DAY 수가 100이어도 첫 화면은 묶음 목록을 우선한다.
- 범위 모드는 시작/끝 DAY를 정규화해 양 끝을 포함한다.
- 랜덤 DAY와 랜덤 단어는 전체 어휘에서 중복 없이 뽑고, 랜덤 단어 기본값은 25개이며 10·50·125개를 제공한다.
- 랜덤 결과는 시작 시 세션에 고정하고 재개 시 다시 추첨하지 않는다.
- `오늘 복습`(D+1·3·7·14)은 선택 학습과 자동으로 섞지 않는다.
- 기존 Apple Pencil 필기, 발음 듣기, 정답 보기/기억남, 수시 테스트, localStorage, PWA 오프라인 동작을 회귀시키지 않는다.
- 로그인, 서버, 자동 손글씨 인식, 음성 인식, 발음 평가는 추가하지 않는다.
- 각 Task는 실패 테스트 → 최소 구현 → 관련 테스트 통과 → 의미 있는 커밋 순서로 완료한다.

## 파일 구조와 책임

- Modify `scripts/build-vocabulary.mjs`: DAY Markdown 다중 입력, 정렬, ID/DAY 검증, 카탈로그 JSON 생성.
- Modify `tests/content/build-vocabulary.test.ts`: DAY 01~20 빌드와 카탈로그 검증.
- Create `src/domain/studySelection.ts`: DAY 카탈로그 생성, 묶음/범위/랜덤 선택 명령 검증, 결정론적 RNG 기반 대상 계산.
- Create `tests/domain/studySelection.test.ts`: 선택 도메인 단위 테스트.
- Modify `src/domain/types.ts` and `src/domain/sessionEngine.ts`: `StudySelection`/`StudyTarget` 타입과 선택된 단어 ID를 세션에 고정하는 생성 API.
- Modify `src/storage/LocalStorageProgressRepository.ts` and `tests/storage/localStorageRepository.test.ts`: 선택 메타데이터 선택적 복원과 구버전 세션 호환.
- Create `src/pages/StudySetupPage.tsx`, `src/components/DayBundleList.tsx`, `src/components/DayRangePicker.tsx`, `src/components/RandomStudyPicker.tsx`: 설정 화면의 세 모드와 요약.
- Modify `src/app/App.tsx`, `src/app/AppRouter.tsx`, `src/pages/HomePage.tsx`: 설정 화면 진입과 새 세션 생성 연결.
- Modify `src/styles/global.css`: 묶음/범위/랜덤 설정의 반응형·접근성 스타일.
- Create `tests/pages/studySetup.test.tsx`, Modify `tests/pages/home.test.tsx`, `tests/e2e/wordmaster.spec.ts`: 화면·세션·오프라인 회귀 검증.

---

### Task 1: DAY 01~20 콘텐츠 빌드 확장

**Files:**
- Modify: `scripts/build-vocabulary.mjs`
- Modify: `tests/content/build-vocabulary.test.ts`
- Modify: `package.json` only if the build command needs no additional dependency (expected: no change)
- Generated: `src/content/vocabulary.json`, `src/content/day-catalog.json`, `public/data/vocabulary.json`, `public/data/day-catalog.json`

**Interfaces:**
- Produces `parseVocabularyMarkdown(markdown: string): VocabularyWord[]` compatibility and `buildVocabularySources(markdowns: Array<{fileName: string; markdown: string}>): VocabularyWord[]`.
- Produces `day-catalog.json` records `{ day, topic, wordCount }[]` sorted by day.

- [ ] **Step 1: Write the failing tests**

```ts
test('build input includes DAY 01 through DAY 20 with 500 words', () => {
  expect(words).toHaveLength(500);
  expect(words[0]).toMatchObject({ id: '0001', day: 1 });
  expect(words[499]).toMatchObject({ id: '0500', day: 20 });
  for (let day = 1; day <= 20; day += 1) {
    expect(words.filter((word) => word.day === day)).toHaveLength(25);
  }
});

test('publishes a DAY catalog matching vocabulary', () => {
  expect(dayCatalog).toHaveLength(20);
  expect(dayCatalog[0]).toMatchObject({ day: 1, wordCount: 25 });
  expect(dayCatalog[19]).toMatchObject({ day: 20, wordCount: 25 });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/content/build-vocabulary.test.ts`

Expected: FAIL because the current script reads only `영어_단어_DAY01-10.md` and produces 250 records.

- [ ] **Step 3: Implement the minimal builder change**

Discover `content/source/영어_단어_DAY*.md` with `fs.readdirSync`, sort by the numeric DAY suffix, parse each file with the existing parser, concatenate, then validate IDs from `0001` through the final row and exactly 25 words per discovered DAY. Write both vocabulary JSON files plus `src/content/day-catalog.json` and `public/data/day-catalog.json`; preserve the exported parser for existing unit tests.

- [ ] **Step 4: Run content tests and build**

Run: `npm run content:build; npm test -- tests/content/build-vocabulary.test.ts`

Expected: output `Generated 500 vocabulary records`, followed by PASS for all content tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-vocabulary.mjs tests/content/build-vocabulary.test.ts src/content/vocabulary.json public/data/vocabulary.json public/data/day-catalog.json
git commit -m "feat: build vocabulary through day 20"
```

### Task 2: 선택 도메인 엔진

**Files:**
- Create: `src/domain/studySelection.ts`
- Create: `tests/domain/studySelection.test.ts`
- Modify: `src/domain/types.ts` only if shared `DaySummary`, `StudySelection`, or `StudyTarget` types are placed there

**Interfaces:**
- `type SelectionRandom = (maxExclusive: number) => number`
- `function buildDaySummaries(words: VocabularyWord[], progress: WordProgress[]): DaySummary[]`
- `function buildFiveDayBundles(days: DaySummary[]): DayBundle[]`
- `function resolveStudySelection(selection: StudySelection, words: VocabularyWord[], random?: SelectionRandom): StudyTarget`
- `function formatSelectionSummary(target: StudyTarget): string`

- [ ] **Step 1: Write failing domain tests**

```ts
function makeWords(dayCount: number): VocabularyWord[] {
  return Array.from({ length: dayCount * 5 }, (_, index) => ({
    id: String(index + 1).padStart(4, '0'), day: Math.floor(index / 5) + 1,
    topic: `DAY ${Math.floor(index / 5) + 1}`, term: `word-${index + 1}`,
    partOfSpeech: ['명'], meanings: [`뜻-${index + 1}`],
  }));
}

test('creates five-day bundles and a final partial bundle', () => {
  const bundles = buildFiveDayBundles(makeWords(100));
  expect(bundles.map((item) => item.dayNumbers)).toEqual([
    [1, 2, 3, 4, 5], [6, 7, 8, 9, 10],
    [11, 12, 13, 14, 15], [16, 17, 18, 19, 20],
  ]);
});

test('resolves reversed range inclusively without duplicates', () => {
  const target = resolveStudySelection({ mode: 'range', startDay: 4, endDay: 2 }, makeWords(20));
  expect(target.targetDayIds).toEqual([2, 3, 4]);
  expect(new Set(target.targetWordIds).size).toBe(target.targetWordIds.length);
});

test('random words select the requested number from the whole vocabulary', () => {
  const target = resolveStudySelection({ mode: 'random-words', wordCount: 25 }, makeWords(100), () => 0);
  expect(target.targetWordIds).toHaveLength(25);
  expect(target.targetDayIds).toEqual([1, 2, 3, 4]);
});

test('rejects invalid random counts and missing days', () => {
  expect(() => resolveStudySelection({ mode: 'random-words', wordCount: 0 }, makeWords(20))).toThrow(/word count/i);
  expect(() => resolveStudySelection({ mode: 'range', startDay: 8, endDay: 9 }, makeWords(20))).toThrow(/DAY/i);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- tests/domain/studySelection.test.ts`

Expected: FAIL because the new module and selection types do not exist.

- [ ] **Step 3: Implement selection resolution**

Use sorted unique DAY numbers for catalogs and bundles. Normalize ranges with `Math.min/Math.max`; for random DAY use a partial Fisher–Yates selection of unique available days; for random words shuffle a copy of all words and slice the validated count. Always return sorted `targetDayIds` and word IDs in the chosen order, and never mutate the input vocabulary or progress arrays.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/domain/studySelection.test.ts`

Expected: PASS, including 20- and 100-DAY fixture coverage and deterministic RNG checks.

- [ ] **Step 5: Commit**

```bash
git add src/domain/studySelection.ts src/domain/types.ts tests/domain/studySelection.test.ts
git commit -m "feat: add scalable study selection engine"
```

### Task 3: 세션에 선택 결과 고정

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/sessionEngine.ts`
- Modify: `tests/domain/sessionEngine.test.ts`
- Modify: `src/storage/LocalStorageProgressRepository.ts`
- Modify: `tests/storage/localStorageRepository.test.ts`

**Interfaces:**
- Add `selection?: StudySelection` to `StudySession` for backward-compatible metadata.
- Add `createStudySessionFromTarget(words, target, progress, now, shuffle?): StudySession`.
- Keep `createStudySession(words, targetDayIds, progress, now, shuffle?)` as a compatibility wrapper that resolves a range target.

- [ ] **Step 1: Write failing tests**

```ts
test('random target session keeps exactly the selected word ids', () => {
  const target = { targetDayIds: [1, 2], targetWordIds: ['0001', '0026'], selection: { mode: 'random-words', wordCount: 2 } };
  const session = createStudySessionFromTarget(words, target, [], now, identity);
  expect(session.targetWordIds).toEqual(['0001', '0026']);
  expect(session.selection).toEqual(target.selection);
});

test('legacy stored sessions without selection still load', () => {
  const legacy = { ...createStudySession(words, [1], [], now, identity) };
  delete (legacy as Partial<StudySession>).selection;
  localStorage.setItem('wordmaster:v1', JSON.stringify({ version: 1, progress: {}, activeSession: legacy, testAttempts: [] }));
  expect(new LocalStorageProgressRepository(localStorage).loadActiveSession()).toMatchObject({ targetDayIds: [1] });
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- tests/domain/sessionEngine.test.ts tests/storage/localStorageRepository.test.ts`

Expected: FAIL because random target creation and optional metadata are not implemented.

- [ ] **Step 3: Implement target-aware session creation**

Refactor queue construction to accept an explicit `targetWordIds` set and preserve its order before applying the existing per-block shuffle behavior. Keep due-review insertion unchanged and continue excluding due-review IDs from the target set. Store `selection` when provided. Update session validation to accept its absence and validate known mode/count fields when present.

- [ ] **Step 4: Run focused tests and all domain/storage tests**

Run: `npm test -- tests/domain/sessionEngine.test.ts tests/storage/localStorageRepository.test.ts tests/domain/reviewScheduler.test.ts`

Expected: PASS with all existing 125-word behavior preserved.

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/sessionEngine.ts tests/domain/sessionEngine.test.ts src/storage/LocalStorageProgressRepository.ts tests/storage/localStorageRepository.test.ts
git commit -m "feat: persist resolved study targets in sessions"
```

### Task 4: 학습 설정 화면 컴포넌트

**Files:**
- Create: `src/pages/StudySetupPage.tsx`
- Create: `src/components/DayBundleList.tsx`
- Create: `src/components/DayRangePicker.tsx`
- Create: `src/components/RandomStudyPicker.tsx`
- Create: `tests/pages/studySetup.test.tsx`

**Interfaces:**
- `StudySetupPageProps = { words, progress, dayCatalog, onStart(target: StudyTarget): void }`.
- Child components receive controlled values and callbacks; they do not write localStorage or create sessions.

- [ ] **Step 1: Write failing component tests**

```tsx
function makeWords(dayCount: number): VocabularyWord[] {
  return Array.from({ length: dayCount * 5 }, (_, index) => ({
    id: String(index + 1).padStart(4, '0'), day: Math.floor(index / 5) + 1,
    topic: `DAY ${Math.floor(index / 5) + 1}`, term: `word-${index + 1}`,
    partOfSpeech: ['명'], meanings: [`뜻-${index + 1}`],
  }));
}

const setupWords = makeWords(20);
const setupProps = {
  words: setupWords,
  progress: [],
  dayCatalog: buildDaySummaries(setupWords, []),
  onStart: vi.fn(),
};

test('shows bundle, range and random modes', async () => {
  render(<MemoryRouter><StudySetupPage {...setupProps} /></MemoryRouter>);
  expect(screen.getByRole('tab', { name: '묶음으로 선택' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: '범위로 선택' }));
  expect(screen.getByLabelText('시작 DAY')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: '랜덤으로 선택' }));
  expect(screen.getByLabelText('랜덤 단어 수')).toHaveValue('25');
});

test('displays a clear summary and passes a target on start', async () => {
  const onStart = vi.fn();
  render(<MemoryRouter><StudySetupPage {...setupProps} onStart={onStart} /></MemoryRouter>);
  await userEvent.click(screen.getByRole('button', { name: /DAY 01–05/ }));
  expect(screen.getByText(/125단어/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '이 범위로 학습 시작' }));
  expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ targetDayIds: [1, 2, 3, 4, 5] }));
});
```

- [ ] **Step 2: Run component tests and confirm failure**

Run: `npm test -- tests/pages/studySetup.test.tsx`

Expected: FAIL because the setup page and components do not exist.

- [ ] **Step 3: Implement controlled setup UI**

Default to the first available five-DAY bundle. The range tab uses two selects populated from `dayCatalog`; the random tab offers `random-days` with a numeric count from 1 to available DAY count and `random-words` with 10/25/50/125 capped at total words. Resolve the command through `resolveStudySelection`, render the summary, and disable start for empty/invalid targets. Add a `다시 뽑기` button that changes the random seed before start without changing an active session.

- [ ] **Step 4: Run page tests**

Run: `npm test -- tests/pages/studySetup.test.tsx tests/pages/home.test.tsx`

Expected: PASS for mode switching, summary, accessible controls, and existing home behavior.

- [ ] **Step 5: Commit**

```bash
git add src/pages/StudySetupPage.tsx src/components/DayBundleList.tsx src/components/DayRangePicker.tsx src/components/RandomStudyPicker.tsx tests/pages/studySetup.test.tsx
git commit -m "feat: add scalable study setup screen"
```

### Task 5: 라우팅과 저장소 연결

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/AppRouter.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/StudyPage.tsx` only if its active-session handling needs an explicit guard
- Modify: `tests/pages/home.test.tsx`

**Interfaces:**
- `AppRouter` adds `dayCatalog: DaySummary[]` and `onStartStudyTarget(target: StudyTarget): void`.
- Home links to `/study/setup` for a new selection; an existing active session keeps the `이어서 학습하기` link to `/study`.

- [ ] **Step 1: Write failing integration tests**

```tsx
test('new study action opens the scalable setup screen', async () => {
  render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<HomePage viewModel={{ ...viewModel, activeSession: null }} />} /><Route path="/study/setup" element={<h2>학습 범위 설정</h2>} /></Routes></MemoryRouter>);
  await userEvent.click(screen.getByRole('link', { name: '학습 범위 선택하기' }));
  expect(screen.getByRole('heading', { name: '학습 범위 설정' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the integration test and confirm failure**

Run: `npm test -- tests/pages/home.test.tsx`

Expected: FAIL because the home action and `/study/setup` route are not wired.

- [ ] **Step 3: Implement router and app callbacks**

Load the generated day catalog beside vocabulary. On setup start, call `createStudySessionFromTarget`, save it, refresh, and navigate to `/study`. Keep `onStartStudy` as a compatibility callback for existing active-session resume. The home view model uses `activeSession.targetWordIds` when present and otherwise retains the recommended five-DAY selection.

- [ ] **Step 4: Run app/page tests**

Run: `npm test -- tests/pages/home.test.tsx tests/pages/study.test.tsx tests/app/App.test.tsx`

Expected: PASS with new setup navigation and existing study route behavior.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.tsx src/app/AppRouter.tsx src/pages/HomePage.tsx src/pages/StudyPage.tsx tests/pages/home.test.tsx
git commit -m "feat: connect study selection to app routing"
```

### Task 6: 반응형·접근성 스타일

**Files:**
- Modify: `src/styles/global.css`
- Modify: `tests/pages/studySetup.test.tsx` only for semantic assertions if needed

**Interfaces:**
- Preserve existing `.page`, `.button`, `.choice-grid`, focus ring, and iPad study action styles.
- Add `.study-setup-page`, `.study-mode-tabs`, `.day-bundle-list`, `.day-bundle`, `.range-picker`, `.random-picker`, `.selection-summary`.

- [ ] **Step 1: Add a failing geometry/accessibility assertion**

```ts
test('setup controls expose pressed state and a visible start action', () => {
  render(<MemoryRouter><StudySetupPage {...setupProps} /></MemoryRouter>);
  expect(screen.getByRole('tab', { name: '묶음으로 선택' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('button', { name: '이 범위로 학습 시작' })).toBeVisible();
});
```

- [ ] **Step 2: Run the focused test and confirm the semantic/style gap**

Run: `npm test -- tests/pages/studySetup.test.tsx`

Expected: FAIL until tab semantics and the setup layout are present.

- [ ] **Step 3: Implement responsive styles and semantics**

Use a single-column layout below 700px, two-column settings above it, minimum 44px controls, visible `:focus-visible` outlines, and `aria-selected`/`aria-controls` on tabs. Keep start summary sticky only inside the setup page; do not alter the study canvas touch behavior.

- [ ] **Step 4: Run page tests and build type-check**

Run: `npm test -- tests/pages/studySetup.test.tsx; npm run build`

Expected: PASS and a successful TypeScript/Vite build.

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css src/pages/StudySetupPage.tsx src/components
git commit -m "style: make study setup responsive and accessible"
```

### Task 7: 전체 회귀 및 오프라인/E2E 검증

**Files:**
- Modify: `tests/e2e/wordmaster.spec.ts`
- Modify: `tests/content/build-vocabulary.test.ts` if generated fixture assertions need the catalog import
- Modify: `README.md` only to document the new selection modes and DAY 11~20 availability

**Interfaces:**
- E2E starts from `/study/setup`, selects a bundle/range/random mode, and verifies the study session target count.
- Existing offline test remains authoritative for service-worker cached app, vocabulary, drawing, progress, and on-demand test.

- [ ] **Step 1: Write failing E2E scenarios**

```ts
test('selects DAY 11–15 from the bundle setup', async ({ page }) => {
  await page.getByRole('link', { name: '학습 범위 선택하기' }).click();
  await page.getByRole('button', { name: /DAY 11–15/ }).click();
  await expect(page.getByText('125단어')).toBeVisible();
  await page.getByRole('button', { name: '이 범위로 학습 시작' }).click();
  await expect(page.getByText(/문제 1/)).toBeVisible();
});

test('random word mode starts with 25 unique words', async ({ page }) => {
  await page.getByRole('link', { name: '학습 범위 선택하기' }).click();
  await page.getByRole('tab', { name: '랜덤으로 선택' }).click();
  await page.getByLabel('랜덤 방식').selectOption('random-words');
  await page.getByRole('button', { name: '이 범위로 학습 시작' }).click();
  await expect(page.getByText(/25개 단어/)).toBeVisible();
});
```

- [ ] **Step 2: Run E2E to confirm the new scenarios fail**

Run: `npm run test:e2e`

Expected: FAIL only at the new setup selectors before implementation; existing offline and Pencil scenarios remain runnable.

- [ ] **Step 3: Implement stable labels and session summary assertions**

Use visible Korean labels from the setup page, avoid CSS-only selectors, and expose the selected target count in the study header so E2E can verify 125 or 25 without inspecting implementation state.

- [ ] **Step 4: Run the complete required verification**

Run in order:

```bash
npm run content:build
npm test
npm run build
npm run test:e2e
```

Expected: all commands exit with code 0; unit/component tests include 500 words and all previous drawing/speech/session tests.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/wordmaster.spec.ts tests/content/build-vocabulary.test.ts README.md
git commit -m "test: verify scalable study selection and offline flow"
```

### Task 8: 최종 검토와 배포 전 상태 확인

**Files:**
- No product code changes unless a verification failure identifies a concrete regression.
- Review: all files changed by Tasks 1–7 and `docs/superpowers/specs/2026-07-17-scalable-study-selection-design.md`.

- [ ] **Step 1: Inspect the diff and repository state**

Run: `git diff --stat; git status --short; git diff --check`

Expected: only planned files are committed; unrelated user files such as `seventeen/` and source images remain untouched.

- [ ] **Step 2: Re-run the four required commands after the final diff review**

Run: `npm run content:build; npm test; npm run build; npm run test:e2e`

Expected: all four pass on the final working tree.

- [ ] **Step 3: Record completion evidence**

Record generated word/day counts, test totals, E2E browser results, and any physical iPad checks still required in the final handoff. Do not claim iPad hardware verification from Playwright alone.
