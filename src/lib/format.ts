import { calendarDaysBetween } from './dates';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = WEEKDAYS.map((d) => d.slice(0, 3));

const pad = (n: number) => String(n).padStart(2, '0');

/** Stopwatch style: 7:05, 47:12, 1:02:45 */
export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Human duration: "45 min", "1h 05m" */
export function fmtDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${pad(m)}m`;
}

/** Compact duration for tiles: "54m", "1h 5m" */
export function fmtDurationCompact(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtRelativeDay(t: number, now: number): string {
  const days = calendarDaysBetween(t, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/** Thursday 5 November */
export function fmtDayLong(t: number): string {
  const d = new Date(t);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Thu 5 Nov */
export function fmtDayShort(t: number): string {
  const d = new Date(t);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** 5 Nov, or 5 Nov 2025 when not in the reference year */
export function fmtDayMonth(t: number, now?: number): string {
  const d = new Date(t);
  const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  if (now !== undefined && new Date(now).getFullYear() !== d.getFullYear()) return `${base} ${d.getFullYear()}`;
  return base;
}

export function fmtMonthYear(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export function fmtTime(t: number): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 70 -> "70", 67.5 -> "67.5", 12.25 -> "12.25" */
export function fmtKg(kg: number): string {
  return String(Math.round(kg * 100) / 100);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
