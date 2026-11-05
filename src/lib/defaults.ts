import type { AppData, Settings, WorkoutType } from './model';

export const PALETTE = ['#FF8A5C', '#5CA8FF', '#B892FF', '#7BD66B', '#F472B6', '#FACC15', '#38BDF8', '#FB7185', '#2DD4BF', '#E2E8F0'];

export function defaultTypes(): WorkoutType[] {
  return [
    { id: 'push', name: 'Push', color: '#FF8A5C', kind: 'gym', order: 0 },
    { id: 'pull', name: 'Pull', color: '#5CA8FF', kind: 'gym', order: 1 },
    { id: 'shoulders', name: 'Shoulders', color: '#B892FF', kind: 'gym', order: 2 },
    { id: 'football', name: 'Football', color: '#7BD66B', kind: 'activity', order: 3 },
  ];
}

export function defaultSettings(): Settings {
  return {
    keepScreenOn: true,
    restTargetSec: 90,
    restSound: true,
    lastBackupAt: null,
    backupSnoozeUntil: null,
  };
}

export function createDefaultData(): AppData {
  return {
    version: 1,
    types: defaultTypes(),
    workouts: [],
    machines: [],
    weights: [],
    active: null,
    settings: defaultSettings(),
  };
}

export const REST_TARGET_OPTIONS: (number | null)[] = [null, 45, 60, 90, 120, 150, 180, 240];
