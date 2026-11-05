import { describe, expect, it } from 'vitest';
import { createDefaultData } from '../../src/lib/defaults';
import type { AppData } from '../../src/lib/model';
import {
  activeToWorkout,
  addManualWorkout,
  avgRest,
  canNextExercise,
  canUndo,
  cleanExercises,
  deleteWorkout,
  discardActiveWorkout,
  endRest,
  endWorkout,
  nextExercise,
  resumeWorkout,
  saveActiveWorkout,
  startRest,
  startWorkout,
  TOGGLE_GUARD_MS,
  totalSets,
  undoSet,
  updateWorkout,
  validateWorkoutInput,
  workoutDuration,
} from '../../src/lib/workout';

const T0 = new Date(2026, 10, 5, 18, 0, 0).getTime();
const S = 1000;

function started(): AppData {
  return startWorkout(createDefaultData(), 'push', T0);
}

describe('starting a workout', () => {
  it('creates an active workout with one empty exercise', () => {
    const d = started();
    expect(d.active).toEqual({ typeId: 'push', start: T0, exercises: [{ sets: 0, rests: [] }], rest: null, endedAt: null, lastToggleAt: null });
  });

  it('does nothing when a workout is already running', () => {
    const d = started();
    expect(startWorkout(d, 'pull', T0 + 5 * S)).toBe(d);
  });

  it('refuses unknown or deleted types', () => {
    const d = createDefaultData();
    expect(startWorkout(d, 'nope', T0).active).toBeNull();
    const deleted = { ...d, types: d.types.map((t) => (t.id === 'push' ? { ...t, deleted: true } : t)) };
    expect(startWorkout(deleted, 'push', T0).active).toBeNull();
  });
});

describe('sets and rests', () => {
  it('start rest counts a set and starts the rest timer', () => {
    const d = startRest(started(), T0 + 60 * S);
    expect(d.active!.exercises[0].sets).toBe(1);
    expect(d.active!.rest).toEqual({ start: T0 + 60 * S, exercise: 0 });
  });

  it('end rest records the rest duration', () => {
    let d = startRest(started(), T0 + 60 * S);
    d = endRest(d, T0 + 150 * S);
    expect(d.active!.rest).toBeNull();
    expect(d.active!.exercises[0].rests).toEqual([90 * S]);
  });

  it('counts several sets in a row', () => {
    let d = started();
    let t = T0;
    for (let i = 0; i < 4; i++) {
      t += 40 * S;
      d = startRest(d, t);
      t += 90 * S;
      d = endRest(d, t);
    }
    expect(d.active!.exercises[0]).toEqual({ sets: 4, rests: [90 * S, 90 * S, 90 * S, 90 * S] });
  });

  it('ignores a second tap within the double-tap guard', () => {
    let d = startRest(started(), T0 + 10 * S);
    const same = endRest(d, T0 + 10 * S + TOGGLE_GUARD_MS - 1);
    expect(same).toBe(d);
    d = endRest(d, T0 + 10 * S + TOGGLE_GUARD_MS);
    expect(d.active!.rest).toBeNull();
  });

  it('cannot start a rest while resting or end one when not resting', () => {
    const d = startRest(started(), T0 + 10 * S);
    expect(startRest(d, T0 + 20 * S)).toBe(d);
    const e = started();
    expect(endRest(e, T0 + 20 * S)).toBe(e);
  });
});

describe('undo (-1)', () => {
  it('is disabled with no sets', () => {
    const d = started();
    expect(canUndo(d.active!)).toBe(false);
    expect(undoSet(d)).toBe(d);
  });

  it('while resting: cancels the rest and removes the set', () => {
    let d = startRest(started(), T0 + 10 * S);
    d = undoSet(d);
    expect(d.active!.rest).toBeNull();
    expect(d.active!.exercises[0]).toEqual({ sets: 0, rests: [] });
  });

  it('after a rest: removes the set and its rest', () => {
    let d = startRest(started(), T0 + 10 * S);
    d = endRest(d, T0 + 70 * S);
    d = startRest(d, T0 + 120 * S);
    d = endRest(d, T0 + 200 * S);
    d = undoSet(d);
    expect(d.active!.exercises[0]).toEqual({ sets: 1, rests: [60 * S] });
  });

  it('allows starting a rest right after an undo', () => {
    let d = startRest(started(), T0 + 10 * S);
    d = undoSet(d);
    d = startRest(d, T0 + 10 * S + 100);
    expect(d.active!.rest).not.toBeNull();
  });
});

