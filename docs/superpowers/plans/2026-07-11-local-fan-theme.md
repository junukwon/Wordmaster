# Local Fan Theme Image Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, device-local fan image theme that decorates WordMaster home, study-block, and result screens without rewards, galleries, network uploads, or app-bundle weight.

**Architecture:** Process selected static files sequentially into bounded 720px WebP/JPEG blobs, stage them in a dedicated IndexedDB database, and atomically activate a complete pack. A React context exposes pack status and deterministic one-image-at-a-time blob loading; decorative frame components integrate with existing pages while all vocabulary, Pencil, speech, review, and PWA flows remain independent.

**Tech Stack:** React 19, TypeScript, native IndexedDB, Canvas/CreateImageBitmap APIs, Vitest, fake-indexeddb (test-only), Testing Library, Playwright, Vite PWA

## Global Constraints

- The source folder contains 142 static images totaling about 87MB; never copy or commit those originals into the repository.
- Accept only JPEG, PNG, and static WebP; reject GIF, MP4, MOV, animated WebP, and animated PNG.
- Process files sequentially, never keep multiple decoded originals in memory, never enlarge a source, cap the long edge at exactly 720px, encode WebP at quality `0.70`, and fall back to JPEG quality `0.72`.
- Accept at most 150 images and at most 30MB of encoded blobs for one pack.
- Stage a complete pack before atomically switching the active pack; any error keeps the previous pack active.
- Store fan data only in IndexedDB database `wordmaster-fan-theme-v1`, separate from `localStorage` key `wordmaster:v1`.
- Never add fan images to Git, `public/`, Vite assets, Workbox precache, runtime HTTP cache, analytics, or external services.
- Do not add rewards, unlocks, albums, image browsing, enlargement, sharing, downloads, clicks, or correctness-driven image changes.
- Home selection is stable per local date; study selection is stable per session and five-word block; completion/result selection is stable per session or test-attempt ID.
- Test-run questions, prompt content, and Apple Pencil canvas never display an image background.
- Render the complete image with `object-fit: contain` and use the same image only as an aria-hidden blurred backdrop.
- Preserve existing DAY selection, spaced review, on-demand tests, local speech, Pencil latency/palm rejection, PWA install/update, and offline learning behavior.
- Use generated synthetic test blobs only; never commit copyrighted fan-image samples.
- Use TDD and a separate commit for every task.

---

## File Structure

- Create `src/fanTheme/types.ts`: shared pack, image, status, import-result, and repository types.
- Create `src/fanTheme/selection.ts`: deterministic context-key hashing and image-index selection.
- Create `tests/fanTheme/selection.test.ts`: stable and rating-independent selection tests.
- Create `src/fanTheme/IndexedDbFanThemeRepository.ts`: database schema, temporary pack staging, activation, cleanup, settings, and blob reads.
- Create `tests/fanTheme/IndexedDbFanThemeRepository.test.ts`: fake-indexeddb atomicity and cleanup tests.
- Modify `package.json` and `package-lock.json`: add `fake-indexeddb` as a dev dependency only.
- Create `src/fanTheme/imageFormat.ts`: MIME validation plus APNG/animated-WebP detection.
- Create `src/fanTheme/imageOptimizer.ts`: browser codec and bounded single-file conversion.
- Create `src/fanTheme/importFanThemePack.ts`: sequential staging, limits, progress, activation, and abort.
- Create `tests/fanTheme/imageOptimizer.test.ts`: format, sizing, fallback, and resource-release tests.
- Create `tests/fanTheme/importFanThemePack.test.ts`: sequential, partial rejection, limit, and rollback tests.
- Create `src/fanTheme/FanThemeProvider.tsx`: initialize repository, expose status/actions, and load one selected blob.
- Create `src/fanTheme/useFanTheme.ts`: typed context hook.
- Create `src/components/FanThemeImage.tsx`: contained foreground plus blurred decorative backdrop and URL lifecycle.
- Create `tests/components/FanThemeImage.test.tsx`: empty/failure/success, accessibility, and URL cleanup tests.
- Create `src/components/FanThemeSettings.tsx`: import, toggle, deletion confirmation, progress, result, and storage notice.
- Create `tests/components/FanThemeSettings.test.tsx`: settings interaction and disabled-state tests.
- Modify `src/app/App.tsx`: construct provider/repository and keep learning storage independent.
- Modify `src/pages/HomePage.tsx`: settings and date-stable hero image.
- Modify `tests/pages/home.test.tsx`: no-pack parity and themed-home tests.
- Modify `src/pages/StudyPage.tsx`: block-stable companion and completion image outside prompt/canvas.
- Modify `tests/pages/study.test.tsx`: block selection, correctness independence, and Pencil layout tests.
- Modify `src/pages/TestResultPage.tsx`: attempt-stable result image.
- Create `tests/pages/testResult.test.tsx`: result-only theme image tests.
- Modify `tests/pages/test-flow.test.tsx`: prove the test-run question screen has no fan image.
- Modify `src/styles/global.css`: responsive fan frames and pastel accents without changing prompt/canvas geometry.
- Modify `tests/e2e/wordmaster.spec.ts`: import synthetic pack, offline display, disabled theme, and iPad geometry.
- Modify `vite.config.ts`: document/exclude fan-image URL handling without broadening precache.
- Modify `README.md`: local-only import, size limits, removal, storage eviction, and copyright instructions.

