import { expect, type Page } from '@playwright/test';
import { createDefaultData } from '../../src/lib/defaults';
import type { AppData, Workout } from '../../src/lib/model';
import { STORAGE_KEY } from '../../src/lib/storage';

/** Thursday 5 November 2026, 18:30 Paris time. */
export const NOW = new Date('2026-11-05T18:30:00+01:00');

const at = (iso: string) => new Date(iso).getTime();
const MIN = 60_000;

function gym(id: string, typeId: string, startIso: string, minutes: number, sets: number[]): Workout {
  const start = at(startIso);
  return { id, typeId, start, end: start + minutes * MIN, manual: false, exercises: sets.map((n) => ({ sets: n, rests: Array(n).fill(95_000) })) };
}

/** A realistic history: October and early November in a Push / Pull / Shoulders rotation, plus football. */
export function seedData(): AppData {
  const d = createDefaultData();
  const rot = ['push', 'pull', 'shoulders'];
  const octDays = [1, 2, 4, 6, 8, 9, 13, 15, 17, 20, 22, 24, 28, 30];
  const workouts: Workout[] = octDays.map((day, i) => gym(`oct${day}`, rot[i % 3], `2026-10-${String(day).padStart(2, '0')}T18:30:00+02:00`, 50 + (i % 4) * 3, [4, 3, 3, 3, 3]));
  workouts.push(gym('nov1', 'shoulders', '2026-11-01T11:00:00+01:00', 49, [4, 3, 3, 3]));
  workouts.push(gym('nov3', 'push', '2026-11-03T18:31:00+01:00', 58, [4, 3, 4, 3, 3]));
  workouts.push(gym('nov4', 'pull', '2026-11-04T18:34:00+01:00', 52, [4, 3, 3, 3, 3]));
  workouts.push({ id: 'foot1', typeId: 'football', start: at('2026-10-25T15:00:00+01:00'), end: at('2026-10-25T16:30:00+01:00'), manual: true, exercises: [] });
  d.workouts = workouts;
  d.machines = [
    { id: 'chest', name: 'Chest press', typeId: 'push', createdAt: at('2026-07-01T10:00:00+02:00') },
    { id: 'lat', name: 'Lat pulldown', typeId: 'pull', createdAt: at('2026-07-01T10:00:00+02:00') },
    { id: 'shp', name: 'Shoulder press', typeId: 'shoulders', createdAt: at('2026-07-01T10:00:00+02:00') },
    { id: 'row', name: 'Seated row', typeId: 'pull', createdAt: at('2026-07-01T10:00:00+02:00') },
    { id: 'lat-raise', name: 'Lateral raise', typeId: 'shoulders', createdAt: at('2026-07-01T10:00:00+02:00') },
  ];
  const chest: [string, number][] = [
    ['2026-07-07', 57.5],
    ['2026-07-21', 60],
    ['2026-08-11', 60],
    ['2026-08-25', 62.5],
    ['2026-09-15', 62.5],
    ['2026-09-29', 65],
    ['2026-10-20', 65],
    ['2026-10-28', 67.5],
    ['2026-11-03', 70],
  ];
  d.weights = [
    ...chest.map(([date, kg], i) => ({ id: `c${i}`, machineId: 'chest', date, kg })),
    { id: 'l1', machineId: 'lat', date: '2026-10-22', kg: 60 },
    { id: 'l2', machineId: 'lat', date: '2026-11-04', kg: 65 },
    { id: 's1', machineId: 'shp', date: '2026-10-24', kg: 37.5 },
    { id: 's2', machineId: 'shp', date: '2026-11-01', kg: 40 },
    { id: 'r1', machineId: 'row', date: '2026-11-04', kg: 60 },
  ];
  d.settings.lastBackupAt = at('2026-10-20T10:00:00+02:00');
  return d;
}

/** Install a fake clock at `time`, put `data` in storage, and open the app. */
export async function openApp(page: Page, opts: { data?: AppData | null; time?: Date } = {}): Promise<void> {
  await page.clock.install({ time: opts.time ?? NOW });
  if (opts.data !== null && opts.data !== undefined) {
    const json = JSON.stringify(opts.data);
    await page.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem(key, value);
          sessionStorage.setItem('seeded', '1');
        }
      },
      [STORAGE_KEY, json] as const,
    );
  }
  await page.goto('./');
  await expect(page.locator('#app')).not.toBeEmpty();
}

export async function stored(page: Page): Promise<AppData> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  return JSON.parse(raw ?? 'null') as AppData;
}

/** Press and hold the "end workout" button long enough. */
export async function holdToEnd(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: 'Hold to end workout' });
  await btn.scrollIntoViewIfNeeded();
  const box = (await btn.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(900);
  await page.mouse.up();
}

export function tab(page: Page, name: 'Train' | 'History' | 'Weights') {
  return page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name });
}

export function sheet(page: Page, name: string | RegExp) {
  return page.getByRole('dialog', { name });
}

export function confirmBox(page: Page) {
  return page.getByRole('alertdialog');
}
