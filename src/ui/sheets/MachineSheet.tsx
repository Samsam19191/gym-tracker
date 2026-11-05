import { useEffect, useRef, useState } from 'preact/hooks';
import { addType, liveTypes, nextColor, validateTypeName } from '../../lib/catalog';
import { dayKey } from '../../lib/dates';
import { newId } from '../../lib/ids';
import type { Machine } from '../../lib/model';
import { addMachine, deleteMachine, entriesFor, logWeight, parseKg, updateMachine, validateMachineName } from '../../lib/weights';
import { Sheet, SheetHeader, TypeChips } from '../components';
import { confirmDialog } from '../dialog';
import { Icon } from '../icons';
import { dispatch, getData, useData } from '../store';
import { toast } from '../toast';

/** Create a machine, or edit / delete an existing one. */
export function MachineSheet({ onClose, editing, onDeleted, defaultTypeId }: { onClose: () => void; editing?: Machine; onDeleted?: () => void; defaultTypeId?: string | null }) {
  const d = useData();
  const [name, setName] = useState(editing?.name ?? '');
  const [typeId, setTypeId] = useState<string | null>(editing ? editing.typeId : (defaultTypeId ?? null));
  const [startKg, setStartKg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newType, setNewType] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const newTypeRef = useRef<HTMLInputElement>(null);
  const addingType = newType !== null;
  useEffect(() => {
    if (!editing) nameRef.current?.focus();
  }, []);
  // Focus once when the field appears (a ref callback would steal focus on every keystroke).
  useEffect(() => {
    if (addingType) newTypeRef.current?.focus();
  }, [addingType]);

  const types = liveTypes(d);

  const createType = () => {
    const n = newType ?? '';
    const err = validateTypeName(getData(), n);
    if (err) {
      setError(err);
      return;
    }
    const id = newId();
    dispatch((x) => addType(x, { name: n, color: nextColor(x), kind: 'gym' }, id));
    setTypeId(id);
    setNewType(null);
    setError(null);
  };

  const save = () => {
    const err = validateMachineName(getData(), name, editing?.id);
    if (err) {
      setError(err);
      return;
    }
    let kg: number | null = null;
    if (!editing && startKg.trim()) {
      kg = parseKg(startKg);
      if (kg === null) {
        setError('Enter a weight between 0 and 1000 kg, or leave it empty');
        return;
      }
    }
    if (editing) {
      dispatch((x) => updateMachine(x, editing.id, { name, typeId }));
      toast('Machine updated', { tone: 'success' });
    } else {
      const id = newId();
      dispatch((x) => {
        let next = addMachine(x, { name, typeId }, id, Date.now());
        if (kg !== null) next = logWeight(next, id, dayKey(Date.now()), kg, newId()).data;
        return next;
      });
      toast('Machine added', { tone: 'success' });
    }
    onClose();
  };

  const remove = async () => {
    if (!editing) return;
    const n = entriesFor(getData(), editing.id).length;
    const ok = await confirmDialog({
      title: `Delete ${editing.name}?`,
      message: n ? `Its ${n} logged ${n === 1 ? 'weight' : 'weights'} will be deleted too. This can't be undone.` : "This can't be undone.",
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    dispatch((x) => deleteMachine(x, editing.id));
    toast('Machine deleted');
    onClose();
    onDeleted?.();
  };

  return (
    <Sheet label={editing ? 'Edit machine' : 'New machine'} onClose={onClose}>
      <SheetHeader title={editing ? 'Edit machine' : 'New machine'} onCancel={onClose} />
      <div class="field">
        <label for="machine-name">Name</label>
        <input
          id="machine-name"
          ref={nameRef}
          class="input"
          type="text"
          autocomplete="off"
          enterKeyHint="done"
          maxLength={40}
          placeholder="e.g. Chest press"
          value={name}
          onInput={(e) => {
            setName((e.target as HTMLInputElement).value);
            setError(null);
          }}
        />
      </div>
      <div class="field">
        <label>Workout type</label>
        <TypeChips label="Machine workout type" types={types} value={typeId} allowNone onChange={setTypeId} />
        {newType === null ? (
          <button type="button" class="fchip add" onClick={() => setNewType('')}>
            <Icon name="plus" /> New type
          </button>
        ) : (
          <div class="inline-add">
            <input
              class="input"
              type="text"
              aria-label="New workout type name"
              placeholder="Type name"
              maxLength={40}
              value={newType}
              ref={newTypeRef}
              onInput={(e) => {
                setNewType((e.target as HTMLInputElement).value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && createType()}
            />
            <button type="button" class="btn small primary" onClick={createType}>
              Add
            </button>
          </div>
        )}
      </div>
      {!editing && (
        <div class="field">
          <label for="machine-kg">
            Starting weight <span class="dim">(optional)</span>
          </label>
          <div class="input-unit">
            <input
              id="machine-kg"
              class="input"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 40"
              value={startKg}
              onInput={(e) => {
                setStartKg((e.target as HTMLInputElement).value);
                setError(null);
              }}
            />
            <span>kg</span>
          </div>
        </div>
      )}
      {error && (
        <div class="form-error" role="alert">
          {error}
        </div>
      )}
      <button type="button" class="btn primary block" onClick={save}>
        {editing ? 'Save changes' : 'Add machine'}
      </button>
      {editing && (
        <button type="button" class="btn ghost block danger-text" onClick={() => void remove()}>
          <Icon name="trash" /> Delete machine
        </button>
      )}
    </Sheet>
  );
}
