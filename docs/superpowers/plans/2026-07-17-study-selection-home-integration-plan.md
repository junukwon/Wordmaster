# Study Selection Home Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈에서 학습 범위 설정을 항상 쉽게 열고, 설정 화면을 떠났다가 돌아와도 현재 브라우저 세션 동안 선택값을 복원한다.

**Architecture:** `HomePage`는 DAY 카드 앞에 상시 진입 링크를 렌더링한다. `StudySetupDraftRepository`가 `sessionStorage`의 임시 설정을 검증·저장하고, `StudySetupPage`는 초기 상태와 변경 상태를 이 저장소에 연결한다. 기존 학습 세션과 진도 저장 형식은 건드리지 않는다.

**Tech Stack:** React 19, TypeScript, React Router hash routing, Web Storage API, Vitest, Testing Library, Playwright

## Global Constraints

- 기존 DAY 직접 선택, 진행 중 세션 재개, 수시 테스트 동작을 유지한다.
- 기존 `localStorage` 키 `wordmaster:v1`과 학습 세션 형식을 변경하지 않는다.
- 새 학습 시작 시에만 기존 세션 교체 확인을 표시한다.
- 임시 선택 저장 실패가 화면 렌더링이나 학습 시작을 막지 않게 한다.
- production code는 해당 실패 테스트를 먼저 확인한 뒤 작성한다.

---

### Task 1: 홈의 상시 학습 범위 설정 진입

