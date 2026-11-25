import { approvalUrl, test, expect } from '../fixtures/extension';

const MOCK_DAPP_ORIGIN = 'https://app.example-dapp.test';
const MOCK_DAPP_NAME = 'Example DApp';

/**
 * Grant-access flow specs.
 *
 * These drive the real GrantAccess UI rendered by the popup entry when a dApp
 * request is pending (src/popup/index.html?requestId=...), which is how the
 * extension opens an approval window. The chrome bridge records the message
 * the screen sends to the background so approve and reject are asserted on
 * the real code path.
 */
test.describe('grant access', () => {
  test('approve a requestAccess prompt sends APPROVE_ACCESS_REQUEST', async ({
    page,
    installExtensionBridge,
  }) => {
    const readMessages = await installExtensionBridge();
    await page.goto(
      approvalUrl({
        requestId: 'req-approve',
        dappName: MOCK_DAPP_NAME,
        origin: MOCK_DAPP_ORIGIN,
        description: 'Connect to Example DApp',
      })
    );

    await expect(page.getByTestId('dapp-name')).toHaveText(MOCK_DAPP_NAME);
    await expect(page.getByTestId('dapp-origin')).toContainText(MOCK_DAPP_ORIGIN);

    await page.getByTestId('approve-access-btn').click();

    await expect(page.getByRole('heading', { name: 'Request Processed' })).toBeVisible();
    const messages = await readMessages();
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'APPROVE_ACCESS_REQUEST', requestId: 'req-approve' }),
      ])
    );
  });

  test('deny a requestAccess prompt sends REJECT_ACCESS_REQUEST', async ({
    page,
    installExtensionBridge,
  }) => {
    const readMessages = await installExtensionBridge();
    await page.goto(
      approvalUrl({
        requestId: 'req-deny',
        dappName: MOCK_DAPP_NAME,
        origin: MOCK_DAPP_ORIGIN,
      })
    );

    await expect(page.getByTestId('dapp-name')).toHaveText(MOCK_DAPP_NAME);

    await page.getByTestId('reject-access-btn').click();

    await expect(page.getByRole('heading', { name: 'Request Processed' })).toBeVisible();
    const messages = await readMessages();
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'REJECT_ACCESS_REQUEST', requestId: 'req-deny' }),
      ])
    );
  });

  // Skipped: the connected-sites settings view exists but has no navigation
  // item in the settings menu, so there is no UI path to approve an origin,
  // open the allowlist and revoke it. Tracked in
  // https://github.com/ancore-org/ancore/issues/1733
  test.skip('approved origin appears in connected sites and can be revoked', async ({ page }) => {
    await page.goto(
      approvalUrl({
        requestId: 'req-allowlist',
        dappName: MOCK_DAPP_NAME,
        origin: MOCK_DAPP_ORIGIN,
      })
    );
    await page.getByTestId('approve-access-btn').click();
    await expect(page.getByRole('heading', { name: 'Request Processed' })).toBeVisible();
  });
});
