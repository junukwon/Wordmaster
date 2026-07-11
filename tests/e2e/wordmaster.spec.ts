import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
    const voices = [
      { default: true, lang: 'en-US', localService: true, name: 'Samantha', voiceURI: 'mock-samantha' },
      { default: false, lang: 'en-GB', localService: true, name: 'Daniel', voiceURI: 'mock-daniel' },
    ] as SpeechSynthesisVoice[];
    const voiceListeners = new Set<EventListenerOrEventListenerObject>();
    const speechSynthesis = {
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => voiceListeners.add(listener),
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => voiceListeners.delete(listener),
      getVoices: () => voices,
      speak: () => undefined,
      cancel: () => undefined,
    };
    class MockSpeechSynthesisUtterance {
      voice: SpeechSynthesisVoice | null = null;
      lang = '';
      rate = 1;
      pitch = 1;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speechSynthesis });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockSpeechSynthesisUtterance });
  });
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('keeps pronunciation and safe reveal usable on iPad Mini', async ({ page }, testInfo) => {
  const isIPadMini = testInfo.project.name === 'iPad Mini portrait' || testInfo.project.name === 'iPad Mini landscape';
  test.skip(!isIPadMini);

  const settings = page.locator('.pronunciation-settings');
  const settingsSummary = settings.locator('summary');
  await settingsSummary.click();
  const voiceSelector = page.getByLabel('영어 음성 선택');
  const previewButton = page.getByRole('button', { name: '미리 듣기' });
  await expect(voiceSelector.locator('option')).toContainText(['자동 선택', 'Samantha (en-US) · 기기 내장']);
  for (const control of [settingsSummary, voiceSelector, previewButton]) {
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  await voiceSelector.selectOption('mock-samantha');
  await previewButton.click();

  await page.getByRole('button', { name: /DAY 01/ }).click();
  await page.getByRole('button', { name: '25개 학습 시작하기' }).click();
  await expect(page.locator('.phonetic')).toHaveCount(0);
  await page.getByRole('button', { name: '발음 듣기' }).click();
  await expect(page.locator('.phonetic')).toBeVisible();

  const problemLabel = await page.locator('.study-progress > strong').textContent();
  const prompt = page.locator('.prompt-meaning, .prompt-term');
  const promptText = await prompt.textContent();
  const progress = page.getByRole('progressbar', { name: '25개 신규 단어 진행률' });
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: '정답 보기' }).click({ clickCount: 2, delay: 20 });
  await expect(page.locator('.study-progress > strong')).toHaveText(problemLabel!);
  const strongRating = page.getByRole('button', { name: '기억남' });
  await expect(strongRating).toBeDisabled();
  const safetyNotice = page.getByRole('status', { name: '' });
  await expect(safetyNotice).toHaveText('정답을 확인한 뒤 평가해 주세요.');
  const colors = await safetyNotice.evaluate((element) => ({
    actual: getComputedStyle(element).color,
    expected: getComputedStyle(document.documentElement).getPropertyValue('--color-muted').trim(),
  }));
  expect(colors.actual).toBe('rgb(97, 115, 132)');
  expect(colors.expected).toBe('#617384');

  await expect(strongRating).toBeEnabled();
  await strongRating.click();
  await expect(page.locator('.study-progress > strong')).toHaveText('문제 2');
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(prompt).not.toHaveText(promptText!);
  await expect(page.getByRole('button', { name: '정답 보기' })).toBeVisible();
});

