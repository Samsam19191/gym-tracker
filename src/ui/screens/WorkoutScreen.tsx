import { useEffect, useRef } from 'preact/hooks';
import { typeById } from '../../lib/catalog';
import { fmtClock, plural } from '../../lib/format';
import type { ActiveWorkout } from '../../lib/model';
import { canNextExercise, canUndo, currentExercise, endRest, endWorkout, nextExercise, startRest, undoSet } from '../../lib/workout';
import { playRestBeep, unlockAudio } from '../../platform/sound';
import { nudgeKeepAwake, useWakeStatus } from '../../platform/wakelock';
import { HoldButton, IconButton, TypeChip } from '../components';
import { Icon } from '../icons';
import { dispatch, useData, useNow } from '../store';

const R = 108;
const CIRC = 2 * Math.PI * R;

function WakePill({ enabled }: { enabled: boolean }) {
  const status = useWakeStatus();
  if (!enabled) return null;
  const on = status === 'on';
  return (
    <span class={on ? 'pill' : 'pill warn'} role="status">
      <Icon name={on ? 'sun' : 'moon'} />
      {on ? 'Screen on' : 'Screen may sleep'}
    </span>
  );
}

function useRestBeep(a: ActiveWorkout, now: number, targetMs: number | null, enabled: boolean) {
  const beeped = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled || !targetMs || !a.rest) return;
    const elapsed = now - a.rest.start;
    // Only beep live: not when coming back to the app long after the target.
    if (elapsed >= targetMs && elapsed < targetMs + 3000 && beeped.current !== a.rest.start) {
      beeped.current = a.rest.start;
      playRestBeep();
    }
  }, [now, a.rest, targetMs, enabled]);
}

export function WorkoutScreen({ onOpenWeights }: { onOpenWeights: () => void }) {
  const d = useData();
  const a = d.active!;
  const now = useNow(250);
  const type = typeById(d, a.typeId);
  const cur = currentExercise(a);
  const exNumber = a.exercises.length;
  const resting = a.rest !== null;
  const total = now - a.start;
  const restMs = a.rest ? now - a.rest.start : 0;
  const targetMs = d.settings.restTargetSec ? d.settings.restTargetSec * 1000 : null;
  const reached = targetMs !== null && restMs >= targetMs;
  useRestBeep(a, now, targetMs, d.settings.restSound);

  const tap = (fn: Parameters<typeof dispatch>[0]) => {
    unlockAudio();
    nudgeKeepAwake();
    dispatch(fn);
  };

  const counter = (
    <div class="ex-row">
      <button type="button" class="undo" aria-label="Undo last set" disabled={!canUndo(a)} onClick={() => tap(undoSet)}>
        −1
      </button>
      <div class="ex-mid">
        <span class="eyebrow">Exercise {exNumber}</span>
        <span class="ex-sets" aria-live="polite">
          <b class="num" data-testid="set-count">{cur.sets}</b> {cur.sets === 1 ? 'set' : 'sets'} done
        </span>
      </div>
      <button type="button" class="ghostbtn sm" disabled={!canNextExercise(a)} onClick={() => tap(nextExercise)}>
        <Icon name="reset" />
        Next exercise
      </button>
    </div>
  );

  return (
    <main class={resting ? 'workout resting' : 'workout'} style={{ '--c': type.color }}>
      <header class="spread wo-top">
        <TypeChip type={type} />
        <div class="row-s">
          <WakePill enabled={d.settings.keepScreenOn} />
          <IconButton icon="dumbbell" label="Open weights" onClick={onOpenWeights} />
        </div>
      </header>

      {!resting ? (
        <>
          <div class="total">
            <div class="eyebrow">Total</div>
            <div class="clock num" data-testid="total-clock">
              {fmtClock(total)}
            </div>
          </div>
          <div class="card setcard">
            <div class="spread">
              <span class="eyebrow">Exercise {exNumber}</span>
              <button type="button" class="undo" aria-label="Undo last set" disabled={!canUndo(a)} onClick={() => tap(undoSet)}>
                −1
              </button>
            </div>
            <div class="setline" aria-live="polite">
              <span class="setn num" data-testid="set-count">
                {cur.sets}
              </span>
              <span class="muted">{cur.sets === 1 ? 'set' : 'sets'} done</span>
            </div>
            <button type="button" class="ghostbtn" disabled={!canNextExercise(a)} onClick={() => tap(nextExercise)}>
              <Icon name="reset" />
              Next exercise
            </button>
          </div>
        </>
      ) : (
        <>
          <div class="center small muted num total-mini">
            Total <span class="strong" data-testid="total-clock">{fmtClock(total)}</span>
          </div>
          <div class={reached ? 'ring reached' : 'ring'}>
            <svg viewBox="0 0 240 240" aria-hidden="true">
              <circle class="track" cx="120" cy="120" r={R} />
              {targetMs !== null && <circle class="prog" cx="120" cy="120" r={R} stroke-dasharray={CIRC} stroke-dashoffset={CIRC * (1 - Math.min(1, restMs / targetMs))} />}
            </svg>
            <div class="ring-in">
              <div class="eyebrow rest-label">{reached ? 'Rest done' : 'Rest'}</div>
              <div class="rclock num" data-testid="rest-clock">
                {fmtClock(restMs)}
              </div>
              {targetMs !== null && <div class="small muted">target {fmtClock(targetMs)}</div>}
            </div>
          </div>
          <div class="card setcard compact">{counter}</div>
        </>
      )}

      <div class="wo-actions">
        {!resting ? (
          <button type="button" class="bigbtn rest" onClick={() => tap((x) => startRest(x, Date.now()))}>
            <span class="bt">Start rest</span>
            <span class="bs">Counts set {cur.sets + 1}</span>
          </button>
        ) : (
          <button type="button" class="bigbtn light" onClick={() => tap((x) => endRest(x, Date.now()))}>
            <span class="bt">End rest</span>
            <span class="bs">{a.rest && a.rest.exercise !== exNumber - 1 ? `Then exercise ${exNumber}, set 1` : `Then set ${cur.sets + 1}`}</span>
          </button>
        )}
        <HoldButton label="Hold to end workout" hint="Press and hold to end the workout" onDone={() => dispatch((x) => endWorkout(x, Date.now()))} />
      </div>
      <span class="sr-only">{plural(a.exercises.reduce((n, e) => n + e.sets, 0), 'set')} so far</span>
    </main>
  );
}
