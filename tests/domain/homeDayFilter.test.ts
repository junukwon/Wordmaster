import { buildDayRanges, filterHomeDays } from '../../src/domain/homeDayFilter';
import type { DaySummary } from '../../src/domain/daySelection';

const days: DaySummary[] = Array.from({ length: 45 }, (_, index) => ({
  day: index + 1,
  topic: index === 24 ? '학교 활동' : `주제 ${index + 1}`,
  total: 25,
  mastered: 0,
  learning: 0,
  unseen: 25,
}));

test('builds compact ranges from the available DAY data', () => {
  expect(buildDayRanges(days)).toEqual([
    { start: 1, end: 20, label: 'DAY 01–20' },
    { start: 21, end: 40, label: '21–40' },
    { start: 41, end: 45, label: '41–45' },
  ]);
});

test('filters by range until a DAY number or topic search is entered', () => {
  const firstRange = { start: 1, end: 20, label: 'DAY 01–20' };

  expect(filterHomeDays(days, firstRange, '').map((day) => day.day)).toEqual(
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
  expect(filterHomeDays(days, firstRange, '25').map((day) => day.day)).toEqual([25]);
  expect(filterHomeDays(days, firstRange, '학교').map((day) => day.day)).toEqual([25]);
});
