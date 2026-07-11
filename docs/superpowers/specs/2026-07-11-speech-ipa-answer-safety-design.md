# Speech, IPA, and Answer Safety Design

## Goal

Improve WordMaster's core study experience in three related areas:

1. prefer a clear, bright American-English female system voice while allowing the learner to choose another installed English voice;
2. reveal a static American-English IPA transcription only after the learner presses the pronunciation button;
3. prevent a rapid second tap on `정답 보기` from being recorded accidentally as `기억남` or `맞음`.

The change remains local-first and adds no server, login, speech recognition, pronunciation scoring, or runtime dictionary API.

## Voice selection

`SpeechPlayer` will expose the installed English voices and accept a saved preferred voice identifier. Selection order is:

1. the learner's saved installed English voice;
2. a local `en-US` voice whose name matches a curated list of commonly available bright female voices (for example Samantha, Ava, Allison, Susan, or Zoe);
3. another local `en-US` voice;
4. another local English voice;
5. a non-local `en-US` voice, then another English voice.

Voice names vary by iPadOS version, language pack, and device. The automatic ranking is therefore a useful default, while the visible selector is the authoritative way to choose the voice the learner prefers. The selected voice is stored locally by its stable voice URI when available, with name and language as fallback matching data.

Speech uses `lang = en-US`, `rate = 0.85`, and a small `pitch = 1.05` lift. The player cancels an existing utterance before starting the next one. If the saved voice is no longer installed, selection falls back through the order above and the UI explains that the saved choice is unavailable.

## Pronunciation settings

The home screen will contain a collapsed `발음 설정` section. It shows:

- the currently selected voice;
- an `자동 선택` option;
- all installed English voices, with local voices identified;
- a `미리 듣기` button using a short fixed English sample;
- the existing offline guidance when no local English voice is installed.

The choice is device-local and survives reloads and PWA updates. Voice-list loading remains asynchronous so it does not block application startup.

## Static American IPA

Every one of the 250 vocabulary records gains a required `phonetic` field containing a reviewed American-English IPA transcription. The build script parses and validates the field, and both generated JSON files include it for offline use. Validation rejects missing values, values without surrounding slashes, and an incomplete 250-word build.

The source Markdown remains the single content source. IPA values are committed as small text data; no online dictionary is queried at runtime.

On each study item:

- IPA starts hidden;
- pressing `발음 듣기` immediately reveals the current word's IPA and attempts speech playback;
- IPA remains visible for repeated playback of that word;
- moving to the next item hides it again;
- if speech is unavailable, the press still reveals IPA and displays the existing voice guidance;
- IPA is never shown in on-demand test questions or results, where it could reveal an answer.

The IPA text uses semantic text rather than an image and is announced together with the word only after reveal.

## Accidental-answer prevention

The current study and test screens replace `정답 보기` in place with rating buttons. A quick second tap can therefore land on the newly rendered positive rating.

Both flows will use two defenses:

1. **spatial separation:** keep a stable reveal-action row and render the rating controls in a separate row;
2. **short activation guard:** rating controls remain disabled for 600 ms after answer reveal.

During the guard, the screen displays `정답을 확인한 뒤 평가해 주세요.` and exposes the disabled state to assistive technology. A rapid double click/tap on `정답 보기` must reveal the answer but must not save progress, advance the study session, or submit a test answer. After 600 ms, one intentional rating tap works normally. `모르겠어요` remains an intentional one-tap weak rating before reveal and is unchanged.

The guard is based on the reveal transition, not a global debounce, so it cannot suppress unrelated Pencil or navigation input. Saving remains protected by the existing saving state.

## Components and data flow

- `VocabularyWord.phonetic`: required static IPA field.
- vocabulary build pipeline: parses, validates, and emits IPA.
- `SpeechPlayer`: ranks voices, resolves a saved preference, lists voices, previews, and speaks with the chosen parameters.
- local speech preference repository: stores only the selected voice identity and automatic/manual mode.
- pronunciation settings component: displays available voices and preview controls.
- `StudyPage`: owns per-item IPA reveal state and resets it when the word changes.
- study/test answer guard: owns the 600 ms reveal timestamp or readiness state and controls rating availability.

Learning progress storage remains independent from speech preferences. IPA reveal and speech playback never alter mastery.

## Error handling

- Empty or late voice lists show guidance and update when `voiceschanged` fires.
- A missing saved voice falls back automatically without breaking pronunciation.
- Speech playback exceptions do not prevent IPA reveal or other learning actions.
- Invalid or missing IPA fails `npm run content:build` rather than shipping incomplete content.
- Repeated rating input during saving or the 600 ms guard is ignored.

## Testing

Unit and component tests will cover:

- preferred female-local ranking and all fallback levels;
- saved manual selection, missing-voice fallback, preview parameters, and persistence;
- asynchronous `voiceschanged` updates;
- 250 required valid IPA entries in source and generated content;
- IPA hidden initially, revealed on pronunciation press, retained for the word, and reset on advance;
- IPA reveal when no speech voice is available;
- no IPA in on-demand tests;
- double-tap regression in study and test flows with fake time;
- disabled guard messaging, activation after 600 ms, and normal intentional rating;
- unchanged Pencil, mastery, offline, and PWA behavior.

E2E verification will exercise the pronunciation settings, IPA reveal, and rapid double-tap protection at iPad Mini portrait and landscape sizes. Real-device acceptance will confirm the preferred voice sounds appropriate because Web Speech voice inventories cannot be reproduced exactly on Windows Playwright.

## Acceptance criteria

- On an iPad with a supported female `en-US` voice, automatic mode chooses it ahead of a male or lower-priority local English voice.
- The learner can select and preview another installed English voice, and that choice persists.
- Pressing pronunciation reveals the correct American IPA for the current word; advancing hides it.
- No runtime network request is required for IPA or a local installed voice.
- Rapidly double-tapping answer reveal never records a positive rating.
- A deliberate rating after the guard records exactly once.
- Existing study scheduling, progress, Pencil input, PWA updates, and offline study continue to work.
