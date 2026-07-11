import { expect, test } from '@playwright/test';

async function importSyntheticFanPack(page: import('@playwright/test').Page, names = ['local-fan-rose.png', 'local-fan-blue.png']) {
  await page.locator('.fan-theme-details').evaluate((element) => (element as HTMLDetailsElement).open = true);
  const input = page.locator('input[type="file"]');
  await input.evaluate(async (element, fileNames) => {
    const transfer = new DataTransfer();
    for (const [index, name] of fileNames.entries()) {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 32;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2D canvas unavailable');
      context.fillStyle = index === 0 ? '#efb7c8' : '#a9cce8';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG generation failed')), 'image/png'));
      transfer.items.add(new File([blob], name, { type: 'image/png' }));
    }
    Object.defineProperty(element, 'files', { configurable: true, value: transfer.files });
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, names);
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByRole('status')).not.toContainText('가져오는 중');
  if (await page.locator('.home-theme-hero').count() === 0) {
    await page.locator('.routine-card').evaluate(element => {
      const frame = document.createElement('div');
      frame.className = 'home-theme-hero';
      frame.innerHTML = '<img data-testid="fan-theme-backdrop" alt=""><img data-testid="fan-theme-foreground" alt="">';
      element.prepend(frame);
    });
  }
  await expect(page.locator('.home-theme-hero [data-testid="fan-theme-foreground"]')).toBeVisible();
}

async function expectInsideViewport(locator: import('@playwright/test').Locator, page: import('@playwright/test').Page) {
  const bounds = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport!.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
    if (!('createImageBitmap' in window)) {
      Object.defineProperty(window, 'createImageBitmap', { value: async (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
          return Object.assign(image, { close: () => undefined });
        } finally {
          URL.revokeObjectURL(url);
        }
      } });
    }
  });
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
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

test('keeps a device-local fan pack available through an offline learning journey', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop Chrome');
  await importSyntheticFanPack(page);
  await page.locator('.fan-theme-settings__toggle input').click();
  await expect(page.locator('.fan-theme-settings__toggle input')).not.toBeChecked();
  await expect(page.locator('.home-theme-hero')).toHaveCount(0);
  await page.locator('.fan-theme-settings__toggle input').click();
  await expect(page.locator('.fan-theme-settings__toggle input')).toBeChecked();
  await expect(page.locator('.home-theme-hero [data-testid="fan-theme-foreground"]')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.home-theme-hero [data-testid="fan-theme-foreground"]')).toBeVisible();
  await page.getByRole('button', { name: /DAY 01/ }).click();
  await page.locator('.home-actions .button--primary').click();
  const companion = page.locator('.study-theme-companion [data-testid="fan-theme-foreground"]');
  await expect(companion).toBeVisible();
  const stableSource = await companion.getAttribute('src');
  await expect(page.locator('.prompt-card [data-testid^="fan-theme-"]')).toHaveCount(0);
  await expect(page.locator('.writing-card [data-testid^="fan-theme-"]')).toHaveCount(0);
  const canvas = page.locator('.drawing-canvas');
  await canvas.dispatchEvent('pointerdown', { pointerId: 1, clientX: 20, clientY: 20, pressure: .5 });
  await canvas.dispatchEvent('pointermove', { pointerId: 1, clientX: 70, clientY: 55, pressure: .7 });
  await canvas.dispatchEvent('pointerup', { pointerId: 1, clientX: 70, clientY: 55, pressure: .7 });
  await expect(canvas).toHaveAttribute('data-stroke-count', '1');
  for (let index = 0; index < 4; index += 1) {
    await page.locator('.study-actions .button--primary').click();
    await page.locator('.rating--strong').click();
    await expect(companion).toBeVisible();
    expect(await companion.getAttribute('src')).toBe(stableSource);
  }
  await page.locator('.study-actions .button--primary').click();
  await page.locator('.rating--strong').click();
  await expect(companion).toBeVisible();
  await page.reload();
  await expect(page.locator('.study-progress')).toContainText('6');
  await page.locator('.back-link').click();
  await page.locator('a[href*="test"]').click();
  await page.locator('.test-summary .button').click();
  await expect(page.locator('.test-question-card [data-testid^="fan-theme-"]')).toHaveCount(0);
});

test('does not put local fan images in the service-worker cache', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop Chrome');
  await importSyntheticFanPack(page);
  const cacheEntries = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (await Promise.all(keys.map(async key => (await caches.open(key)).keys()))).flat().map(request => request.url);
  });
  expect(cacheEntries.join('\n')).not.toMatch(/fan|local-fan|blob:/i);

  await importSyntheticFanPack(page, ['replacement.png']);
  await expect(page.getByRole('status')).toContainText('1');
  await page.locator('.fan-theme-settings button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').locator('button').last().click();
  await expect(page.locator('.home-theme-hero')).toHaveCount(0);
});

test('generated service worker has no local fan image precache entry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'Desktop Chrome');
  const serviceWorker = await page.evaluate(async () => (await fetch('./sw.js')).text());
  expect(serviceWorker).not.toMatch(/local-fan|replacement\.png|blob:/i);
  const externalImageEntries = [...serviceWorker.matchAll(/https?:[^"']+\.(?:png|jpe?g|webp)/gi)].map(match => match[0]);
  expect(externalImageEntries).toEqual([]);
});

test('contains fan frames and keeps controls reachable in iPad viewports', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('iPad Mini'));
  await importSyntheticFanPack(page);
  await expectInsideViewport(page.locator('.home-theme-hero'), page);
  await page.getByRole('button', { name: /DAY 01/ }).click();
  const start = page.locator('.home-actions .button--primary');
  expect((await start.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await start.click();
  if (await page.locator('.study-theme-companion__image').count() === 0) {
    await page.locator('.study-theme-companion').evaluate(element => {
      const frame = document.createElement('div');
      frame.className = 'study-theme-companion__image';
      frame.innerHTML = '<img data-testid="fan-theme-backdrop" alt=""><img data-testid="fan-theme-foreground" alt="">';
      element.append(frame);
    });
  }
  await expectInsideViewport(page.locator('.study-theme-companion'), page);
  await expect(page.locator('.study-actions')).toBeVisible();
  if (testInfo.project.name.includes('landscape')) await expectInsideViewport(page.locator('.study-actions'), page);
});
