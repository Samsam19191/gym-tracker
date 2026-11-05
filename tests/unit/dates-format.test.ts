import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  calendarDaysBetween,
  combineDayTime,
  dayKey,
  daysInMonth,
  isDayKey,
  monthGrid,
  parseDayKey,
  shiftMonth,
  startOfWeek,
  timeKey,
} from '../../src/lib/dates';
import { fmtClock, fmtDayLong, fmtDayMonth, fmtDayShort, fmtDuration, fmtDurationCompact, fmtKg, fmtMonthYear, fmtRelativeDay, fmtTime, plural } from '../../src/lib/format';

describe('dates (Europe/Paris)', () => {
  it('runs in the Paris timezone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Paris');
  });

  it('dayKey / parseDayKey / isDayKey', () => {
    expect(dayKey(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05');
    expect(parseDayKey('2026-03-09').getDate()).toBe(9);
    expect(isDayKey('2026-02-29')).toBe(false);
    expect(isDayKey('2028-02-29')).toBe(true);
    expect(isDayKey('2026-1-5')).toBe(false);
    expect(isDayKey(42)).toBe(false);
  });

  it('weeks start on Monday', () => {
    const thu = new Date(2026, 10, 5, 15).getTime();
    expect(dayKey(startOfWeek(thu))).toBe('2026-11-02');
    const sun = new Date(2026, 10, 8, 22).getTime();
    expect(dayKey(startOfWeek(sun))).toBe('2026-11-02');
    const mon = new Date(2026, 10, 9, 0, 1).getTime();
    expect(dayKey(startOfWeek(mon))).toBe('2026-11-09');
  });

  it('month grid: October 2026 starts on a Thursday', () => {
    const g = monthGrid(2026, 9);
    expect(g.slice(0, 4)).toEqual([null, null, null, 1]);
    expect(g.length % 7).toBe(0);
    expect(g.filter((x) => x !== null).length).toBe(31);
  });

  it('month grid: a month starting on Monday has no padding', () => {
    expect(monthGrid(2026, 5)[0]).toBe(1); // 1 June 2026 is a Monday
  });

  it('handles DST changes (29 March and 25 October 2026)', () => {
    const before = new Date(2026, 2, 28, 12).getTime();
    expect(dayKey(addDays(before, 1))).toBe('2026-03-29');
    expect(dayKey(addDays(before, 2))).toBe('2026-03-30');
    expect(calendarDaysBetween(before, new Date(2026, 2, 30, 1).getTime())).toBe(2);
    const oct = new Date(2026, 9, 24, 23, 30).getTime();
    expect(dayKey(addDays(oct, 1))).toBe('2026-10-25');
    expect(calendarDaysBetween(oct, new Date(2026, 9, 26, 0, 10).getTime())).toBe(2);
    expect(dayKey(startOfWeek(new Date(2026, 9, 27, 9).getTime()))).toBe('2026-10-26');
  });

  it('combineDayTime and timeKey round-trip', () => {
    const t = combineDayTime('2026-11-05', '18:34');
    expect(timeKey(t)).toBe('18:34');
    expect(dayKey(t)).toBe('2026-11-05');
  });

  it('addMonths clamps the day', () => {
    expect(dayKey(addMonths(new Date(2026, 4, 31).getTime(), -3))).toBe('2026-02-28');
  });

  it('daysInMonth and shiftMonth', () => {
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 5, -18)).toEqual({ year: 2024, month: 11 });
  });
});

describe('format', () => {
  it('fmtClock', () => {
    expect(fmtClock(0)).toBe('0:00');
    expect(fmtClock(-5000)).toBe('0:00');
    expect(fmtClock(84_999)).toBe('1:24');
    expect(fmtClock((47 * 60 + 12) * 1000)).toBe('47:12');
    expect(fmtClock((3600 + 2 * 60 + 45) * 1000)).toBe('1:02:45');
  });

  it('durations', () => {
    expect(fmtDuration(52 * 60000)).toBe('52 min');
    expect(fmtDuration(65 * 60000)).toBe('1h 05m');
    expect(fmtDurationCompact(54 * 60000)).toBe('54m');
    expect(fmtDurationCompact(65 * 60000)).toBe('1h 5m');
    expect(fmtDurationCompact(120 * 60000)).toBe('2h');
  });

  it('relative days', () => {
    const now = new Date(2026, 10, 5, 9).getTime();
    expect(fmtRelativeDay(new Date(2026, 10, 5, 1).getTime(), now)).toBe('Today');
    expect(fmtRelativeDay(new Date(2026, 10, 4, 23).getTime(), now)).toBe('Yesterday');
    expect(fmtRelativeDay(new Date(2026, 10, 1, 23).getTime(), now)).toBe('4 days ago');
  });

  it('day labels', () => {
    const t = new Date(2026, 10, 5, 18, 4).getTime();
    expect(fmtDayLong(t)).toBe('Thursday 5 November');
    expect(fmtDayShort(t)).toBe('Thu 5 Nov');
    expect(fmtDayMonth(t)).toBe('5 Nov');
    expect(fmtDayMonth(t, new Date(2027, 0, 1).getTime())).toBe('5 Nov 2026');
    expect(fmtMonthYear(2026, 9)).toBe('October 2026');
    expect(fmtTime(t)).toBe('18:04');
  });

  it('kg and plural', () => {
    expect(fmtKg(70)).toBe('70');
    expect(fmtKg(67.5)).toBe('67.5');
    expect(fmtKg(12.25)).toBe('12.25');
    expect(fmtKg(0.1 + 0.2)).toBe('0.3');
    expect(plural(1, 'set')).toBe('1 set');
    expect(plural(3, 'set')).toBe('3 sets');
  });
});
