import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.999999;
  });
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('completes the saved study and on-demand test journey', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '125개 단어 도전' })).toBeVisible();
  await page.getByRole('link', { name: '오늘 학습 시작하기' }).click();
  await expect(page.getByRole('heading', { name: '집중 학습' })).toBeVisible();

  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('button', { name: '정답 보기' }).click();
    await page.getByRole('button', { name: '기억남' }).click();
  }
  await expect(page.getByText('knee', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '정답 보기' }).click();
  await expect(page.getByText('knee', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '기억남' }).click();
  await page.reload();
  await expect(page.getByText(/문제 12/)).toBeVisible();

  await page.getByRole('link', { name: '홈으로 돌아가기' }).click();
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
  if (browserName === 'webkit') {
    await context.route('**/*', (route) => route.abort('internetdisconnected'));
    const cachedHtml = await page.evaluate(() => fetch(location.href).then((response) => response.text()));
    expect(cachedHtml).toContain('WordMaster');
  } else {
    await context.setOffline(true);
    await page.reload();
  }
  await expect(page.getByRole('heading', { name: '125개 단어 도전' })).toBeVisible();
  await page.getByRole('link', { name: '오늘 학습 시작하기' }).click();
  const canvas = page.getByRole('img', { name: /Apple Pencil 필기장/ });
  await canvas.dispatchEvent('pointerdown', { pointerId: 1, clientX: 20, clientY: 20, pressure: .5 });
  await canvas.dispatchEvent('pointermove', { pointerId: 1, clientX: 70, clientY: 55, pressure: .7 });
  await canvas.dispatchEvent('pointerup', { pointerId: 1, clientX: 70, clientY: 55, pressure: .7 });
  await expect(canvas).toHaveAttribute('data-stroke-count', '1');
  await page.getByRole('button', { name: '정답 보기' }).click();
  await page.getByRole('button', { name: '기억남' }).click();
  if (browserName !== 'webkit') await page.reload();
  await expect(page.getByText(/문제 2/)).toBeVisible();
  await page.getByRole('link', { name: '홈으로 돌아가기' }).click();
  await page.getByRole('link', { name: '수시 단어 테스트' }).click();
  await page.getByRole('button', { name: '테스트 시작하기' }).click();
  await expect(page.getByText('수시 테스트')).toBeVisible();
});

test('keeps study actions inside the initial iPad Mini landscape viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iPad Mini landscape');
  await page.getByRole('link', { name: '오늘 학습 시작하기' }).click();

  const actions = page.locator('.study-actions');
  await expect(actions).toBeVisible();
  const geometry = await actions.evaluate((element) => {
    return {
      actionsBottom: element.getBoundingClientRect().bottom,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
    };
  });

  expect(geometry.scrollY).toBe(0);
  expect(geometry.actionsBottom).toBeLessThanOrEqual(geometry.viewportHeight);
});
