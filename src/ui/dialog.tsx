import { useEffect, useState } from 'preact/hooks';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  pending?.resolve(false);
  return new Promise((resolve) => {
    pending = { ...opts, resolve };
    emit();
  });
}

function close(ok: boolean) {
  const p = pending;
  pending = null;
  emit();
  p?.resolve(ok);
}

export function DialogHost() {
  const [, setN] = useState(0);
  useEffect(() => {
    const l = () => setN((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (!pending) return null;
  const p = pending;
  return (
    <div class="dialog-wrap">
      <div class="scrim" onClick={() => close(false)} />
      <div class="dialog" role="alertdialog" aria-modal="true" aria-label={p.title}>
        <div class="dialog-title">{p.title}</div>
        {p.message && <div class="dialog-msg">{p.message}</div>}
        <div class="dialog-actions">
          <button type="button" class="btn ghost" onClick={() => close(false)}>
            {p.cancelLabel ?? 'Cancel'}
          </button>
          <button type="button" class={p.danger ? 'btn danger' : 'btn primary'} onClick={() => close(true)}>
            {p.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
