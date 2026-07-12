# Speech, IPA, and Answer Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a preferred bright American-English voice with a persistent selector, reveal reviewed American IPA after pronunciation playback, and prevent answer-reveal double taps from recording an unintended positive rating.

**Architecture:** Keep voice preference separate from learning progress in a small local-storage repository, and make `SpeechPlayer` the single voice-ranking and playback boundary. Extend the existing Markdown-to-JSON content pipeline with required static IPA. Use a reusable 600 ms answer guard in both study and on-demand test screens so visual layout and input safety share one rule.

**Tech Stack:** React 19, TypeScript, Web Speech API, localStorage, Vitest/Testing Library, Playwright, Vite PWA.

## Global Constraints

- Work from `origin/main` on `agent/speech-study-safety`; do not merge the fan-theme branch.
- Use TDD for every behavior: observe RED before production changes and run focused GREEN tests before each commit.
- Prefer saved installed English voice, then preferred local `en-US` female names, another local `en-US`, another local English, non-local `en-US`, and finally another English voice.
- Speech parameters are `lang = en-US`, `rate = 0.85`, and `pitch = 1.05`.
- Store voice preference locally and independently from learning progress.
- Add a required reviewed American-English IPA transcription for all 250 words; do not call a dictionary at runtime.
- IPA starts hidden, appears after `발음 듣기`, resets on the next word, and never appears in on-demand tests.
- Study and test rating controls use a separate row and remain disabled for exactly 600 ms after reveal.
- Do not add login, server storage, speech recognition, pronunciation scoring, or unrelated UI changes.
- Preserve Apple Pencil, mastery scheduling, offline operation, service-worker update behavior, and existing DAY selection.

---

### Task 1: Voice preference and deterministic voice ranking

**Files:**
- Create: `src/speech/SpeechPreferenceRepository.ts`
- Create: `src/speech/voiceSelection.ts`
- Create: `src/speech/voiceSelection.test.ts`
- Modify: `src/speech/SpeechPlayer.ts`
- Modify: `src/speech/SpeechPlayer.test.ts`

**Interfaces:**
- Produces: `VoicePreference = { mode: 'auto' } | { mode: 'manual'; voiceURI: string; name: string; lang: string }`.
- Produces: `SpeechPreferenceRepository.load(): VoicePreference`, `.save(preference): void` using key `wordmaster-speech-preference-v1`.
- Produces: `rankEnglishVoices(voices, preference): SpeechSynthesisVoice[]` and `SpeechPlayer.getVoices()`, `.getSelectedVoice()`, `.setPreference()`, `.getPreference()`, `.preview()`.
- Preserves: `SpeechPlayer.speak(term): boolean`, `isAvailable()`, `subscribe()`, and `getNotice()` used by the existing app.

- [ ] **Step 1: Write failing ranking and persistence tests**

Add table-driven cases showing manual installed voice wins; Samantha/Ava/Allison/Susan/Zoe local `en-US` beat an arbitrary local male voice; arbitrary local `en-US` beats local `en-GB`; local English beats remote; and a missing manual voice falls back to automatic ranking. Test malformed localStorage JSON returns `{ mode: 'auto' }` without throwing.

```ts
expect(rankEnglishVoices([male, samantha], { mode: 'auto' })[0]).toBe(samantha);
expect(rankEnglishVoices([male, samantha], {
  mode: 'manual', voiceURI: male.voiceURI, name: male.name, lang: male.lang,
})[0]).toBe(male);
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- src/speech/voiceSelection.test.ts src/speech/SpeechPlayer.test.ts`

Expected: FAIL because `voiceSelection` and preference APIs do not exist and the existing player still uses `rate = 0.8` with no pitch.

- [ ] **Step 3: Implement the preference repository and pure ranking function**

Use exact preferred-name matching after lowercasing and stripping platform suffixes. Rank by a numeric tuple rather than relying on browser order. Filter non-English voices before ranking and preserve original order for equal scores.

```ts
const PREFERRED_FEMALE_NAMES = ['samantha', 'ava', 'allison', 'susan', 'zoe'];
export function rankEnglishVoices(voices: SpeechSynthesisVoice[], preference: VoicePreference) {
  return voices.filter(isEnglish).map((voice, index) => ({ voice, index, score: scoreVoice(voice, preference) }))
    .sort((a, b) => a.score - b.score || a.index - b.index).map(({ voice }) => voice);
}
```

