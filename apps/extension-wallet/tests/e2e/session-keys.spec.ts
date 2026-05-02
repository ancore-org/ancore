import { test, expect, navigateTo } from '../fixtures/extension';

test.describe('Session key management', () => {
  test.beforeEach(async ({ page, seedWallet }) => {
    await seedWallet('onboarded-unlocked');
    await navigateTo(page, '/session-keys');
  });

  test('session keys screen is reachable from home', async ({ page }) => {
    await navigateTo(page, '/home');
    await page.getByText('Session keys').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/session-keys/);
  });

  test('session keys screen shows active keys list', async ({ page }) => {
    await expect(page.getByText('Active keys')).toBeVisible();
    await expect(page.getByText('Trading bot')).toBeVisible();
    await expect(page.getByText('Automation script')).toBeVisible();
  });

  test('session keys screen shows key validity info', async ({ page }) => {
    await expect(page.getByText(/Valid for 12 more hours/)).toBeVisible();
    await expect(page.getByText(/expires tomorrow/i)).toBeVisible();
  });

  test('add session key button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add session key/i })).toBeVisible();
  });

  test('unauthenticated user cannot access session keys', async ({ page, clearWallet }) => {
    await clearWallet();
    await page.goto('/session-keys');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/\/session-keys/);
  });

  test('settings are reachable and back link from session keys works', async ({ page }) => {
    await navigateTo(page, '/settings');
    await expect(page).toHaveURL(/\/settings/);
  });
});
