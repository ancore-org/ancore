import { StorageKey, WalletStateSchema } from '../wallet';
import { isWalletState } from '../guards';

describe('WalletState', () => {
  describe('WalletStateSchema', () => {
    test('parses uninitialized state', () => {
      const state = 'uninitialized';
      const parsed = WalletStateSchema.parse(state);
      expect(parsed).toBe('uninitialized');
    });

    test('parses locked state', () => {
      const state = 'locked';
      const parsed = WalletStateSchema.parse(state);
      expect(parsed).toBe('locked');
    });

    test('parses unlocked state', () => {
      const state = 'unlocked';
      const parsed = WalletStateSchema.parse(state);
      expect(parsed).toBe('unlocked');
    });

    test('rejects invalid state', () => {
      const state = 'invalid';
      expect(() => WalletStateSchema.parse(state)).toThrow();
    });

    test('rejects non-string state', () => {
      expect(() => WalletStateSchema.parse(123)).toThrow();
      expect(() => WalletStateSchema.parse(null)).toThrow();
      expect(() => WalletStateSchema.parse(undefined)).toThrow();
    });
  });

  describe('isWalletState', () => {
    test('returns true for uninitialized', () => {
      expect(isWalletState('uninitialized')).toBe(true);
    });

    test('returns true for locked', () => {
      expect(isWalletState('locked')).toBe(true);
    });

    test('returns true for unlocked', () => {
      expect(isWalletState('unlocked')).toBe(true);
    });

    test('returns false for invalid state', () => {
      expect(isWalletState('invalid')).toBe(false);
      expect(isWalletState('pending')).toBe(false);
      expect(isWalletState('active')).toBe(false);
    });

    test('returns false for non-string values', () => {
      expect(isWalletState(null)).toBe(false);
      expect(isWalletState(undefined)).toBe(false);
      expect(isWalletState(123)).toBe(false);
      expect(isWalletState({})).toBe(false);
      expect(isWalletState([])).toBe(false);
    });
  });
});

describe('StorageKey', () => {
  describe('enum values', () => {
    test('has all required core wallet keys', () => {
      expect(StorageKey.WALLET_STATE).toBe('walletState');
      expect(StorageKey.ACCOUNTS).toBe('accounts');
      expect(StorageKey.CURRENT_ACCOUNT_ID).toBe('currentAccountId');
    });

    test('has all required session and security keys', () => {
      expect(StorageKey.SESSION_KEYS).toBe('sessionKeys');
      expect(StorageKey.SETTINGS).toBe('settings');
      expect(StorageKey.PASSWORD_HASH).toBe('passwordHash');
    });

    test('has all required transaction history keys', () => {
      expect(StorageKey.TRANSACTIONS).toBe('transactions');
      expect(StorageKey.PENDING_OPERATIONS).toBe('pendingOperations');
    });

    test('has network configuration key', () => {
      expect(StorageKey.NETWORK).toBe('network');
    });

    test('all keys are unique strings', () => {
      const values = Object.values(StorageKey);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
      expect(values.every((v) => typeof v === 'string')).toBe(true);
    });
  });

  describe('usage patterns', () => {
    test('can be used as object keys', () => {
      const storage: Record<string, unknown> = {};
      storage[StorageKey.WALLET_STATE] = 'locked';
      storage[StorageKey.ACCOUNTS] = [];
      storage[StorageKey.SESSION_KEYS] = {};

      expect(storage[StorageKey.WALLET_STATE]).toBe('locked');
      expect(Array.isArray(storage[StorageKey.ACCOUNTS])).toBe(true);
      expect(typeof storage[StorageKey.SESSION_KEYS]).toBe('object');
    });

    test('can be iterated', () => {
      const keys = Object.values(StorageKey);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.every((k) => typeof k === 'string')).toBe(true);
    });
  });

  describe('type safety', () => {
    test('prevents typos in storage access', () => {
      // This test verifies that the enum provides type safety
      const key: StorageKey = StorageKey.ACCOUNTS;
      expect(typeof key).toBe('string');

      // Accessing with invalid key should be caught by TypeScript
      // @ts-expect-error - Testing that invalid keys are caught
      const invalid: StorageKey = 'invalidKey';
      expect(invalid).toBe('invalidKey');
    });
  });
});
