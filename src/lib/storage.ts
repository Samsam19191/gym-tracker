import { createDefaultData } from './defaults';
import type { AppData } from './model';
import { parseAppData } from './validate';

// Namespaced: every GitHub Pages project of the same account shares one origin (and one localStorage).
export const STORAGE_KEY = 'gym-tracker:data';

export interface LoadResult {
  data: AppData;
  warning: string | null;
}

export function loadData(storage: Storage, now: number): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { data: createDefaultData(), warning: "Couldn't read saved data on this device" };
  }
  if (raw === null) return { data: createDefaultData(), warning: null };
  try {
    return { data: parseAppData(JSON.parse(raw)), warning: null };
  } catch {
    // Keep the unreadable copy aside instead of overwriting it, so nothing is lost for good.
    try {
      storage.setItem(`${STORAGE_KEY}:corrupt:${now}`, raw);
    } catch {
      /* storage full: nothing more we can do */
    }
    return { data: createDefaultData(), warning: 'Saved data was damaged and has been set aside. Restore a backup in Settings.' };
  }
}

export function saveData(storage: Storage, data: AppData): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
