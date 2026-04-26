import { test, expect, navigateTo } from '../fixtures/extension';

test.describe('Extension release-candidate smoke @smoke', () => {
  test('onboarding creates wallet and lands on home', async ({ page, clearWallet, freezeTime }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await clearWallet();

    await page.goto('/welcome');
    await page.getByText('Create a wallet').click();
    await expect(page).toHaveURL(/\/create-account/);

    const walletName = page.getByPlaceholder('My Ancore Wallet');
    await walletName.fill('Smoke Wallet');
    await page.getByRole('button', { name: /Create wallet/i }).click();

    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  });

  test('locked wallet unlocks and returns to home', async ({ page, seedWallet, freezeTime }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await seedWallet('onboarded-locked');
    await navigateTo(page, '/');

    await expect(page).toHaveURL(/\/unlock/);
    await page.getByPlaceholder('Enter your password').fill('smoke-pass');
    await page.getByRole('button', { name: /Unlock/i }).click();

    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByText('Available balance')).toBeVisible();
  });

  test('send and receive core screens are reachable', async ({ page, seedWallet, freezeTime }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await seedWallet('onboarded-unlocked');
    await navigateTo(page, '/home');

    await page.getByText('Send funds').click();
    await expect(page).toHaveURL(/\/send/);
    await expect(page.getByPlaceholder('Recipient address')).toBeVisible();
    await expect(page.getByPlaceholder('Amount')).toBeVisible();

    await navigateTo(page, '/home');
    await page.getByText('Receive funds').click();
    await expect(page).toHaveURL(/\/receive/);
    await expect(page.getByRole('button', { name: /Copy address/i })).toBeVisible();
  });

  test('session key page is available for unlocked wallet and blocked when logged out', async ({
    page,
    seedWallet,
    clearWallet,
    freezeTime,
  }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await seedWallet('onboarded-unlocked');
    await navigateTo(page, '/session-keys');

    await expect(page.getByText('Active keys')).toBeVisible();
    await expect(page.getByRole('button', { name: /Add session key/i })).toBeVisible();

    await clearWallet();
    await navigateTo(page, '/session-keys');
    await expect(page).not.toHaveURL(/\/session-keys$/);
  });
});
