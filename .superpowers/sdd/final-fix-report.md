# Scalable selection final-fix report

## Findings mapping

1. **Protect active sessions in advanced setup — fixed.** `src/pages/StudySetupPage.tsx` opens the existing accessible `SessionReplacementDialog` when an unfinished session exists. Cancel keeps the setup and stored session, continue returns to the active study, and only explicit replace creates the new target session. `src/app/AppRouter.tsx` passes the active session and continue callback, including direct/browser-history entry to `#/study/setup`. Covered by `tests/pages/studySetup.test.tsx`, `src/app/App.test.tsx`, and `tests/e2e/wordmaster.spec.ts`.
2. **Exclude due reviews from target-based sessions — fixed.** `src/domain/sessionEngine.ts` makes due-review injection opt-in for `createStudySessionFromTarget`; the legacy DAY wrapper opts in explicitly to retain deployed behavior. The random-25 regression in `tests/domain/sessionEngine.test.ts` proves the queue contains exactly the resolved target IDs and no outside due-review ID.
3. **Search by DAY number or topic — fixed.** `src/pages/StudySetupPage.tsx` accepts numeric (`12`, `DAY 12`) and Korean topic queries, while `src/components/DayBundleList.tsx` exposes bundle topics. Filtering changes bundle discovery only; the selected target and summary remain unchanged. Covered by page and E2E regressions.
4. **ARIA tab keyboard navigation — fixed.** Setup tabs support ArrowLeft, ArrowRight, Home, and End, including wrapping focus and selection. Covered by `tests/pages/studySetup.test.tsx`.
5. **E2E regressions — fixed and passing.** `tests/e2e/wordmaster.spec.ts` verifies topic search plus active-session protection across all configured browser/device projects.
6. **README IPA limitation — documented.** `README.md` states that DAY 11–20 source data has no IPA, no IPA is fabricated, and system TTS remains available.
7. **Implementation plan completion — recorded.** All actual task checkboxes in `docs/superpowers/plans/2026-07-17-scalable-study-selection-plan.md` are checked. The only literal `- [ ]` text left is prose explaining the checkbox syntax, not an incomplete task.

## Fresh verification (2026-07-17 Asia/Seoul)

- Focused: `npm test -- tests/domain/sessionEngine.test.ts tests/pages/studySetup.test.tsx src/app/App.test.tsx` — exit 0; 3 files passed, 26 tests passed.
- `npm run content:build` — exit 0; generated 500 vocabulary records.
- `npm test` — exit 0; 20 files passed, 147 tests passed.
- `npm run build` — exit 0; TypeScript/Vite build succeeded; PWA precached 14 entries (511.07 KiB).
- `npm run test:e2e` — exit 0; 22 passed, 10 skipped by intentional project guards, 0 failed across Desktop Chrome, iPhone, iPad Mini portrait, and iPad Mini landscape.
- `git diff --check` — exit 0.

No test or build failures occurred during this completion run, so no additional product-code fix was required.

## Commits

- Product, test, and user-facing documentation fixes: `8490630 fix: complete scalable study selection`.
- This report is recorded in the following local documentation commit (`docs: record final selection fixes`); its hash is intentionally not self-referenced because amending the report changes that hash.

No push, merge, deployment, worktree cleanup, or unrelated-file change was performed.

## Remaining concerns

- Physical iPad Safari remains required for the existing Apple Pencil pressure/palm-rejection, system voice quality, offline reload, and home-screen installation checks. Playwright device emulation does not prove those hardware/OS behaviors.
- DAY 11–20 IPA remains absent by source-data design; system TTS is the supported pronunciation path for those entries.
