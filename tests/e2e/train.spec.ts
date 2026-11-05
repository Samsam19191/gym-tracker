import { expect, test } from '@playwright/test';
import { createDefaultData } from '../../src/lib/defaults';
import { confirmBox, endRest, fakeWakeLock, holdToEnd, NOW, openApp, seedData, sheet, startRest, stored, tab, wakeLog } from './helpers';

const setCount = (page: import('@playwright/test').Page) => page.getByTestId('set-count');
const total = (page: import('@playwright/test').Page) => page.getByTestId('total-clock');

/** The fake clock keeps flowing in real time, so compare recorded durations in whole seconds. */
const secs = (exercises: { sets: number; rests: number[] }[]) => exercises.map((e) => ({ sets: e.sets, rests: e.rests.map((r) => Math.round(r / 1000)) }));

test.describe('live workout', () => {
  test('start a workout: the total timer starts at 0 and keeps counting', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await expect(page.getByText('Push', { exact: true })).toBeVisible();
    await expect(total(page)).toHaveText('0:00');
    await page.clock.fastForward(65_000);
    await expect(total(page)).toHaveText('1:05');
    await page.clock.fastForward(60 * 60_000);
    await expect(total(page)).toHaveText('1:01:05');
    const a = (await stored(page)).active!;
    expect(a).toMatchObject({ typeId: 'push', endedAt: null });
    expect(Math.abs(a.start - NOW.getTime())).toBeLessThan(5000);
  });

  test('sets and rests: each Start rest counts a set, End rest records the rest', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Pull' }).click();
    await expect(setCount(page)).toHaveText('0');
    await expect(page.getByRole('button', { name: /^Start rest/ })).toContainText('Counts set 1');

    await startRest(page);
    await expect(page.getByTestId('rest-clock')).toHaveText('0:00');
    await expect(setCount(page)).toHaveText('1');
    await page.clock.fastForward(75_000);
    await expect(page.getByTestId('rest-clock')).toHaveText('1:15');
    await expect(page.getByRole('button', { name: /^End rest/ })).toContainText('Then set 2');
    await page.getByRole('button', { name: /^End rest/ }).click();

    await expect(setCount(page)).toHaveText('1');
    await expect(page.getByText('set done')).toBeVisible();
    await startRest(page);
    await endRest(page);
    await expect(setCount(page)).toHaveText('2');
    await expect(page.getByText('sets done')).toBeVisible();

    const a = (await stored(page)).active!;
    expect(secs(a.exercises)).toEqual([{ sets: 2, rests: [75, 1] }]);
  });

  test('an accidental double tap does not end the rest straight away', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await startRest(page);
    await page.clock.fastForward(200);
    await page.getByRole('button', { name: /^End rest/ }).click();
    await expect(page.getByRole('button', { name: /^End rest/ })).toBeVisible();
    expect((await stored(page)).active!.rest).not.toBeNull();
  });

  test('-1 undoes a set during a rest and after a rest', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await expect(page.getByRole('button', { name: 'Undo last set' })).toBeDisabled();
    await startRest(page);
    await page.getByRole('button', { name: 'Undo last set' }).click();
    await expect(page.getByRole('button', { name: /^Start rest/ })).toBeVisible();
    await expect(setCount(page)).toHaveText('0');

    await startRest(page);
    await endRest(page);
    await startRest(page);
    await endRest(page);
    await expect(setCount(page)).toHaveText('2');
    await page.getByRole('button', { name: 'Undo last set' }).click();
    await expect(setCount(page)).toHaveText('1');
    expect(secs((await stored(page)).active!.exercises)).toEqual([{ sets: 1, rests: [1] }]);
  });

  test('next exercise resets the counter, also during a rest', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Shoulders' }).click();
    await expect(page.getByRole('button', { name: 'Next exercise' })).toBeDisabled();
    await startRest(page);
    await endRest(page);
    await page.getByRole('button', { name: 'Next exercise' }).click();
    await expect(page.getByText('Exercise 2', { exact: true })).toBeVisible();
    await expect(setCount(page)).toHaveText('0');

    await startRest(page);
    await page.getByRole('button', { name: 'Next exercise' }).click();
    await expect(page.getByText('Exercise 3', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^End rest/ })).toContainText('Then exercise 3, set 1');
    await expect(page.getByTestId('rest-clock')).toBeVisible();
    await page.clock.fastForward(30_000);
    await page.getByRole('button', { name: /^End rest/ }).click();
    expect(secs((await stored(page)).active!.exercises)).toEqual([
      { sets: 1, rests: [1] },
      { sets: 1, rests: [30] },
      { sets: 0, rests: [] },
    ]);
  });

  test('a simple tap on end does nothing; holding shows the summary', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await page.getByRole('button', { name: 'Hold to end workout' }).click();
    await expect(page.getByText('Press and hold to end the workout')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Start rest/ })).toBeVisible();
    await holdToEnd(page);
    await expect(page.getByText('Workout complete')).toBeVisible();
  });

  test('summary shows duration, exercises, sets and average rest; save adds it to history', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    // Exercise 1: 2 sets, rests 60s and 90s
    await startRest(page);
    await page.clock.fastForward(59_000);
    await endRest(page);
    await startRest(page);
    await page.clock.fastForward(89_000);
    await endRest(page);
    await page.getByRole('button', { name: 'Next exercise' }).click();
    // Exercise 2: 1 set, rest 120s
    await startRest(page);
    await page.clock.fastForward(119_000);
    await endRest(page);
    await page.clock.fastForward(40 * 60_000);
    await holdToEnd(page);

    await expect(page.getByText('Workout complete')).toBeVisible();
    const a = (await stored(page)).active!;
    const minutes = Math.floor((a.endedAt! - a.start) / 60_000);
    await expect(page.getByTestId('summary-duration')).toHaveText(new RegExp(`^${minutes}:\\d\\d$`));
    await expect(page.getByText('Exercises', { exact: true })).toBeVisible();
    await expect(page.locator('.tile').nth(0)).toContainText('2');
    await expect(page.locator('.tile').nth(1)).toContainText('3');
    await expect(page.locator('.tile').nth(2)).toContainText('1:30');

    await page.getByRole('button', { name: 'Save workout' }).click();
    await expect(page.getByText('Ready to train?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Push' })).toContainText('Today');
    await expect(page.getByText('1 workout ·')).toBeVisible();
    const d = await stored(page);
    expect(d.active).toBeNull();
    expect(d.workouts).toHaveLength(1);
    expect(d.workouts[0]).toMatchObject({ typeId: 'push', manual: false });
    expect(secs(d.workouts[0].exercises)).toEqual([{ sets: 2, rests: [60, 90] }, { sets: 1, rests: [120] }]);

    await tab(page, 'History').click();
    await expect(page.getByRole('button', { name: /Thursday 5 November: Push/ })).toBeVisible();
    await expect(page.locator('.lrow')).toContainText('3 sets');
  });

  test('back to workout resumes with the original start time', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await page.clock.fastForward(10 * 60_000);
    await holdToEnd(page);
    await page.getByRole('button', { name: 'Back to workout' }).click();
    await page.clock.fastForward(5 * 60_000);
    await expect(total(page)).toHaveText(/^15:0\d$/);
  });

  test('discard asks for confirmation and saves nothing', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await holdToEnd(page);
    await page.getByRole('button', { name: 'Discard workout' }).click();
    await confirmBox(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Workout complete')).toBeVisible();
    await page.getByRole('button', { name: 'Discard workout' }).click();
    await confirmBox(page).getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByText('Ready to train?')).toBeVisible();
    const d = await stored(page);
    expect(d.active).toBeNull();
    expect(d.workouts).toHaveLength(0);
  });

  test('closing and reopening the app keeps the workout and the timers stay right', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await startRest(page);
    await page.clock.fastForward(30_000);
    await page.reload();
    await page.clock.fastForward(60_000);
    await expect(page.getByTestId('rest-clock')).toHaveText('1:30');
    await expect(total(page)).toHaveText('1:31');
    await expect(setCount(page)).toHaveText('1');
  });

  test('the summary also survives a reload', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await page.clock.fastForward(20 * 60_000);
    await holdToEnd(page);
    await page.reload();
    await expect(page.getByText('Workout complete')).toBeVisible();
    await expect(page.getByTestId('summary-duration')).toHaveText(/^20:0\d$/);
  });

  test('rest target: ring shows when the target is reached', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await startRest(page);
    await expect(page.getByText('target 1:30')).toBeVisible();
    await expect(page.getByText('Rest done')).toBeHidden();
    await page.clock.fastForward(91_000);
    await expect(page.getByText('Rest done')).toBeVisible();
  });

  test('rest target off: no target shown', async ({ page }) => {
    const d = createDefaultData();
    d.settings.restTargetSec = null;
    await openApp(page, { data: d });
    await page.getByRole('button', { name: 'Start Push' }).click();
    await startRest(page);
    await expect(page.getByTestId('rest-clock')).toBeVisible();
    await expect(page.getByText(/target \d/)).toBeHidden();
    await expect(page.getByRole('button', { name: 'No rest target, tap to set one' })).toBeVisible();
  });

  test('change the rest target in the middle of a rest', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await startRest(page);
    await page.getByRole('button', { name: 'Rest target 1:30, tap to change' }).click();
    await sheet(page, 'Rest target').getByRole('radio', { name: '1:00' }).click();
    await expect(page.getByText('target 1:00')).toBeVisible();
    await page.clock.fastForward(61_000);
    await expect(page.getByText('Rest done')).toBeVisible();
    // The rest itself kept running while the sheet was open.
    await expect(page.getByTestId('rest-clock')).toHaveText(/^1:0\d$/);
    expect((await stored(page)).settings.restTargetSec).toBe(60);
  });

  test('weights during a workout: open them and come back, timers keep running', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await page.getByRole('button', { name: 'Start Shoulders' }).click();
    await startRest(page);
    await page.getByRole('button', { name: 'Open weights' }).click();
    await expect(page.getByRole('heading', { name: 'Weights' })).toBeVisible();
    const bar = page.getByRole('button', { name: 'Back to Shoulders workout' });
    await expect(bar).toContainText('Resting');
    await page.getByRole('button', { name: /Shoulder press/ }).click();
    await expect(page.getByTestId('best-kg')).toHaveText('40kg');
    await expect(bar).toBeVisible();
    await page.clock.fastForward(30_000);
    await bar.click();
    await expect(page.getByTestId('rest-clock')).toHaveText(/^0:3\d$/);
  });

  test('history and other tabs work during a workout and the Train tab returns to it', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await page.getByRole('button', { name: 'Start Push' }).click();
    await page.getByRole('button', { name: 'Open weights' }).click();
    await tab(page, 'History').click();
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await tab(page, 'Train').click();
    await expect(page.getByRole('button', { name: /^Start rest/ })).toBeVisible();
  });

  test('screen stays on during the workout and is released at the end', async ({ page }) => {
    await fakeWakeLock(page);
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await expect(page.getByText('Screen on')).toBeVisible();
    expect(await wakeLog(page)).toMatchObject({ requests: 1, held: true });
    await holdToEnd(page);
    await expect(page.getByText('Workout complete')).toBeVisible();
    await expect.poll(async () => (await wakeLog(page)).held).toBe(false);
    await page.getByRole('button', { name: 'Back to workout' }).click();
    await expect.poll(async () => (await wakeLog(page)).held).toBe(true);
  });

  test('keep screen on disabled: no wake lock and no indicator', async ({ page }) => {
    await fakeWakeLock(page);
    const d = createDefaultData();
    d.settings.keepScreenOn = false;
    await openApp(page, { data: d });
    await page.getByRole('button', { name: 'Start Push' }).click();
    await expect(page.getByRole('button', { name: /^Start rest/ })).toBeVisible();
    await expect(page.getByText('Screen on')).toBeHidden();
    expect((await wakeLog(page)).requests).toBe(0);
  });

  test('without wake lock support the app says the screen may sleep', async ({ page }) => {
    await page.addInitScript(() => {
      // Simulate an older iPhone: no Screen Wake Lock API.
      delete (Navigator.prototype as unknown as { wakeLock?: unknown }).wakeLock;
    });
    await openApp(page);
    await page.getByRole('button', { name: 'Start Push' }).click();
    await expect(page.getByText('Screen may sleep')).toBeVisible();
  });
});