---

### Task 1: Deterministic Theme Selection and Shared Types

**Files:**
- Create: `src/fanTheme/types.ts`
- Create: `src/fanTheme/selection.ts`
- Create: `tests/fanTheme/selection.test.ts`

**Interfaces:**
- Produces: `FanThemePackMeta`, `FanThemeImageRecord`, `FanThemeStatus`, `FanThemeImportResult`, `FanThemeRepository`.
- Produces: `selectFanImageIndex(contextKey: string, imageCount: number): number | null`.
- Produces: `localDateThemeKey(date: Date): string`.

- [ ] **Step 1: Write failing deterministic-selection tests**

```ts
import { localDateThemeKey, selectFanImageIndex } from '../../src/fanTheme/selection';

test('selects a stable bounded image for the same context', () => {
  const first = selectFanImageIndex('study:session-1:block-2', 142);
  expect(first).not.toBeNull();
  expect(first).toBeGreaterThanOrEqual(0);
  expect(first).toBeLessThan(142);
  expect(selectFanImageIndex('study:session-1:block-2', 142)).toBe(first);
});

test('is safe for empty and single-image packs', () => {
  expect(selectFanImageIndex('home:2026-07-11', 0)).toBeNull();
  expect(selectFanImageIndex('anything', 1)).toBe(0);
});

test('builds a local calendar-day key without rating input', () => {
  expect(localDateThemeKey(new Date(2026, 6, 11, 23, 30))).toBe('home:2026-07-11');
  expect(selectFanImageIndex('study:session-1:block-2', 10)).toBe(
    selectFanImageIndex('study:session-1:block-2', 10),
  );
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/fanTheme/selection.test.ts`

Expected: FAIL because the fan-theme selection module does not exist.

- [ ] **Step 3: Define exact shared types and FNV-1a selection**

`types.ts` must export:

```ts
export type FanThemePackMeta = {
  id: string;
  status: 'staging' | 'active';
  imageCount: number;
  totalBytes: number;
  createdAt: string;
  mimeType: 'image/webp' | 'image/jpeg' | 'mixed';
};

export type FanThemeImageRecord = {
  packId: string;
  index: number;
  blob: Blob;
  width: number;
  height: number;
};

export type FanThemeStatus = {
  ready: boolean;
  enabled: boolean;
  imageCount: number;
  totalBytes: number;
  importing: boolean;
  processed: number;
  total: number;
  notice: string | null;
};

export type FanThemeImportResult = {
  imported: number;
  skipped: number;
  totalBytes: number;
};

export interface FanThemeRepository {
  initialize(): Promise<void>;
  beginPack(packId: string, createdAt: string): Promise<void>;
  addStagedImage(record: FanThemeImageRecord): Promise<void>;
  activatePack(meta: FanThemePackMeta): Promise<void>;
  abortPack(packId: string): Promise<void>;
  getActivePack(): Promise<FanThemePackMeta | null>;
  getImage(packId: string, index: number): Promise<FanThemeImageRecord | null>;
  getEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
  deleteActivePack(): Promise<void>;
}
```

Implement FNV-1a over UTF-16 code units and return `hash % imageCount`; return `null` for `imageCount <= 0`. Format local year/month/day with zero padding in `localDateThemeKey`.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- tests/fanTheme/selection.test.ts`

Expected: all selection tests PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/fanTheme/types.ts src/fanTheme/selection.ts tests/fanTheme/selection.test.ts
git commit -m "feat: define fan theme selection"
```

