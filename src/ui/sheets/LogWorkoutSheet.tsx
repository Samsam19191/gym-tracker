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

  // Default: the last 90 minutes. The date is the start's day, so just after midnight it is still yesterday.
  const [init] = useState(() => {
    const defaultEnd = roundDown15(now);
    const defaultStart = defaultEnd - 90 * 60_000;
    return {
      date: editing ? dayKey(editing.start) : (day ?? dayKey(defaultStart)),
      from: editing ? timeKey(editing.start) : timeKey(defaultStart),
      to: editing ? timeKey(editing.end) : timeKey(defaultEnd),
    };
  });
  const [type, setType] = useState<string | null>(editing?.typeId ?? typeId ?? null);
  const [date, setDate] = useState(init.date);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [error, setError] = useState<string | null>(null);

  // When editing, untouched fields keep the exact recorded time (the form only shows minutes).
  const keepStart = !!editing && date === init.date && from === init.from;
  const keepEnd = !!editing && date === init.date && to === init.to;
  const start = keepStart ? editing.start : date && from ? combineDayTime(date, from) : NaN;
  let end = keepEnd ? editing.end : date && to ? combineDayTime(date, to) : NaN;
  if (!keepEnd && Number.isFinite(start) && Number.isFinite(end) && end <= start && to !== from) {
    end = combineDayTime(dayKey(addDays(start, 1)), to);
  }
  const valid = Number.isFinite(start) && Number.isFinite(end) && end > start;
  const overnight = valid && dayKey(end) !== dayKey(start);

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
