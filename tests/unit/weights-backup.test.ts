import { describe, expect, it } from 'vitest';
import { applyImport, backupFileName, makeBackup, markBackedUp, readBackup, shouldRemindBackup, snoozeBackup } from '../../src/lib/backup';
import { createDefaultData } from '../../src/lib/defaults';
import type { AppData } from '../../src/lib/model';
import { loadData, saveData, STORAGE_KEY } from '../../src/lib/storage';
import { parseAppData } from '../../src/lib/validate';
import {
  addMachine,
  bestKg,
  deleteMachine,
  deleteWeight,
  entriesFor,
  lastDate,
  lastKg,
  logWeight,
  machineRows,
  parseKg,
  progressSince,
  rangeEntries,
  updateMachine,
  validateMachineName,
} from '../../src/lib/weights';
import { addManualWorkout, startWorkout } from '../../src/lib/workout';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 5, 12).getTime();

function withMachine(): AppData {
  return addMachine(createDefaultData(), { name: 'Chest press', typeId: 'push' }, 'm1', NOW);
}

describe('machines', () => {
  it('validates names (empty, duplicate ignoring case, length)', () => {
    const d = withMachine();
    expect(validateMachineName(d, ' ')).toBe('Give it a name');
    expect(validateMachineName(d, 'chest PRESS')).toMatch(/already/);
    expect(validateMachineName(d, 'Chest press', 'm1')).toBeNull();
    expect(validateMachineName(d, 'y'.repeat(40))).toMatch(/under/);
  });

  it('adds, renames, retags', () => {
    let d = withMachine();
    expect(d.machines[0]).toEqual({ id: 'm1', name: 'Chest press', typeId: 'push', createdAt: NOW });
    d = updateMachine(d, 'm1', { name: ' Bench  press ', typeId: null });
    expect(d.machines[0]).toMatchObject({ name: 'Bench press', typeId: null });
  });

  it('deleting a machine deletes its weights only', () => {
    let d = withMachine();
    d = addMachine(d, { name: 'Row', typeId: 'pull' }, 'm2', NOW);
    d = logWeight(d, 'm1', '2026-11-01', 60, 'a').data;
    d = logWeight(d, 'm2', '2026-11-01', 50, 'b').data;
    d = deleteMachine(d, 'm1');
    expect(d.machines.map((m) => m.id)).toEqual(['m2']);
    expect(d.weights.map((x) => x.id)).toEqual(['b']);
  });
});

describe('weights', () => {
  it('one entry per day, keeping the higher weight', () => {
    let d = withMachine();
    let r = logWeight(d, 'm1', '2026-11-05', 60, 'a');
    expect(r.result).toBe('added');
    d = r.data;
    r = logWeight(d, 'm1', '2026-11-05', 55, 'b');
    expect(r.result).toBe('kept');
    expect(r.data).toBe(d);
    r = logWeight(d, 'm1', '2026-11-05', 62.5, 'c');
    expect(r.result).toBe('raised');
    expect(entriesFor(r.data, 'm1')).toEqual([{ id: 'a', machineId: 'm1', date: '2026-11-05', kg: 62.5 }]);
  });

  it('best, last, progress, delete', () => {
    let d = withMachine();
    d = logWeight(d, 'm1', '2026-07-07', 57.5, 'a').data;
    d = logWeight(d, 'm1', '2026-11-03', 70, 'c').data;
    d = logWeight(d, 'm1', '2026-10-28', 67.5, 'b').data;
    const e = entriesFor(d, 'm1');
    expect(e.map((x) => x.date)).toEqual(['2026-07-07', '2026-10-28', '2026-11-03']);
    expect(bestKg(e)).toBe(70);
    expect(lastKg(e)).toBe(70);
    expect(lastDate(e)).toBe('2026-11-03');
    expect(progressSince(e)).toEqual({ delta: 12.5, since: '2026-07-07' });
    d = deleteWeight(d, 'c');
    expect(bestKg(entriesFor(d, 'm1'))).toBe(67.5);
    expect(bestKg([])).toBeNull();
    expect(lastKg([])).toBeNull();
    expect(progressSince(e.slice(0, 1))).toBeNull();
  });

  it('last weight is the most recent day, not the best', () => {
    let d = withMachine();
    d = logWeight(d, 'm1', '2026-11-01', 70, 'a').data;
    d = logWeight(d, 'm1', '2026-11-04', 65, 'b').data;
    expect(lastKg(entriesFor(d, 'm1'))).toBe(65);
  });

  it('chart ranges', () => {
    let d = withMachine();
    d = logWeight(d, 'm1', '2026-04-01', 50, 'a').data;
    d = logWeight(d, 'm1', '2026-06-01', 55, 'b').data;
    d = logWeight(d, 'm1', '2026-09-01', 60, 'c').data;
    const e = entriesFor(d, 'm1');
    expect(rangeEntries(e, '3M', NOW).map((x) => x.id)).toEqual(['c']);
    expect(rangeEntries(e, '6M', NOW).map((x) => x.id)).toEqual(['b', 'c']);
    expect(rangeEntries(e, 'ALL', NOW).length).toBe(3);
  });

  it('parses typed weights', () => {
    expect(parseKg('72,5')).toBe(72.5);
    expect(parseKg(' 40 ')).toBe(40);
    expect(parseKg('')).toBeNull();
    expect(parseKg('0')).toBeNull();
    expect(parseKg('-5')).toBeNull();
    expect(parseKg('abc')).toBeNull();
    expect(parseKg('5000')).toBeNull();
  });

  it('machine list: filter, accent-insensitive search, sorted by name', () => {
    let d = withMachine();
    d = addMachine(d, { name: 'Élévations latérales', typeId: 'shoulders' }, 'm2', NOW);
    d = addMachine(d, { name: 'Ab crunch', typeId: null }, 'm3', NOW);
    d = logWeight(d, 'm1', '2026-11-01', 60, 'a').data;
    expect(machineRows(d, null, '').map((r) => r.machine.id)).toEqual(['m3', 'm1', 'm2']);
    expect(machineRows(d, 'push', '').map((r) => r.machine.id)).toEqual(['m1']);
    expect(machineRows(d, null, 'elev').map((r) => r.machine.id)).toEqual(['m2']);
    expect(machineRows(d, null, 'CHEST')[0]).toMatchObject({ best: 60, last: '2026-11-01', series: [60] });
    expect(machineRows(d, null, 'zzz')).toEqual([]);
  });
});

