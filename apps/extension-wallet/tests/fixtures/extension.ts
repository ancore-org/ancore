import { test as base, type Page } from '@playwright/test';

const AUTH_KEY = 'ancore_extension_auth';

export type WalletState = 'fresh' | 'onboarded-locked' | 'onboarded-unlocked';

const AUTH_PRESETS = {
  fresh: {
    hasOnboarded: false,
    isUnlocked: false,
    walletName: 'Ancore Wallet',
    accountAddress: 'GCFX...WALLET',
  },
  'onboarded-locked': {
    hasOnboarded: true,
    isUnlocked: false,
    walletName: 'Test Wallet',
    accountAddress: 'GCFX...WALLET',
  },
  'onboarded-unlocked': {
    hasOnboarded: true,
    isUnlocked: true,
    walletName: 'Test Wallet',
    accountAddress: 'GCFX...WALLET',
  },
} as const;

export interface ExtensionFixtures {
  seedWallet: (state: WalletState) => Promise<void>;
  clearWallet: () => Promise<void>;
}

export const test = base.extend<ExtensionFixtures>({
  seedWallet: async ({ page }, use) => {
    await use(async (state: WalletState) => {
      await page.goto('/');
      await page.evaluate(
        ([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        },
        [AUTH_KEY, AUTH_PRESETS[state]] as [string, object]
      );
    });
  },

  clearWallet: async ({ page }, use) => {
    await use(async () => {
      await page.evaluate((key) => localStorage.removeItem(key), AUTH_KEY);
    });
  },
});

export { expect } from '@playwright/test';

export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}