- [ ] **Step 4: Update `SpeechPlayer`**

Inject `SpeechPreferenceRepository`, use the ranked first voice, cancel before playback, and set all fixed utterance parameters. `preview()` speaks `Hello, let's study English.` through the same internal method. A missing saved voice returns a notice but does not block fallback playback. `voiceschanged` continues notifying subscribers.

- [ ] **Step 5: Run focused and regression tests**

Run: `npm test -- src/speech/voiceSelection.test.ts src/speech/SpeechPlayer.test.ts tests/pages/study.test.tsx`

Expected: PASS; speech assertions include `{ lang: 'en-US', rate: 0.85, pitch: 1.05 }`.

- [ ] **Step 6: Commit**

```bash
git add src/speech/SpeechPreferenceRepository.ts src/speech/voiceSelection.ts src/speech/voiceSelection.test.ts src/speech/SpeechPlayer.ts src/speech/SpeechPlayer.test.ts
git commit -m "feat: prefer configurable female english voice"
```

### Task 2: Pronunciation settings UI

**Files:**
- Create: `src/speech/PronunciationSettings.tsx`
- Create: `src/speech/PronunciationSettings.test.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `tests/pages/home.test.tsx`

**Interfaces:**
- Consumes: Task 1 `SpeechPlayer` voice-list, preference, preview, notice, and subscription APIs.
- Produces: a collapsed `<details>` labelled `발음 설정` on HomePage.

- [ ] **Step 1: Write failing settings component tests**

Assert the section is collapsed initially, automatic mode is selected by default, every installed English voice appears, local voices have a `기기 내장` label, selecting a voice persists it, preview calls `speechPlayer.preview()`, and `voiceschanged` refreshes options without remounting the app.

```tsx
await user.click(screen.getByText('발음 설정'));
await user.selectOptions(screen.getByLabelText('영어 음성 선택'), samantha.voiceURI);
expect(speechPlayer.setPreference).toHaveBeenCalledWith(expect.objectContaining({ mode: 'manual' }));
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- src/speech/PronunciationSettings.test.tsx tests/pages/home.test.tsx`

Expected: FAIL because the settings component and HomePage integration do not exist.

- [ ] **Step 3: Implement settings and root wiring**

Construct one `SpeechPlayer` in App, pass it to HomePage and StudyPage, and render `PronunciationSettings` after the learning routine. Use native `<select>` and `<button>` controls with at least 44 px touch height. Show notices with `role="status"`; do not block startup while voices are empty.

- [ ] **Step 4: Add responsive styling**

Keep the settings compact in collapsed state and single-column within iPad Mini portrait. Do not change Pencil canvas touch handling or the DAY selection layout.

- [ ] **Step 5: Run focused and app tests**

Run: `npm test -- src/speech/PronunciationSettings.test.tsx tests/pages/home.test.tsx src/speech/SpeechPlayer.test.ts`

Expected: PASS with automatic/manual selection, preview, late voice loading, and accessible labels covered.

- [ ] **Step 6: Commit**

```bash
git add src/speech/PronunciationSettings.tsx src/speech/PronunciationSettings.test.tsx src/pages/HomePage.tsx src/App.tsx src/styles.css tests/pages/home.test.tsx
git commit -m "feat: add pronunciation voice settings"
```

### Task 3: Required American IPA content

**Files:**
- Modify: `content/source/영어_단어_DAY01-10.md`
- Modify: `scripts/build-vocabulary.mjs`
- Modify: `src/domain/types.ts`
- Regenerate: `src/content/vocabulary.json`
- Regenerate: `public/data/vocabulary.json`
- Modify: `tests/content/build-vocabulary.test.ts`

**Interfaces:**
- Produces: required `VocabularyWord.phonetic: string`, formatted with surrounding `/` characters.
- Preserves: source Markdown as the only editable vocabulary source and generated JSON equality.

- [ ] **Step 1: Write failing parser and complete-content tests**

Extend parser fixtures with a `발음기호` column. Assert missing or malformed IPA throws, the generated collection has 250 non-empty IPA strings, and representative entries match reviewed American forms.

```ts
expect(words[0]).toMatchObject({ term: 'knee', phonetic: '/niː/' });
expect(words.every((word) => /^\/.+\/$/.test(word.phonetic))).toBe(true);
expect(new Set(words.map((word) => word.phonetic)).size).toBeGreaterThan(150);
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- tests/content/build-vocabulary.test.ts`

Expected: FAIL because `phonetic` is absent from the parser, type, and generated data.

- [ ] **Step 3: Add and review all 250 IPA values**

Add `발음기호` immediately after the English term column for every vocabulary row. Use General American transcription and preserve phrase stress/word boundaries for multiword entries. Review homographs and phrases in the context of the supplied Korean meaning; verify the first, last, and at least five entries per DAY manually before generation. Do not synthesize IPA at runtime or add a production dictionary dependency.

- [ ] **Step 4: Update parser, type, and validation**

Parse `[id, term, phonetic, partOfSpeech, meaning, inflection]`, require `/.../`, and include the field in emitted records.

```js
if (!/^\/.+\/$/.test(word.phonetic)) throw new Error(`Invalid phonetic: ${word.id}`);
```

- [ ] **Step 5: Regenerate and verify content**

Run: `npm run content:build`

Expected: `Generated 250 vocabulary records`.

Run: `npm test -- tests/content/build-vocabulary.test.ts`

Expected: PASS; source and public JSON remain identical and all DAY counts remain 25.

- [ ] **Step 6: Commit**

```bash
git add content/source/영어_단어_DAY01-10.md scripts/build-vocabulary.mjs src/domain/types.ts src/content/vocabulary.json public/data/vocabulary.json tests/content/build-vocabulary.test.ts
git commit -m "feat: add american ipa vocabulary data"
```

### Task 4: Reveal IPA after pronunciation

**Files:**
- Modify: `src/pages/StudyPage.tsx`
- Modify: `tests/pages/study.test.tsx`
- Modify: `src/styles.css`
- Test: `tests/pages/test-flow.test.tsx`

**Interfaces:**
- Consumes: Task 3 `VocabularyWord.phonetic` and Task 1 `SpeechPlayer.speak()`.
- Produces: per-word local `phoneticVisible` state in StudyPage only.

- [ ] **Step 1: Write failing reveal/reset/no-test-leak tests**

Assert IPA is absent initially; pronunciation click reveals it and calls speech; speech unavailability still leaves the button usable and reveals IPA; repeated click keeps it visible; intentional rating/advance hides the prior IPA; and TestPage never renders `phonetic`.

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm test -- tests/pages/study.test.tsx tests/pages/test-flow.test.tsx`

