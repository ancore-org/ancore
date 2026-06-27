import { test, expect, navigateTo, waitForAppReady } from '../fixtures/extension';

test.describe('Extension release-candidate smoke @smoke', () => {
  test('onboarding welcome loads and create wallet flow starts', async ({
    page,
    clearWallet,
    freezeTime,
  }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await clearWallet();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Welcome to Ancore/i })).toBeVisible();
    await page.getByRole('button', { name: /Create New Wallet/i }).click();
    await expect(page.getByRole('button', { name: /I've Saved My Recovery Phrase/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('onboarded unlocked wallet lands on home', async ({ page, seedWallet, freezeTime }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await seedWallet('onboarded-unlocked');

    await page.waitForURL(/\/home/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  });

  test('locked wallet unlocks and returns to home', async ({ page, seedWallet, freezeTime }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await seedWallet('onboarded-locked');

    await page.waitForURL(/\/unlock/, { timeout: 15_000 });
    await page.getByPlaceholder('Enter your password').fill('smoke-pass');
    await page.getByRole('button', { name: /Unlock/i }).click();

    await page.waitForURL(/\/home/, { timeout: 15_000 });
    await expect(page.getByText('Available balance')).toBeVisible();
  });

  test('send and receive core screens are reachable', async ({ page, seedWallet, freezeTime }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await seedWallet('onboarded-unlocked');
    await page.waitForURL(/\/home/, { timeout: 15_000 });

    await page.getByRole('link', { name: /Send funds/i }).click();
    await expect(page).toHaveURL(/\/send/);
    await expect(page.getByLabel('Recipient')).toBeVisible();
    await expect(page.getByLabel('Amount')).toBeVisible();

    await navigateTo(page, '/home');
    await page.getByRole('link', { name: /Receive funds/i }).click();
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

    await expect(page.getByRole('heading', { name: 'Session Keys' })).toBeVisible();
    await expect(page.getByText('Active Keys')).toBeVisible();
    await expect(page.getByRole('button', { name: /Add session key/i })).toBeVisible();

    await clearWallet();
    await page.goto('/session-keys', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expect(page).not.toHaveURL(/\/session-keys$/);
  });

  test('settings screen renders i18n copy without layout regression @smoke', async ({
    seedWallet,
    freezeTime,
    page,
  }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await seedWallet('onboarded-unlocked');
    await navigateTo(page, '/settings');

    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Manage your wallet preferences')).toBeVisible();
    await expect(page.getByText('About Ancore')).toBeVisible();
    await expect(page.getByText('Notifications (Demo)')).toBeVisible();

    // Visual baseline for local regression; CI validates rendered i18n copy via assertions above.
    if (!process.env.CI) {
      await expect(page.locator('.bg-gradient-to-br.from-primary')).toHaveScreenshot(
        'settings-header.png',
        { maxDiffPixelRatio: 0.02 }
      );
    }
  });
});
