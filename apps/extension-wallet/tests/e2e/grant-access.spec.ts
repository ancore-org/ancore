import { test, expect } from '../fixtures/extension';
import { AllowlistPage } from '../page-objects/AllowlistPage';

const MOCK_DAPP_ORIGIN = 'https://app.example-dapp.test';

/**
 * Grant-access / allowlist flow specs.
 * Injects a mock wallet-api requestAccess call and asserts the smart account
 * ID is returned after user approval.
 *
 * Full flow unblocks after #764 + #768.
 */
test.describe('grant access', () => {
  test.skip('inject mock requestAccess → approve → smart account id returned to dapp', async ({
    context,
    extensionUrl,
  }) => {
    // TODO: unblocks after #764 + #768
    const page = await context.newPage();
    await page.goto(extensionUrl('index.html'));

    // Simulate a dApp calling requestAccess via the wallet API message bus
    await page.evaluate((origin) => {
      window.postMessage({ type: 'ANCORE_REQUEST_ACCESS', origin, requestId: 'req-001' }, '*');
    }, MOCK_DAPP_ORIGIN);

    const allowlist = new AllowlistPage(page);
    await allowlist.waitForApprovalPrompt();
    await allowlist.approveAccessRequest();

    // Extension should post back with the smart account ID
    const response = await page.evaluate(
      () =>
        new Promise<{ smartAccountId: string }>((resolve) => {
          window.addEventListener('message', (evt) => {
            if ((evt.data as Record<string, unknown>).type === 'ANCORE_ACCESS_GRANTED') {
              resolve(evt.data as { smartAccountId: string });
            }
          });
        })
    );

    expect(response.smartAccountId).toBeTruthy();
    expect(response.smartAccountId).toMatch(/^[CG]/); // Stellar address prefix
  });

  test.skip('inject mock requestAccess → deny → error returned to dapp', async ({
    context,
    extensionUrl,
  }) => {
    // TODO: unblocks after #764
    const page = await context.newPage();
    await page.goto(extensionUrl('index.html'));

    await page.evaluate((origin) => {
      window.postMessage({ type: 'ANCORE_REQUEST_ACCESS', origin, requestId: 'req-002' }, '*');
    }, MOCK_DAPP_ORIGIN);

    const allowlist = new AllowlistPage(page);
    await allowlist.waitForApprovalPrompt();
    await allowlist.denyAccessRequest();

    const response = await page.evaluate(
      () =>
        new Promise<{ error: string }>((resolve) => {
          window.addEventListener('message', (evt) => {
            if ((evt.data as Record<string, unknown>).type === 'ANCORE_ACCESS_DENIED') {
              resolve(evt.data as { error: string });
            }
          });
        })
    );

    expect(response.error).toMatch(/denied|rejected/i);
  });

  test.skip('approved origin appears in allowlist settings and can be revoked', async ({
    context,
    extensionUrl,
  }) => {
    // TODO: unblocks after #764
    const page = await context.newPage();
    await page.goto(extensionUrl('index.html'));

    // Grant access first
    await page.evaluate((origin) => {
      window.postMessage({ type: 'ANCORE_REQUEST_ACCESS', origin, requestId: 'req-003' }, '*');
    }, MOCK_DAPP_ORIGIN);

    const allowlist = new AllowlistPage(page);
    await allowlist.waitForApprovalPrompt();
    await allowlist.approveAccessRequest();

    // Navigate to allowlist settings and verify the origin is listed
    await allowlist.navigate();
    await expect(page.getByTestId(`allowlist-origin-${MOCK_DAPP_ORIGIN}`)).toBeVisible();

    // Revoke and confirm it's removed
    await allowlist.revokeOrigin(MOCK_DAPP_ORIGIN);
    await expect(page.getByTestId(`allowlist-origin-${MOCK_DAPP_ORIGIN}`)).not.toBeVisible();
  });
});
