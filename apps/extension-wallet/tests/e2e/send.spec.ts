import { test, expect } from '../fixtures/extension';
import { SendPage } from '../page-objects/SendPage';
import { HistoryPage } from '../page-objects/HistoryPage';

// Testnet BRAVO address (derived from TEST_MNEMONICS.BRAVO — no real funds)
const BRAVO_ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';

/**
 * Send flow specs.
 * Horizon submit is mocked via page.route() so no real testnet calls are made.
 * Full flow unblocks after #764 (real vault unlock).
 */
test.describe('send', () => {
  test('unlock → fill send form → mock Horizon submit → tx hash shown in history', async ({
    context,
    extensionUrl,
  }) => {
    const page = await context.newPage();

    // Mock Horizon transaction submission
    await page.route('**/transactions', (route) => {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hash: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
          successful: true,
        }),
      });
    });

    await page.goto(extensionUrl('index.html'));

    // Unlock wallet
    await page.getByRole('button', { name: /lock/i }).click();
    await page.getByLabel(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /unlock/i }).click();
    await page.waitForSelector('[data-testid="home-screen"]');

    const send = new SendPage(page);
    await send.navigate();
    await send.fillDestination(BRAVO_ADDRESS);
    await send.fillAmount('1');
    await send.submit();
    await send.confirm();
    await send.waitForSuccess();

    const txHash = send.getTxHashLocator();
    await expect(txHash).toBeVisible();
    const hash = await txHash.innerText();
    expect(hash).toHaveLength(64);

    // Verify it appears in history
    const history = new HistoryPage(page);
    await history.navigate();
    await history.waitForAtLeastOne();
    const firstHash = await history.getFirstTxHash();
    expect(firstHash).toBe(hash);
  });

  test('send form rejects invalid Stellar address', async ({ context, extensionUrl }) => {
    const page = await context.newPage();
    await page.goto(extensionUrl('index.html'));
    await page.getByRole('button', { name: /lock/i }).click();
    await page.getByLabel(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /unlock/i }).click();
    await page.waitForSelector('[data-testid="home-screen"]');

    const send = new SendPage(page);
    await send.navigate();
    await send.fillDestination('not-a-valid-address');
    await send.fillAmount('1');
    await send.submit();
    await expect(page.getByRole('alert')).toContainText(/invalid.*address/i);
  });

  test('send form rejects amount exceeding balance', async ({ context, extensionUrl }) => {
    const page = await context.newPage();
    await page.goto(extensionUrl('index.html'));
    await page.getByRole('button', { name: /lock/i }).click();
    await page.getByLabel(/password/i).fill('TestPassword123!');
    await page.getByRole('button', { name: /unlock/i }).click();
    await page.waitForSelector('[data-testid="home-screen"]');

    const send = new SendPage(page);
    await send.navigate();
    await send.fillDestination(BRAVO_ADDRESS);
    await send.fillAmount('999999999');
    await send.submit();
    await expect(page.getByRole('alert')).toContainText(/insufficient|balance/i);
  });
});
