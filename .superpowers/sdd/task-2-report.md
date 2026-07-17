# Task 2 report

Status: complete

Implemented `src/domain/studySelection.ts` and focused domain coverage in `tests/domain/studySelection.test.ts`.

- Builds sorted DAY summaries with mastered/learning/unstarted progress counts.
- Builds five-DAY bundles, including partial final bundles, and scales to 100 DAYs.
- Resolves bundle, normalized inclusive range, random DAY, and whole-vocabulary random-word selections.
- Validates empty vocabularies, unavailable DAYs, integer inputs, and UI-compatible random word counts (10/25/50/125).
- Uses an injected deterministic random function and does not mutate source arrays.
- Formats a concise selection summary for the setup UI.

Tests:

- `npm test -- tests/domain/studySelection.test.ts` — PASS (9 tests)
- `npm test` — PASS (13 files, 74 tests)
- `npm run build` — BLOCKED by existing TypeScript configuration errors in `tests/content/build-vocabulary.test.ts` (`node:fs`, `node:path`, `process`, and missing `.mjs` declaration), unrelated to Task 2 files.
