import { expect, test, type Page } from '@playwright/test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

/**
 * Serves a private copy of dist/ so the test can change files on the "server" (a new deploy)
 * while the app is open, like GitHub Pages does after a push.
 */
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

let root: string;
let server: Server;
let base: string;

test.beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'gym-pwa-'));
  cpSync('dist', root, { recursive: true });
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/gym-tracker/')) {
      res.writeHead(404).end();
      return;
    }
    let rel = normalize(decodeURIComponent(url.pathname.slice('/gym-tracker/'.length)));
    if (rel === '.' || rel === '') rel = 'index.html';
    try {
      const body = readFileSync(join(root, rel));
      // Same caching as GitHub Pages: everything may be reused from the HTTP cache for 10 minutes.
      res.writeHead(200, { 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream', 'cache-control': 'max-age=600' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, 'localhost', () => r()));
  base = `http://localhost:${(server.address() as AddressInfo).port}/gym-tracker/`;
});

test.afterEach(async () => {
  // The browser keeps connections alive; drop them or close() waits until the test times out.
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(root, { recursive: true, force: true });
});

async function waitForControl(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
}

test('works offline once opened @pwa', async ({ page, context }) => {
  await page.goto(base);
  await expect(page.getByText('Ready to train?')).toBeVisible();
  await waitForControl(page);
  await page.getByRole('button', { name: 'Start Push' }).click();
  await expect(page.getByRole('button', { name: /^Start rest/ })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /^Start rest/ })).toBeVisible();
  await page.getByRole('button', { name: /^Start rest/ }).click();
  await expect(page.getByTestId('rest-clock')).toBeVisible();
  const icon = await page.evaluate(async () => (await fetch('./icon-192.png')).status);
  expect(icon).toBe(200);
});

test('a new deploy shows "Update" (after the workout) and installs fresh files @pwa', async ({ page }) => {
  await page.goto(base);
  await waitForControl(page);
  await page.getByRole('button', { name: 'Start Pull' }).click();
  await expect(page.getByRole('button', { name: /^Start rest/ })).toBeVisible();
  const before = await page.evaluate(() => caches.keys());
  expect(before).toHaveLength(1);

  // A new deploy within 10 minutes: new index.html and a new service worker version.
  const indexPath = join(root, 'index.html');
  writeFileSync(indexPath, readFileSync(indexPath, 'utf8').replace('<title>Gym</title>', '<title>Gym</title><meta name="build" content="next">'));
  const swPath = join(root, 'sw.js');
  writeFileSync(swPath, readFileSync(swPath, 'utf8').replace(/const VERSION = '([^']+)'/, "const VERSION = '$1-next'"));

  // Coming back to the app checks for updates. The banner waits while a workout is running.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const banner = page.getByRole('status').filter({ hasText: 'A new version is ready' });
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting), { timeout: 15_000 }).toBe(true);
  await expect(banner).toBeHidden();

  const hold = page.getByRole('button', { name: 'Hold to end workout' });
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click();
  await expect(banner).toBeVisible();
  // It must not cover the header buttons or the tab bar.
  const b = (await banner.boundingBox())!;
  const gear = (await page.getByRole('button', { name: 'Settings' }).boundingBox())!;
  const nav = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!;
  expect(b.y).toBeGreaterThan(gear.y + gear.height);
  expect(b.y + b.height).toBeLessThanOrEqual(nav.y);

  await Promise.all([page.waitForEvent('load'), banner.getByRole('button', { name: 'Update' }).click()]);
  await expect(page.getByText('Ready to train?')).toBeVisible();
  await expect(banner).toBeHidden();
  const after = await page.evaluate(() => caches.keys());
  expect(after).toHaveLength(1);
  expect(after[0]).toMatch(/-next$/);
  // The new cache holds the new index.html, not the old one from the browser's HTTP cache.
  const cachedIndex = await page.evaluate(async (name) => (await (await caches.open(name)).match('./'))!.text(), after[0]);
  expect(cachedIndex).toContain('name="build" content="next"');
  await expect(page.locator('meta[name="build"]')).toHaveCount(1);
});

test('the first install does not show an update banner @pwa', async ({ page }) => {
  await page.goto(base);
  await waitForControl(page);
  await page.reload();
  await expect(page.getByText('Ready to train?')).toBeVisible();
  await expect(page.getByText('A new version is ready')).toBeHidden();
});

test('manifest and icons are valid for Add to Home Screen @pwa', async ({ page }) => {
  await page.goto(base);
  const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
  expect(manifest).toMatchObject({ display: 'standalone', start_url: './', scope: './', short_name: 'Gym' });
  for (const icon of manifest.icons as { src: string; sizes: string }[]) {
    const ok = await page.evaluate(async (src) => (await fetch(src)).ok, icon.src);
    expect(ok, icon.src).toBe(true);
  }
  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect(touchIcon).toBe('/gym-tracker/apple-touch-icon.png');
  expect(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content')).toBe('yes');
});