---

### Task 2: Atomic IndexedDB Image-Pack Repository

**Files:**
- Create: `src/fanTheme/IndexedDbFanThemeRepository.ts`
- Create: `tests/fanTheme/IndexedDbFanThemeRepository.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Implements: `FanThemeRepository` from Task 1.
- Database: exact name `wordmaster-fan-theme-v1`, version `1`.
- Stores: `packs` keyed by `id`, `images` keyed by `[packId, index]` with `packId` index, `settings` keyed by `key`.

- [ ] **Step 1: Install the test-only IndexedDB implementation**

Run: `npm install --save-dev fake-indexeddb`

Expected: `fake-indexeddb` appears only in `devDependencies`; production dependencies are unchanged.

- [ ] **Step 2: Write failing repository tests**

Use `IDBFactory` from `fake-indexeddb` and a unique database name per test. Cover:

```ts
test('activates a complete staged pack and reads one indexed image', async () => {
  const repository = makeRepository();
  await repository.initialize();
  await repository.beginPack('new', now);
  await repository.addStagedImage({ packId: 'new', index: 0, blob: new Blob(['a']), width: 10, height: 8 });
  await repository.activatePack({ id: 'new', status: 'active', imageCount: 1, totalBytes: 1, createdAt: now, mimeType: 'image/webp' });
  expect(await repository.getActivePack()).toMatchObject({ id: 'new', imageCount: 1 });
  expect(await repository.getImage('new', 0)).toMatchObject({ width: 10, height: 8 });
});

test('keeps the old pack active when staging is aborted', async () => {
  const repository = await repositoryWithActivePack('old');
  await repository.beginPack('failed', now);
  await repository.addStagedImage({ packId: 'failed', index: 0, blob: new Blob(['x']), width: 1, height: 1 });
  await repository.abortPack('failed');
  expect((await repository.getActivePack())?.id).toBe('old');
  expect(await repository.getImage('failed', 0)).toBeNull();
});

test('cleans incomplete staging packs during initialization', async () => {
  const repository = await repositoryWithActivePack('old');
  await repository.beginPack('orphan', now);
  await repository.initialize();
  expect((await repository.getActivePack())?.id).toBe('old');
  expect(await repository.getImage('orphan', 0)).toBeNull();
});
```

- [ ] **Step 3: Run RED**

Run: `npm test -- tests/fanTheme/IndexedDbFanThemeRepository.test.ts`

Expected: FAIL because the repository class does not exist.

- [ ] **Step 4: Implement schema, transactions, and cleanup**

Constructor:

```ts
constructor(
  private readonly indexedDBFactory: IDBFactory = window.indexedDB,
  private readonly databaseName = 'wordmaster-fan-theme-v1',
) {}
```

Use Promise wrappers for request/transaction completion. `activatePack` must use one `readwrite` transaction across all three stores: verify the new pack is staging and its stored image count/byte total matches metadata; set it active; write `activePackId`; delete previous pack metadata and all previous indexed images. Do not change `activePackId` before validation. `initialize` removes every staging pack and its images but preserves the active pack. `deleteActivePack` removes only fan-theme pack/image data and active ID, leaving `enabled` set to false.

- [ ] **Step 5: Run GREEN and repository regression**

Run: `npm test -- tests/fanTheme/IndexedDbFanThemeRepository.test.ts tests/storage/progressRepository.test.ts`

Expected: fan repository and existing learning repository tests PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add package.json package-lock.json src/fanTheme/IndexedDbFanThemeRepository.ts tests/fanTheme/IndexedDbFanThemeRepository.test.ts
git commit -m "feat: store fan theme packs atomically"
```

---

### Task 3: Sequential Static-Image Optimization and Import

**Files:**
- Create: `src/fanTheme/imageFormat.ts`
- Create: `src/fanTheme/imageOptimizer.ts`
- Create: `src/fanTheme/importFanThemePack.ts`
- Create: `tests/fanTheme/imageOptimizer.test.ts`
- Create: `tests/fanTheme/importFanThemePack.test.ts`

**Interfaces:**
- Produces: `optimizeFanImage(file: File, codec?: FanImageCodec): Promise<OptimizedFanImage>`.
- Produces: `importFanThemePack(files, repository, options): Promise<FanThemeImportResult>`.
- Constants: `MAX_FAN_IMAGES = 150`, `MAX_FAN_PACK_BYTES = 30 * 1024 * 1024`, `MAX_FAN_EDGE = 720`.