test('completes the saved study and on-demand test journey', async ({ page }) => {
  await page.getByRole('button', { name: /DAY 02/ }).click();
  await page.getByRole('button', { name: /DAY 07/ }).click();
  await expect(page.getByText('2개 선택 · 신규 50개 · 복습 0개')).toBeVisible();
  await page.getByRole('button', { name: '50개 학습 시작하기' }).click();
  await expect(page.getByRole('heading', { name: '집중 학습' })).toBeVisible();
  await expect(page.getByText('DAY 02 · DAY 07')).toBeVisible();

  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('button', { name: '정답 보기' }).click();
    await page.getByRole('button', { name: '기억남' }).click();
  }
  await expect(page.getByText('mad', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '정답 보기' }).click();
  await expect(page.getByText('mad', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '기억남' }).click();
  await page.reload();
  await expect(page.getByText(/문제 12/)).toBeVisible();

  await page.getByRole('link', { name: '홈으로 돌아가기' }).click();
  await page.getByRole('button', { name: /DAY 01/ }).click();
  await page.getByRole('button', { name: '25개 학습 시작하기' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('link', { name: '이어서 학습하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: /DAY 01/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('DAY 02 · DAY 07')).toBeVisible();
  await page.getByRole('link', { name: '수시 단어 테스트' }).click();
  await page.getByLabel('문제 유형').selectOption('mixed');
  await page.getByLabel('문제 수').selectOption('10');
  await page.getByLabel('출제 순서').selectOption('number');
  await page.getByRole('button', { name: '테스트 시작하기' }).click();

  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('button', { name: '정답 보기' }).click();
    await page.getByRole('button', { name: index === 0 ? '틀림' : '맞음' }).click();
  }
  await expect(page.getByRole('heading', { name: '테스트 결과' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '틀린 단어' }).locator('..')).toContainText('knee');
});

test('keeps core learning available offline after the first visit', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit service-worker readiness is nondeterministic on Windows; verify offline reload on physical iPad Safari.');
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('service worker unsupported');
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('service worker not ready')), 10000)),
    ]);
  });
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /DAY 01/ }).click();
  await expect(page.getByText('1개 선택 · 신규 25개 · 복습 0개')).toBeVisible();
  await page.getByRole('button', { name: '25개 학습 시작하기' }).click();
  await expect(page.getByRole('heading', { name: '집중 학습' })).toBeVisible();
  await expect(page.locator('.study-kicker')).toHaveText('DAY 01');
  const canvas = page.getByRole('img', { name: /Apple Pencil 필기장/ });
  await canvas.dispatchEvent('pointerdown', { pointerId: 1, clientX: 20, clientY: 20, pressure: .5 });
  await canvas.dispatchEvent('pointermove', { pointerId: 1, clientX: 70, clientY: 55, pressure: .7 });
  await canvas.dispatchEvent('pointerup', { pointerId: 1, clientX: 70, clientY: 55, pressure: .7 });
  await expect(canvas).toHaveAttribute('data-stroke-count', '1');
  await page.getByRole('button', { name: '정답 보기' }).click();
  await page.getByRole('button', { name: '기억남' }).click();
  await page.reload();
  await expect(page.getByText(/문제 2/)).toBeVisible();
  await page.getByRole('link', { name: '홈으로 돌아가기' }).click();
  await page.getByRole('link', { name: '수시 단어 테스트' }).click();
  await page.getByRole('button', { name: '테스트 시작하기' }).click();
  await expect(page.getByText('수시 테스트')).toBeVisible();
});

test('keeps DAY selection and replacement controls inside iPad Mini viewports', async ({ page }, testInfo) => {
  const isIPadMini = testInfo.project.name === 'iPad Mini portrait' || testInfo.project.name === 'iPad Mini landscape';
  test.skip(!isIPadMini);
  const dayGrid = page.getByLabel('학습할 DAY 선택');
  await expect(dayGrid).toBeVisible();
  const firstDayCard = page.getByRole('button', { name: /DAY 01/ });
  await firstDayCard.click();
  const startButton = page.getByRole('button', { name: '25개 학습 시작하기' });
  const stickyActions = startButton.locator('..');
  const homeGeometry = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  for (const locator of [dayGrid, firstDayCard, stickyActions, startButton]) {
    const bounds = await locator.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(homeGeometry.viewportWidth);
  }
  expect(homeGeometry.documentWidth).toBeLessThanOrEqual(homeGeometry.viewportWidth);
  const startBounds = await startButton.boundingBox();
  expect(startBounds!.height).toBeGreaterThanOrEqual(44);

  await startButton.click();

  if (testInfo.project.name === 'iPad Mini landscape') {
    const actions = page.locator('.study-actions');
    await expect(actions).toBeVisible();
    const geometry = await actions.evaluate((element) => ({
      actionsBottom: element.getBoundingClientRect().bottom,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
    }));
    expect(geometry.scrollY).toBe(0);
    expect(geometry.actionsBottom).toBeLessThanOrEqual(geometry.viewportHeight);
  }

  await page.getByRole('link', { name: '홈으로 돌아가기' }).click();
  await page.getByRole('button', { name: /DAY 02/ }).click();
  await page.getByRole('button', { name: '25개 학습 시작하기' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const viewport = page.viewportSize()!;
  for (const name of ['취소', '기존 학습 이어하기', '새 학습으로 교체']) {
    const action = dialog.getByRole('button', { name });
    const bounds = await action.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  }
});
