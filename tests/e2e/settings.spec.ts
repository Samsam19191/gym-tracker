import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { makeBackup } from '../../src/lib/backup';
import { createDefaultData } from '../../src/lib/defaults';
import { STORAGE_KEY } from '../../src/lib/storage';
import { confirmBox, holdToEnd, NOW, openApp, seedData, sheet, startRest, stored, tab } from './helpers';

async function openSettings(page: Page) {
  await tab(page, 'Train').click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
}

const homeTypes = (page: Page) => page.locator('.wtype .wname');

test.describe('workout types', () => {
  test('add a gym type: it appears on Home and can be started', async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    await page.getByRole('button', { name: 'Add workout type' }).click();
    const s = sheet(page, 'New workout type');
    await s.getByRole('button', { name: 'Add workout type' }).click();
    await expect(s.getByRole('alert')).toHaveText('Give it a name');
    await s.getByLabel('Name').fill('push');
    await s.getByRole('button', { name: 'Add workout type' }).click();
    await expect(s.getByRole('alert')).toHaveText('You already have a type with this name');
    await s.getByLabel('Name').fill('Legs');
    await s.getByRole('radio', { name: 'Color #F472B6' }).click();
    await s.getByRole('button', { name: 'Add workout type' }).click();
    await expect(s).toBeHidden();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(homeTypes(page)).toHaveText(['Push', 'Pull', 'Shoulders', 'Legs']);
    await page.getByRole('button', { name: 'Start Legs' }).click();
    await expect(page.locator('.chip').first()).toHaveText('Legs');
    const legs = (await stored(page)).types.find((t) => t.name === 'Legs')!;
    expect(legs).toMatchObject({ color: '#F472B6', kind: 'gym' });
  });

  test('add an activity type: it is logged by hand from Home', async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    await page.getByRole('button', { name: 'Add workout type' }).click();
    const s = sheet(page, 'New workout type');
    await s.getByLabel('Name').fill('Running');
    await s.getByRole('radio', { name: 'Logged by hand' }).click();
    await expect(s.getByText(/log the start and end time afterwards/)).toBeVisible();
    await s.getByRole('button', { name: 'Add workout type' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Log Running' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Running' })).toHaveCount(0);
  });

  test('rename a type: Home and History follow', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openSettings(page);
    await page.getByRole('button', { name: 'Edit Shoulders' }).click();
    const s = sheet(page, 'Edit workout type');
    await expect(s.getByLabel('Name')).toHaveValue('Shoulders');
    await s.getByLabel('Name').fill('Shoulders & arms');
    await s.getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Start Shoulders & arms' })).toContainText('Up next');
    await tab(page, 'History').click();
    await expect(page.getByRole('button', { name: 'Sunday 1 November: Shoulders & arms' })).toBeVisible();
  });

  test('reorder types: Home order and Up next follow', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openSettings(page);
    await page.getByRole('button', { name: 'Edit Shoulders' }).click();
    const s = sheet(page, 'Edit workout type');
    await s.getByRole('button', { name: 'Move up' }).click();
    await s.getByRole('button', { name: 'Move up' }).click();
    await expect(s.getByRole('button', { name: 'Move up' })).toBeDisabled();
    await s.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(homeTypes(page)).toHaveText(['Shoulders', 'Push', 'Pull']);
    // Last gym workout was Pull (now last in order): the rotation wraps to Shoulders.
    await expect(page.getByRole('button', { name: 'Start Shoulders' })).toContainText('Up next');
  });

  test('delete a type: hidden everywhere, past workouts keep it, machines untagged', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openSettings(page);
    await page.getByRole('button', { name: 'Edit Push' }).click();
    await sheet(page, 'Edit workout type').getByRole('button', { name: 'Delete workout type' }).click();
    await expect(confirmBox(page)).toContainText('Past workouts keep their history');
    await confirmBox(page).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('button', { name: 'Edit Push' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(homeTypes(page)).toHaveText(['Pull', 'Shoulders']);
    await tab(page, 'History').click();
    await expect(page.getByRole('button', { name: 'Tuesday 3 November: Push' })).toBeVisible();
    await page.getByRole('button', { name: 'Tuesday 3 November: Push' }).click();
    await expect(sheet(page, 'Tuesday 3 November').getByText('Push', { exact: true })).toBeVisible();
    await page.locator('.scrim').click({ position: { x: 10, y: 10 } });
    await tab(page, 'Weights').click();
    await expect(page.getByRole('radio', { name: 'Push' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Chest press/ })).not.toContainText('Push');
    expect((await stored(page)).machines.find((m) => m.id === 'chest')!.typeId).toBeNull();
  });

  test('editing a workout whose type was deleted keeps that type selectable', async ({ page }) => {
    const d = seedData();
    d.types = d.types.map((t) => (t.id === 'push' ? { ...t, deleted: true } : t));
    await openApp(page, { data: d });
    await tab(page, 'History').click();
    await page.getByRole('button', { name: 'Tuesday 3 November: Push' }).click();
    const day = sheet(page, 'Tuesday 3 November');
    await day.getByRole('button', { name: 'Options for Push workout' }).click();
    await day.getByRole('menuitem', { name: /Edit/ }).click();
    const edit = sheet(page, 'Edit workout');
    await expect(edit.getByRole('radio', { name: 'Push' })).toHaveAttribute('aria-checked', 'true');
    await edit.getByLabel('From').fill('18:00');
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expect(edit).toBeHidden();
  });
});

