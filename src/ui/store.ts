import { useEffect, useState } from 'preact/hooks';
import { createDefaultData } from '../lib/defaults';
import type { AppData } from '../lib/model';
import { loadData, saveData, STORAGE_KEY } from '../lib/storage';
import { parseAppData } from '../lib/validate';
import { toast } from './toast';

let data: AppData = createDefaultData();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Loads saved data. Returns a warning to show the user, if any. */
export function initStore(): string | null {
  const r = loadData(window.localStorage, Date.now());
  data = r.data;
  // Ask iOS/Chrome to never evict our storage. Best effort: not all browsers support or grant it.
  navigator.storage?.persist?.().catch(() => undefined);
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || e.newValue === null) return;
    try {
      data = parseAppData(JSON.parse(e.newValue));
      emit();
    } catch {
      /* another tab wrote something unreadable: keep ours */
    }
  });
  return r.warning;
}

export function getData(): AppData {
  return data;
}

/** Apply a pure update, persist it, and re-render. Returns the new data. */
export function dispatch(fn: (d: AppData) => AppData): AppData {
  const next = fn(data);
  if (next === data) return data;
  data = next;
  if (!saveData(window.localStorage, next)) {
    toast("Couldn't save on this device. Your phone storage may be full.", { tone: 'error', duration: 6000 });
  }
  emit();
  return next;
}

export function useData(): AppData {
  const [, setN] = useState(0);
  useEffect(() => {
    const l = () => setN((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return data;
}

/** Re-renders every `intervalMs` (and when the app comes back to the foreground) with the current time. */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs, enabled]);
  return enabled ? now : Date.now();
}
