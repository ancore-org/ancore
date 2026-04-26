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
  freezeTime: (isoDate: string) => Promise<void>;
}

export const test = base.extend<ExtensionFixtures>({
  seedWallet: async ({ page }, use) => {
    await use(async (state: WalletState) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
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

  freezeTime: async ({ page }, use) => {
    await use(async (isoDate: string) => {
      const fixedTime = new Date(isoDate).getTime();
      await page.addInitScript((mockedNow) => {
        const realNow = Date.now.bind(Date);
        Date.now = () => mockedNow;
        (window as Window & { __restoreDateNow?: () => void }).__restoreDateNow = () => {
          Date.now = realNow;
        };
      }, fixedTime);
    });
  },
});

export { expect } from '@playwright/test';

export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}
