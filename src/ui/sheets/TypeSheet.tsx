import { useState } from 'preact/hooks';
import { addType, canDeleteType, deleteType, liveTypes, moveType, nextColor, updateType, validateTypeName } from '../../lib/catalog';
import { PALETTE } from '../../lib/defaults';
import { newId } from '../../lib/ids';
import type { TypeKind, WorkoutType } from '../../lib/model';
import { Segmented, Sheet, SheetHeader } from '../components';
import { confirmDialog } from '../dialog';
import { Icon } from '../icons';
import { dispatch, getData, useData } from '../store';
import { toast } from '../toast';

export function TypeSheet({ onClose, editing }: { onClose: () => void; editing?: WorkoutType }) {
  const d = useData();
  const [name, setName] = useState(editing?.name ?? '');
  const [color, setColor] = useState(editing?.color ?? nextColor(d));
  const [kind, setKind] = useState<TypeKind>(editing?.kind ?? 'gym');
  const [error, setError] = useState<string | null>(null);
  const list = liveTypes(d);
  const idx = editing ? list.findIndex((t) => t.id === editing.id) : -1;

  const save = () => {
    const err = validateTypeName(getData(), name, editing?.id);
    if (err) {
      setError(err);
      return;
    }
    if (editing) {
      dispatch((x) => updateType(x, editing.id, { name, color, kind }));
      toast('Workout type updated', { tone: 'success' });
    } else {
      dispatch((x) => addType(x, { name, color, kind }, newId()));
      toast('Workout type added', { tone: 'success' });
    }
    onClose();
  };

  const remove = async () => {
    if (!editing) return;
    const blocked = canDeleteType(getData(), editing.id);
    if (blocked) {
      setError(blocked);
      return;
    }
    const ok = await confirmDialog({
      title: `Delete ${editing.name}?`,
      message: 'Past workouts keep their history and color. Machines tagged with it become untagged.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    dispatch((x) => deleteType(x, editing.id));
    toast('Workout type deleted');
    onClose();
  };

  return (
    <Sheet label={editing ? 'Edit workout type' : 'New workout type'} onClose={onClose}>
      <SheetHeader title={editing ? 'Edit workout type' : 'New workout type'} onCancel={onClose} />
      <div class="field">
        <label for="type-name">Name</label>
        <input
          id="type-name"
          class="input"
          type="text"
          autocomplete="off"
          maxLength={40}
          placeholder="e.g. Legs"
          value={name}
          onInput={(e) => {
            setName((e.target as HTMLInputElement).value);
            setError(null);
          }}
        />
      </div>
      <div class="field">
        <label>Color</label>
        <div class="swatches" role="radiogroup" aria-label="Color">
          {PALETTE.map((c) => (
            <button type="button" key={c} role="radio" aria-checked={c.toLowerCase() === color.toLowerCase()} aria-label={`Color ${c}`} class={c.toLowerCase() === color.toLowerCase() ? 'swatch on' : 'swatch'} style={{ '--c': c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <div class="field">
        <label>How you track it</label>
        <Segmented
          label="How you track it"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'gym', label: 'Live timer' },
            { value: 'activity', label: 'Logged by hand' },
          ]}
        />
        <div class="form-note">{kind === 'gym' ? 'Shows on Home as a workout you start with the timer.' : 'For things like a football match: you log the start and end time afterwards.'}</div>
      </div>
      {editing && (
        <div class="field">
          <label>Order</label>
          <div class="row-s">
            <button type="button" class="btn small ghost" disabled={idx <= 0} onClick={() => dispatch((x) => moveType(x, editing.id, -1))}>
              <Icon name="chevU" /> Move up
            </button>
            <button type="button" class="btn small ghost" disabled={idx < 0 || idx >= list.length - 1} onClick={() => dispatch((x) => moveType(x, editing.id, 1))}>
              <Icon name="chevD" /> Move down
            </button>
          </div>
        </div>
      )}
      {error && (
        <div class="form-error" role="alert">
          {error}
        </div>
      )}
      <button type="button" class="btn primary block" onClick={save}>
        {editing ? 'Save changes' : 'Add workout type'}
      </button>
      {editing && (
        <button type="button" class="btn ghost block danger-text" onClick={() => void remove()}>
          <Icon name="trash" /> Delete workout type
        </button>
      )}
    </Sheet>
  );
}
