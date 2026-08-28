/**
 * chrome-compat.test.ts
 *
 * Smoke tests for the storage adapter selection logic.
 * Validates that createStorageAdapter() wires up the correct adapter
 * (Chrome, Firefox/browser, or localStorage fallback) based on the
 * available runtime globals, and that the SecureStorageManager works
 * end-to-end with both the Chrome and Firefox adapter mocks.
 */

import { webcrypto } from 'crypto';

if (!globalThis.crypto) {
  // @ts-expect-error - Polyfill for Node.js test environment
  globalThis.crypto = webcrypto;
}
if (!globalThis.btoa) {
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}
if (!globalThis.atob) {
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

import {
  ChromeStorageAdapter,
  BrowserStorageAdapter,
  LocalStorageAdapter,
  createStorageAdapter,
} from '../storage-adapter';
import { SecureStorageManager } from '../secure-storage-manager';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeChromeStorageArea(store: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string, cb: (r: Record<string, unknown>) => void) => {
      cb({ [key]: store[key] });
    }),
    set: jest.fn((items: Record<string, unknown>, cb: () => void) => {
      Object.assign(store, items);
      cb();
    }),
    remove: jest.fn((key: string, cb: () => void) => {
      delete store[key];
      cb();
    }),
    getBytesInUse: jest.fn((_: null, cb: (n: number) => void) => cb(0)),
    QUOTA_BYTES: 5242880,
  };
}

function makeBrowserStorageArea(store: Record<string, unknown> = {}) {
  return {
    get: jest.fn(async (key: string) => ({ [key]: store[key] })),
    set: jest.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    }),
    remove: jest.fn(async (key: string) => {
      delete store[key];
    }),
  };
}

function installMemoryLocalStorage(): void {
  const data = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    get length() {
      return data.size;
    },
    clear(): void {
      data.clear();
    },
    getItem(key: string): string | null {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    key(index: number): string | null {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      data.delete(key);
    },
    setItem(key: string, value: string): void {
      data.set(key, value);
    },
  } as Storage;
}

// ─── createStorageAdapter selection ──────────────────────────────────────────

describe('createStorageAdapter — runtime adapter selection', () => {
  let savedChrome: unknown;
  let savedBrowser: unknown;

  beforeEach(() => {
    savedChrome = (globalThis as Record<string, unknown>).chrome;
    savedBrowser = (globalThis as Record<string, unknown>).browser;
    delete (globalThis as Record<string, unknown>).chrome;
    delete (globalThis as Record<string, unknown>).browser;
    installMemoryLocalStorage();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).chrome = savedChrome;
    (globalThis as Record<string, unknown>).browser = savedBrowser;
  });

  it('returns LocalStorageAdapter when neither chrome nor browser globals are present', () => {
    const adapter = createStorageAdapter();
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });

  it('returns ChromeStorageAdapter when chrome.storage.local is available', () => {
    (globalThis as Record<string, unknown>).chrome = {
      storage: { local: makeChromeStorageArea() },
      runtime: { lastError: undefined },
    };

    const adapter = createStorageAdapter();
    expect(adapter).toBeInstanceOf(ChromeStorageAdapter);
  });

  it('returns BrowserStorageAdapter when browser.storage.local is available (Firefox)', () => {
    (globalThis as Record<string, unknown>).browser = {
      storage: { local: makeBrowserStorageArea() },
    };

    const adapter = createStorageAdapter();
    expect(adapter).toBeInstanceOf(BrowserStorageAdapter);
  });

  it('prefers BrowserStorageAdapter over ChromeStorageAdapter when both are present', () => {
    (globalThis as Record<string, unknown>).browser = {
      storage: { local: makeBrowserStorageArea() },
    };
    (globalThis as Record<string, unknown>).chrome = {
      storage: { local: makeChromeStorageArea() },
      runtime: { lastError: undefined },
    };

    const adapter = createStorageAdapter();
    // browser namespace (Firefox) takes precedence per createStorageAdapter() logic
    expect(adapter).toBeInstanceOf(BrowserStorageAdapter);
  });
});

// ─── SecureStorageManager + ChromeStorageAdapter ─────────────────────────────

