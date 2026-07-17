# Compact Home DAY Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iPad Mini 가로 홈 화면에서 20개 DAY를 컴팩트하게 탐색하고, DAY 100까지 20개 구간과 검색으로 확장할 수 있는 선택 UI를 구현한다.

**Architecture:** `homeDayFilter` 순수 함수가 구간 생성과 검색을 담당하고, `HomeDayToolbar`가 검색·범례·구간 선택을 렌더링한다. `HomePage`가 필터 상태와 전체 선택을 관리하며 `DaySelectionGrid`는 작은 3색 상태 카드만 담당한다.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library, Playwright, CSS Grid

## Global Constraints

- 기존 학습 세션·진도·테스트·PWA 저장 형식은 변경하지 않는다.
- 상태 색은 숙달 `#2A9D8F`, 학습 중 `#E9C46A`, 미학습 `#E76F51`을 사용한다.
- iPad Mini 가로에서 5열 × 4행을 사용하고 가로 스크롤이 없어야 한다.
- 주요 버튼과 DAY 카드의 터치 영역은 최소 44px을 유지한다.
- 필터 밖 DAY의 선택 상태와 하단 선택 합계는 유지한다.
- 모든 production code는 실패 테스트를 먼저 확인한 뒤 작성한다.

---

### Task 1: DAY 구간 및 검색 로직

**Files:**
- Create: `src/domain/homeDayFilter.ts`
- Create: `tests/domain/homeDayFilter.test.ts`

**Interfaces:**
- Produces: `DayRange = { start: number; end: number; label: string }`
- Produces: `buildDayRanges(days: DaySummary[], size?: number): DayRange[]`
- Produces: `filterHomeDays(days: DaySummary[], range: DayRange, query: string): DaySummary[]`

- [x] **Step 1: 구간 생성과 전체 검색 실패 테스트 작성**

```ts
const days = Array.from({ length: 45 }, (_, index) => ({
  day: index + 1, topic: index === 24 ? '학교 활동' : `주제 ${index + 1}`,
  total: 25, mastered: 0, learning: 0, unseen: 25,
}));

expect(buildDayRanges(days)).toEqual([
  { start: 1, end: 20, label: 'DAY 01–20' },
  { start: 21, end: 40, label: '21–40' },
  { start: 41, end: 45, label: '41–45' },
]);
expect(filterHomeDays(days, { start: 1, end: 20, label: 'DAY 01–20' }, '25').map((day) => day.day)).toEqual([25]);
expect(filterHomeDays(days, { start: 1, end: 20, label: 'DAY 01–20' }, '학교').map((day) => day.day)).toEqual([25]);
```

- [x] **Step 2: 실패 확인**

Run: `npm test -- tests/domain/homeDayFilter.test.ts`

Expected: FAIL because `src/domain/homeDayFilter.ts` does not exist.

- [x] **Step 3: 최소 순수 함수 구현**

`buildDayRanges`는 정렬된 DAY의 최소·최대 번호를 20개 단위로 묶고 마지막 실제 DAY에서 종료한다. `filterHomeDays`는 검색어가 있으면 구간을 무시하고 DAY 번호 또는 소문자 주제를 검색하며, 검색어가 없으면 구간만 적용한다.

- [x] **Step 4: 통과 확인**

Run: `npm test -- tests/domain/homeDayFilter.test.ts`

Expected: PASS.

- [x] **Step 5: 커밋**

```bash
git add src/domain/homeDayFilter.ts tests/domain/homeDayFilter.test.ts
git commit -m "feat: add scalable home DAY filtering"
```

### Task 2: 컴팩트 DAY 카드와 홈 도구 모음

