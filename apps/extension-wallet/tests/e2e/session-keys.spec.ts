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

  test('session keys screen shows list section and empty state', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Session Keys' })).toBeVisible();
    await expect(page.getByText('Active Keys')).toBeVisible();
    await expect(page.getByText('No session keys yet.')).toBeVisible();
  });

  test('session keys screen exposes add session key actions', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add session key/i }).first()).toBeVisible();
    await expect(page.getByText('+ Add Session Key')).toBeVisible();
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
