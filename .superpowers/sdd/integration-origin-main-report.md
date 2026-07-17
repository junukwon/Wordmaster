# origin/main integration report

## Result

- Status: DONE
- Integration branch: `agent/scalable-selection-implementation`
- Merge commit: `9a1e9e4c84221f6d2a45a955497c16b08bc51a84`
- Parents:
  - scalable selection: `7ce9c78eae887bd5339f3c79b8d1f158c7274d98`
  - deployed `origin/main`: `776256acc63ce802302655b05f7272b757324ec4`
- Push performed: no

## Conflicts and resolutions

Eleven content conflicts were resolved without deleting either side's coverage:

1. `README.md`
   - Kept the DAY 01–20 / 500-word description and scalable bundle, range, and random-selection instructions.
   - Kept deployed offline DAY-selection/session-replacement guarantees, pronunciation voice setup, IPA reveal, and 600 ms rating-safety documentation.
2. `scripts/build-vocabulary.mjs`
   - Supports the six-column IPA schema used by DAY 01–10 and the five-column legacy schema used by DAY 11–20.
   - Emits a stable `phonetic` field for all words, requires valid IPA only for IPA-schema rows, combines/sorts all sources, and validates contiguous 25-word DAY groups.
3. `src/app/App.tsx`
   - Retained direct arbitrary DAY-card session creation and added target-based bundle/range/random session creation.
   - Both paths share storage rollback/error handling and preserve an existing session until replacement is explicitly confirmed.
4. `src/app/AppRouter.tsx`
   - Retained deployed routes and added `/study/setup`, navigating only after the target session is saved successfully.
5. `src/domain/sessionEngine.ts`
   - Retained explicit target word IDs/order and scalable selection metadata.
   - Retained deployed due-review behavior, legacy DAY filtering, target-day normalization, and non-contiguous DAY support.
6. `src/pages/HomePage.tsx`
   - Retained arbitrary DAY cards, dynamic counts, progress summaries, pronunciation settings, active-session banner, and accessible replacement dialog.
   - Added the advanced bundle/range/random selection entry point; it is hidden during an unfinished session so it cannot silently replace that session.
7. `src/pages/StudyPage.tsx`
   - Retained precise non-contiguous DAY labels, female/local pronunciation behavior, IPA reveal, and guarded rating controls.
   - Progress remains target-aware and dynamically sized for scalable sessions.
8. `tests/content/build-vocabulary.test.ts`
   - Retained DAY 01–10 IPA assertions and added 500-word, DAY 20, catalog, mixed-schema, and offline-output coverage.
9. `tests/domain/sessionEngine.test.ts`
   - Retained deployed legacy/non-contiguous DAY cases and scalable explicit-target/random-order cases.
10. `tests/e2e/wordmaster.spec.ts`
    - Retained direct DAY selection, active-session replacement, pronunciation/IPA/deliberate-rating, iPad viewport, and offline scenarios.
    - Retained scalable DAY 11–15 bundle and 25-word random-set scenarios, plus setup-to-study viewport coverage.
11. `tests/pages/home.test.tsx`
    - Retained all direct DAY-card, session protection, accessibility, and storage-error tests while adding the scalable setup link expectation.

## Integration fixes discovered by verification

- Updated scalable test fixtures with the now-required `phonetic` field introduced by the deployed pronunciation feature.
- Removed an obsolete `@ts-expect-error` after TypeScript correctly inferred the JavaScript builder export.
- Updated the DAY summary expectation from 10 to 20 after the vocabulary expanded to 500 words.
- Standardized progress accessibility labels on the deployed wording, such as `125개 신규 단어 진행률`, while preserving dynamic target counts.
- Added regression coverage ensuring DAY 11–20 legacy rows can still play TTS when IPA is absent; IPA remains hidden rather than rendering an empty element.
- Regenerated both application and offline vocabulary/catalog assets from the merged builder.

## Verification

- Focused app/home/study/session/storage/speech/content suite:
  - command: `npm test -- src/app/App.test.tsx tests/pages/home.test.tsx tests/pages/study.test.tsx tests/domain/sessionEngine.test.ts tests/storage/localStorageRepository.test.ts src/speech/SpeechPlayer.test.ts src/speech/PronunciationSettings.test.tsx src/speech/voiceSelection.test.ts tests/content/build-vocabulary.test.ts`
  - result: 9 files passed, 86 tests passed.
- Content build:
  - command: `npm run content:build`
  - result: generated 500 vocabulary records.
- Full unit/component suite:
  - command: `npm test`
  - result: 20 files passed, 142 tests passed.
- Production/PWA build:
  - command: `npm run build`
  - result: TypeScript and Vite succeeded; service worker generated with 14 precache entries (509.30 KiB).
- Whitespace/conflict validation:
  - `git diff --check` and cached check passed; no conflict markers remain.

## Remaining concerns

- The full Playwright suite was not run as part of this integration subtask; the parent task should run `npm run test:e2e` during final verification.
- DAY 11–20 uses the legacy source schema, so its `phonetic` values are empty until IPA data is added. TTS pronunciation remains available; only the IPA display is absent for those entries.
- Physical iPad Safari checks are still required for real system voice timbre/availability, Apple Pencil latency and palm rejection, Home Screen PWA update behavior, and true offline relaunch.
- No push or deployment was performed.