describe('SecureStorageManager with ChromeStorageAdapter (Chrome smoke test)', () => {
  let area: ReturnType<typeof makeChromeStorageArea>;
  let adapter: ChromeStorageAdapter;
  let manager: SecureStorageManager;
  const password = 'chrome-test-password-123!';

  beforeEach(() => {
    area = makeChromeStorageArea();
    (globalThis as Record<string, unknown>).chrome = {
      storage: { local: area },
      runtime: { lastError: undefined },
    };
    adapter = new ChromeStorageAdapter(
      area as Parameters<typeof ChromeStorageAdapter.prototype.constructor>[0]
    );
    manager = new SecureStorageManager(adapter);
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).chrome;
  });

  it('unlocks successfully on first use (no existing vault)', async () => {
    const result = await manager.unlock(password);
    expect(result).toBe(true);
    expect(manager.isUnlocked).toBe(true);
  });

  it('saves and retrieves account data encrypted via Chrome storage', async () => {
    await manager.unlock(password);
    await manager.saveAccount({ privateKey: 'STEST_CHROME_KEY_ABCDEF' });

    // The raw stored value must NOT contain the plaintext private key
    const rawStored = area.set.mock.calls.find(
      ([items]: [Record<string, unknown>]) => 'account' in items
    );
    expect(rawStored).toBeDefined();
    const rawJson = JSON.stringify(rawStored![0]);
    expect(rawJson).not.toContain('STEST_CHROME_KEY_ABCDEF');

    // Re-unlock with a fresh manager instance to confirm round-trip
    manager.lock();
    const manager2 = new SecureStorageManager(adapter);
    await manager2.unlock(password);
    const account = await manager2.getAccount();
    expect(account?.privateKey).toBe('STEST_CHROME_KEY_ABCDEF');
  });

  it('lock() clears the in-memory key and subsequent reads throw', async () => {
    await manager.unlock(password);
    manager.lock();
    expect(manager.isUnlocked).toBe(false);
    await expect(manager.getAccount()).rejects.toThrow('Storage manager is locked');
  });

  it('hasVault() returns false before first unlock and true afterwards', async () => {
    expect(await manager.hasVault()).toBe(false);
    await manager.unlock(password);
    expect(await manager.hasVault()).toBe(true);
  });
});

// ─── SecureStorageManager + BrowserStorageAdapter ────────────────────────────

describe('SecureStorageManager with BrowserStorageAdapter (Firefox smoke test)', () => {
  let area: ReturnType<typeof makeBrowserStorageArea>;
  let adapter: BrowserStorageAdapter;
  let manager: SecureStorageManager;
  const password = 'firefox-test-password-456!';

  beforeEach(() => {
    area = makeBrowserStorageArea();
    (globalThis as Record<string, unknown>).browser = {
      storage: { local: area },
    };
    adapter = new BrowserStorageAdapter(
      area as Parameters<typeof BrowserStorageAdapter.prototype.constructor>[0]
    );
    manager = new SecureStorageManager(adapter);
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).browser;
  });

  it('unlocks successfully on first use (no existing vault)', async () => {
    const result = await manager.unlock(password);
    expect(result).toBe(true);
    expect(manager.isUnlocked).toBe(true);
  });

  it('saves and retrieves session keys encrypted via Firefox storage', async () => {
    await manager.unlock(password);
    await manager.saveSessionKeys({ keys: { sessionA: 'SECRET_KEY_FIREFOX' } });

    // Verify the raw stored data does not expose plaintext
    const rawCalls = area.set.mock.calls as Array<[Record<string, unknown>]>;
    const sessionKeyCall = rawCalls.find(([items]) => 'sessionKeys' in items);
    expect(sessionKeyCall).toBeDefined();
    expect(JSON.stringify(sessionKeyCall![0])).not.toContain('SECRET_KEY_FIREFOX');

    // Re-unlock with a fresh manager and verify decrypted round-trip
    manager.lock();
    const manager2 = new SecureStorageManager(adapter);
    await manager2.unlock(password);
    const sessionKeys = await manager2.getSessionKeys();
    expect(sessionKeys?.keys?.sessionA).toBe('SECRET_KEY_FIREFOX');
  });

  it('wrong password returns false and leaves manager locked', async () => {
    await manager.unlock(password);
    manager.lock();

    const manager2 = new SecureStorageManager(adapter);
    const result = await manager2.unlock('totally-wrong-password');
    expect(result).toBe(false);
    expect(manager2.isUnlocked).toBe(false);
  });

  it('lock() clears the in-memory key and subsequent reads throw', async () => {
    await manager.unlock(password);
    manager.lock();
    expect(manager.isUnlocked).toBe(false);
    await expect(manager.getAccount()).rejects.toThrow('Storage manager is locked');
  });
});

// ─── SecureStorageManager + LocalStorageAdapter (fallback) ───────────────────

describe('SecureStorageManager with LocalStorageAdapter (fallback / dev env)', () => {
  let manager: SecureStorageManager;
  const password = 'local-storage-password-789!';

  beforeEach(() => {
    installMemoryLocalStorage();
    globalThis.localStorage.clear();
    manager = new SecureStorageManager(new LocalStorageAdapter());
  });

  it('unlocks and saves/retrieves data via localStorage fallback', async () => {
    await manager.unlock(password);
    await manager.saveAccount({ privateKey: 'STEST_LOCAL_KEY' });

    manager.lock();
    const manager2 = new SecureStorageManager(new LocalStorageAdapter());
    await manager2.unlock(password);

    const account = await manager2.getAccount();
    expect(account?.privateKey).toBe('STEST_LOCAL_KEY');
  });
});
