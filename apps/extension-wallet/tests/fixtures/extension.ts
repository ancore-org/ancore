import { test as base, chromium, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// This package is "type": "module", so __dirname does not exist here.
const dirname = path.dirname(fileURLToPath(import.meta.url));

const AUTH_KEY = 'ancore_extension_auth';

export type WalletState = 'fresh' | 'onboarded-locked' | 'onboarded-unlocked';

const TEST_SMART_ACCOUNT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';

const AUTH_PRESETS = {
  fresh: {
    hasOnboarded: false,
    walletName: 'Ancore Wallet',
    accountAddress: 'GCFX...WALLET',
  },
  'onboarded-locked': {
    hasOnboarded: true,
    walletName: 'Test Wallet',
    accountAddress: 'GCFX...WALLET',
    smartAccountId: TEST_SMART_ACCOUNT_ID,
  },
  'onboarded-unlocked': {
    hasOnboarded: true,
    walletName: 'Test Wallet',
    accountAddress: 'GCFX...WALLET',
    smartAccountId: TEST_SMART_ACCOUNT_ID,
  },
} as const;

export interface ExtensionFixtures {
  seedWallet: (state: WalletState) => Promise<void>;
  clearWallet: () => Promise<void>;
  freezeTime: (isoDate: string) => Promise<void>;
  /**
   * Installs a localStorage-backed chrome shim into the dev page before any
   * app script runs. It records every runtime message so approval requests can
   * be asserted, and resolves UNLOCK_WALLET against `unlockPassword` so the
   * real unlock verifier code path is exercised without a built extension.
   * Returns a reader for the recorded messages.
   */
  installExtensionBridge: (
    unlockPassword?: string
  ) => Promise<() => Promise<Record<string, unknown>[]>>;
  // Extension-loader fixtures for tests that load the built dist/ artifact
  extensionContext: BrowserContext;
  extensionId: string;
  extensionUrl: (path: string) => string;
}

export const test = base.extend<ExtensionFixtures>({
  seedWallet: async ({ page }, use) => {
    await use(async (state: WalletState) => {
      await page.addInitScript(
        ([key, value, initiallyUnlocked]) => {
          localStorage.setItem(key, JSON.stringify(value));
          if (initiallyUnlocked) {
            window.__E2E_INITIALLY_UNLOCKED__ = true;
          }
        },
        [AUTH_KEY, AUTH_PRESETS[state], state === 'onboarded-unlocked'] as [string, object, boolean]
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

  installExtensionBridge: async ({ page }, use) => {
    await use(async (unlockPassword?: string) => {
      await page.addInitScript((expectedPassword?: string) => {
        type RecordedMessage = Record<string, unknown> & {
          type?: string;
          payload?: { password?: string };
        };
        const messages: RecordedMessage[] = [];
        (window as unknown as { __E2E_MESSAGES__: RecordedMessage[] }).__E2E_MESSAGES__ = messages;

        // chrome.storage.local proxies to localStorage so fixtures that seed
        // auth state with localStorage keep working once the shim is present.
        const local = {
          get: (key: string, cb: (result: Record<string, string>) => void) => {
            const value = localStorage.getItem(key);
            cb(value === null ? {} : { [key]: value });
          },
          set: (items: Record<string, string>, cb?: () => void) => {
            for (const [key, value] of Object.entries(items)) {
              localStorage.setItem(key, String(value));
            }
            cb?.();
          },
          remove: (key: string, cb?: () => void) => {
            localStorage.removeItem(key);
            cb?.();
          },
        };

        const shim = {
          storage: { local },
          runtime: {
            lastError: null,
            sendMessage: (message: RecordedMessage, cb?: (response?: unknown) => void) => {
              messages.push(message);
              if (message.type === 'UNLOCK_WALLET') {
                cb?.({
                  ok: true,
                  payload: {
                    success: expectedPassword
                      ? message.payload?.password === expectedPassword
                      : true,
                  },
                });
                return;
              }
              cb?.({ ok: true, payload: {} });
            },
          },
        };
        (window as unknown as { chrome: typeof shim }).chrome = shim;
      }, unlockPassword);

      return async () =>
        page.evaluate(
          () =>
            (window as unknown as { __E2E_MESSAGES__?: Record<string, unknown>[] })
              .__E2E_MESSAGES__ ?? []
        );
    });
  },

  // Launches Chromium with the built dist/ loaded as an unpacked extension.
  // Prerequisites: run `pnpm build` before the suite.
  // eslint-disable-next-line no-empty-pattern
  extensionContext: async ({}, use) => {
    const distPath = path.resolve(dirname, '../../dist');
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
  // The app uses HashRouter in dev (see router/index.tsx), so app routes live
  // under the URL hash. A plain pathname navigation never reaches them and
  // silently falls back to whatever route has no hash (e.g. /home).
  await page.goto(`/#${path}`, { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
}

/**
 * URL for the popup entry with a pending grant-access approval. The Vite dev
 * server serves both entry points, and popup/main.tsx renders ApprovalApp
 * whenever a requestId is present in the query string.
 */
export function approvalUrl(params: {
  requestId: string;
  dappName?: string;
  origin?: string;
  description?: string;
}): string {
  const search = new URLSearchParams({ route: 'grant-access', requestId: params.requestId });
  if (params.dappName) search.set('dappName', params.dappName);
  if (params.origin) search.set('origin', params.origin);
  if (params.description) search.set('description', params.description);
  return `/src/popup/index.html?${search.toString()}`;
}
