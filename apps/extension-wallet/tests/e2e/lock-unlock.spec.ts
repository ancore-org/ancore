import { test, expect, navigateTo } from '../fixtures/extension';

test.describe('Lock / unlock flow', () => {
  test('locked wallet shows unlock screen', async ({ page, seedWallet }) => {
    await seedWallet('onboarded-locked');
    await navigateTo(page, '/');
    await expect(page).toHaveURL(/\/unlock/);
    await expect(page.getByText('Unlock wallet')).toBeVisible();
  });

  test('unlock screen shows wallet name and address', async ({ page, seedWallet }) => {
    await seedWallet('onboarded-locked');
    await navigateTo(page, '/unlock');
    await expect(page.getByText('Test Wallet')).toBeVisible();
    await expect(page.getByText('GCFX...WALLET')).toBeVisible();
  });

  test('unlock with any password grants access to home', async ({ page, seedWallet }) => {
    await seedWallet('onboarded-locked');
    await navigateTo(page, '/unlock');

    await page.getByPlaceholder('Enter your password').fill('anypassword');
    await page.getByRole('button', { name: /Unlock/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  });

  test('unlock button is disabled when password is empty', async ({ page, seedWallet }) => {
    await seedWallet('onboarded-locked');
    await navigateTo(page, '/unlock');

    const unlockBtn = page.getByRole('button', { name: /Unlock/i });
    await expect(unlockBtn).toBeDisabled();
  });

  test('locking wallet redirects to unlock screen', async ({ page, seedWallet }) => {
    await seedWallet('onboarded-unlocked');
    await navigateTo(page, '/home');

    await page.getByRole('button', { name: /Lock wallet/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/unlock/);
  });

  test('locked wallet cannot access protected routes directly', async ({ page, seedWallet }) => {
    await seedWallet('onboarded-locked');
    await page.goto('/send');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unlock/);
  });

  test('reset wallet returns to fresh state', async ({ page, seedWallet }) => {
    await seedWallet('onboarded-locked');
    await navigateTo(page, '/unlock');

    await page.getByRole('button', { name: /Reset demo wallet/i }).click();
    // After reset the app stays at /unlock; navigate to / to trigger root redirect
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/welcome/);
  });
});