Expected: FAIL because IPA is never rendered and the current speech button is disabled without a voice.

- [ ] **Step 3: Implement per-item reveal**

Use the current `word.id` as the reset boundary. The click handler calls speech and reveals IPA regardless of the boolean playback result. Keep the button enabled when IPA is available, while the inline notice explains missing speech.

```tsx
const [phoneticWordId, setPhoneticWordId] = useState<string | null>(null);
const revealPronunciation = () => { setPhoneticWordId(word.id); speechPlayer.speak(word.term); };
{phoneticWordId === word.id && <p className="phonetic" lang="en-US">{word.phonetic}</p>}
```

- [ ] **Step 4: Style and verify**

Use a readable IPA-capable system font stack, keep the line near the English term, and avoid shifting primary action buttons outside the iPad Mini initial viewport.

Run: `npm test -- tests/pages/study.test.tsx tests/pages/test-flow.test.tsx tests/drawing/pencil-input.test.tsx`

Expected: PASS; Pencil tests remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/pages/StudyPage.tsx tests/pages/study.test.tsx tests/pages/test-flow.test.tsx src/styles.css
git commit -m "feat: reveal ipa after pronunciation"
```

### Task 5: Guard rating controls against reveal double taps

**Files:**
- Create: `src/hooks/useAnswerRevealGuard.ts`
- Create: `src/hooks/useAnswerRevealGuard.test.tsx`
- Modify: `src/pages/StudyPage.tsx`
- Modify: `src/pages/TestPage.tsx`
- Modify: `src/components/RatingButtons.tsx`
- Modify: `tests/pages/study.test.tsx`
- Modify: `tests/pages/test-flow.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `useAnswerRevealGuard(delayMs = 600)` returning `{ revealed, ratingReady, reveal, reset }`.
- Consumes: existing `rate` functions; neither page may call them while `ratingReady === false`.

