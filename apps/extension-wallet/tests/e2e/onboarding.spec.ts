import { test, expect } from '../fixtures/extension';

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page, clearWallet }) => {
    await page.goto('/');
    await clearWallet();
  });

  test('fresh wallet redirects to /welcome', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/welcome/);
    await expect(page.getByText('Meet your Ancore wallet')).toBeVisible();
  });

  test('welcome screen shows setup options', async ({ page }) => {
    await page.goto('/welcome');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('I already have a wallet')).toBeVisible();
    await expect(page.getByText('Create a wallet')).toBeVisible();
  });

  test('create wallet flow completes onboarding and lands on /home', async ({ page }) => {
    await page.goto('/welcome');
    await page.waitForLoadState('networkidle');

    await page.getByText('Create a wallet').click();
    await expect(page).toHaveURL(/\/create-account/);
    await expect(page.getByText('Create account')).toBeVisible();

    const nameInput = page.getByPlaceholder('My Ancore Wallet');
    await nameInput.clear();
    await nameInput.fill('E2E Test Wallet');

    await page.getByRole('button', { name: /Create wallet/i }).click();

    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  });

  test('onboarded wallet skips welcome and goes to unlock', async ({ page, seedWallet }) => {
    await seedWallet('onboarded-locked');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/unlock/);
  });

  test('authenticated wallet goes directly to home', async ({ page, seedWallet }) => {
    await seedWallet('onboarded-unlocked');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/home/);
  });

  test('protected route redirects unauthenticated user to welcome', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/welcome/);
  });
});
