import { test, expect, navigateTo } from '../fixtures/extension';

test.describe('Transaction flow', () => {
  test.beforeEach(async ({ page, seedWallet }) => {
    await seedWallet('onboarded-unlocked');
    await navigateTo(page, '/home');
  });

  test('home screen shows wallet balance and navigation links', async ({ page }) => {
    await expect(page.getByText('Available balance')).toBeVisible();
    await expect(page.getByText('1,245.80 XLM')).toBeVisible();
    await expect(page.getByText('Send funds')).toBeVisible();
    await expect(page.getByText('Receive funds')).toBeVisible();
  });

  test('navigates to /send from home', async ({ page }) => {
    await page.getByText('Send funds').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/send/);
    await expect(page.getByRole('heading', { name: 'Send' })).toBeVisible();
  });

  test('send screen renders recipient and amount inputs', async ({ page }) => {
    await navigateTo(page, '/send');
    await expect(page.getByPlaceholder('Recipient address')).toBeVisible();
    await expect(page.getByPlaceholder('Amount')).toBeVisible();
    await expect(page.getByRole('button', { name: /Review transaction/i })).toBeVisible();
  });

  test('navigates to /receive from home', async ({ page }) => {
    await page.getByText('Receive funds').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/receive/);
    await expect(page.getByRole('heading', { name: 'Receive', exact: true })).toBeVisible();
  });

  test('receive screen shows address and actions', async ({ page }) => {
    await navigateTo(page, '/receive');
    await expect(page.getByText('Receive funds')).toBeVisible();
    await expect(page.getByRole('button', { name: /Copy address/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Show QR/i })).toBeVisible();
  });

  test('navigates to /history from home', async ({ page }) => {
    await page.getByText('View history').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/history/);
    await expect(page.getByText('Recent activity')).toBeVisible();
  });

  test('history screen lists recent transactions', async ({ page }) => {
    await navigateTo(page, '/history');
    await expect(page.getByText('Received from Treasury')).toBeVisible();
    await expect(page.getByText('Sent to Merchant')).toBeVisible();
    await expect(page.getByText('+320 XLM')).toBeVisible();
  });
});
