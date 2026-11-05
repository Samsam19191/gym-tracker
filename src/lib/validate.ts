import { isDayKey } from './dates';
import { defaultSettings } from './defaults';
import type { ActiveWorkout, AppData, Exercise, Machine, Settings, WeightEntry, Workout, WorkoutType } from './model';

export class DataError extends Error {}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);

function fail(what: string): never {
  throw new DataError(`Invalid data: ${what}`);
}

function arr(v: unknown, what: string): unknown[] {
  if (!Array.isArray(v)) fail(`${what} should be a list`);
  return v;
}

function exercise(v: unknown, where: string): Exercise {
  if (!isObj(v) || !isNum(v.sets) || v.sets < 0 || !Number.isInteger(v.sets)) fail(`${where} sets`);
  const rests = arr(v.rests, `${where} rests`);
  if (!rests.every((r) => isNum(r) && r >= 0)) fail(`${where} rests`);
  return { sets: v.sets, rests: (rests as number[]).slice(0, v.sets) };
}

function type(v: unknown, i: number): WorkoutType {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name) || !isStr(v.color) || !isNum(v.order)) fail(`workout type #${i + 1}`);
  if (v.kind !== 'gym' && v.kind !== 'activity') fail(`workout type #${i + 1} kind`);
  const t: WorkoutType = { id: v.id, name: v.name, color: v.color, kind: v.kind, order: v.order };
  if (v.deleted === true) t.deleted = true;
  return t;
}

function workout(v: unknown, i: number): Workout {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.typeId) || !isNum(v.start) || !isNum(v.end) || typeof v.manual !== 'boolean') fail(`workout #${i + 1}`);
  const exercises = arr(v.exercises, `workout #${i + 1} exercises`).map((e) => exercise(e, `workout #${i + 1}`));
  return { id: v.id, typeId: v.typeId, start: v.start, end: v.end, manual: v.manual, exercises };
}

function machine(v: unknown, i: number): Machine {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name) || !(v.typeId === null || isStr(v.typeId)) || !isNum(v.createdAt)) fail(`machine #${i + 1}`);
  return { id: v.id, name: v.name, typeId: v.typeId, createdAt: v.createdAt };
}

function weight(v: unknown, i: number): WeightEntry {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.machineId) || !isDayKey(v.date) || !isNum(v.kg) || v.kg <= 0) fail(`weight #${i + 1}`);
  return { id: v.id, machineId: v.machineId, date: v.date, kg: v.kg };
}

function active(v: unknown): ActiveWorkout | null {
  if (v === null || v === undefined) return null;
  if (!isObj(v) || !isStr(v.typeId) || !isNum(v.start) || !isNumOrNull(v.endedAt)) fail('current workout');
  const exercises = arr(v.exercises, 'current workout exercises').map((e) => exercise(e, 'current workout'));
  if (exercises.length === 0) fail('current workout exercises');
  let rest: ActiveWorkout['rest'] = null;
  if (v.rest !== null && v.rest !== undefined) {
    const r = v.rest;
    if (!isObj(r) || !isNum(r.start) || !isNum(r.exercise) || r.exercise < 0 || r.exercise >= exercises.length) fail('current rest');
    rest = { start: r.start, exercise: r.exercise };
  }
  return { typeId: v.typeId, start: v.start, exercises, rest, endedAt: v.endedAt, lastToggleAt: isNum(v.lastToggleAt) ? v.lastToggleAt : null };
}

function settings(v: unknown): Settings {
  const s = defaultSettings();
  if (!isObj(v)) return s;
  if (typeof v.keepScreenOn === 'boolean') s.keepScreenOn = v.keepScreenOn;
  if (v.restTargetSec === null || (isNum(v.restTargetSec) && v.restTargetSec > 0)) s.restTargetSec = v.restTargetSec;
  if (typeof v.restSound === 'boolean') s.restSound = v.restSound;
  if (isNumOrNull(v.lastBackupAt)) s.lastBackupAt = v.lastBackupAt;
  if (isNumOrNull(v.backupSnoozeUntil)) s.backupSnoozeUntil = v.backupSnoozeUntil;
  return s;
}

/** Validates unknown JSON into AppData. Throws DataError with a readable message. */
export function parseAppData(raw: unknown): AppData {
  if (!isObj(raw)) fail('not an object');
  if (raw.version !== 1) fail(`unsupported version ${String(raw.version)}`);
  const types = arr(raw.types, 'workout types').map(type);
  const workouts = arr(raw.workouts, 'workouts').map(workout);
  const machines = arr(raw.machines, 'machines').map(machine);
  const weights = arr(raw.weights, 'weights').map(weight);
  return { version: 1, types, workouts, machines, weights, active: active(raw.active), settings: settings(raw.settings) };
}

function keepValid<T>(items: unknown[], parse: (v: unknown, i: number) => T): { ok: T[]; bad: number } {
  const ok: T[] = [];
  let bad = 0;
  items.forEach((v, i) => {
    try {
      ok.push(parse(v, i));
    } catch {
      bad++;
    }
  });
  return { ok, bad };
}

/**
 * Like parseAppData, but one damaged record (a workout, a weight...) is skipped instead of
 * making everything unreadable. Only a broken overall structure still throws.
 */
export function parseAppDataLenient(raw: unknown): { data: AppData; dropped: number } {
  if (!isObj(raw)) fail('not an object');
  if (raw.version !== 1) fail(`unsupported version ${String(raw.version)}`);
  const types = keepValid(arr(raw.types, 'workout types'), type);
  const workouts = keepValid(arr(raw.workouts, 'workouts'), workout);
  const machines = keepValid(arr(raw.machines, 'machines'), machine);
  const weights = keepValid(arr(raw.weights, 'weights'), weight);
  let activeWorkout: ActiveWorkout | null = null;
  let activeBad = 0;
  try {
    activeWorkout = active(raw.active);
  } catch {
    activeBad = 1;
  }
  const dropped = types.bad + workouts.bad + machines.bad + weights.bad + activeBad;
  return {
    data: { version: 1, types: types.ok, workouts: workouts.ok, machines: machines.ok, weights: weights.ok, active: activeWorkout, settings: settings(raw.settings) },
    dropped,
  };
}