- [ ] **Step 1: Write failing format and optimizer tests**

Test that JPEG/PNG/static WebP are accepted; GIF and files containing APNG `acTL` or WebP `ANIM` chunks are rejected. With an injected codec, assert 1440×720 becomes 720×360, 300×200 stays 300×200, WebP uses `0.70`, null WebP result triggers JPEG `0.72`, and `dispose()` runs on success and failure.

```ts
const codec: FanImageCodec = {
  decode: vi.fn(async () => ({ source: {}, width: 1440, height: 720, dispose: vi.fn() })),
  encode: vi.fn(async (_source, width, height, mime, quality) =>
    mime === 'image/webp' ? new Blob(['webp'], { type: mime }) : new Blob(['jpg'], { type: mime })
  ),
};
const optimized = await optimizeFanImage(new File(['jpeg'], 'wide.jpg', { type: 'image/jpeg' }), codec);
expect(optimized).toMatchObject({ width: 720, height: 360, mimeType: 'image/webp' });
expect(codec.encode).toHaveBeenCalledWith(expect.anything(), 720, 360, 'image/webp', 0.70);
```

- [ ] **Step 2: Write failing sequential import and rollback tests**

Use a fake `FanThemeRepository` and codec that records concurrent decodes. Assert maximum concurrent decode is exactly 1, skipped corrupt/static-format files are counted, progress emits processed counts, success activates once, 151 inputs reject before staging, byte total above 30MB aborts, and any repository/codec failure calls `abortPack` without replacing the old active pack.

- [ ] **Step 3: Run RED**

Run: `npm test -- tests/fanTheme/imageOptimizer.test.ts tests/fanTheme/importFanThemePack.test.ts`

Expected: FAIL because format/optimizer/import modules do not exist.

- [ ] **Step 4: Implement static detection and browser codec**

Read only the file bytes needed for format detection. Search PNG bytes for ASCII `acTL` and WebP RIFF bytes for ASCII `ANIM`; reject when present. Browser decode uses `createImageBitmap(file, { imageOrientation: 'from-image' })`. Browser encode draws to a temporary HTML canvas and wraps `canvas.toBlob`. Always close `ImageBitmap`, clear canvas dimensions, and release temporary references in `finally`.

Calculate dimensions with:

```ts
const scale = Math.min(1, MAX_FAN_EDGE / Math.max(width, height));
const targetWidth = Math.max(1, Math.round(width * scale));
const targetHeight = Math.max(1, Math.round(height * scale));
```

- [ ] **Step 5: Implement the sequential importer**

Validate `files.length` before `beginPack`. Generate `pack-${crypto.randomUUID()}`. For each file: validate format, optimize, check prospective total bytes, write one staged record, dispose resources, call `onProgress({ processed, total })`, then yield with `await new Promise<void>((resolve) => setTimeout(resolve, 0))`. Skip unsupported/corrupt files; treat pack limits, repository errors, and zero successful images as full import failure. On success call `activatePack` once and return counts; in `catch`, call `abortPack` and rethrow.

- [ ] **Step 6: Run GREEN**

Run: `npm test -- tests/fanTheme/imageOptimizer.test.ts tests/fanTheme/importFanThemePack.test.ts`

