import { describe, expect, it } from 'vitest';
import { activityTypes, addType, canDeleteType, deleteType, gymTypes, liveTypes, moveType, nextColor, typeById, updateType, validateTypeName } from '../../src/lib/catalog';
import { createDefaultData } from '../../src/lib/defaults';
import type { AppData, Workout } from '../../src/lib/model';
import { lastWorkoutOfType, monthStats, typeCounts, upNextTypeId, weekStrip, weekSummary, workoutsInMonth, workoutsOnDay } from '../../src/lib/stats';
import { addMachine } from '../../src/lib/weights';
import { startWorkout } from '../../src/lib/workout';

const at = (y: number, m: number, d: number, h = 18, min = 0) => new Date(y, m, d, h, min).getTime();
const MIN = 60_000;

function w(id: string, typeId: string, start: number, minutes: number): Workout {
  return { id, typeId, start, end: start + minutes * MIN, manual: false, exercises: [] };
}

function withWorkouts(ws: Workout[]): AppData {
  return { ...createDefaultData(), workouts: ws };
}

describe('workout types', () => {
  it('defaults: 3 gym types and Football as an activity', () => {
    const d = createDefaultData();
    expect(gymTypes(d).map((t) => t.name)).toEqual(['Push', 'Pull', 'Shoulders']);
    expect(activityTypes(d).map((t) => t.name)).toEqual(['Football']);
  });

  it('validates names', () => {
    const d = createDefaultData();
    expect(validateTypeName(d, '   ')).toBe('Give it a name');
    expect(validateTypeName(d, 'push')).toMatch(/already/);
    expect(validateTypeName(d, 'Push', 'push')).toBeNull();
    expect(validateTypeName(d, 'x'.repeat(33))).toMatch(/under/);
    expect(validateTypeName(d, 'Legs')).toBeNull();
  });

  it('adds with the next order and a free color, trims the name', () => {
    const d0 = createDefaultData();
    const color = nextColor(d0);
    expect(liveTypes(d0).map((t) => t.color.toLowerCase())).not.toContain(color.toLowerCase());
    const d = addType(d0, { name: '  Legs   day ', color, kind: 'gym' }, 'legs');
    const legs = d.types.find((t) => t.id === 'legs')!;
    expect(legs.name).toBe('Legs day');
    expect(legs.order).toBe(4);
    expect(gymTypes(d).map((t) => t.id)).toEqual(['push', 'pull', 'shoulders', 'legs']);
  });

  it('updates name, color and kind', () => {
    const d = updateType(createDefaultData(), 'football', { name: 'Match', color: '#fff', kind: 'gym' });
    expect(typeById(d, 'football')).toMatchObject({ name: 'Match', color: '#fff', kind: 'gym' });
  });

  it('reorders, and ignores moves past the ends', () => {
    let d = moveType(createDefaultData(), 'shoulders', -1);
    expect(liveTypes(d).map((t) => t.id)).toEqual(['push', 'shoulders', 'pull', 'football']);
    expect(moveType(d, 'push', -1)).toBe(d);
    expect(moveType(d, 'football', 1)).toBe(d);
    d = moveType(d, 'push', 1);
    expect(liveTypes(d).map((t) => t.id)).toEqual(['shoulders', 'push', 'pull', 'football']);
  });

  it('soft-deletes: hidden from lists, kept for history, machines untagged', () => {
    let d = addMachine(createDefaultData(), { name: 'Chest press', typeId: 'push' }, 'm1', 0);
    d = deleteType(d, 'push');
    expect(liveTypes(d).map((t) => t.id)).not.toContain('push');
    expect(typeById(d, 'push').name).toBe('Push');
    expect(d.machines[0].typeId).toBeNull();
    expect(validateTypeName(d, 'Push')).toBeNull();
  });

  it('cannot delete the type of the running workout', () => {
    const d = startWorkout(createDefaultData(), 'pull', 0);
    expect(canDeleteType(d, 'pull')).toMatch(/Finish/);
    expect(deleteType(d, 'pull')).toBe(d);
  });

  it('unknown type ids resolve to a placeholder', () => {
    expect(typeById(createDefaultData(), 'ghost').name).toBe('Unknown');
  });
});

describe('up next rotation', () => {
  it('starts with the first gym type', () => {
    expect(upNextTypeId(createDefaultData())).toBe('push');
  });

  it('follows the order after the last gym workout, ignoring activities', () => {
    const d = withWorkouts([w('1', 'push', at(2026, 10, 3), 60), w('2', 'pull', at(2026, 10, 4), 50), w('3', 'football', at(2026, 10, 4, 21), 90)]);
    expect(upNextTypeId(d)).toBe('shoulders');
  });

  it('wraps around', () => {
    expect(upNextTypeId(withWorkouts([w('1', 'shoulders', at(2026, 10, 1), 60)]))).toBe('push');
  });

  it('restarts at the first type when the last type was deleted', () => {
    const d = deleteType(withWorkouts([w('1', 'pull', at(2026, 10, 1), 60)]), 'pull');
    expect(upNextTypeId(d)).toBe('push');
  });

  it('returns null with no gym types', () => {
    let d = createDefaultData();
    for (const id of ['push', 'pull', 'shoulders']) d = deleteType(d, id);
    expect(upNextTypeId(d)).toBeNull();
  });
});

describe('month and week stats', () => {
  const oct = [w('a', 'push', at(2026, 9, 1), 60), w('b', 'pull', at(2026, 9, 2), 50), w('c', 'push', at(2026, 9, 28), 58)];
  const d = withWorkouts([...oct, w('n', 'pull', at(2026, 10, 4), 52), w('s', 'push', at(2026, 8, 30, 23, 30), 60)]);

  it('filters a month (newest first) and a day', () => {
    expect(workoutsInMonth(d, 2026, 9).map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(workoutsOnDay(d, '2026-09-30').map((x) => x.id)).toEqual(['s']);
  });

  it('past month: per week over the whole month', () => {
    const s = monthStats(workoutsInMonth(d, 2026, 9), 2026, 9, at(2026, 10, 5));
    expect(s.count).toBe(3);
    expect(s.avgDurationMs).toBe(56 * MIN);
    expect(s.perWeek).toBeCloseTo(3 / (31 / 7));
  });

  it('current month: per week over the days so far', () => {
    const s = monthStats(workoutsInMonth(d, 2026, 10), 2026, 10, at(2026, 10, 7, 10));
    expect(s.perWeek).toBeCloseTo(1);
  });

  it('future or empty months', () => {
    expect(monthStats([], 2026, 11, at(2026, 10, 5))).toEqual({ count: 0, avgDurationMs: null, perWeek: null });
    expect(monthStats([], 2026, 8, at(2026, 10, 5)).perWeek).toBe(0);
  });

  it('type counts', () => {
    expect(Object.fromEntries(typeCounts(oct))).toEqual({ push: 2, pull: 1 });
  });

  it('week strip runs Monday to Sunday with today flagged', () => {
    const now = at(2026, 10, 5, 9);
    const days = weekStrip(d, now);
    expect(days.map((x) => x.key)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect(days[3].isToday).toBe(true);
    expect(days[4].isFuture).toBe(true);
    expect(days[2].workouts.map((x) => x.id)).toEqual(['n']);
    expect(weekSummary(d, now)).toEqual({ count: 1, totalMs: 52 * MIN });
  });

  it('last workout of a type', () => {
    expect(lastWorkoutOfType(d, 'push')!.id).toBe('c');
    expect(lastWorkoutOfType(d, 'shoulders')).toBeUndefined();
  });
});
