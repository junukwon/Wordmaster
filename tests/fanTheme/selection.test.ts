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
