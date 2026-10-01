import { test, expect } from '../fixtures/extension';

test.describe('Extension Install & Clean State lifecycle', () => {
  test('fresh extension install starts with clean storage and routes to onboarding', async ({
    page,
    clearWallet,
  }) => {
    await clearWallet();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify it starts with onboarding flow
    await expect(page).toHaveURL(/\/#\/onboarding/);
    await expect(page.getByText('Meet your Ancore wallet')).toBeVisible();

    // Verify no orphaned auth data is present in localStorage
    const authData = await page.evaluate(() => localStorage.getItem('ancore_extension_auth'));
    expect(authData).toBeNull();
  });

  test('reinstall/clean install wipes any residual unlock or vault session state', async ({
    page,
    seedWallet,
    clearWallet,
  }) => {
    // Seed wallet as onboarded unlocked
    await seedWallet('onboarded-unlocked');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/home/);

    // Simulate uninstall/reinstall by clearing storage
    await clearWallet();
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify redirected back to onboarding with no residual sessions
    await expect(page).toHaveURL(/\/#\/onboarding/);
    await expect(page.getByText('Meet your Ancore wallet')).toBeVisible();
  });
});