**Files:**
- Modify: `tests/pages/home.test.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: 기존 React Router 경로 `/study/setup`
- Produces: 세션 유무와 무관하게 하나만 렌더링되는 `학습 범위 설정` 링크

- [ ] **Step 1: 진행 중 세션에서도 링크가 상단에 보이는 실패 테스트 작성**

```tsx
test('keeps one setup entry visible before DAY cards while a session is active', () => {
  renderHome({ ...viewModel, activeSession });
  const link = screen.getByRole('link', { name: '학습 범위 설정' });
  expect(screen.getAllByRole('link', { name: '학습 범위 설정' })).toHaveLength(1);
  const grid = screen.getByLabelText('학습할 DAY 선택');
  expect(link.compareDocumentPosition(grid)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/pages/home.test.tsx`

Expected: FAIL because the active-session branch currently hides `학습 범위 선택하기` and no pre-grid link exists.

- [ ] **Step 3: DAY 목록 앞에 상시 링크를 최소 구현**

```tsx
<div className="study-setup-entry">
  <div>
    <strong>묶음·범위·랜덤 학습</strong>
    <span>DAY가 많아져도 원하는 분량만 골라 시작할 수 있어요.</span>
  </div>
  <Link className="button button--secondary" to="/study/setup">학습 범위 설정</Link>
</div>
```

기존 `!activeSession` 조건 링크는 제거하고, `.study-setup-entry`는 iPad에서도 버튼이 밀리지 않는 반응형 레이아웃을 적용한다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/pages/home.test.tsx`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add tests/pages/home.test.tsx src/pages/HomePage.tsx src/styles/global.css
git commit -m "feat: keep study setup visible from home"
```

### Task 2: 세션 범위의 학습 설정 임시 저장소

**Files:**
- Create: `src/storage/StudySetupDraftRepository.ts`
- Create: `tests/storage/studySetupDraftRepository.test.ts`

**Interfaces:**
- Produces: `StudySetupDraft`, `loadStudySetupDraft(storage, defaults)`, `saveStudySetupDraft(storage, draft)`
- Consumes: `Storage` 호환 객체와 현재 단어 데이터에서 계산한 기본값

- [ ] **Step 1: 유효값 복원·손상값 기본 처리·저장 실패 무시 테스트 작성**

```ts
const defaults = {
  mode: 'bundle', bundleStartDay: 1, startDay: 1, endDay: 1,
  randomMode: 'random-days', dayCount: 1, wordCount: 25,
  seed: 'initial', searchQuery: '',
} satisfies StudySetupDraft;

expect(loadStudySetupDraft(storageWithValidDraft, defaults)).toEqual(validDraft);
expect(loadStudySetupDraft(storageWithMalformedJson, defaults)).toEqual(defaults);
expect(() => saveStudySetupDraft(throwingStorage, defaults)).not.toThrow();
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/storage/studySetupDraftRepository.test.ts`

Expected: FAIL because the repository module does not exist.

- [ ] **Step 3: 검증과 예외 격리를 최소 구현**

```ts
export const STUDY_SETUP_DRAFT_KEY = 'wordmaster:study-setup-draft:v1';

export type StudySetupDraft = {
  mode: 'bundle' | 'range' | 'random';
  bundleStartDay: number | null;
  startDay: number | null;
  endDay: number | null;
  randomMode: 'random-days' | 'random-words';
  dayCount: number;
  wordCount: number;
  seed: string;
  searchQuery: string;
};
```

`loadStudySetupDraft`는 JSON 객체와 각 필드 타입을 검사하고, 유효하지 않거나 읽기 예외가 나면 `defaults`를 반환한다. `saveStudySetupDraft`는 쓰기 예외를 삼킨다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- tests/storage/studySetupDraftRepository.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/storage/StudySetupDraftRepository.ts tests/storage/studySetupDraftRepository.test.ts
git commit -m "feat: persist study setup draft per session"
```

### Task 3: 설정 화면 복원 연결과 최종 검증

**Files:**
- Modify: `src/pages/StudySetupPage.tsx`
- Modify: `tests/pages/studySetup.test.tsx`
- Modify: `tests/e2e/wordmaster.spec.ts`
- Modify: `docs/superpowers/plans/2026-07-17-study-selection-home-integration-plan.md`

**Interfaces:**
- Consumes: Task 2의 `StudySetupDraftRepository`
- Produces: 홈 이동 후 다시 열어도 복원되는 설정 UI

- [ ] **Step 1: 컴포넌트 재마운트 복원 실패 테스트 작성**

```tsx
const first = render(<MemoryRouter><StudySetupPage {...setupProps} /></MemoryRouter>);
await user.click(screen.getByRole('tab', { name: '범위로 선택' }));
await user.selectOptions(screen.getByLabelText('시작 DAY'), '4');
await user.selectOptions(screen.getByLabelText('종료 DAY'), '7');
first.unmount();
render(<MemoryRouter><StudySetupPage {...setupProps} /></MemoryRouter>);
expect(screen.getByRole('tab', { name: '범위로 선택' })).toHaveAttribute('aria-selected', 'true');
expect(screen.getByLabelText('시작 DAY')).toHaveValue('4');
expect(screen.getByLabelText('종료 DAY')).toHaveValue('7');
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/pages/studySetup.test.tsx`

Expected: FAIL because the remounted page returns to bundle DAY 01–05.

- [ ] **Step 3: 저장소를 상태 초기화와 변경 효과에 연결**

```tsx
const defaults = createDefaultDraft(days, bundles, words.length);
const [draft, setDraft] = useState(() => loadStudySetupDraft(sessionStorage, defaults));

useEffect(() => {
  saveStudySetupDraft(sessionStorage, draft);
}, [draft]);
```

각 자식 콜백은 `draft`의 해당 필드만 갱신한다. 브라우저 저장소가 없는 테스트·비브라우저 환경에서는 기본값을 사용한다.

- [ ] **Step 4: 컴포넌트와 관련 회귀 테스트 통과 확인**

Run: `npm test -- tests/pages/studySetup.test.tsx tests/pages/home.test.tsx tests/storage/studySetupDraftRepository.test.ts`

Expected: PASS.

- [ ] **Step 5: E2E에 홈 상시 진입과 복원 시나리오 추가**

홈에서 `학습 범위 설정` 링크가 DAY 카드 목록보다 먼저 보이는지 확인하고, 범위 선택 후 홈 왕복 시 시작·종료 DAY가 유지되는지 검증한다.

- [ ] **Step 6: 전체 검증**

Run:

```bash
npm run content:build
npm test
npm run build
npm run test:e2e
```

Expected: content 500 records, all unit tests PASS, production build PASS, all applicable E2E tests PASS.

- [ ] **Step 7: 체크박스 갱신과 커밋**

```bash
git add src/pages/StudySetupPage.tsx tests/pages/studySetup.test.tsx tests/e2e/wordmaster.spec.ts docs/superpowers/plans/2026-07-17-study-selection-home-integration-plan.md
git commit -m "feat: restore study setup after home navigation"
```