- [ ] **Step 1: Write the failing guard unit test**

With fake timers, assert `reveal()` immediately sets `revealed` but not `ratingReady`, 599 ms remains guarded, 600 ms enables rating, and `reset()` cancels pending activation.

- [ ] **Step 2: Write failing study and test double-tap regressions**

Use `user.dblClick()` or two immediate pointer clicks on `정답 보기`. Assert answer appears, `repository.saveWordProgress`, `onAttemptChange`, and positive rating handlers have not run, and the current item/question does not advance. Advance fake time by 600 ms, click a rating once, and assert exactly one save/advance.

- [ ] **Step 3: Run tests and confirm RED**

Run: `npm test -- src/hooks/useAnswerRevealGuard.test.tsx tests/pages/study.test.tsx tests/pages/test-flow.test.tsx`

Expected: FAIL because replacement-in-place controls accept the second click.

- [ ] **Step 4: Implement the hook and integrate both pages**

Clear the timer on reset/unmount. Preserve the reveal button row as a stable placeholder after reveal and render rating controls in a separate `.rating-stage` row. Disable every rating until ready and guard the handler as a second line of defense.

```ts
if (!ratingReady || saving) return;
```

Show `정답을 확인한 뒤 평가해 주세요.` with `role="status"` during the 600 ms window. Reset on each next study item or test question. Keep `모르겠어요` unchanged before reveal.

- [ ] **Step 5: Run focused and full tests**

Run: `npm test -- src/hooks/useAnswerRevealGuard.test.tsx tests/pages/study.test.tsx tests/pages/test-flow.test.tsx`

Expected: PASS with immediate double taps ignored and intentional delayed ratings saved once.

Run: `npm test`

Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useAnswerRevealGuard.ts src/hooks/useAnswerRevealGuard.test.tsx src/pages/StudyPage.tsx src/pages/TestPage.tsx src/components/RatingButtons.tsx tests/pages/study.test.tsx tests/pages/test-flow.test.tsx src/styles.css
git commit -m "fix: prevent accidental answer ratings"
```

### Task 6: iPad, offline, documentation, and final verification

**Files:**
- Modify: `tests/e2e/wordmaster.spec.ts`
- Modify: `README.md`
- Modify: `2026-07-10-wordmaster-implementation-plan.md` only if its tracked checklist has matching verification items.

**Interfaces:**
- Verifies Tasks 1–5 without adding production behavior.

- [ ] **Step 1: Add failing iPad E2E coverage**

In the existing iPad portrait/landscape projects, assert pronunciation settings controls are reachable and at least 44 px tall, IPA is absent before playback and visible after it, and a rapid double click on answer reveal does not advance. Use installed mock voices through an init script; do not inject fake application DOM.

- [ ] **Step 2: Run the focused E2E and confirm RED**

Run: `npx playwright test tests/e2e/wordmaster.spec.ts --grep "pronunciation and safe reveal"`

Expected: FAIL before the new journey exists or if layout/input behavior violates the design.

- [ ] **Step 3: Finish responsive adjustments and README**

Document automatic female-voice ranking, manual selection and preview, iPad English voice installation, the device-dependent nature of system voice names, IPA reveal behavior, the 600 ms safety guard, and offline conditions. Do not claim Windows emulation verifies the subjective sound of an actual iPad voice.

- [ ] **Step 4: Run mandatory verification**

Run in order:

```bash
npm run content:build
npm test
npm run build
npm run test:e2e
```

Expected: 250 records generated; all unit/component tests pass; TypeScript/Vite/PWA build exits 0; Playwright exits 0 with documented platform-specific skips only.

- [ ] **Step 5: Verify working tree and commit**

Run: `git diff --check && git status --short`

```bash
git add tests/e2e/wordmaster.spec.ts README.md 2026-07-10-wordmaster-implementation-plan.md
git commit -m "test: verify pronunciation and safe rating on ipad"
```

- [ ] **Step 6: Real-device acceptance checklist**

On iPad Mini, verify Samantha/Ava or the chosen installed voice sounds clear and bright; changing the selector persists after closing the PWA; IPA is legible in portrait and landscape; Pencil strokes remain continuous; rapid double taps never record `기억남`/`맞음`; and the feature still works after going offline. Record any unavailable voice names as device inventory, not an app failure.
