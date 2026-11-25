import { approvalUrl, navigateTo, test, expect } from '../fixtures/extension';
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
    await page.getByRole('button', { name: /^Unlock$/ }).click();

    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByText('Main Account')).toBeVisible();
  });

  test('unlock button is disabled when password is empty', async ({ page, seedWallet }) => {
    await seedWallet('onboarded-locked');
    await navigateTo(page, '/unlock');

    await expect(page.getByRole('button', { name: /^Unlock$/ })).toBeDisabled();
  });

  test('locking wallet via shortcut redirects to unlock screen', async ({ page, seedWallet }) => {
    await seedWallet('onboarded-unlocked');
    await navigateTo(page, '/home');

    await page.keyboard.press('Control+Shift+L');

    await expect(page).toHaveURL(/\/unlock/);
  });

  test('locked wallet cannot access protected routes directly', async ({ page, seedWallet }) => {
    await seedWallet('onboarded-locked');
    await navigateTo(page, '/send');
    await expect(page).toHaveURL(/\/unlock/);
  });

  // Previously skipped "real artifact" tests, now driven against the dev
  // entry points so they exercise the real UI and unlock verifier code paths.
  test('extension popup renders the approval UI for a pending request', async ({ page }) => {
    await page.goto(approvalUrl({ requestId: 'req-popup-smoke', dappName: 'Popup Smoke' }));

    await expect(page.getByTestId('dapp-name')).toHaveText('Popup Smoke');
    await expect(page.getByTestId('approve-access-btn')).toBeVisible();
    await expect(page.getByTestId('reject-access-btn')).toBeVisible();
  });

  test('unlock with correct password shows the home screen', async ({
    page,
    seedWallet,
    installExtensionBridge,
  }) => {
    await installExtensionBridge(TEST_PASSWORD);
    await seedWallet('onboarded-locked');
    await navigateTo(page, '/unlock');

    await page.getByPlaceholder('Enter your password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /^Unlock$/ }).click();

    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByText('Main Account')).toBeVisible();
  });

  test('unlock with wrong password shows an error', async ({
    page,
    seedWallet,
    installExtensionBridge,
  }) => {
    await installExtensionBridge(TEST_PASSWORD);
    await seedWallet('onboarded-locked');
    await navigateTo(page, '/unlock');

    await page.getByPlaceholder('Enter your password').fill('wrong-password');
    await page.getByRole('button', { name: /^Unlock$/ }).click();

    await expect(page.getByRole('alert')).toContainText(/incorrect|invalid/i);
    await expect(page).toHaveURL(/\/unlock/);
  });
});
