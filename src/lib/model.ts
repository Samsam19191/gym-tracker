export type TypeKind = 'gym' | 'activity';

export interface WorkoutType {
  id: string;
  name: string;
  color: string;
  /** gym = started live with the timer, activity = logged by hand (e.g. football) */
  kind: TypeKind;
  order: number;
  /** Deleted types stay in storage so past workouts keep their name and color. */
  deleted?: boolean;
}

export interface Exercise {
  sets: number;
  /** Rest durations in ms, one per finished rest. Never longer than `sets`. */
  rests: number[];
}

export interface Workout {
  id: string;
  typeId: string;
  start: number;
  end: number;
  /** true when logged by hand (no sets or rests recorded) */
  manual: boolean;
  exercises: Exercise[];
}

export interface ActiveRest {
  start: number;
  /** Index of the exercise the rest belongs to (the one whose set was just finished). */
  exercise: number;
}

export interface ActiveWorkout {
  typeId: string;
  start: number;
  exercises: Exercise[];
  rest: ActiveRest | null;
  /** Set when the user ends the workout and is looking at the summary. */
  endedAt: number | null;
  /** Time of the last rest toggle, used to ignore accidental double taps. */
  lastToggleAt: number | null;
}

export interface Machine {
  id: string;
  name: string;
  typeId: string | null;
  createdAt: number;
}

export interface WeightEntry {
  id: string;
  machineId: string;
  /** Local calendar day, YYYY-MM-DD */
  date: string;
  kg: number;
}

export interface Settings {
  keepScreenOn: boolean;
  /** null = no rest target */
  restTargetSec: number | null;
  restSound: boolean;
  lastBackupAt: number | null;
  backupSnoozeUntil: number | null;
}

export interface AppData {
  version: 1;
  types: WorkoutType[];
  workouts: Workout[];
  machines: Machine[];
  weights: WeightEntry[];
  active: ActiveWorkout | null;
  settings: Settings;
}