describe('next exercise', () => {
  it('needs at least one set', () => {
    const d = started();
    expect(canNextExercise(d.active!)).toBe(false);
    expect(nextExercise(d)).toBe(d);
  });

  it('resets the counter for a new exercise', () => {
    let d = startRest(started(), T0 + 10 * S);
    d = endRest(d, T0 + 70 * S);
    d = nextExercise(d);
    expect(d.active!.exercises).toEqual([{ sets: 1, rests: [60 * S] }, { sets: 0, rests: [] }]);
  });

  it('during a rest: the rest keeps running and is saved to the previous exercise', () => {
    let d = startRest(started(), T0 + 10 * S);
    d = nextExercise(d);
    expect(d.active!.rest).toEqual({ start: T0 + 10 * S, exercise: 0 });
    d = endRest(d, T0 + 100 * S);
    expect(d.active!.exercises).toEqual([{ sets: 1, rests: [90 * S] }, { sets: 0, rests: [] }]);
  });

  it('-1 on an empty exercise undoes the "Next exercise" tap', () => {
    let d = startRest(started(), T0 + 10 * S);
    d = endRest(d, T0 + 70 * S);
    d = nextExercise(d);
    expect(canUndo(d.active!)).toBe(true);
    d = undoSet(d);
    expect(d.active!.exercises).toEqual([{ sets: 1, rests: [60 * S] }]);
    // Back on exercise 1: the next -1 removes its set as usual.
    d = undoSet(d);
    expect(d.active!.exercises).toEqual([{ sets: 0, rests: [] }]);
    expect(canUndo(d.active!)).toBe(false);
  });

  it('-1 on an empty exercise during a rest keeps the rest running on the previous one', () => {
    let d = startRest(started(), T0 + 10 * S);
    d = nextExercise(d);
    d = undoSet(d);
    expect(d.active!.exercises).toEqual([{ sets: 1, rests: [] }]);
    expect(d.active!.rest).toEqual({ start: T0 + 10 * S, exercise: 0 });
    d = endRest(d, T0 + 40 * S);
    expect(d.active!.exercises).toEqual([{ sets: 1, rests: [30 * S] }]);
  });
});

describe('ending, resuming, saving', () => {
  it('ending keeps the last set and never records the open rest (it is not a rest between sets)', () => {
    let d = startRest(started(), T0 + 10 * S);
    d = endRest(d, T0 + 70 * S);
    d = startRest(d, T0 + 120 * S);
    d = endWorkout(d, T0 + 900 * S);
    expect(d.active!.endedAt).toBe(T0 + 900 * S);
    expect(d.active!.exercises[0]).toEqual({ sets: 2, rests: [60 * S] });
    expect(activeToWorkout(d.active!, 'w')!.exercises).toEqual([{ sets: 2, rests: [60 * S] }]);
  });

  it('back to workout after ending during a rest brings the rest timer back', () => {
    let d = startRest(started(), T0 + 10 * S);
    d = endWorkout(d, T0 + 40 * S);
    d = resumeWorkout(d);
    expect(d.active!.rest).toEqual({ start: T0 + 10 * S, exercise: 0 });
    d = endRest(d, T0 + 100 * S);
    expect(d.active!.exercises[0]).toEqual({ sets: 1, rests: [90 * S] });
  });

  it('no actions are possible on an ended workout', () => {
    const d = endWorkout(started(), T0 + 40 * S);
    expect(startRest(d, T0 + 50 * S)).toBe(d);
    expect(canUndo(d.active!)).toBe(false);
  });

  it('resume clears the end time', () => {
    const d = resumeWorkout(endWorkout(started(), T0 + 40 * S));
    expect(d.active!.endedAt).toBeNull();
  });

  it('save stores the workout and drops empty exercises', () => {
    let d = startRest(started(), T0 + 10 * S);
    d = endRest(d, T0 + 70 * S);
    d = nextExercise(d);
    d = endWorkout(d, T0 + 3600 * S);
    d = saveActiveWorkout(d, 'w1');
    expect(d.active).toBeNull();
    expect(d.workouts).toEqual([{ id: 'w1', typeId: 'push', start: T0, end: T0 + 3600 * S, manual: false, exercises: [{ sets: 1, rests: [60 * S] }] }]);
  });

  it('cannot save before ending', () => {
    const d = started();
    expect(saveActiveWorkout(d, 'x')).toBe(d);
    expect(activeToWorkout(d.active!, 'x')).toBeNull();
  });

  it('discard drops the workout', () => {
    const d = discardActiveWorkout(endWorkout(started(), T0 + 10 * S));
    expect(d.active).toBeNull();
    expect(d.workouts).toEqual([]);
  });
});

