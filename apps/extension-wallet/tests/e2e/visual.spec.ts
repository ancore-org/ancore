import { test, expect, navigateTo } from '../fixtures/extension';

test.describe('Extension visual regression @visual', () => {
  test('captures popup shells for major screens', async ({ page, seedWallet, freezeTime }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await seedWallet('onboarded-unlocked');

    const screens = [
      { path: '/home', name: 'popup-home.png' },
      { path: '/settings', name: 'popup-settings.png' },
      { path: '/session-keys', name: 'popup-session-keys.png' },
      { path: '/send', name: 'popup-send.png' },
      { path: '/unlock', name: 'popup-unlock.png' },
      { path: '/sign-transaction', name: 'popup-sign-transaction.png' },
    ] as const;

    for (const screen of screens) {
      await navigateTo(page, screen.path);
      await expect(page.locator('body')).toHaveScreenshot(screen.name, {
        maxDiffPixelRatio: 0.02,
      });
    }
  });

  test('captures the side panel approval shell', async ({ page, freezeTime }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await navigateTo(page, '/sidepanel/index.html?requestId=demo');

    await expect(page.locator('body')).toHaveScreenshot('sidepanel-empty.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
