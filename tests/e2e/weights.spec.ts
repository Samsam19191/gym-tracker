import { expect, test, type Page } from '@playwright/test';
import { confirmBox, openApp, seedData, sheet, stored, tab } from './helpers';

const rows = (page: Page) => page.locator('.wrow');

async function openMachine(page: Page, name: string) {
  await tab(page, 'Weights').click();
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test.describe('weights', () => {
  test('first machine from the empty state, with a starting weight', async ({ page }) => {
    await openApp(page);
    await tab(page, 'Weights').click();
    await expect(page.getByText('No machines yet')).toBeVisible();
    await page.getByRole('button', { name: 'Add your first machine' }).click();
    const s = sheet(page, 'New machine');
    await expect(s.getByLabel('Name')).toBeFocused();
    await s.getByLabel('Name').fill('Leg press');
    await s.getByRole('radio', { name: 'Push' }).click();
    await s.getByLabel(/Starting weight/).fill('80');
    await s.getByRole('button', { name: 'Add machine' }).click();
    await expect(s).toBeHidden();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Leg press');
    await expect(rows(page).first()).toContainText('80kg');
    const d = await stored(page);
    expect(d.machines[0]).toMatchObject({ name: 'Leg press', typeId: 'push' });
    expect(d.weights[0]).toMatchObject({ date: '2026-11-05', kg: 80 });
  });

  test('a machine without type or weight', async ({ page }) => {
    await openApp(page);
    await tab(page, 'Weights').click();
    await page.getByRole('button', { name: 'Add machine' }).click();
    const s = sheet(page, 'New machine');
    await s.getByLabel('Name').fill('  Ab   crunch ');
    await s.getByRole('radio', { name: 'Pull' }).click();
    await s.getByRole('radio', { name: 'Pull' }).click(); // tap again to untag
    await s.getByRole('button', { name: 'Add machine' }).click();
    await expect(rows(page).first()).toContainText('Ab crunch');
    await expect(rows(page).first()).toContainText('No weight yet');
    expect((await stored(page)).machines[0]).toMatchObject({ name: 'Ab crunch', typeId: null });
  });

  test('name is required, unique, and the weight must be valid', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await tab(page, 'Weights').click();
    await page.getByRole('button', { name: 'Add machine' }).click();
    const s = sheet(page, 'New machine');
    await s.getByRole('button', { name: 'Add machine' }).click();
    await expect(s.getByRole('alert')).toHaveText('Give it a name');
    await s.getByLabel('Name').fill('chest PRESS');
    await s.getByRole('button', { name: 'Add machine' }).click();
    await expect(s.getByRole('alert')).toHaveText('You already have a machine with this name');
    await s.getByLabel('Name').fill('Pec deck');
    await s.getByLabel(/Starting weight/).fill('abc');
    await s.getByRole('button', { name: 'Add machine' }).click();
    await expect(s.getByRole('alert')).toContainText('Enter a weight');
    await s.getByLabel(/Starting weight/).fill('52,5');
    await s.getByRole('button', { name: 'Add machine' }).click();
    await expect(s).toBeHidden();
    await expect(page.getByRole('button', { name: /Pec deck/ })).toContainText('52.5kg');
  });

  test('create a new workout type right from the machine sheet', async ({ page }) => {
    await openApp(page);
    await tab(page, 'Weights').click();
    await page.getByRole('button', { name: 'Add machine' }).click();
    const s = sheet(page, 'New machine');
    await s.getByLabel('Name').fill('Leg extension');
    await s.getByRole('button', { name: 'New type' }).click();
    await s.getByLabel('New workout type name').fill('Legs');
    await s.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(s.getByRole('radio', { name: 'Legs' })).toHaveAttribute('aria-checked', 'true');
    await s.getByRole('button', { name: 'Add machine' }).click();
    await expect(page.getByRole('radio', { name: 'Legs' })).toBeVisible();
    await tab(page, 'Train').click();
    await expect(page.getByRole('button', { name: 'Start Legs' })).toBeVisible();
  });

  test('filter by type and search by name', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await tab(page, 'Weights').click();
    await expect(rows(page)).toHaveCount(5);
    await page.getByRole('radio', { name: 'Pull' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(0)).toContainText('Lat pulldown');
    await page.getByRole('radio', { name: 'All' }).click();
    await page.getByLabel('Search machines').fill('PRESS');
    await expect(rows(page)).toHaveCount(2);
    await page.getByLabel('Search machines').fill('zzz');
    await expect(page.getByText('No machines match.')).toBeVisible();
  });

  test('machine page: best weight, progress and chart ranges', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openMachine(page, 'Chest press');
    await expect(page.getByTestId('best-kg')).toHaveText('70kg');
    await expect(page.getByText('↑ +12.5 kg since July')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Weight progress chart' })).toBeVisible();
    await expect(page.locator('.hrow')).toHaveCount(8);
    await page.getByRole('button', { name: 'Show all 9' }).click();
    await expect(page.locator('.hrow')).toHaveCount(9);
    await page.getByRole('radio', { name: '3M' }).click();
    // Since 5 August: 7 entries, drawn as 6 dots plus the highlighted last point (2 circles).
    await expect(page.locator('.chart circle')).toHaveCount(6 + 2);
    await expect(page.locator('.chart')).not.toContainText('Jul');
    await page.getByRole('radio', { name: 'All' }).click();
    await expect(page.locator('.chart circle')).toHaveCount(8 + 2);
  });

  test('log a weight: new best, then same day keeps only the highest', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openMachine(page, 'Chest press');
    await expect(page.getByRole('button', { name: /70 kg, tap to type/ })).toBeVisible();
    await page.getByRole('button', { name: 'Increase weight' }).click();
    await page.getByRole('button', { name: 'Log', exact: true }).click();
    await expect(page.getByText('New best: 72.5 kg')).toBeVisible();
    await expect(page.getByTestId('best-kg')).toHaveText('72.5kg');

    await page.getByRole('button', { name: 'Decrease weight' }).click();
    await page.getByRole('button', { name: 'Decrease weight' }).click();
    await page.getByRole('button', { name: 'Log', exact: true }).click();
    await expect(page.getByText("Kept today's 72.5 kg")).toBeVisible();

    await page.getByRole('button', { name: /tap to type/ }).click();
    await page.getByLabel('Weight in kg').fill('75');
    await page.getByLabel('Weight in kg').press('Enter');
    await page.getByRole('button', { name: 'Log', exact: true }).click();
    await expect(page.getByTestId('best-kg')).toHaveText('75kg');
    const today = (await stored(page)).weights.filter((w) => w.machineId === 'chest' && w.date === '2026-11-05');
    expect(today).toHaveLength(1);
    expect(today[0].kg).toBe(75);
    await expect(page.locator('.hrow').first()).toContainText('5 Nov');
    await expect(page.locator('.hrow').first()).toContainText('Best');
  });

  test('a typed weight that makes no sense is refused', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openMachine(page, 'Chest press');
    await page.getByRole('button', { name: /tap to type/ }).click();
    await page.getByLabel('Weight in kg').fill('-3');
    await page.getByLabel('Weight in kg').press('Enter');
    await expect(page.getByText('Enter a weight between 0 and 1000 kg')).toBeVisible();
    await expect(page.getByRole('button', { name: /70 kg, tap to type/ })).toBeVisible();
  });

  test('the first weight of a new machine', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openMachine(page, 'Lateral raise');
    await expect(page.getByText('Log your first weight below')).toBeVisible();
    await expect(page.getByRole('button', { name: /20 kg, tap to type/ })).toBeVisible();
    await page.getByRole('button', { name: 'Decrease weight' }).click();
    await page.getByRole('button', { name: 'Decrease weight' }).click();
    await page.getByRole('button', { name: 'Decrease weight' }).click();
    await page.getByRole('button', { name: 'Log', exact: true }).click();
    await expect(page.getByText('Logged 12.5 kg')).toBeVisible();
    await expect(page.getByText('First logged 5 Nov')).toBeVisible();
  });

  test('delete a logged weight', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openMachine(page, 'Chest press');
    await page.getByRole('button', { name: 'Delete 70 kg on 3 Nov' }).click();
    await confirmBox(page).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByTestId('best-kg')).toHaveText('67.5kg');
    expect((await stored(page)).weights.some((w) => w.id === 'c8')).toBe(false);
  });

  test('rename and retag a machine', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openMachine(page, 'Seated row');
    await page.getByRole('button', { name: 'Edit' }).click();
    const s = sheet(page, 'Edit machine');
    await expect(s.getByLabel('Name')).toHaveValue('Seated row');
    await s.getByLabel('Name').fill('Cable row');
    await s.getByRole('radio', { name: 'Shoulders' }).click();
    await s.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: 'Cable row' })).toBeVisible();
    await expect(page.locator('.title-row .chip')).toHaveText('Shoulders');
  });

  test('delete a machine and its weights', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openMachine(page, 'Lat pulldown');
    await page.getByRole('button', { name: 'Edit' }).click();
    await sheet(page, 'Edit machine').getByRole('button', { name: 'Delete machine' }).click();
    await expect(confirmBox(page)).toContainText('Its 2 logged weights will be deleted too');
    await confirmBox(page).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { name: 'Weights' })).toBeVisible();
    await expect(rows(page)).toHaveCount(4);
    const d = await stored(page);
    expect(d.machines.some((m) => m.id === 'lat')).toBe(false);
    expect(d.weights.some((w) => w.machineId === 'lat')).toBe(false);
  });

  test('back button returns to the list', async ({ page }) => {
    await openApp(page, { data: seedData() });
    await openMachine(page, 'Chest press');
    await page.getByRole('button', { name: 'Weights', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Weights' })).toBeVisible();
  });
});
