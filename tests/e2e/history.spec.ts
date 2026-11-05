import { expect, test } from '@playwright/test';
import { createDefaultData } from '../../src/lib/defaults';
import { confirmBox, openApp, seedData, sheet, stored, tab } from './helpers';

test.describe('history', () => {
  test('opens on the current month; navigate months and jump back to today', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await tab(page, 'History').click();
    await expect(page.getByRole('button', { name: /^November 2026/ })).toBeVisible();
    // November so far: Shoulders 1st, Push 3rd, Pull 4th, over 5 days.
    await expect(page.locator('.tile').nth(0)).toContainText('3');
    await expect(page.locator('.tile').nth(2)).toContainText('4.2');
    await expect(page.getByRole('button', { name: 'Thursday 5 November' })).toHaveClass(/today/);
    await expect(page.getByRole('button', { name: 'Friday 6 November' })).toBeDisabled();

    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByRole('button', { name: /^October 2026/ })).toBeVisible();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.getByRole('button', { name: /^September 2026/ })).toBeVisible();
    await expect(page.getByText('No workouts this month.')).toBeVisible();
    await page.getByRole('button', { name: /^September 2026/ }).click();
    await expect(page.getByRole('button', { name: /^November 2026/ })).toBeVisible();
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.getByRole('button', { name: /^December 2026/ })).toBeVisible();
    await expect(page.getByText('Nothing here yet.')).toBeVisible();
  });

  test('October stats, colors and legend', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await tab(page, 'History').click();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(page.locator('.tile').nth(0)).toContainText('15');
    await expect(page.locator('.tile').nth(2)).toContainText(String((15 / (31 / 7)).toFixed(1)));
    await expect(page.getByRole('button', { name: 'Thursday 1 October: Push' })).toHaveClass(/\bw\b/);
    await expect(page.getByRole('button', { name: 'Sunday 25 October: Football' })).toBeVisible();
    await expect(page.locator('.legend')).toContainText('Push 5');
    await expect(page.locator('.legend')).toContainText('Football 1');
    await expect(page.locator('.lrow')).toHaveCount(15);
    await expect(page.locator('.lrow').first()).toContainText('Fri 30 Oct');
  });

  test('tap a day to see its workout; edit its type and times', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await tab(page, 'History').click();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await page.getByRole('button', { name: 'Thursday 22 October: Pull' }).click();
    const day = sheet(page, 'Thursday 22 October');
    await expect(day.getByText('16', { exact: true })).toBeVisible();
    await expect(day.getByText('Exercise 5')).toBeVisible();

    await day.getByRole('button', { name: 'Options for Pull workout' }).click();
    await day.getByRole('menuitem', { name: /Edit/ }).click();
    const edit = sheet(page, 'Edit workout');
    await expect(edit.getByRole('radio', { name: 'Pull' })).toHaveAttribute('aria-checked', 'true');
    await edit.getByRole('radio', { name: 'Push' }).click();
    await edit.getByLabel('To').fill('20:00');
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByRole('button', { name: 'Thursday 22 October: Push' })).toBeVisible();
    const w = (await stored(page)).workouts.find((x) => x.id === 'oct22')!;
    expect(w.typeId).toBe('push');
    expect(new Date(w.end).getHours()).toBe(20);
    // Sets recorded live are kept when editing.
    expect(w.exercises.length).toBe(5);
  });

  test('delete a workout created by mistake', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await tab(page, 'History').click();
    await page.getByRole('button', { name: 'Wednesday 4 November: Pull' }).click();
    const day = sheet(page, 'Wednesday 4 November');
    await day.getByRole('button', { name: 'Options for Pull workout' }).click();
    await day.getByRole('menuitem', { name: /Delete/ }).click();
    await confirmBox(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(day).toBeVisible();
    await day.getByRole('menuitem', { name: /Delete/ }).click();
    await confirmBox(page).getByRole('button', { name: 'Delete' }).click();
    await expect(day).toBeHidden();
    await expect(page.getByRole('button', { name: 'Wednesday 4 November' })).toBeVisible();
    expect((await stored(page)).workouts.some((w) => w.id === 'nov4')).toBe(false);
    // Up next follows the new last workout (Push on the 3rd).
    await tab(page, 'Train').click();
    await expect(page.getByRole('button', { name: 'Start Pull' })).toContainText('Up next');
  });

  test('a day with two workouts shows both; deleting one keeps the other', async ({ page }) => {
    const d = seedData();
    d.workouts.push({ id: 'extra', typeId: 'football', start: new Date('2026-11-04T21:00:00+01:00').getTime(), end: new Date('2026-11-04T22:30:00+01:00').getTime(), manual: true, exercises: [] });
    await openApp(page, { data: d });
    await tab(page, 'History').click();
    const cell = page.getByRole('button', { name: 'Wednesday 4 November: Pull, Football' });
    await expect(cell.locator('.multi')).toBeVisible();
    await cell.click();
    const day = sheet(page, 'Wednesday 4 November');
    await expect(day.getByRole('region', { name: 'Pull workout' })).toBeVisible();
    await expect(day.getByRole('region', { name: 'Football workout' })).toContainText('logged by hand');
    await day.getByRole('button', { name: 'Options for Football workout' }).click();
    await day.getByRole('menuitem', { name: /Delete/ }).click();
    await confirmBox(page).getByRole('button', { name: 'Delete' }).click();
    await expect(day.getByRole('region', { name: 'Football workout' })).toBeHidden();
    await expect(day.getByRole('region', { name: 'Pull workout' })).toBeVisible();
  });

  test('tap an empty past day to log a forgotten workout on that day', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await tab(page, 'History').click();
    await page.getByRole('button', { name: 'Monday 2 November' }).click();
    const s = sheet(page, 'Log a workout');
    await expect(s.getByLabel('Date')).toHaveValue('2026-11-02');
    await s.getByRole('button', { name: 'Log workout' }).click();
    await expect(s.getByRole('alert')).toHaveText('Pick a workout type');
    await s.getByRole('radio', { name: 'Shoulders' }).click();
    await s.getByLabel('From').fill('18:00');
    await s.getByLabel('To').fill('19:00');
    await s.getByRole('button', { name: 'Log workout' }).click();
    await expect(s).toBeHidden();
    await expect(page.getByRole('button', { name: 'Monday 2 November: Shoulders' })).toBeVisible();
    await expect(page.locator('.tile').nth(0)).toContainText('4');
  });

  test('the + button logs a workout for today by default', async ({ page }) => {
    await openApp(page, { data: createDefaultData() });
    await tab(page, 'History').click();
    await page.getByRole('button', { name: 'Log a workout' }).click();
    const s = sheet(page, 'Log a workout');
    await expect(s.getByLabel('Date')).toHaveValue('2026-11-05');
    await s.getByRole('radio', { name: 'Push' }).click();
    await s.getByRole('button', { name: 'Log workout' }).click();
    await expect(page.getByRole('button', { name: 'Thursday 5 November: Push' })).toBeVisible();
    await expect(page.locator('.lrow')).toContainText('1h 30m');
  });

  test('swipe left and right to change month', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await tab(page, 'History').click();
    const swipe = async (fromX: number, toX: number) => {
      await page.evaluate(
        ([a, b]) => {
          // Desktop WebKit can't construct Touch objects, so build events carrying the same fields.
          const el = document.querySelector('main')!;
          const fire = (type: string, x: number) => {
            const e = new Event(type, { bubbles: true });
            const pt = [{ clientX: x, clientY: 400 }];
            Object.defineProperty(e, 'touches', { value: type === 'touchstart' ? pt : [] });
            Object.defineProperty(e, 'changedTouches', { value: pt });
            el.dispatchEvent(e);
          };
          fire('touchstart', a);
          fire('touchend', b);
        },
        [fromX, toX],
      );
    };
    await swipe(80, 300);
    await expect(page.getByRole('button', { name: /^October 2026/ })).toBeVisible();
    await swipe(300, 80);
    await expect(page.getByRole('button', { name: /^November 2026/ })).toBeVisible();
  });
});