Expected: all format, optimizer, sequential, limit, and rollback tests PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/fanTheme/imageFormat.ts src/fanTheme/imageOptimizer.ts src/fanTheme/importFanThemePack.ts tests/fanTheme/imageOptimizer.test.ts tests/fanTheme/importFanThemePack.test.ts
git commit -m "feat: optimize fan images sequentially"
```

---

### Task 4: Fan Theme Provider and Decorative Image Frame

**Files:**
- Create: `src/fanTheme/FanThemeProvider.tsx`
- Create: `src/fanTheme/useFanTheme.ts`
- Create: `src/components/FanThemeImage.tsx`
- Create: `tests/fanTheme/FanThemeProvider.test.tsx`
- Create: `tests/components/FanThemeImage.test.tsx`

**Interfaces:**
- Produces context: `status`, `importFiles`, `setEnabled`, `deletePack`, `loadImageBlob(contextKey)`.
- Consumes: `FanThemeRepository`, `importFanThemePack`, `selectFanImageIndex`.
- Component: `<FanThemeImage contextKey className ariaLabel?>` is decorative by default.

- [ ] **Step 1: Write failing provider tests**

Render with a fake repository and assert initialization cleans staging state, reads enabled/active pack, `loadImageBlob` selects the deterministic index, import progress updates status, successful import refreshes metadata and enables theme, failure preserves previous ready status with a notice, toggle persists, and delete removes only fan data.

- [ ] **Step 2: Write failing frame tests**

```tsx
test('renders one object URL as contained foreground and hidden blurred backdrop', async () => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fan');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  const view = render(<Provider blob={new Blob(['x'])}><FanThemeImage contextKey="home:2026-07-11" /></Provider>);
  expect(await screen.findByTestId('fan-theme-foreground')).toHaveAttribute('src', 'blob:fan');
  expect(screen.getByTestId('fan-theme-backdrop')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByTestId('fan-theme-foreground')).toHaveAttribute('alt', '');
  view.unmount();
  expect(revoke).toHaveBeenCalledWith('blob:fan');
});
```

Also cover no pack, disabled theme, blob-load rejection, and context-key changes revoking the prior URL.

- [ ] **Step 3: Run RED**

Run: `npm test -- tests/fanTheme/FanThemeProvider.test.tsx tests/components/FanThemeImage.test.tsx`

Expected: FAIL because provider/hook/frame do not exist.

- [ ] **Step 4: Implement provider state transitions**

Provider accepts `repository` and optional `importer` for testing. Initialize in `useEffect`; ignore async completion after unmount. `loadImageBlob` returns null unless ready+enabled, calls `selectFanImageIndex`, and fetches only that indexed record. Do not load the complete image collection. Import status is `importing: true` with processed/total; success refreshes active metadata, persists enabled true, and reports imported/skipped; failure restores prior count/bytes/enabled and sets a Korean notice.

- [ ] **Step 5: Implement frame URL lifecycle**

On `contextKey` or provider change, request one blob, create one object URL, and render it twice: a backdrop `<img aria-hidden="true">` and a foreground `<img alt="">`. Revoke the URL on replacement/unmount. Render `null` when disabled, unavailable, or failed. Do not add click handlers, tabindex, captions, or accessible names.

- [ ] **Step 6: Run GREEN**

Run: `npm test -- tests/fanTheme/FanThemeProvider.test.tsx tests/components/FanThemeImage.test.tsx`

Expected: provider actions and URL lifecycle tests PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/fanTheme/FanThemeProvider.tsx src/fanTheme/useFanTheme.ts src/components/FanThemeImage.tsx tests/fanTheme/FanThemeProvider.test.tsx tests/components/FanThemeImage.test.tsx
git commit -m "feat: provide local fan theme images"
```

---

### Task 5: Home Theme Settings and Daily Hero

**Files:**
- Create: `src/components/FanThemeSettings.tsx`
- Create: `tests/components/FanThemeSettings.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `tests/pages/home.test.tsx`

**Interfaces:**
- Consumes: provider actions/status and `localDateThemeKey`.
- Home hero context key: exact `home:YYYY-MM-DD` from local date.
- Settings input: `multiple`, exact accept string `image/jpeg,image/png,image/webp`.

- [ ] **Step 1: Write failing settings tests**

Assert the settings section has no image list/gallery; import passes all selected files once; progress is visible; toggle persists without deleting; delete requires confirmation; replacement wording says the old pack remains until completion; and the site-data/copyright notice is visible.

```tsx
const input = screen.getByLabelText('팬 테마 이미지 가져오기');
expect(input).toHaveAttribute('multiple');
expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
await user.upload(input, [jpgFile, pngFile]);
expect(importFiles).toHaveBeenCalledWith([jpgFile, pngFile]);
expect(screen.queryByRole('link', { name: /앨범|이미지 보기/ })).not.toBeInTheDocument();
```

- [ ] **Step 2: Write failing home integration tests**

With no/disabled pack, assert no fan frame and existing DAY controls unchanged. With enabled pack, assert one `FanThemeImage` in the home hero with `home:2026-07-11`; ensure DAY cards contain no image. Verify settings remain operable without navigating to a gallery.

- [ ] **Step 3: Run RED**

Run: `npm test -- tests/components/FanThemeSettings.test.tsx tests/pages/home.test.tsx src/app/App.test.tsx`

Expected: FAIL because settings/provider integration is absent.

- [ ] **Step 4: Implement settings UI**

Use a native multiple file input. Reset `event.currentTarget.value = ''` after copying the `FileList`. Disable import/toggle/delete during import. Show `processed / total`, imported/skipped/encoded MB result, and provider notice in `role="status"` or `role="alert"`. Delete uses an accessible confirmation dialog with cancel and `이미지팩 삭제`; do not show thumbnails.

- [ ] **Step 5: Wrap the app and add the home hero**

Construct one `IndexedDbFanThemeRepository` in `App` state and wrap `HashRouter` with `FanThemeProvider`. Add a home theme section that renders `FanThemeImage` plus existing headline copy; pass `now?: () => Date` to `HomePage` for deterministic tests. Place `FanThemeSettings` below study actions, collapsed in a `<details>` labeled `팬 테마 설정`.

- [ ] **Step 6: Run GREEN**

Run: `npm test -- tests/components/FanThemeSettings.test.tsx tests/pages/home.test.tsx src/app/App.test.tsx`

Expected: settings, no-pack parity, daily hero, and app smoke tests PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add src/components/FanThemeSettings.tsx tests/components/FanThemeSettings.test.tsx src/app/App.tsx src/pages/HomePage.tsx tests/pages/home.test.tsx
git commit -m "feat: add home fan theme settings"
```

