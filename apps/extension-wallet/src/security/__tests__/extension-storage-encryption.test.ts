import '../../../../../packages/ensure-webcrypto';
import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EncryptedPayload } from '@ancore/core-sdk';

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
});

if (!globalThis.btoa) {
  globalThis.btoa = (value: string) => Buffer.from(value, 'binary').toString('base64');
}

if (!globalThis.atob) {
  globalThis.atob = (value: string) => Buffer.from(value, 'base64').toString('binary');
}

interface MockChromeArea {
  store: Record<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  getBytesInUse: ReturnType<typeof vi.fn>;
  QUOTA_BYTES: number;
}

function createMockChromeStorage(): {
  area: MockChromeArea;
  getRawStore: () => Record<string, unknown>;
} {
  const store: Record<string, unknown> = {};

  const area: MockChromeArea = {
    store,
    get: vi.fn((key: string, cb: (r: Record<string, unknown>) => void) => {
      cb({ [key]: store[key] });
    }),
    set: vi.fn((items: Record<string, unknown>, cb: () => void) => {
      Object.assign(store, items);
      cb();
    }),
    remove: vi.fn((key: string, cb: () => void) => {
      delete store[key];
      cb();
    }),
    getBytesInUse: vi.fn((_: null, cb: (n: number) => void) => cb(0)),
    QUOTA_BYTES: 5242880,
  };

  (globalThis as any).chrome = { runtime: { lastError: undefined } };

  return {
    area,
    getRawStore: () => store,
  };
}

describe('Extension storage encryption audit', () => {
  let mockStorage: { area: MockChromeArea; getRawStore: () => Record<string, unknown> };
  let ChromeStorageAdapter: typeof import('@ancore/core-sdk').ChromeStorageAdapter;
  let SecureStorageManager: typeof import('@ancore/core-sdk').SecureStorageManager;

  const password = 'integration-test-password';
  const plaintext = { privateKey: 'my-secret-private-key-12345' };

  beforeEach(async () => {
    mockStorage = createMockChromeStorage();
    const sdk = await import('@ancore/core-sdk');
    ChromeStorageAdapter = sdk.ChromeStorageAdapter;
    SecureStorageManager = sdk.SecureStorageManager;
  });

  it('never stores plaintext secrets in chrome.storage.local', async () => {
    const adapter = new ChromeStorageAdapter(
      mockStorage.area as unknown as chrome.storage.StorageArea
    );
    const manager = new SecureStorageManager(adapter);

    await manager.unlock(password);
    await manager.saveAccount(plaintext);

    const rawStore = mockStorage.getRawStore();
    const rawValue = JSON.stringify(rawStore);

    expect(rawValue).not.toContain(plaintext.privateKey);
    expect(rawValue).not.toContain('my-secret-private-key');

    const stored = rawStore['account'] as EncryptedPayload | undefined;
    expect(stored).toBeDefined();
    expect(stored).toHaveProperty('salt');
    expect(stored).toHaveProperty('iv');
    expect(stored).toHaveProperty('data');
  });
});