test.describe('workout settings', () => {
  test('change the rest target and turn it off', async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    await page.getByRole('button', { name: 'Rest target: 1:30' }).click();
    await sheet(page, 'Rest target').getByRole('radio', { name: '2:00' }).click();
    await expect(page.getByRole('button', { name: 'Rest target: 2:00' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Start Push' }).click();
    await startRest(page);
    await expect(page.getByText('target 2:00')).toBeVisible();
    await holdToEnd(page);
    await page.getByRole('button', { name: 'Discard workout' }).click();
    await confirmBox(page).getByRole('button', { name: 'Discard' }).click();

    await openSettings(page);
    await page.getByRole('button', { name: 'Rest target: 2:00' }).click();
    await sheet(page, 'Rest target').getByRole('radio', { name: 'Off' }).click();
    expect((await stored(page)).settings.restTargetSec).toBeNull();
  });

  test('toggles are saved', async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    await page.getByRole('switch', { name: 'Keep screen on' }).click();
    await page.getByRole('switch', { name: 'Sound at rest target' }).click();
    await expect(page.getByRole('switch', { name: 'Keep screen on' })).toHaveAttribute('aria-checked', 'false');
    const s = (await stored(page)).settings;
    expect(s.keepScreenOn).toBe(false);
    expect(s.restSound).toBe(false);
    await page.reload();
    await openSettings(page);
    await expect(page.getByRole('switch', { name: 'Keep screen on' })).toHaveAttribute('aria-checked', 'false');
  });

  test('shows the app version', async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    await expect(page.getByText(/^Version \d{4}\.\d{2}\.\d{2} \d{2}:\d{2} \(/)).toBeVisible();
  });
});

test.describe('backup', () => {
  test('export downloads a backup file with everything in it', async ({ page }) => {
    await page.addInitScript(() => {
      // Desktop WebKit has no share sheet for files: force the download path used on such browsers.
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
    });
    await openApp(page, { data: seedData() });
    await openSettings(page);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export backup' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('gym-tracker-backup-2026-11-05.json');
    const file = JSON.parse(readFileSync((await download.path())!, 'utf8'));
    expect(file.app).toBe('gym-tracker');
    expect(file.data.workouts).toHaveLength(18);
    expect(file.data.machines).toHaveLength(5);
    await expect(page.getByText('Last backup: 5 Nov')).toBeVisible();
  });

  test('export through the iPhone share sheet', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __shared: { name: string; size: number }[] };
      w.__shared = [];
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (d: ShareData) => {
          for (const f of d.files ?? []) w.__shared.push({ name: f.name, size: f.size });
        },
      });
    });
    await openApp(page, { data: seedData() });
    await openSettings(page);
    await page.getByRole('button', { name: 'Export backup' }).click();
    await expect(page.getByText('Backup ready')).toBeVisible();
    const shared = await page.evaluate(() => (window as unknown as { __shared: { name: string; size: number }[] }).__shared);
    expect(shared[0].name).toBe('gym-tracker-backup-2026-11-05.json');
    expect(shared[0].size).toBeGreaterThan(1000);
  });

  test('cancelling the share sheet does not count as a backup', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async () => Promise.reject(new DOMException('cancel', 'AbortError')) });
    });
    const d = seedData();
    d.settings.lastBackupAt = null;
    await openApp(page, { data: d });
    await openSettings(page);
    await page.getByRole('button', { name: 'Export backup' }).click();
    await expect(page.getByText('No backup yet.', { exact: false })).toBeVisible();
    expect((await stored(page)).settings.lastBackupAt).toBeNull();
  });

  test('import a backup: confirm, then everything is replaced', async ({ page }) => {
    await openApp(page);
    await openSettings(page);
    const backup = makeBackup(seedData(), NOW.getTime() - 86_400_000);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import backup' }).click();
    await (await chooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await expect(confirmBox(page)).toContainText('18 workouts, 5 machines and 14 logged weights');
    await expect(confirmBox(page)).toContainText('from 4 Nov');
    await confirmBox(page).getByRole('button', { name: 'Replace' }).click();
    await expect(page.getByText('Backup restored')).toBeVisible();
    const d = await stored(page);
    expect(d.workouts).toHaveLength(18);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Start Shoulders' })).toContainText('Up next');
  });

  test('importing the wrong file explains the problem and changes nothing', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openSettings(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import backup' }).click();
    await (await chooser).setFiles({ name: 'photo.json', mimeType: 'application/json', buffer: Buffer.from('{"hello": 1}') });
    await expect(page.getByText("This file isn't a Gym Tracker backup")).toBeVisible();
    expect((await stored(page)).workouts).toHaveLength(18);
  });

  test('cancelling the import confirmation keeps the current data', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openSettings(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import backup' }).click();
    await (await chooser).setFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(makeBackup(createDefaultData(), NOW.getTime())) });
    await confirmBox(page).getByRole('button', { name: 'Cancel' }).click();
    expect((await stored(page)).workouts).toHaveLength(18);
  });

  test('reminder banner on Home when there is no recent backup', async ({ page }) => {
    const d = seedData();
    d.settings.lastBackupAt = null;
    await openApp(page, { data: d });
    await expect(page.getByText('Back up your data')).toBeVisible();
    await expect(page.getByText('No backup yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Remind me later' }).click();
    await expect(page.getByText('Back up your data')).toBeHidden();
    await page.reload();
    await expect(page.getByText('Ready to train?')).toBeVisible();
    await expect(page.getByText('Back up your data')).toBeHidden();
  });

  test('no reminder for a recent backup', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await expect(page.getByText('Ready to train?')).toBeVisible();
    await expect(page.getByText('Back up your data')).toBeHidden();
  });
});

test.describe('data safety', () => {
  test('delete all data asks for confirmation and resets the app', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openSettings(page);
    await page.getByRole('button', { name: 'Delete all data' }).click();
    await expect(confirmBox(page)).toContainText('Export a backup first');
    await confirmBox(page).getByRole('button', { name: 'Delete everything' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('No workouts yet')).toBeVisible();
    await tab(page, 'Weights').click();
    await expect(page.getByText('No machines yet')).toBeVisible();
  });

  test('damaged saved data: the app still opens, warns, and keeps a copy', async ({ page }) => {
    await page.clock.install({ time: NOW });
    await page.addInitScript((key) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, '{"version":1,"types":');
        sessionStorage.setItem('seeded', '1');
      }
    }, STORAGE_KEY);
    await page.goto('./');
    await expect(page.getByRole('alert')).toContainText('Saved data was damaged');
    await expect(page.getByText('Ready to train?')).toBeVisible();
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.some((k) => k.startsWith('gym-tracker:data:corrupt:'))).toBe(true);
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByRole('alert')).toBeHidden();
  });

  test('data persists across app restarts', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await holdToEnd(page);
    await page.getByRole('button', { name: 'Save workout' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Start Push' })).toContainText('Today');
  });
});