test.describe('home', () => {
  test('up next follows the rotation after the last gym workout', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await expect(page.getByRole('button', { name: 'Start Shoulders' })).toContainText('Up next');
    await expect(page.getByRole('button', { name: 'Start Pull' })).toContainText('Yesterday');
    await expect(page.getByRole('button', { name: 'Start Push' })).toContainText('2 days ago');
    await expect(page.getByText('2 workouts · 1h 50m')).toBeVisible();
    await page.getByRole('button', { name: 'Start Shoulders' }).click();
    await holdToEnd(page);
    await page.getByRole('button', { name: 'Save workout' }).click();
    await expect(page.getByRole('button', { name: 'Start Push' })).toContainText('Up next');
  });

  test('log a football match from Home with its start and end time', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await page.getByRole('button', { name: 'Log Football' }).click();
    const s = sheet(page, 'Log a workout');
    await expect(s.getByRole('radio', { name: 'Football' })).toHaveAttribute('aria-checked', 'true');
    await s.getByLabel('Date').fill('2026-11-05');
    await s.getByLabel('From').fill('14:00');
    await s.getByLabel('To').fill('15:45');
    await expect(s.getByText('Duration 1h 45m')).toBeVisible();
    await s.getByRole('button', { name: 'Log workout' }).click();
    await expect(s).toBeHidden();
    await expect(page.getByRole('button', { name: 'Log Football' })).toContainText('Today');
    // Activities don't change the gym rotation.
    await expect(page.getByRole('button', { name: 'Start Shoulders' })).toContainText('Up next');
    const d = await stored(page);
    const f = d.workouts.find((w) => w.typeId === 'football' && w.manual && w.start === new Date('2026-11-05T14:00:00+01:00').getTime());
    expect(f).toBeTruthy();
    expect(f!.end - f!.start).toBe(105 * 60_000);
  });

  test('a match ending after midnight is logged as ending the next day', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Log Football' }).click();
    const s = sheet(page, 'Log a workout');
    await s.getByLabel('Date').fill('2026-11-04');
    await s.getByLabel('From').fill('22:30');
    await s.getByLabel('To').fill('00:15');
    await expect(s.getByText('Duration 1h 45m · ends the next day')).toBeVisible();
    await s.getByRole('button', { name: 'Log workout' }).click();
    await expect(s).toBeHidden();
    const w = (await stored(page)).workouts[0];
    expect(w.end - w.start).toBe(105 * 60_000);
  });

  test('cannot log something in the future or with the same start and end', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Log Football' }).click();
    const s = sheet(page, 'Log a workout');
    await s.getByLabel('Date').fill('2026-11-05');
    await s.getByLabel('From').fill('20:00');
    await s.getByLabel('To').fill('21:00');
    await s.getByRole('button', { name: 'Log workout' }).click();
    await expect(s.getByRole('alert')).toHaveText("You can't log a workout that hasn't started yet");
    await s.getByLabel('From').fill('10:00');
    await s.getByLabel('To').fill('10:00');
    await s.getByRole('button', { name: 'Log workout' }).click();
    await expect(s.getByRole('alert')).toHaveText('The end time must be after the start time');
    expect((await stored(page))?.workouts ?? []).toHaveLength(0);
  });

  test('cancel closes the log sheet without saving', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Log Football' }).click();
    await sheet(page, 'Log a workout').getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet(page, 'Log a workout')).toBeHidden();
    const d = await stored(page);
    expect(d === null || d.workouts.length === 0).toBe(true);
  });
});