describe('validation', () => {
  it('accepts default and full data', () => {
    let d = withMachine();
    d = logWeight(d, 'm1', '2026-11-01', 60, 'a').data;
    d = addManualWorkout(d, { typeId: 'football', start: NOW - DAY, end: NOW - DAY + 5400000 }, 'w1');
    d = startWorkout(d, 'push', NOW);
    expect(parseAppData(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it('rejects broken data with a message', () => {
    expect(() => parseAppData(null)).toThrow(/not an object/);
    expect(() => parseAppData({ ...createDefaultData(), version: 2 })).toThrow(/version/);
    expect(() => parseAppData({ ...createDefaultData(), workouts: 'x' })).toThrow(/workouts/);
    expect(() => parseAppData({ ...createDefaultData(), workouts: [{ id: 'x' }] })).toThrow(/workout #1/);
    expect(() => parseAppData({ ...createDefaultData(), weights: [{ id: 'a', machineId: 'm', date: '2026-13-01', kg: 5 }] })).toThrow(/weight #1/);
    expect(() => parseAppData({ ...createDefaultData(), types: [{ id: 'a', name: 'A', color: '#fff', order: 0, kind: 'x' }] })).toThrow(/kind/);
  });

  it('fills missing settings with defaults', () => {
    const raw = { ...createDefaultData(), settings: { keepScreenOn: false } };
    const d = parseAppData(raw);
    expect(d.settings.keepScreenOn).toBe(false);
    expect(d.settings.restTargetSec).toBe(90);
  });
});

describe('backup', () => {
  it('round-trips and never restores a running workout', () => {
    let d = withMachine();
    d = startWorkout(d, 'push', NOW);
    const text = makeBackup(d, NOW);
    const back = readBackup(text);
    expect(back.exportedAt).toBe(NOW);
    expect(back.data.active).toBeNull();
    expect(back.data.machines).toEqual(d.machines);
  });

  it('rejects other files', () => {
    expect(() => readBackup('hello')).toThrow(/isn't a Gym Tracker backup/);
    expect(() => readBackup('{"foo":1}')).toThrow(/isn't a Gym Tracker backup/);
    expect(() => readBackup('{"app":"gym-tracker","data":{"version":1}}')).toThrow(/Invalid data/);
  });

  it('file name', () => {
    expect(backupFileName(NOW)).toBe('gym-tracker-backup-2026-11-05.json');
  });

  it('reminder after 30 days, snooze for 7', () => {
    const empty = createDefaultData();
    expect(shouldRemindBackup(empty, NOW)).toBe(false);
    const old = addManualWorkout(empty, { typeId: 'push', start: NOW - 31 * DAY, end: NOW - 31 * DAY + 1000 }, 'w');
    expect(shouldRemindBackup(old, NOW)).toBe(true);
    const fresh = addManualWorkout(empty, { typeId: 'push', start: NOW - 3 * DAY, end: NOW - 3 * DAY + 1000 }, 'w');
    expect(shouldRemindBackup(fresh, NOW)).toBe(false);
    const snoozed = snoozeBackup(old, NOW);
    expect(shouldRemindBackup(snoozed, NOW + 6 * DAY)).toBe(false);
    expect(shouldRemindBackup(snoozed, NOW + 8 * DAY)).toBe(true);
    const backed = markBackedUp(old, NOW);
    expect(shouldRemindBackup(backed, NOW + 29 * DAY)).toBe(false);
    expect(shouldRemindBackup(backed, NOW + 31 * DAY)).toBe(true);
  });

  it('import keeps this device backup date', () => {
    const current = markBackedUp(createDefaultData(), NOW);
    const imported = { ...withMachine(), settings: { ...withMachine().settings, lastBackupAt: 1 } };
    const merged = applyImport(current, imported);
    expect(merged.settings.lastBackupAt).toBe(NOW);
    expect(merged.machines.length).toBe(1);
  });
});

class MemStorage implements Storage {
  m = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.m.set(k, v);
  }
}

describe('storage', () => {
  it('first run returns defaults', () => {
    expect(loadData(new MemStorage(), NOW)).toEqual({ data: createDefaultData(), warning: null });
  });

  it('save then load', () => {
    const s = new MemStorage();
    const d = withMachine();
    expect(saveData(s, d)).toBe(true);
    expect(loadData(s, NOW).data).toEqual(d);
  });

  it('damaged data is set aside, not destroyed', () => {
    const s = new MemStorage();
    s.setItem(STORAGE_KEY, '{broken');
    const r = loadData(s, NOW);
    expect(r.warning).toMatch(/damaged/);
    expect(r.data).toEqual(createDefaultData());
    expect(s.getItem(`${STORAGE_KEY}:corrupt:${NOW}`)).toBe('{broken');
  });

  it('reports failed writes', () => {
    const s = new MemStorage();
    s.failWrites = true;
    expect(saveData(s, createDefaultData())).toBe(false);
  });
});
