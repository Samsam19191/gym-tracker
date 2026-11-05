import { expect, test, type Page } from '@playwright/test';
import { holdToEnd, openApp, seedData, sheet, tab } from './helpers';

/**
 * Walks through every screen with realistic data, checks nothing overflows horizontally
 * and that the key controls are visible without scrolling, and saves a screenshot of each.
 */
async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function shot(page: Page, name: string) {
  await noHorizontalOverflow(page);
  await page.screenshot({ path: `test-results/screens/${test.info().project.name}/${name}.png`, animations: 'disabled' });
}

async function inViewport(page: Page, name: string) {
  const btn = page.getByRole('button', { name: new RegExp(`^${name}`) });
  await expect(btn).toBeInViewport({ ratio: 1 });
}

test('every screen fits the phone @layout', async ({ page }) => {
  await openApp(page, { data: seedData() });
  await expect(page.getByText('Ready to train?')).toBeVisible();
  await shot(page, '01-home');

  await page.getByRole('button', { name: 'Start Shoulders' }).click();
  await page.clock.fastForward(47 * 60_000);
  await inViewport(page, 'Start rest');
  await expect(page.getByRole('button', { name: 'Hold to end workout' })).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: /^Start rest/ }).click();
  await page.clock.fastForward(60_000);
  await page.getByRole('button', { name: /^End rest/ }).click();
  await page.clock.fastForward(60_000);
  await shot(page, '02-workout');

  await page.getByRole('button', { name: /^Start rest/ }).click();
  await page.clock.fastForward(84_000);
  await inViewport(page, 'End rest');
  await expect(page.getByRole('button', { name: 'Next exercise' })).toBeInViewport({ ratio: 1 });
  await shot(page, '03-resting');

  await page.getByRole('button', { name: 'Open weights' }).click();
  await expect(page.getByRole('button', { name: /Back to Shoulders workout/ })).toBeVisible();
  await shot(page, '04-weights-during-workout');

  await page.getByRole('button', { name: /Back to Shoulders workout/ }).click();
  await holdToEnd(page);
  await expect(page.getByText('Workout complete')).toBeVisible();
  await inViewport(page, 'Save workout');
  await shot(page, '05-summary');
  await page.getByRole('button', { name: 'Save workout' }).click();

  await tab(page, 'History').click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('button', { name: /^October 2026/ })).toBeVisible();
  await shot(page, '06-history-october');

  await page.getByRole('button', { name: /Thursday 22 October/ }).click();
  await expect(sheet(page, 'Thursday 22 October')).toBeVisible();
  await shot(page, '07-day-detail');
  await page.locator('.scrim').click({ position: { x: 10, y: 10 } });

  await page.getByRole('button', { name: 'Log a workout' }).click();
  await shot(page, '08-log-sheet');
  await sheet(page, 'Log a workout').getByRole('button', { name: 'Cancel' }).click();

  await tab(page, 'Weights').click();
  await shot(page, '09-weights');
  await page.getByRole('button', { name: /Chest press/ }).click();
  await expect(page.getByTestId('best-kg')).toHaveText('70kg');
  await shot(page, '10-machine');
  await page.getByRole('button', { name: 'Edit' }).click();
  await shot(page, '11-machine-edit');
  await sheet(page, 'Edit machine').getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Weights' }).first().click();

  await page.getByRole('button', { name: 'Add machine' }).click();
  await shot(page, '12-new-machine');
  await sheet(page, 'New machine').getByRole('button', { name: 'Cancel' }).click();

  await tab(page, 'Train').click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await shot(page, '13-settings');
  await page.getByRole('button', { name: 'Edit Push' }).click();
  await shot(page, '14-type-sheet');
});

test('empty app on first launch @layout', async ({ page }) => {
  await openApp(page);
  await shot(page, '20-first-home');
  await tab(page, 'History').click();
  await shot(page, '21-first-history');
  await tab(page, 'Weights').click();
  await expect(page.getByText('No machines yet')).toBeVisible();
  await shot(page, '22-first-weights');
});
