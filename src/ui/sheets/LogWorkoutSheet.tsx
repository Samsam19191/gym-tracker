import { useState } from 'preact/hooks';
import { liveTypes } from '../../lib/catalog';
import { addDays, combineDayTime, dayKey, timeKey } from '../../lib/dates';
import { fmtDuration } from '../../lib/format';
import { newId } from '../../lib/ids';
import type { Workout } from '../../lib/model';
import { addManualWorkout, updateWorkout, validateWorkoutInput } from '../../lib/workout';
import { Sheet, SheetHeader, TypeChips } from '../components';
import { dispatch, getData, useData } from '../store';
import { toast } from '../toast';

function roundDown15(t: number): number {
  const d = new Date(t);
  d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
  return d.getTime();
}

/** Add a workout by hand (forgotten timer, football match...) or edit an existing one. */
export function LogWorkoutSheet({ onClose, typeId, day, editing }: { onClose: () => void; typeId?: string; day?: string; editing?: Workout }) {
  const d = useData();
  const now = Date.now();
  const types = liveTypes(d);
  const editingType = editing ? d.types.find((t) => t.id === editing.typeId) : undefined;
  const choices = editingType?.deleted ? [...types, editingType] : types;

  const defaultEnd = roundDown15(now);
  const [type, setType] = useState<string | null>(editing?.typeId ?? typeId ?? null);
  const [date, setDate] = useState(editing ? dayKey(editing.start) : (day ?? dayKey(now)));
  const [from, setFrom] = useState(editing ? timeKey(editing.start) : timeKey(defaultEnd - 90 * 60_000));
  const [to, setTo] = useState(editing ? timeKey(editing.end) : timeKey(defaultEnd));
  const [error, setError] = useState<string | null>(null);

  const start = date && from ? combineDayTime(date, from) : NaN;
  let end = date && to ? combineDayTime(date, to) : NaN;
  const overnight = Number.isFinite(start) && Number.isFinite(end) && end <= start && to !== from;
  if (overnight) end = combineDayTime(dayKey(addDays(start, 1)), to);
  const valid = Number.isFinite(start) && Number.isFinite(end) && end > start;

  const save = () => {
    const input = { typeId: type ?? '', start, end };
    const err = validateWorkoutInput(getData(), input, Date.now(), editing?.id);
    if (err) {
      setError(err);
      return;
    }
    if (editing) {
      dispatch((x) => updateWorkout(x, editing.id, input));
      toast('Workout updated', { tone: 'success' });
    } else {
      dispatch((x) => addManualWorkout(x, input, newId()));
      toast('Workout logged', { tone: 'success' });
    }
    onClose();
  };

  return (
    <Sheet label={editing ? 'Edit workout' : 'Log a workout'} onClose={onClose}>
      <SheetHeader title={editing ? 'Edit workout' : 'Log a workout'} onCancel={onClose} />
      <div class="field">
        <label>Type</label>
        <TypeChips label="Workout type" types={choices} value={type} onChange={(v) => { setType(v); setError(null); }} />
      </div>
      <div class="field">
        <label for="log-date">Date</label>
        <input id="log-date" class="input" type="date" value={date} max={dayKey(now)} onInput={(e) => { setDate((e.target as HTMLInputElement).value); setError(null); }} />
      </div>
      <div class="field-row">
        <div class="field">
          <label for="log-from">From</label>
          <input id="log-from" class="input" type="time" value={from} onInput={(e) => { setFrom((e.target as HTMLInputElement).value); setError(null); }} />
        </div>
        <div class="field">
          <label for="log-to">To</label>
          <input id="log-to" class="input" type="time" value={to} onInput={(e) => { setTo((e.target as HTMLInputElement).value); setError(null); }} />
        </div>
      </div>
      <div class="form-note" aria-live="polite">
        {valid ? `Duration ${fmtDuration(end - start)}${overnight ? ' · ends the next day' : ''}` : ' '}
      </div>
      {error && (
        <div class="form-error" role="alert">
          {error}
        </div>
      )}
      <button type="button" class="btn primary block" onClick={save}>
        {editing ? 'Save changes' : 'Log workout'}
      </button>
    </Sheet>
  );
}
