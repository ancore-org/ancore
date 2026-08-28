/**
 * Integration test: WebExtension storage encryption
 *
 * Threat Model Reference:
 * This test verifies that plaintext-at-rest is the threat being mitigated.
 * In browser extension environments, chrome.storage.local persists data to disk.
 * If an attacker gains access to the stored data (via XSS, physical access,
 * or browser vulnerabilities), encrypted payloads protect sensitive user data
 * (private keys, session tokens, account data) from exposure.
 * See: packages/crypto/src/CRYPTO_ASSUMPTIONS.md for encryption assumptions.
 */

import { webcrypto } from 'crypto';
import type { EncryptedPayload, StorageAdapter, AccountData } from '../types';

if (!globalThis.crypto) {
  // @ts-expect-error - Polyfill for Node.js environment
  globalThis.crypto = webcrypto;
}
if (!globalThis.btoa) {
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}
if (!globalThis.atob) {
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

// ─── Mock chrome.storage.local ───────────────────────────────────────────────────

interface MockChromeArea {
  store: Record<string, unknown>;
  get: jest.Mock;
  set: jest.Mock;
  remove: jest.Mock;
  getBytesInUse: jest.Mock;
  QUOTA_BYTES: number;
}

function createMockChromeStorage(): {
  area: MockChromeArea;
  getRawStore: () => Record<string, unknown>;
} {
  const store: Record<string, unknown> = {};

  const area: MockChromeArea = {
    store,
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

  // Simulate chrome.runtime.lastError being undefined (no error)
  (globalThis as any).chrome = { runtime: { lastError: undefined } };

  return {
    area,
    getRawStore: () => store,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────────

describe('WebExtension storage encryption integration', () => {
  let mockStorage: {
    area: MockChromeArea;
    getRawStore: () => Record<string, unknown>;
  };
  let adapter: StorageAdapter;
  let SecureStorageManager: typeof import('../secure-storage-manager').SecureStorageManager;

  const password = 'integration-test-password';
  const plaintext: AccountData = { privateKey: 'my-secret-private-key-12345' };

  beforeEach(async () => {
    mockStorage = createMockChromeStorage();

    const { ChromeStorageAdapter } = await import('../storage-adapter');
    adapter = new ChromeStorageAdapter(mockStorage.area as unknown as chrome.storage.StorageArea);
  });

  it('never stores plaintext in chrome.storage.local under any key', async () => {
    const { SecureStorageManager: SSM } = await import('../secure-storage-manager');
    SecureStorageManager = SSM;
    const manager = new SecureStorageManager(adapter);

    await manager.unlock(password);
    await manager.saveAccount(plaintext);

    const rawStore = mockStorage.getRawStore();
    const rawValue = JSON.stringify(rawStore);

    // Plaintext should never appear in raw storage
    expect(rawValue).not.toContain(plaintext.privateKey);
    expect(rawValue).not.toContain('my-secret-private-key');

    // Stored value must have encrypted payload structure
    const stored = rawStore['account'] as EncryptedPayload | undefined;
    expect(stored).toBeDefined();
    expect(stored).toHaveProperty('salt');
    expect(stored).toHaveProperty('iv');
    expect(stored).toHaveProperty('data');
  });

  it('decrypt round-trip recovers the original plaintext', async () => {
    const { SecureStorageManager: SSM } = await import('../secure-storage-manager');
    SecureStorageManager = SSM;
    const manager = new SecureStorageManager(adapter);

    await manager.unlock(password);
    await manager.saveAccount(plaintext);

    manager.lock();
    const newManager = new SecureStorageManager(adapter);
    await newManager.unlock(password);

    const restored = await newManager.getAccount();

    expect(restored).toEqual(plaintext);
  });

  it('handles multiple encrypted items independently', async () => {
    const sessionData = { keys: { session1: 'secret-session-key' } };
    const { SecureStorageManager: SSM } = await import('../secure-storage-manager');
    SecureStorageManager = SSM;
    const manager = new SecureStorageManager(adapter);

    await manager.unlock(password);
    await manager.saveAccount(plaintext);
    await manager.saveSessionKeys(sessionData);

    const rawStore = mockStorage.getRawStore();
    const rawValue = JSON.stringify(rawStore);

    // Neither plaintext should appear
    expect(rawValue).not.toContain(plaintext.privateKey);
    expect(rawValue).not.toContain('secret-session-key');

    // Both keys should have encrypted structure
    const accountStored = rawStore['account'] as EncryptedPayload | undefined;
    const sessionStored = rawStore['sessionKeys'] as EncryptedPayload | undefined;

    expect(accountStored).toHaveProperty('salt');
    expect(accountStored).toHaveProperty('iv');
    expect(accountStored).toHaveProperty('data');

    expect(sessionStored).toHaveProperty('salt');
    expect(sessionStored).toHaveProperty('iv');
    expect(sessionStored).toHaveProperty('data');
  });
});
