import { expect, test, type Page } from '@playwright/test';
import { createDefaultData } from '../../src/lib/defaults';
import { endRest, holdToEnd, NOW, openApp, seedData, startRest, tab } from './helpers';

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const LONG = 'Shoulders and arms super day'; // 28 characters, under the 32 limit

test('long names never push the layout sideways @layout', async ({ page }) => {
  const d = seedData();
  d.types = d.types.map((t) => (t.id === 'shoulders' ? { ...t, name: LONG } : t));
  d.machines.push({ id: 'long', name: 'Incline chest press machine XL', typeId: 'shoulders', createdAt: NOW.getTime() });
  d.weights.push({ id: 'lw', machineId: 'long', date: '2026-11-04', kg: 112.5 });
  await openApp(page, { data: d });
  await noHorizontalOverflow(page);
  await page.getByRole('button', { name: `Start ${LONG}` }).click();
  await noHorizontalOverflow(page);
  await expect(page.getByRole('button', { name: 'Open weights' })).toBeInViewport({ ratio: 1 });
  await startRest(page);
  await noHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Open weights' }).click();
  await noHorizontalOverflow(page);
  await page.getByRole('button', { name: /Incline chest press machine XL/ }).click();
  await noHorizontalOverflow(page);
  await expect(page.getByRole('button', { name: 'Edit' })).toBeInViewport({ ratio: 1 });
  await tab(page, 'History').click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await noHorizontalOverflow(page);
});

test('a 3-hour workout and an exercise with 30+ sets still fit @layout', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Start Push' }).click();
  for (let i = 0; i < 32; i++) {
    await startRest(page);
    await endRest(page);
  }
  await expect(page.getByTestId('set-count')).toHaveText('32');
  await page.clock.fastForward(3 * 3600_000);
  await expect(page.getByTestId('total-clock')).toHaveText(/^3:0\d:\d\d$/);
  await expect(page.getByTestId('total-clock')).toBeInViewport({ ratio: 1 });
  await noHorizontalOverflow(page);
  await holdToEnd(page);
  await expect(page.getByText('Workout complete')).toBeVisible();
  await expect(page.locator('.exrow .n')).toHaveText('32 sets');
  await noHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Save workout' }).click();
  await tab(page, 'History').click();
  await expect(page.locator('.lrow')).toContainText('32 sets');
});

test('with every gym type deleted, Home explains what to do', async ({ page }) => {
  const d = createDefaultData();
  d.types = d.types.map((t) => (t.kind === 'gym' ? { ...t, deleted: true } : t));
  await openApp(page, { data: d });
  await expect(page.getByText('No gym workout types. Add one in Settings.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log Football' })).toBeVisible();
});

test('a workout started before midnight belongs to the day it started', async ({ page }) => {
  await openApp(page, { time: new Date('2026-11-05T23:40:00+01:00') });
  await page.getByRole('button', { name: 'Start Pull' }).click();
  await page.clock.fastForward(45 * 60_000);
  await holdToEnd(page);
  await page.getByRole('button', { name: 'Save workout' }).click();
  await tab(page, 'History').click();
  await expect(page.getByRole('button', { name: 'Thursday 5 November: Pull' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Friday 6 November' })).toHaveClass(/today/);
});