describe('manual workouts', () => {
  const now = T0 + 5 * 3600 * S;
  it('validates input', () => {
    const d = createDefaultData();
    expect(validateWorkoutInput(d, { typeId: 'football', start: T0, end: T0 + 5400 * S }, now)).toBeNull();
    expect(validateWorkoutInput(d, { typeId: 'nope', start: T0, end: T0 + 1 }, now)).toBe('Pick a workout type');
    expect(validateWorkoutInput(d, { typeId: 'football', start: T0, end: T0 }, now)).toMatch(/after the start/);
    expect(validateWorkoutInput(d, { typeId: 'football', start: T0, end: T0 - 1 }, now)).toMatch(/after the start/);
    expect(validateWorkoutInput(d, { typeId: 'football', start: now + 1, end: now + 2 }, now)).toMatch(/hasn't started/);
    expect(validateWorkoutInput(d, { typeId: 'football', start: T0, end: T0 + 25 * 3600 * S }, now)).toMatch(/24 hours/);
    expect(validateWorkoutInput(d, { typeId: 'football', start: NaN, end: T0 }, now)).toMatch(/date/);
  });

  it('allows keeping a deleted type only when editing a workout that already had it', () => {
    let d = addManualWorkout(createDefaultData(), { typeId: 'push', start: T0, end: T0 + 1000 }, 'w1');
    d = { ...d, types: d.types.map((t) => (t.id === 'push' ? { ...t, deleted: true } : t)) };
    const input = { typeId: 'push', start: T0, end: T0 + 2000 };
    expect(validateWorkoutInput(d, input, now, 'w1')).toBeNull();
    expect(validateWorkoutInput(d, input, now)).toBe('Pick a workout type');
  });

  it('adds, updates and deletes', () => {
    let d = addManualWorkout(createDefaultData(), { typeId: 'football', start: T0, end: T0 + 5400 * S }, 'm1');
    expect(d.workouts[0]).toEqual({ id: 'm1', typeId: 'football', start: T0, end: T0 + 5400 * S, manual: true, exercises: [] });
    d = updateWorkout(d, 'm1', { typeId: 'push', start: T0 + 1, end: T0 + 2 });
    expect(d.workouts[0]).toMatchObject({ typeId: 'push', start: T0 + 1, end: T0 + 2, manual: true });
    expect(updateWorkout(d, 'zzz', { typeId: 'push', start: 1, end: 2 })).toBe(d);
    d = deleteWorkout(d, 'm1');
    expect(d.workouts).toEqual([]);
  });
});

describe('helpers', () => {
  it('totals and averages', () => {
    const ex = [{ sets: 3, rests: [60 * S, 90 * S] }, { sets: 2, rests: [120 * S] }];
    expect(totalSets(ex)).toBe(5);
    expect(avgRest(ex)).toBe(90 * S);
    expect(avgRest([{ sets: 1, rests: [] }])).toBeNull();
    expect(workoutDuration({ start: 10, end: 5 })).toBe(0);
  });

  it('cleanExercises trims rests to the set count', () => {
    expect(cleanExercises([{ sets: 1, rests: [1, 2] }, { sets: 0, rests: [] }])).toEqual([{ sets: 1, rests: [1] }]);
  });
});
