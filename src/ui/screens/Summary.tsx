import { typeById } from '../../lib/catalog';
import { fmtClock, fmtDayShort, fmtTime, plural } from '../../lib/format';
import { newId } from '../../lib/ids';
import { avgRest, cleanExercises, discardActiveWorkout, resumeWorkout, saveActiveWorkout, totalSets } from '../../lib/workout';
import { SetPips, Tiles } from '../components';
import { confirmDialog } from '../dialog';
import { Icon } from '../icons';
import { dispatch, useData } from '../store';
import { toast } from '../toast';

export function Summary() {
  const d = useData();
  const a = d.active!;
  const type = typeById(d, a.typeId);
  const end = a.endedAt ?? Date.now();
  const exercises = cleanExercises(a.exercises);
  const rest = avgRest(exercises);

  const discard = async () => {
    const ok = await confirmDialog({ title: 'Discard this workout?', message: "It won't be saved anywhere.", confirmLabel: 'Discard', danger: true });
    if (!ok) return;
    dispatch(discardActiveWorkout);
    toast('Workout discarded');
  };

  return (
    <main class="screen summary" style={{ '--c': type.color }}>
      <div class="donecheck">
        <Icon name="check" />
      </div>
      <h1 class="h2 center">Workout complete</h1>
      <div class="small muted num center">
        {type.name} · {fmtDayShort(a.start)} · {fmtTime(a.start)} → {fmtTime(end)}
      </div>
      <div class="clock num center summary-clock" data-testid="summary-duration">
        {fmtClock(end - a.start)}
      </div>
      <Tiles
        items={[
          { value: String(exercises.length), label: exercises.length === 1 ? 'Exercise' : 'Exercises' },
          { value: String(totalSets(exercises)), label: 'Sets' },
          { value: rest === null ? '–' : fmtClock(rest), label: 'Avg rest' },
        ]}
      />
      {exercises.length > 0 && (
        <div class="card exlist">
          {exercises.map((e, i) => (
            <div class="exrow" key={i}>
              <span>Exercise {i + 1}</span>
              <SetPips sets={e.sets} color={type.color} />
              <span class="n num">{plural(e.sets, 'set')}</span>
            </div>
          ))}
        </div>
      )}
      <div class="summary-actions">
        <button
          type="button"
          class="btn primary block"
          onClick={() => {
            dispatch((x) => saveActiveWorkout(x, newId()));
            toast('Workout saved', { tone: 'success' });
          }}
        >
          Save workout
        </button>
        <button type="button" class="btn ghost block" onClick={() => dispatch(resumeWorkout)}>
          Back to workout
        </button>
        <button type="button" class="link danger-text" onClick={() => void discard()}>
          Discard workout
        </button>
      </div>
    </main>
  );
}
