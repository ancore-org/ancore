import { test, expect, navigateTo } from '../fixtures/extension';

test.describe('Extension visual regression @visual', () => {
  test('captures popup shells for major screens', async ({ page, seedWallet, freezeTime }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await seedWallet('onboarded-unlocked');
  test('captures the side panel approval shell', async ({ page, freezeTime }) => {
    await freezeTime('2026-01-15T10:00:00.000Z');
    await navigateTo(page, '/sidepanel/index.html?requestId=demo');

    await expect(page.locator('body')).toHaveScreenshot('sidepanel-empty.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
