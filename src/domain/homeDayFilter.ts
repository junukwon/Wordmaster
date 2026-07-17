import type { DaySummary } from './daySelection';

export type DayRange = {
  start: number;
  end: number;
  label: string;
};

function formatDay(day: number): string {
  return String(day).padStart(2, '0');
}

export function buildDayRanges(days: DaySummary[], size = 20): DayRange[] {
  if (days.length === 0 || size < 1) return [];
  const maxDay = Math.max(...days.map((day) => day.day));
  const available = new Set(days.map((day) => day.day));
  const ranges: DayRange[] = [];

  for (let start = 1; start <= maxDay; start += size) {
    const end = Math.min(start + size - 1, maxDay);
    if (![...available].some((day) => day >= start && day <= end)) continue;
    const prefix = ranges.length === 0 ? 'DAY ' : '';
    ranges.push({ start, end, label: `${prefix}${formatDay(start)}–${formatDay(end)}` });
  }

  return ranges;
}

export function filterHomeDays(days: DaySummary[], range: DayRange, query: string): DaySummary[] {
  const normalized = query.trim().toLocaleLowerCase('ko');
  if (!normalized) return days.filter((day) => day.day >= range.start && day.day <= range.end);

  const numericMatch = normalized.match(/^(?:day\s*)?0*(\d+)$/i);
  if (numericMatch) {
    const requestedDay = Number(numericMatch[1]);
    return days.filter((day) => day.day === requestedDay);
  }

  return days.filter((day) => day.topic.toLocaleLowerCase('ko').includes(normalized));
}
