import { createDefaultData } from './defaults';
import type { AppData } from './model';
import { parseAppDataLenient } from './validate';

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
  // Keep the original aside before anything overwrites it, so nothing is lost for good.
  const keepCopy = () => {
    try {
      storage.setItem(`${STORAGE_KEY}:corrupt:${now}`, raw);
    } catch {
      /* storage full: nothing more we can do */
    }
  };
  try {
    const { data, dropped, lostActive } = parseAppDataLenient(JSON.parse(raw));
    if (dropped === 0) return { data, warning: null };
    keepCopy();
    saveData(storage, data);
    const what = lostActive ? "Your workout in progress couldn't be restored" : `${dropped} damaged ${dropped === 1 ? 'record was' : 'records were'} skipped`;
    return { data, warning: `${what}. The rest of your data is safe, and a copy was set aside (Settings).` };
  } catch {
    keepCopy();
    return { data: createDefaultData(), warning: 'Saved data was damaged and has been set aside. Restore a backup in Settings.' };
  }
}

const SET_ASIDE_PREFIX = `${STORAGE_KEY}:corrupt:`;

/** Copies of saved data that couldn't be fully read, kept so they can still be recovered. */
export function setAsideKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(SET_ASIDE_PREFIX)) keys.push(k);
  }
  return keys.sort();
}

export function exportSetAside(storage: Storage): string {
  return JSON.stringify(Object.fromEntries(setAsideKeys(storage).map((k) => [k, storage.getItem(k)])), null, 2);
}

export function clearSetAside(storage: Storage): void {
  for (const k of setAsideKeys(storage)) storage.removeItem(k);
}

export function saveData(storage: Storage, data: AppData): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
