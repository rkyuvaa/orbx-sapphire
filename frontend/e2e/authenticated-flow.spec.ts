import { expect, test } from '@playwright/test';

const storageState = process.env.PLAYWRIGHT_AUTH_STORAGE_STATE;

test.describe('authenticated flow scaffold', () => {
  test.skip(
    !storageState,
    'Set PLAYWRIGHT_AUTH_STORAGE_STATE to a pre-created, non-production storage-state file to run authenticated checks.',
  );

  test('opens the workspace with an existing session', async ({ page }) => {
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/workspace(?:\?|$)/);
  });
});
