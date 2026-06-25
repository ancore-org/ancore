import { test, expect, navigateTo } from '../fixtures/extension';
import { TEST_PASSWORD } from '../fixtures/test-mnemonics';

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
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/welcome/);
  });

  // ── Real-artifact tests (unblock after #764) ───────────────────────────────

  test.skip('extension popup opens and renders root UI (real artifact)', async ({
    extensionContext,
    extensionUrl,
  }) => {
    // TODO: unblocks after #764
    const page = await extensionContext.newPage();
    await page.goto(extensionUrl('index.html'));
    await page.waitForLoadState('domcontentloaded');
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test.skip('unlock with correct password → home screen shown (real artifact)', async ({
    extensionContext,
    extensionUrl,
  }) => {
    // TODO: unblocks after #764
    const page = await extensionContext.newPage();
    await page.goto(extensionUrl('index.html'));
    await page.getByRole('button', { name: /lock/i }).click();
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /unlock/i }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });

  test.skip('unlock with wrong password → error message shown (real artifact)', async ({
    extensionContext,
    extensionUrl,
  }) => {
    // TODO: unblocks after #764
    const page = await extensionContext.newPage();
    await page.goto(extensionUrl('index.html'));
    await page.getByRole('button', { name: /lock/i }).click();
    await page.getByLabel(/password/i).fill('wrong-password');
    await page.getByRole('button', { name: /unlock/i }).click();
    await expect(page.getByRole('alert')).toContainText(/incorrect|invalid/i);
  });
});
