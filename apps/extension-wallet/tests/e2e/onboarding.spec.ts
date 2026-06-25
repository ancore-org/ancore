import { test, expect } from '../fixtures/extension';
import { OnboardingPage } from '../page-objects/OnboardingPage';
import { TEST_MNEMONICS, TEST_PASSWORD } from '../fixtures/test-mnemonics';

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

  // ── Real-artifact tests (unblock after #764 + #768) ───────────────────────

  test.skip('create wallet — mnemonic revealed + verified + password set → home screen (real artifact)', async ({
    extensionContext,
    extensionUrl,
  }) => {
    // TODO: unblocks after #764 + #768
    const page = await extensionContext.newPage();
    await page.goto(extensionUrl('index.html'));
    const onboarding = new OnboardingPage(page);

    await onboarding.selectCreateWallet();
    const wordEls = onboarding.getMnemonicWords();
    const words: string[] = [];
    for (const el of await wordEls.all()) {
      words.push((await el.innerText()).trim());
    }
    expect(words).toHaveLength(12);

    await page.getByRole('button', { name: /i.*saved|continue/i }).click();
    for (let i = 0; i < words.length; i++) {
      await onboarding.confirmMnemonicWord(i, words[i]);
    }
    await page.getByRole('button', { name: /verify|confirm/i }).click();

    await onboarding.enterPassword(TEST_PASSWORD);
    await onboarding.confirmPassword(TEST_PASSWORD);
    await onboarding.submitPassword();
    await onboarding.waitForHome();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });

  test.skip('import wallet — ALPHA mnemonic + password → home screen (real artifact)', async ({
    extensionContext,
    extensionUrl,
  }) => {
    // TODO: unblocks after #764
    const page = await extensionContext.newPage();
    await page.goto(extensionUrl('index.html'));
    const onboarding = new OnboardingPage(page);

    await onboarding.selectImportWallet();
    await onboarding.enterMnemonic(TEST_MNEMONICS.ALPHA);
    await page.getByRole('button', { name: /next|continue/i }).click();
    await onboarding.enterPassword(TEST_PASSWORD);
    await onboarding.confirmPassword(TEST_PASSWORD);
    await onboarding.submitPassword();
    await onboarding.waitForHome();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });

  test.skip('onboarding rejects mismatched mnemonic confirmation (real artifact)', async ({
    extensionContext,
    extensionUrl,
  }) => {
    // TODO: unblocks after #764
    const page = await extensionContext.newPage();
    await page.goto(extensionUrl('index.html'));
    const onboarding = new OnboardingPage(page);

    await onboarding.selectCreateWallet();
    await page.getByRole('button', { name: /i.*saved|continue/i }).click();
    await onboarding.confirmMnemonicWord(0, 'wrong');
    await page.getByRole('button', { name: /verify|confirm/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
