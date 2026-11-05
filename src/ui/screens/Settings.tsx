import { useState } from 'preact/hooks';
import { liveTypes } from '../../lib/catalog';
import { createDefaultData } from '../../lib/defaults';
import { fmtDayMonth } from '../../lib/format';
import type { Settings as SettingsT, WorkoutType } from '../../lib/model';
import { exportBackup, importBackup } from '../backupActions';
import { Toggle } from '../components';
import { confirmDialog } from '../dialog';
import { Icon } from '../icons';
import { RestTargetSheet, restLabel } from '../sheets/RestTargetSheet';
import { TypeSheet } from '../sheets/TypeSheet';
import { dispatch, useData } from '../store';
import { toast } from '../toast';

export function Settings({ onClose }: { onClose: () => void }) {
  const d = useData();
  const [typeSheet, setTypeSheet] = useState<{ editing?: WorkoutType } | null>(null);
  const [restSheet, setRestSheet] = useState(false);
  const set = (patch: Partial<SettingsT>) => dispatch((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  const types = liveTypes(d);
  const s = d.settings;

  const eraseAll = async () => {
    if (d.active) {
      toast('Finish or discard your current workout first', { tone: 'error' });
      return;
    }
    const ok = await confirmDialog({
      title: 'Delete all data?',
      message: 'Every workout, machine, weight and setting on this phone will be erased. Export a backup first if you might want it back.',
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (!ok) return;
    dispatch(() => createDefaultData());
    toast('All data deleted');
  };

  return (
    <main class="screen settings">
      <header class="spread">
        <h1 class="title">Settings</h1>
        <button type="button" class="link strong" onClick={onClose}>
          Done
        </button>
      </header>

      <div class="glabel">Workout types</div>
      <div class="group">
        {types.map((t) => (
          <button type="button" class="grow" key={t.id} onClick={() => setTypeSheet({ editing: t })} aria-label={`Edit ${t.name}`}>
            <span class="dot" style={{ '--c': t.color }} />
            {t.name}
            <span class="r">
              {t.kind === 'activity' && <span class="kind">Logged by hand</span>}
              <Icon name="chevR" />
            </span>
          </button>
        ))}
        <button type="button" class="grow add" onClick={() => setTypeSheet({})}>
          <Icon name="plus" />
          Add workout type
        </button>
      </div>
      <div class="gnote">The order of your gym types sets the "Up next" rotation on Home.</div>

      <div class="glabel">During workouts</div>
      <div class="group">
        <div class="grow">
          Keep screen on
          <span class="r">
            <Toggle label="Keep screen on" on={s.keepScreenOn} onChange={(v) => set({ keepScreenOn: v })} />
          </span>
        </div>
        <button type="button" class="grow" onClick={() => setRestSheet(true)} aria-label={`Rest target: ${restLabel(s.restTargetSec)}`}>
          Rest target
          <span class="r muted">
            {restLabel(s.restTargetSec)}
            <Icon name="chevR" />
          </span>
        </button>
        <div class={s.restTargetSec === null ? 'grow disabled' : 'grow'}>
          Sound at rest target
          <span class="r">
            <Toggle label="Sound at rest target" on={s.restSound} onChange={(v) => set({ restSound: v })} />
          </span>
        </div>
      </div>
      <div class="gnote">The sound only plays while the app is open, and not when your iPhone is on silent.</div>

      <div class="glabel">Backup</div>
      <div class="group">
        <button type="button" class="grow" onClick={() => void exportBackup()}>
          <Icon name="export" />
          Export backup
        </button>
        <button type="button" class="grow" onClick={() => void importBackup()}>
          <Icon name="import" />
          Import backup
        </button>
      </div>
      <div class="gnote">{s.lastBackupAt ? `Last backup: ${fmtDayMonth(s.lastBackupAt, Date.now())}` : 'No backup yet.'} Your data only lives on this phone. Save the file to Files or iCloud Drive.</div>

      <div class="glabel">Danger zone</div>
      <div class="group">
        <button type="button" class="grow danger-text" onClick={() => void eraseAll()}>
          <Icon name="trash" />
          Delete all data
        </button>
      </div>

      <div class="version">Version {__APP_VERSION__}</div>

      {typeSheet && <TypeSheet editing={typeSheet.editing} onClose={() => setTypeSheet(null)} />}
      {restSheet && <RestTargetSheet onClose={() => setRestSheet(false)} />}
    </main>
  );
}