---

### Task 6: Study-Block and Result-Screen Theme Integration

**Files:**
- Modify: `src/pages/StudyPage.tsx`
- Modify: `tests/pages/study.test.tsx`
- Modify: `src/pages/TestResultPage.tsx`
- Create: `tests/pages/testResult.test.tsx`
- Modify: `tests/pages/test-flow.test.tsx`

**Interfaces:**
- Study key: `study:${session.id}:${item.blockId}`.
- Study completion key: `study-result:${session.id}`.
- Test result key: `test-result:${attempt.id}`.
- No key may include rating, confidence, score, correct count, or incorrect count.

- [ ] **Step 1: Write failing study tests**

Assert one companion frame is outside `.prompt-card` and `.writing-card`; the same block keeps the same key after ratings/retries; a new block changes the key; strong/weak outcomes with the same session/block produce the same key; completion renders `study-result:<id>`; the Pencil canvas contains no fan image.

- [ ] **Step 2: Write failing test-result tests**

Assert result page uses only `test-result:<attempt.id>` for attempts with different scores but the same ID; retry/practice actions remain unchanged; TestPage itself contains no fan frame.

- [ ] **Step 3: Run RED**

Run: `npm test -- tests/pages/study.test.tsx tests/pages/testResult.test.tsx tests/pages/test-flow.test.tsx`

Expected: FAIL because study/result fan frames are not integrated.

- [ ] **Step 4: Integrate images without evaluation coupling**

In active StudyPage render a sibling `aside` outside prompt/writing cards containing `FanThemeImage contextKey={`study:${session.id}:${item.blockId}`}`. In completion state render `FanThemeImage contextKey={`study-result:${session.id}`}` only when session exists. In TestResultPage render one `FanThemeImage contextKey={`test-result:${attempt.id}`}` alongside the result hero. Do not modify TestPage.

- [ ] **Step 5: Run GREEN and Pencil regression**

Run: `npm test -- tests/pages/study.test.tsx tests/pages/testResult.test.tsx tests/pages/test-flow.test.tsx src/drawing/DrawingCanvas.test.tsx`

