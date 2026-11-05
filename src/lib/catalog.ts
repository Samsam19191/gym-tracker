import { PALETTE } from './defaults';
import type { AppData, TypeKind, WorkoutType } from './model';

export const NAME_MAX = 32;

export function liveTypes(d: AppData): WorkoutType[] {
  return d.types.filter((t) => !t.deleted).sort((a, b) => a.order - b.order);
}

export function gymTypes(d: AppData): WorkoutType[] {
  return liveTypes(d).filter((t) => t.kind === 'gym');
}

export function activityTypes(d: AppData): WorkoutType[] {
  return liveTypes(d).filter((t) => t.kind === 'activity');
}

const UNKNOWN: WorkoutType = { id: '?', name: 'Unknown', color: '#8C8C96', kind: 'gym', order: 999, deleted: true };

/** Includes deleted types, so old workouts still show their name and color. */
export function typeById(d: AppData, id: string | null | undefined): WorkoutType {
  return d.types.find((t) => t.id === id) ?? UNKNOWN;
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export function validateTypeName(d: AppData, name: string, excludeId?: string): string | null {
  const n = cleanName(name);
  if (!n) return 'Give it a name';
  if (n.length > NAME_MAX) return `Keep it under ${NAME_MAX} characters`;
  const taken = liveTypes(d).some((t) => t.id !== excludeId && t.name.toLowerCase() === n.toLowerCase());
  return taken ? 'You already have a type with this name' : null;
}

export function nextColor(d: AppData): string {
  const used = new Set(liveTypes(d).map((t) => t.color.toLowerCase()));
  return PALETTE.find((c) => !used.has(c.toLowerCase())) ?? PALETTE[liveTypes(d).length % PALETTE.length];
}

export interface TypeInput {
  name: string;
  color: string;
  kind: TypeKind;
}

export function addType(d: AppData, input: TypeInput, id: string): AppData {
  const order = d.types.reduce((m, t) => Math.max(m, t.order), -1) + 1;
  const t: WorkoutType = { id, name: cleanName(input.name), color: input.color, kind: input.kind, order };
  return { ...d, types: [...d.types, t] };
}

export function updateType(d: AppData, id: string, input: TypeInput): AppData {
  return { ...d, types: d.types.map((t) => (t.id === id ? { ...t, name: cleanName(input.name), color: input.color, kind: input.kind } : t)) };
}

/** Swap with the neighbouring live type. dir -1 = up, 1 = down. */
export function moveType(d: AppData, id: string, dir: -1 | 1): AppData {
  const list = liveTypes(d);
  const i = list.findIndex((t) => t.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return d;
  const a = list[i];
  const b = list[j];
  return { ...d, types: d.types.map((t) => (t.id === a.id ? { ...t, order: b.order } : t.id === b.id ? { ...t, order: a.order } : t)) };
}

export function canDeleteType(d: AppData, id: string): string | null {
  if (d.active && d.active.typeId === id) return 'Finish your current workout before deleting its type';
  return null;
}

/** Soft delete: past workouts keep the name and color; machines lose their tag. */
export function deleteType(d: AppData, id: string): AppData {
  if (canDeleteType(d, id)) return d;
  return {
    ...d,
    types: d.types.map((t) => (t.id === id ? { ...t, deleted: true } : t)),
    machines: d.machines.map((m) => (m.typeId === id ? { ...m, typeId: null } : m)),
  };
}