**Files:**
- Create: `src/components/HomeDayToolbar.tsx`
- Create: `tests/components/HomeDayToolbar.test.tsx`
- Modify: `src/components/DaySelectionGrid.tsx`
- Modify: `tests/components/DaySelectionGrid.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `DayRange`
- Produces: `HomeDayToolbarProps = { query; ranges; selectedRangeStart; onQueryChange; onRangeChange }`
- Preserves: `DaySelectionGridProps = { summaries; selectedDayIds; onChange }`

- [x] **Step 1: 상태 범례와 구간 선택 실패 테스트 작성**

```tsx
render(<HomeDayToolbar query="" ranges={ranges} selectedRangeStart={1} onQueryChange={onQueryChange} onRangeChange={onRangeChange} />);
expect(screen.getByLabelText('DAY 또는 주제 검색')).toBeInTheDocument();
expect(screen.getByRole('list', { name: '학습 상태 범례' })).toHaveTextContent('숙달학습 중미학습');
await user.click(screen.getByRole('button', { name: '21–40' }));
expect(onRangeChange).toHaveBeenCalledWith(21);
```

- [x] **Step 2: 카드 3색 숫자 실패 테스트 작성**

```tsx
expect(screen.getByTestId('day-1-mastered')).toHaveTextContent('8');
expect(screen.getByTestId('day-1-learning')).toHaveTextContent('5');
expect(screen.getByTestId('day-1-unseen')).toHaveTextContent('12');
expect(screen.getByRole('button', { name: /숙달 8 학습 중 5 미학습 12/ })).toBeInTheDocument();
expect(screen.queryByText('25개')).not.toBeInTheDocument();
```

- [x] **Step 3: 실패 확인**

Run: `npm test -- tests/components/HomeDayToolbar.test.tsx tests/components/DaySelectionGrid.test.tsx`

Expected: FAIL because the toolbar is missing and the current card renders vertical labels.

- [x] **Step 4: 최소 컴포넌트 구현**

`HomeDayToolbar`는 검색 입력, 단일 상태 범례, 구간 버튼을 렌더링한다. `DaySelectionGrid`는 DAY·주제·선택 원과 `day-status-pill--mastered|learning|unseen` 숫자 캡슐만 렌더링한다.

- [x] **Step 5: 통과 확인**

Run: `npm test -- tests/components/HomeDayToolbar.test.tsx tests/components/DaySelectionGrid.test.tsx`

Expected: PASS.

- [x] **Step 6: 커밋**

```bash
git add src/components/HomeDayToolbar.tsx tests/components/HomeDayToolbar.test.tsx src/components/DaySelectionGrid.tsx tests/components/DaySelectionGrid.test.tsx
git commit -m "feat: add compact DAY status cards"
```

### Task 3: 홈 통합과 iPad 가로 레이아웃

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `tests/pages/home.test.tsx`
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/wordmaster.spec.ts`
- Modify: `docs/superpowers/plans/2026-07-17-compact-home-day-grid-plan.md`

**Interfaces:**
- Consumes: `buildDayRanges`, `filterHomeDays`, `HomeDayToolbar`
- Preserves: `HomePageProps`, `onStartStudy(dayIds)`, 세션 교체 대화상자

- [ ] **Step 1: 구간 전환·검색·숨은 선택 유지 실패 테스트 작성**

45개 DAY의 HomePage를 렌더링하고 기본 화면에 DAY 01–20만 있는지, 21–40을 누르면 DAY 21이 표시되는지, `학교` 검색으로 구간 밖 DAY가 표시되는지 검증한다. DAY 02 선택 후 다른 구간으로 이동해도 하단 요약은 `1개 선택 · 신규 25개`를 유지해야 한다.

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/pages/home.test.tsx`

Expected: FAIL because HomePage does not render filtering controls.

- [ ] **Step 3: HomePage 필터 상태와 승인 레이아웃 구현**

`useMemo`로 ranges와 visibleDays를 계산하고 `HomeDayToolbar` 뒤에 필터된 `DaySelectionGrid`를 렌더링한다. 검색 결과가 없으면 `role="status"`로 `검색 결과가 없어요.`를 표시한다. 선택 합계는 항상 전체 `viewModel.days`에서 계산한다.

- [ ] **Step 4: CSS를 iPad 가로 5열 컴팩트 카드로 변경**

기본 `.day-grid`는 5열, `.day-card`는 최소 높이 약 108px, 상태 캡슐은 34–38px × 18px로 구현한다. 900px 이하에서는 3열, 640px 이하에서는 2열로 전환한다. 헤더·도구 모음·하단 액션은 승인 시안의 여백과 색 체계를 따른다.

- [ ] **Step 5: 홈 단위 테스트 통과 확인**

Run: `npm test -- tests/pages/home.test.tsx tests/components/HomeDayToolbar.test.tsx tests/components/DaySelectionGrid.test.tsx tests/domain/homeDayFilter.test.ts`

Expected: PASS.

- [ ] **Step 6: iPad Mini 가로 E2E 갱신**

`iPad Mini landscape`에서 첫 구간에 DAY 카드 20개가 보이고, `.day-grid`의 첫 행에 5개가 배치되며, 문서 가로 폭이 viewport를 넘지 않는지 검증한다. 기존 DAY 선택·학습 시작·세션 교체 흐름도 유지한다.

- [ ] **Step 7: 전체 검증**

Run:

```bash
npm run content:build
npm test
npm run build
npm run test:e2e
```

Expected: 500 vocabulary records, all unit tests PASS, build PASS, all applicable E2E tests PASS.

- [ ] **Step 8: 체크박스 갱신과 커밋**

```bash
git add src/pages/HomePage.tsx tests/pages/home.test.tsx src/styles/global.css tests/e2e/wordmaster.spec.ts docs/superpowers/plans/2026-07-17-compact-home-day-grid-plan.md
git commit -m "feat: optimize home DAY grid for iPad landscape"
```
