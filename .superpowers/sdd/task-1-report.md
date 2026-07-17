# Task 1 Report

## Status

Complete. The vocabulary builder now discovers and combines all matching DAY source files, validates sequential records with 25 words per day, and publishes vocabulary and day-catalog JSON assets for both source and offline paths.

## Original commit

`ef513c5 feat: build vocabulary through day 20`

## Original tests and verification

- `npm run content:build` passed; generated 500 vocabulary records.
- `npm test -- tests/content/build-vocabulary.test.ts` passed (3 tests).
- `npm test` passed (12 files, 64 tests).

## Follow-up fix

### Files

- Added and committed `content/source/영어_단어_DAY11-20.md` without changing its user-provided contents.
- Strengthened `tests/content/build-vocabulary.test.ts` to read the checked-in DAY 11~20 source, validate its 250 records, and compare those records with the generated 500-word output.

### Verification

- `npm run content:build` passed (`Generated 500 vocabulary records`).
- `npm test -- tests/content/build-vocabulary.test.ts` passed (4 tests).
- `npm test` passed (12 files, 65 tests).

### Commit

`4157134 fix: include day 11-20 source in vocabulary build`

### Concerns

No known concerns. The source is now tracked, so a clean checkout can reproduce the 500-word build.
