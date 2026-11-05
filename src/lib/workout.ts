import type { ActiveWorkout, AppData, Exercise, Workout } from './model';

/** Taps on the rest button closer together than this are treated as an accidental double tap. */
export const TOGGLE_GUARD_MS = 600;

const withActive = (d: AppData, active: ActiveWorkout | null): AppData => ({ ...d, active });

export function currentExerciseIndex(a: ActiveWorkout): number {
  return a.exercises.length - 1;
}

export function currentExercise(a: ActiveWorkout): Exercise {
  return a.exercises[a.exercises.length - 1];
}

export function isRunning(a: ActiveWorkout | null): a is ActiveWorkout {
  return !!a && a.endedAt === null;
}

export function startWorkout(d: AppData, typeId: string, now: number): AppData {
  if (d.active) return d;
  const type = d.types.find((t) => t.id === typeId && !t.deleted);
  if (!type) return d;
  return withActive(d, {
    typeId,
    start: now,
    exercises: [{ sets: 0, rests: [] }],
    rest: null,
    endedAt: null,
    lastToggleAt: null,
  });
}

function guarded(a: ActiveWorkout, now: number): boolean {
  return a.lastToggleAt !== null && now - a.lastToggleAt >= 0 && now - a.lastToggleAt < TOGGLE_GUARD_MS;
}

/** The user finished a set: count it and start resting. */
export function startRest(d: AppData, now: number): AppData {
  const a = d.active;
  if (!isRunning(a) || a.rest || guarded(a, now)) return d;
  const idx = currentExerciseIndex(a);
  const exercises = a.exercises.map((e, i) => (i === idx ? { ...e, sets: e.sets + 1 } : e));
  return withActive(d, { ...a, exercises, rest: { start: now, exercise: idx }, lastToggleAt: now });
}

function closeRest(a: ActiveWorkout, now: number): ActiveWorkout {
  if (!a.rest) return a;
  const { start, exercise } = a.rest;
  const duration = Math.max(0, now - start);
  const exercises = a.exercises.map((e, i) => (i === exercise ? { ...e, rests: [...e.rests, duration].slice(0, e.sets) } : e));
  return { ...a, exercises, rest: null };
}

export function endRest(d: AppData, now: number): AppData {
  const a = d.active;
  if (!isRunning(a) || !a.rest || guarded(a, now)) return d;
  return withActive(d, { ...closeRest(a, now), lastToggleAt: now });
}

export function canUndo(a: ActiveWorkout): boolean {
  return isRunning(a) && currentExercise(a).sets > 0;
}

/** Undo the last counted set of the current exercise (and its rest, if any). */
export function undoSet(d: AppData): AppData {
  const a = d.active;
  if (!a || !canUndo(a)) return d;
  const idx = currentExerciseIndex(a);
  const cur = a.exercises[idx];
  const sets = cur.sets - 1;
  const restIsOnCurrent = a.rest !== null && a.rest.exercise === idx;
  const exercises = a.exercises.map((e, i) => (i === idx ? { sets, rests: e.rests.slice(0, sets) } : e));
  return withActive(d, { ...a, exercises, rest: restIsOnCurrent ? null : a.rest, lastToggleAt: null });
}

export function canNextExercise(a: ActiveWorkout): boolean {
  return isRunning(a) && currentExercise(a).sets > 0;
}

/** Reset the set counter for a new exercise. A running rest keeps going and stays with the previous exercise. */
export function nextExercise(d: AppData): AppData {
  const a = d.active;
  if (!a || !canNextExercise(a)) return d;
  return withActive(d, { ...a, exercises: [...a.exercises, { sets: 0, rests: [] }] });
}

export function endWorkout(d: AppData, now: number): AppData {
  const a = d.active;
  if (!isRunning(a)) return d;
  return withActive(d, { ...closeRest(a, now), endedAt: Math.max(now, a.start) });
}

export function resumeWorkout(d: AppData): AppData {
  const a = d.active;
  if (!a || a.endedAt === null) return d;
  return withActive(d, { ...a, endedAt: null, lastToggleAt: null });
}

/** Exercises worth keeping: drop empty ones (e.g. "Next exercise" tapped at the very end). */
export function cleanExercises(exercises: Exercise[]): Exercise[] {
  return exercises.filter((e) => e.sets > 0).map((e) => ({ sets: e.sets, rests: e.rests.slice(0, e.sets) }));
}

export function activeToWorkout(a: ActiveWorkout, id: string): Workout | null {
  if (a.endedAt === null) return null;
  return { id, typeId: a.typeId, start: a.start, end: a.endedAt, manual: false, exercises: cleanExercises(a.exercises) };
}

export function saveActiveWorkout(d: AppData, id: string): AppData {
  const a = d.active;
  if (!a) return d;
  const w = activeToWorkout(a, id);
  if (!w) return d;
  return { ...d, active: null, workouts: [...d.workouts, w] };
}

export function discardActiveWorkout(d: AppData): AppData {
  return d.active ? withActive(d, null) : d;
}

export interface WorkoutInput {
  typeId: string;
  start: number;
  end: number;
}

export function validateWorkoutInput(d: AppData, input: WorkoutInput, now: number, editingId?: string): string | null {
  const type = d.types.find((t) => t.id === input.typeId);
  if (!type) return 'Pick a workout type';
  if (type.deleted) {
    const original = editingId ? d.workouts.find((w) => w.id === editingId) : undefined;
    if (!original || original.typeId !== input.typeId) return 'Pick a workout type';
  }
  if (!Number.isFinite(input.start) || !Number.isFinite(input.end)) return 'Enter a date and times';
  if (input.end <= input.start) return 'The end time must be after the start time';
  if (input.end - input.start > 24 * 3600_000) return 'A workout can last 24 hours at most';
  if (input.start > now) return "You can't log a workout that hasn't started yet";
  return null;
}

export function addManualWorkout(d: AppData, input: WorkoutInput, id: string): AppData {
  const w: Workout = { id, typeId: input.typeId, start: input.start, end: input.end, manual: true, exercises: [] };
  return { ...d, workouts: [...d.workouts, w] };
}

export function updateWorkout(d: AppData, id: string, input: WorkoutInput): AppData {
  if (!d.workouts.some((w) => w.id === id)) return d;
  return { ...d, workouts: d.workouts.map((w) => (w.id === id ? { ...w, typeId: input.typeId, start: input.start, end: input.end } : w)) };
}

export function deleteWorkout(d: AppData, id: string): AppData {
  return { ...d, workouts: d.workouts.filter((w) => w.id !== id) };
}

export function totalSets(exercises: Exercise[]): number {
  return exercises.reduce((n, e) => n + e.sets, 0);
}

export function avgRest(exercises: Exercise[]): number | null {
  const rests = exercises.flatMap((e) => e.rests);
  if (rests.length === 0) return null;
  return rests.reduce((a, b) => a + b, 0) / rests.length;
}

export function workoutDuration(w: Pick<Workout, 'start' | 'end'>): number {
  return Math.max(0, w.end - w.start);
}
