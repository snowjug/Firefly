import { expect, test } from '@playwright/test';

// A placeholder for the browser suite while the interface is rebuilt. The next commits replace it
// with the journeys of the new product.
test('the server is up and serves the app', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Firefly' })).toBeVisible();
});
