import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

test('viewer loads and posts', async ({ page }) => {
  await page.goto(`${BASE}/viewer`);
  await expect(page.getByRole('heading', { name: /viewer/i })).toBeVisible();
  await page.getByPlaceholder('https://example.com').fill('https://example.com');
  await page.getByRole('button', { name: /start/i }).click();
  await expect(page.locator('[data-test="result"]')).toContainText(/ok|error/i);
});

test('watch redirects/serves viewer', async ({ page }) => {
  await page.goto(`${BASE}/watch`);
  await expect(page.url()).toContain('/viewer');
});
