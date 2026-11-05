import { useEffect, useState } from 'preact/hooks';

export type WakeStatus = 'off' | 'on' | 'unsupported' | 'failed';

let wanted = false;
let sentinel: WakeLockSentinel | null = null;
let requesting = false;
let status: WakeStatus = 'off';
const listeners = new Set<() => void>();

function setStatus(s: WakeStatus) {
  if (s === status) return;
  status = s;
  listeners.forEach((l) => l());
}

async function acquire(): Promise<void> {
  if (!wanted) return;
  if (!('wakeLock' in navigator)) {
    setStatus('unsupported');
    return;
  }
  if (document.visibilityState !== 'visible' || requesting || (sentinel && !sentinel.released)) return;
  requesting = true;
  try {
    const s = await navigator.wakeLock.request('screen');
    requesting = false;
    if (!wanted) {
      await s.release();
      return;
    }
    sentinel = s;
    setStatus('on');
    // iOS releases the lock whenever the app goes to the background; we take it again on return.
    s.addEventListener('release', () => {
      if (sentinel === s) sentinel = null;
      if (wanted && document.visibilityState === 'visible') void acquire();
    });
  } catch {
    requesting = false;
    setStatus('failed');
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void acquire();
  });
}

/** Keep the screen on while `on` is true. Safe to call often; also retries after a failure. */
export function setKeepAwake(on: boolean): void {
  wanted = on;
  if (on) {
    void acquire();
  } else {
    const s = sentinel;
    sentinel = null;
    setStatus('off');
    if (s && !s.released) void s.release().catch(() => undefined);
  }
}

/** Call from tap handlers: some browsers only grant the lock during a user gesture. */
export function nudgeKeepAwake(): void {
  if (wanted && (!sentinel || sentinel.released)) void acquire();
}

export function useWakeStatus(): WakeStatus {
  const [, setN] = useState(0);
  useEffect(() => {
    const l = () => setN((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return status;
}
