import { test as base, chromium, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';

const AUTH_KEY = 'ancore_extension_auth';

export type WalletState = 'fresh' | 'onboarded-locked' | 'onboarded-unlocked';

const TEST_SMART_ACCOUNT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';

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
    smartAccountId: TEST_SMART_ACCOUNT_ID,
  },
  'onboarded-unlocked': {
    hasOnboarded: true,
    isUnlocked: true,
    walletName: 'Test Wallet',
    accountAddress: 'GCFX...WALLET',
    smartAccountId: TEST_SMART_ACCOUNT_ID,
  },
} as const;

export interface ExtensionFixtures {
  seedWallet: (state: WalletState) => Promise<void>;
  clearWallet: () => Promise<void>;
  freezeTime: (isoDate: string) => Promise<void>;
  // Extension-loader fixtures for real-artifact tests
  extensionContext: BrowserContext;
  extensionId: string;
  extensionUrl: (path: string) => string;
}

export const test = base.extend<ExtensionFixtures>({
  seedWallet: async ({ page }, use) => {
    await use(async (state: WalletState) => {
      await page.addInitScript(
        ([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        },
        [AUTH_KEY, AUTH_PRESETS[state]] as [string, object]
      );
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await waitForAppReady(page);
    });
  },

  clearWallet: async ({ page }, use) => {
    await use(async () => {
      await page.addInitScript((key) => {
        localStorage.removeItem(key);
      }, AUTH_KEY);
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

  // Launches Chromium with the built dist/ loaded as an unpacked extension.
  // Prerequisites: run `pnpm build` before the suite.
  // eslint-disable-next-line no-empty-pattern
  extensionContext: async ({}, use) => {
    const distPath = path.resolve(__dirname, '../../dist');
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${distPath}`,
        `--load-extension=${distPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ extensionContext }, use) => {
    let extensionId = '';
    for (let attempts = 0; attempts < 10; attempts++) {
      const worker = extensionContext
        .serviceWorkers()
        .find((w) => w.url().startsWith('chrome-extension://'));
      if (worker) {
        extensionId = new URL(worker.url()).hostname;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!extensionId) {
      throw new Error(
        'Could not detect extension ID. Make sure the extension is built (`pnpm build`).'
      );
    }
    await use(extensionId);
  },

  extensionUrl: async ({ extensionId }, use) => {
    await use(
      (pagePath: string) => `chrome-extension://${extensionId}/${pagePath.replace(/^\//, '')}`
    );
  },
});

export { expect } from '@playwright/test';

/** Wait for AuthGuard vault init spinner to finish before asserting routes. */
export async function waitForAppReady(page: Page): Promise<void> {
  const spinner = page.getByTestId('auth-initializing');
  if (await spinner.count()) {
    await expect(spinner).toBeHidden({ timeout: 15_000 });
  }
}

export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
}
