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

  test('create wallet — mnemonic revealed + verified + password set → home screen (real artifact)', async ({
    extensionContext,
    extensionUrl,
  }) => {
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

    await onboarding.confirmMnemonicChallenge(words);

    await page.getByRole('button', { name: /verify|continue/i }).click();

    await onboarding.enterPassword(TEST_PASSWORD);
    await onboarding.confirmPassword(TEST_PASSWORD);
    await onboarding.submitPassword();
    await onboarding.waitForHome();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });

  test('import wallet — ALPHA mnemonic + password → home screen (real artifact)', async ({
    extensionContext,
    extensionUrl,
  }) => {
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

  test('onboarding rejects mismatched mnemonic confirmation (real artifact)', async ({
    extensionContext,
    extensionUrl,
  }) => {
    const page = await extensionContext.newPage();
    await page.goto(extensionUrl('index.html'));
    const onboarding = new OnboardingPage(page);

    await onboarding.selectCreateWallet();
    await page.getByRole('button', { name: /i.*saved|continue/i }).click();

    await onboarding.failMnemonicChallenge();

    await page.getByRole('button', { name: /verify|continue/i }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
