import { useEffect, useState } from 'preact/hooks';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  action?: ToastAction;
  tone: 'default' | 'error' | 'success';
}

let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function toast(message: string, opts: { action?: ToastAction; tone?: Toast['tone']; duration?: number } = {}): void {
  clearTimeout(timer);
  current = { id: ++seq, message, action: opts.action, tone: opts.tone ?? 'default' };
  const id = current.id;
  timer = setTimeout(() => {
    if (current?.id === id) {
      current = null;
      emit();
    }
  }, opts.duration ?? 2800);
  emit();
}

export function dismissToast(): void {
  clearTimeout(timer);
  current = null;
  emit();
}

export function useToast(): Toast | null {
  const [, setN] = useState(0);
  useEffect(() => {
    const l = () => setN((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return current;
}
