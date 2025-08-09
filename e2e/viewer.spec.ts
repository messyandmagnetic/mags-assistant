import { test, expect } from '@playwright/test';
const BASE = process.env.BASE_URL || 'http://localhost:3000';

test('viewer loads & posts', async ({ page }) => {
  await page.goto(`${BASE}/viewer`);
  await expect(page.getByRole('heading', { name: /viewer/i })).toBeVisible();
  await page.getByPlaceholder('https://example.com').fill('https://example.com');
  await page.getByRole('button', { name: /start/i }).click();
  await expect(page.locator('[data-test="result"], pre')).toContainText(/ok|error/i);
});

test('watch alias works', async ({ page }) => {
  await page.goto(`${BASE}/watch`);
  await expect(page.url()).toContain('/viewer');
});
