/**
 * Playwright e2e mock — no physical Ledger required.
 * Seeds hardware-wallet preference and asserts Settings UX + approval copy.
 */
import { test, expect, navigateTo } from '../fixtures/extension';

const HARDWARE_KEY = 'ancore_hardware_wallet';

test.describe('Ledger hardware wallet @ledger', () => {
  test('settings screen shows hardware wallet entry and paired state', async ({
    page,
    seedWallet,
    freezeTime,
  }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await page.addInitScript(
      ([key, value]) => {
        localStorage.setItem(key, value);
      },
      [
        HARDWARE_KEY,
        JSON.stringify({
          state: {
            signerMode: 'ledger',
            ledgerAccountIndex: 0,
            ledgerPublicKey: 'GCFXTESTLEDGERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            ledgerPath: "44'/148'/0'",
            ledgerAppVersion: '5.0.0',
          },
          version: 1,
        }),
      ] as [string, string]
    );
    await seedWallet('onboarded-unlocked');
    await navigateTo(page, '/settings');

    await expect(page.getByText('Hardware wallet')).toBeVisible();
    await page.getByText('Hardware wallet').click();
    await expect(page.getByText('Paired device')).toBeVisible();
    await expect(page.getByText(/44'\/148'\/0'/)).toBeVisible();
  });
});
