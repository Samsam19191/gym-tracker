import { expect, test } from '@playwright/test';
import { createDefaultData } from '../../src/lib/defaults';
import { endRest, fakeAudio, holdToEnd, openApp, seedData, sheet, startRest, stored, tab, tones } from './helpers';

/** Regression tests for issues found in the independent review. */

test('a weight that would round to 0 kg is refused', async ({ page }) => {
  await openApp(page, { data: seedData() });
  await tab(page, 'Weights').click();
  await page.getByRole('button', { name: /Chest press/ }).click();
  await page.getByRole('button', { name: /tap to type/ }).click();
  await page.getByLabel('Weight in kg').fill('0.001');
  await page.getByLabel('Weight in kg').press('Enter');
  await expect(page.getByText('Enter a weight between 0 and 1000 kg')).toBeVisible();
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const today = (await stored(page)).weights.filter((w) => w.date === '2026-11-05');
  expect(today.every((w) => w.kg > 0)).toBe(true);
});

test('saved data with one bad weight still opens with everything else', async ({ page }) => {
  const d = seedData();
  d.weights.push({ id: 'zero', machineId: 'chest', date: '2026-11-05', kg: 0 });
  await openApp(page, { data: d });
  await expect(page.getByRole('alert')).toContainText('1 damaged record was skipped');
  await expect(page.getByRole('button', { name: 'Start Pull' })).toContainText('Yesterday');
  await tab(page, 'Weights').click();
  await expect(page.locator('.wrow')).toHaveCount(5);
});

test('the rest beep also plays while looking at weights', async ({ page }) => {
  await fakeAudio(page);
  await openApp(page, { data: seedData() });
  await page.getByRole('button', { name: 'Start Push' }).click();
  await startRest(page);
  await page.getByRole('button', { name: 'Open weights' }).click();
  await page.getByRole('button', { name: /Chest press/ }).click();
  expect(await tones(page)).toBe(0);
  await page.clock.runFor(91_000);
  await expect.poll(() => tones(page)).toBe(2);
  // Only once per rest.
  await page.clock.runFor(5_000);
  expect(await tones(page)).toBe(2);
});

test('no beep when the sound is turned off', async ({ page }) => {
  await fakeAudio(page);
  const d = createDefaultData();
  d.settings.restSound = false;
  await openApp(page, { data: d });
  await page.getByRole('button', { name: 'Start Push' }).click();
  await startRest(page);
  await page.clock.runFor(95_000);
  await expect(page.getByText('Rest done')).toBeVisible();
  expect(await tones(page)).toBe(0);
});

test('typing a machine name with the new-type field open stays in the name field', async ({ page }) => {
  await openApp(page);
  await tab(page, 'Weights').click();
  await page.getByRole('button', { name: 'Add machine' }).click();
  const s = sheet(page, 'New machine');
  await s.getByRole('button', { name: 'New type' }).click();
  await expect(s.getByLabel('New workout type name')).toBeFocused();
  await s.getByLabel('Name', { exact: true }).click();
  await page.keyboard.type('Chest');
  await expect(s.getByLabel('Name', { exact: true })).toHaveValue('Chest');
  await expect(s.getByLabel('New workout type name')).toHaveValue('');
});

test('logging just after midnight defaults to a valid evening slot', async ({ page }) => {
  await openApp(page, { time: new Date('2026-11-06T00:40:00+01:00') });
  await page.getByRole('button', { name: 'Log Football' }).click();
  const s = sheet(page, 'Log a workout');
  await expect(s.getByLabel('Date')).toHaveValue('2026-11-05');
  await expect(s.getByLabel('From')).toHaveValue('23:00');
  await expect(s.getByLabel('To')).toHaveValue('00:30');
  await expect(s.getByText('ends the next day')).toBeVisible();
  await s.getByRole('button', { name: 'Log workout' }).click();
  await expect(s).toBeHidden();
  const w = (await stored(page)).workouts[0];
  expect(w.start).toBe(new Date('2026-11-05T23:00:00+01:00').getTime());
  expect(w.end).toBe(new Date('2026-11-06T00:30:00+01:00').getTime());
});

test('-1 right after "Next exercise" goes back to the previous exercise', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start Push' }).click();
  await startRest(page);
  await endRest(page);
  await startRest(page);
  await endRest(page);
  await page.getByRole('button', { name: 'Next exercise' }).click();
  await expect(page.getByText('Exercise 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo last set' }).click();
  await expect(page.getByText('Exercise 1', { exact: true })).toBeVisible();
  await expect(page.getByTestId('set-count')).toHaveText('2');
});

test('the last open rest is not counted in the average rest', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start Push' }).click();
  await startRest(page);
  await page.clock.fastForward(59_000);
  await endRest(page);
  await startRest(page);
  await page.clock.fastForward(10 * 60_000);
  await holdToEnd(page);
  await expect(page.locator('.tile').nth(1)).toContainText('2');
  await expect(page.locator('.tile').nth(2)).toContainText('1:00');
});

test('changing only the type of a recorded workout keeps its exact times', async ({ page }) => {
  const d = seedData();
  const w = d.workouts.find((x) => x.id === 'nov4')!;
  w.start += 17_000;
  w.end += 43_000;
  await openApp(page, { data: d });
  await tab(page, 'History').click();
  await page.getByRole('button', { name: 'Wednesday 4 November: Pull' }).click();
  const day = sheet(page, 'Wednesday 4 November');
  await day.getByRole('button', { name: 'Options for Pull workout' }).click();
  await day.getByRole('menuitem', { name: /Edit/ }).click();
  const edit = sheet(page, 'Edit workout');
  await edit.getByRole('radio', { name: 'Push' }).click();
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit).toBeHidden();
  const after = (await stored(page)).workouts.find((x) => x.id === 'nov4')!;
  expect(after.typeId).toBe('push');
  expect(after.start).toBe(w.start);
  expect(after.end).toBe(w.end);
});

test('the summary ignores the tap from the finger that held "end"', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start Push' }).click();
  await holdToEnd(page);
  const save = page.getByRole('button', { name: 'Save workout' });
  // A finger click (detail 1) whose touch didn't start on the summary, like the lifted finger, does nothing.
  await save.dispatchEvent('click', { detail: 1 });
  await expect(page.getByText('Workout complete')).toBeVisible();
  await save.click();
  await expect(page.getByText('Ready to train?')).toBeVisible();
  expect((await stored(page)).workouts).toHaveLength(1);
});

test('summary buttons work from the keyboard / assistive technology', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start Push' }).click();
  await holdToEnd(page);
  await page.getByRole('button', { name: 'Save workout' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Ready to train?')).toBeVisible();
  expect((await stored(page)).workouts).toHaveLength(1);
});

test('ending during a rest then going back brings the rest timer back', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start Push' }).click();
  await startRest(page);
  await page.clock.fastForward(20_000);
  await holdToEnd(page);
  await page.getByRole('button', { name: 'Back to workout' }).click();
  await expect(page.getByTestId('rest-clock')).toHaveText(/^0:2\d$/);
  await expect(page.getByTestId('set-count')).toHaveText('1');
});

test('set-aside data can be saved from Settings after damaged data', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
  });
  await page.clock.install({ time: new Date('2026-11-05T18:30:00+01:00') });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('gym-tracker:data', '{"version":1,"types":');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Settings' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save the set-aside copy' }).click();
  expect((await download).suggestedFilename()).toBe('gym-tracker-set-aside-2026-11-05.json');
  await page.getByRole('button', { name: 'Delete the set-aside copy' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'Save the set-aside copy' })).toBeHidden();
});
