import { cleanName, NAME_MAX } from './catalog';
import { addMonths, parseDayKey } from './dates';
import type { AppData, Machine, WeightEntry } from './model';

export const KG_STEP = 2.5;
export const KG_MAX = 1000;
export const DEFAULT_START_KG = 20;

export function entriesFor(d: AppData, machineId: string): WeightEntry[] {
  return d.weights.filter((w) => w.machineId === machineId).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function bestKg(entries: WeightEntry[]): number | null {
  return entries.length ? Math.max(...entries.map((e) => e.kg)) : null;
}

/** Weight of the most recent day logged. */
export function lastKg(entries: WeightEntry[]): number | null {
  let last: WeightEntry | null = null;
  for (const e of entries) if (!last || e.date >= last.date) last = e;
  return last ? last.kg : null;
}

export function lastDate(entries: WeightEntry[]): string | null {
  let last: string | null = null;
  for (const e of entries) if (!last || e.date > last) last = e.date;
  return last;
}

export function parseKg(input: string): number | null {
  const v = Number(input.replace(',', '.').trim());
  if (!input.trim() || !Number.isFinite(v) || v <= 0 || v > KG_MAX) return null;
  return Math.round(v * 100) / 100;
}

export type LogResult = 'added' | 'raised' | 'kept';

/** One entry per machine per day: logging again the same day keeps the higher weight. */
export function logWeight(d: AppData, machineId: string, date: string, kg: number, id: string): { data: AppData; result: LogResult } {
  const existing = d.weights.find((w) => w.machineId === machineId && w.date === date);
  if (!existing) return { data: { ...d, weights: [...d.weights, { id, machineId, date, kg }] }, result: 'added' };
  if (kg <= existing.kg) return { data: d, result: 'kept' };
  return { data: { ...d, weights: d.weights.map((w) => (w.id === existing.id ? { ...w, kg } : w)) }, result: 'raised' };
}

export function deleteWeight(d: AppData, id: string): AppData {
  return { ...d, weights: d.weights.filter((w) => w.id !== id) };
}

export function validateMachineName(d: AppData, name: string, excludeId?: string): string | null {
  const n = cleanName(name);
  if (!n) return 'Give it a name';
  if (n.length > NAME_MAX) return `Keep it under ${NAME_MAX} characters`;
  const taken = d.machines.some((m) => m.id !== excludeId && m.name.toLowerCase() === n.toLowerCase());
  return taken ? 'You already have a machine with this name' : null;
}

export function addMachine(d: AppData, input: { name: string; typeId: string | null }, id: string, now: number): AppData {
  const m: Machine = { id, name: cleanName(input.name), typeId: input.typeId, createdAt: now };
  return { ...d, machines: [...d.machines, m] };
}

export function updateMachine(d: AppData, id: string, input: { name: string; typeId: string | null }): AppData {
  return { ...d, machines: d.machines.map((m) => (m.id === id ? { ...m, name: cleanName(input.name), typeId: input.typeId } : m)) };
}

export function deleteMachine(d: AppData, id: string): AppData {
  return { ...d, machines: d.machines.filter((m) => m.id !== id), weights: d.weights.filter((w) => w.machineId !== id) };
}

export type Range = '3M' | '6M' | 'ALL';

export function rangeEntries(entries: WeightEntry[], range: Range, today: number): WeightEntry[] {
  if (range === 'ALL') return entries;
  const from = addMonths(today, range === '3M' ? -3 : -6);
  return entries.filter((e) => parseDayKey(e.date).getTime() >= new Date(from).setHours(0, 0, 0, 0));
}

/** Best weight vs the first weight ever logged. */
export function progressSince(entries: WeightEntry[]): { delta: number; since: string } | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const best = bestKg(sorted)!;
  return { delta: Math.round((best - sorted[0].kg) * 100) / 100, since: sorted[0].date };
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export interface MachineRow {
  machine: Machine;
  best: number | null;
  last: string | null;
  series: number[];
}

export function machineRows(d: AppData, filterTypeId: string | null, query: string): MachineRow[] {
  const q = normalize(query);
  return d.machines
    .filter((m) => (filterTypeId ? m.typeId === filterTypeId : true))
    .filter((m) => (q ? normalize(m.name).includes(q) : true))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((machine) => {
      const entries = entriesFor(d, machine.id);
      return { machine, best: bestKg(entries), last: lastDate(entries), series: entries.map((e) => e.kg) };
    });
}
