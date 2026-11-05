import { applyImport, backupFileName, makeBackup, markBackedUp, readBackup } from '../lib/backup';
import { fmtDayMonth, plural } from '../lib/format';
import { pickTextFile, saveTextFile } from '../platform/files';
import { confirmDialog } from './dialog';
import { dispatch, getData } from './store';
import { toast } from './toast';

export async function exportBackup(): Promise<void> {
  const now = Date.now();
  try {
    const outcome = await saveTextFile(makeBackup(getData(), now), backupFileName(now));
    if (outcome === 'cancelled') return;
    dispatch((d) => markBackedUp(d, now));
    toast(outcome === 'shared' ? 'Backup ready' : 'Backup downloaded', { tone: 'success' });
  } catch {
    toast("Couldn't create the backup file", { tone: 'error' });
  }
}

export async function importBackup(): Promise<void> {
  if (getData().active) {
    toast('Finish or discard your current workout first', { tone: 'error' });
    return;
  }
  const text = await pickTextFile('application/json,.json');
  if (text === null) return;
  let parsed: ReturnType<typeof readBackup>;
  try {
    parsed = readBackup(text);
  } catch (e) {
    toast(e instanceof Error ? e.message : "Couldn't read this file", { tone: 'error', duration: 5000 });
    return;
  }
  const { data, exportedAt, skipped } = parsed;
  const ok = await confirmDialog({
    title: 'Replace all data?',
    message: `This backup${exportedAt ? ` from ${fmtDayMonth(exportedAt, Date.now())}` : ''} has ${plural(data.workouts.length, 'workout')}, ${plural(data.machines.length, 'machine')} and ${plural(data.weights.length, 'logged weight')}.${skipped ? ` ${plural(skipped, 'damaged record')} will be skipped.` : ''} Everything currently in the app will be replaced.`,
    confirmLabel: 'Replace',
    danger: true,
  });
  if (!ok) return;
  dispatch((current) => applyImport(current, data));
  toast('Backup restored', { tone: 'success' });
}
