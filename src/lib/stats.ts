import { gymTypes } from './catalog';
import { addDays, calendarDaysBetween, dayKey, daysInMonth, startOfWeek } from './dates';
import type { AppData, Workout } from './model';
import { workoutDuration } from './workout';

export function sortByStart(ws: Workout[], dir: 'asc' | 'desc' = 'asc'): Workout[] {
  const s = [...ws].sort((a, b) => a.start - b.start);
  return dir === 'asc' ? s : s.reverse();
}

export function workoutsOnDay(d: AppData, day: string): Workout[] {
  return sortByStart(d.workouts.filter((w) => dayKey(w.start) === day));
}

export function workoutsInMonth(d: AppData, year: number, month: number): Workout[] {
  return sortByStart(
    d.workouts.filter((w) => {
      const t = new Date(w.start);
      return t.getFullYear() === year && t.getMonth() === month;
    }),
    'desc',
  );
}

export interface MonthStats {
  count: number;
  avgDurationMs: number | null;
  /** null when the month hasn't started yet */
  perWeek: number | null;
}

/** perWeek uses the days elapsed so far for the current month, so early-month numbers aren't diluted. */
export function monthStats(ws: Workout[], year: number, month: number, now: number): MonthStats {
  const count = ws.length;
  const avgDurationMs = count ? ws.reduce((s, w) => s + workoutDuration(w), 0) / count : null;
  const today = new Date(now);
  const total = daysInMonth(year, month);
  let days: number;
  if (year === today.getFullYear() && month === today.getMonth()) days = today.getDate();
  else if (year * 12 + month > today.getFullYear() * 12 + today.getMonth()) days = 0;
  else days = total;
  const perWeek = days === 0 ? null : count / (days / 7);
  return { count, avgDurationMs, perWeek };
}

export function typeCounts(ws: Workout[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of ws) m.set(w.typeId, (m.get(w.typeId) ?? 0) + 1);
  return m;
}

export interface WeekDay {
  start: number;
  key: string;
  workouts: Workout[];
  isToday: boolean;
  isFuture: boolean;
}

export function weekStrip(d: AppData, now: number): WeekDay[] {
  const monday = startOfWeek(now);
  const todayKey = dayKey(now);
  return Array.from({ length: 7 }, (_, i) => {
    const start = addDays(monday, i);
    const key = dayKey(start);
    return { start, key, workouts: workoutsOnDay(d, key), isToday: key === todayKey, isFuture: start > now && key !== todayKey };
  });
}

export function weekSummary(d: AppData, now: number): { count: number; totalMs: number } {
  const days = weekStrip(d, now);
  const ws = days.flatMap((x) => x.workouts);
  return { count: ws.length, totalMs: ws.reduce((s, w) => s + workoutDuration(w), 0) };
}

export function lastWorkoutOfType(d: AppData, typeId: string): Workout | undefined {
  let best: Workout | undefined;
  for (const w of d.workouts) if (w.typeId === typeId && (!best || w.start > best.start)) best = w;
  return best;
}

/** Next gym type in the rotation (Settings order), based on the most recent gym workout. */
export function upNextTypeId(d: AppData): string | null {
  const types = gymTypes(d);
  if (types.length === 0) return null;
  const ids = new Set(types.map((t) => t.id));
  let last: Workout | undefined;
  for (const w of d.workouts) if (ids.has(w.typeId) && (!last || w.start > last.start)) last = w;
  if (!last) return types[0].id;
  const i = types.findIndex((t) => t.id === last!.typeId);
  return types[(i + 1) % types.length].id;
}

export function daysSince(t: number, now: number): number {
  return calendarDaysBetween(t, now);
}
