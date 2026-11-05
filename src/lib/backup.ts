import { dayKey } from './dates';
import type { AppData } from './model';
import { DataError, parseAppDataLenient } from './validate';

export const BACKUP_APP = 'gym-tracker';
export const REMIND_AFTER_DAYS = 30;
export const SNOOZE_DAYS = 7;
const DAY = 86_400_000;

export function makeBackup(d: AppData, now: number): string {
  return JSON.stringify({ app: BACKUP_APP, format: 1, exportedAt: now, data: { ...d, active: null } }, null, 2);
}

export function backupFileName(now: number): string {
  return `gym-tracker-backup-${dayKey(now)}.json`;
}

export function readBackup(text: string): { data: AppData; exportedAt: number | null; skipped: number } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new DataError("This file isn't a Gym Tracker backup");
  }
  if (typeof json !== 'object' || json === null || (json as { app?: unknown }).app !== BACKUP_APP) {
    throw new DataError("This file isn't a Gym Tracker backup");
  }
  const j = json as { exportedAt?: unknown; data?: unknown };
  const { data, dropped } = parseAppDataLenient(j.data);
  return { data: { ...data, active: null }, exportedAt: typeof j.exportedAt === 'number' ? j.exportedAt : null, skipped: dropped };
}

/** Remind when there is something worth saving and no backup in the last 30 days (unless snoozed). */
export function shouldRemindBackup(d: AppData, now: number): boolean {
  const s = d.settings;
  if (s.backupSnoozeUntil !== null && now < s.backupSnoozeUntil) return false;
  if (s.lastBackupAt !== null) return now - s.lastBackupAt > REMIND_AFTER_DAYS * DAY;
  const firstRecord = Math.min(...d.workouts.map((w) => w.start), ...d.machines.map((m) => m.createdAt), Infinity);
  return firstRecord !== Infinity && now - firstRecord > REMIND_AFTER_DAYS * DAY;
}

export function snoozeBackup(d: AppData, now: number): AppData {
  return { ...d, settings: { ...d.settings, backupSnoozeUntil: now + SNOOZE_DAYS * DAY } };
}

export function markBackedUp(d: AppData, now: number): AppData {
  return { ...d, settings: { ...d.settings, lastBackupAt: now, backupSnoozeUntil: null } };
}

/** Keep this device's backup date: importing old data shouldn't make the reminder think it's backed up. */
export function applyImport(current: AppData, imported: AppData): AppData {
  return { ...imported, active: null, settings: { ...imported.settings, lastBackupAt: current.settings.lastBackupAt, backupSnoozeUntil: current.settings.backupSnoozeUntil } };
}