Expected: study/result selection and all Pencil tests PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add src/pages/StudyPage.tsx tests/pages/study.test.tsx src/pages/TestResultPage.tsx tests/pages/testResult.test.tsx tests/pages/test-flow.test.tsx
git commit -m "feat: theme study and result screens"
```

---

### Task 7: Responsive Styling, Offline E2E, Documentation, and Final Verification

**Files:**
- Modify: `src/styles/global.css`
- Modify: `tests/e2e/wordmaster.spec.ts`
- Modify: `vite.config.ts`
- Modify: `README.md`

**Interfaces:**
- Preserves existing iPad portrait/landscape projects and `.drawing-canvas` pointer/touch rules.
- E2E creates synthetic generated image files in-browser; it never reads `C:\dev\wordmaster\seventeen`.

- [ ] **Step 1: Add E2E expectations and capture RED**

Add a browser-side helper that creates two small canvas PNG `File` objects and uploads them through `팬 테마 이미지 가져오기`. Verify import result and theme toggle, home image, a stable image through one five-word block, no image inside prompt/canvas/test-run, result image, replacement pack behavior, and delete confirmation. In Desktop Chrome, import online, wait for IndexedDB completion, go offline, reload, and verify home/study fan images plus existing drawing/progress/test flow. In both iPad projects assert hero/companion/result frames stay within viewport, controls remain at least 44px, and study actions remain visible.

Run: `npm run test:e2e`

Expected: FAIL before styling or reveal missing offline/layout integration.

- [ ] **Step 2: Add contained/blurred frame and responsive layout styles**

Add these core rules without changing canvas sizing/touch rules:

```css
.fan-theme-frame { position: relative; overflow: hidden; min-width: 0; border-radius: var(--radius-lg); background: #eef1f7; isolation: isolate; }
.fan-theme-frame__backdrop { position: absolute; inset: -12%; width: 124%; height: 124%; object-fit: cover; filter: blur(18px) brightness(.62) saturate(.85); transform: scale(1.08); }
.fan-theme-frame__foreground { position: relative; z-index: 1; display: block; width: 100%; height: 100%; object-fit: contain; }
.home-theme-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, .65fr); min-height: 190px; }
.study-companion { width: min(100%, 220px); min-height: 120px; }
.result-theme-frame { min-height: 220px; }
```

Use pastel rose/blue accents only on non-semantic surfaces while retaining current text/button contrast and `:focus-visible`. Under 760px stack home hero and keep study companion compact; under the short-landscape media query cap companion height so `.study-actions` remain in the initial viewport. `prefers-reduced-motion` removes image transition animation.

- [ ] **Step 3: Prove fan images are not precached**

Keep `globPatterns` unchanged and add a build/E2E assertion that `dist/sw.js` and the generated precache manifest contain no `fan`, imported filename, Blob URL, or external image entry. Do not add an image runtime-caching rule for IndexedDB blobs. Update stale PWA description from fixed 125 words to flexible DAY selection while editing `vite.config.ts`.

- [ ] **Step 4: Update README**

Document supported static formats, 150/30MB/720px limits, complete replacement, device-local IndexedDB, no upload/Git/cache, fan-theme toggle/delete, Safari site-data eviction, copyright responsibility, no gallery/reward behavior, and exact iPad Files import steps. Preserve Pages deployment, PWA install/update, offline learning, and local run instructions.

- [ ] **Step 5: Run the complete required validation**

Run separately:

```bash
npm run content:build
npm test
npm run build
npm run test:e2e
```

Expected:

- Content build generates exactly 250 vocabulary records.
- All Vitest files pass, including repository/import/provider/page/Pencil regressions.
- TypeScript/Vite/PWA build exits 0; service worker is generated without fan images.
- Playwright applicable Desktop Chrome, iPhone, iPad portrait, and iPad landscape scenarios pass; only documented project-specific skips remain.

- [ ] **Step 6: Inspect scope and commit Task 7**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Confirm `C:\dev\wordmaster\seventeen` and every fan image remain untracked/uncommitted, generated vocabulary has no content diff, and only planned files are staged.

```bash
git add src/styles/global.css tests/e2e/wordmaster.spec.ts vite.config.ts README.md
git commit -m "test: verify local fan theme offline"
```

---

## Final Review Checklist

- [ ] No fan image binary, sample, filename, or source-folder content is committed or copied into build assets.
- [ ] Static-format detection rejects GIF, video, APNG, and animated WebP.
- [ ] At most one source is decoded and one current Blob URL is retained.
- [ ] Long edge, quality, count, and total-byte limits match 720px, 0.70/0.72, 150, and 30MB exactly.
- [ ] Failed imports and interrupted staging preserve the active pack.
- [ ] Re-import replaces rather than appends or duplicates.
- [ ] Home/study/result keys are stable and contain no correctness or mastery signal.
- [ ] No gallery, album, reward, unlock, enlargement, click, or image-list UI exists.
- [ ] Prompt, Pencil canvas, and TestPage contain no theme image.
- [ ] Complete image and captions remain visible with contained foreground and blurred backdrop.
- [ ] Theme disabled/no-pack/render failure returns the current WordMaster UI.
- [ ] Fan images are local-only, offline-capable, and absent from service-worker caches.
- [ ] Existing learning data and all core tests remain intact.
