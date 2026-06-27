/**
 * Unit tests for allowlist service
 */

import {
  isAllowed,
  addToAllowlist,
  removeFromAllowlist,
  getAllowedOrigins,
  clearAllowlist,
} from '../allowlist';
import { useAllowlistStore } from '../../../../stores/allowlist';

// Mock chrome storage
const mockStorage = new Map<string, unknown>();

(globalThis as any).chrome = {
  storage: {
    local: {
      get: (key: string, callback: (result: Record<string, unknown>) => void) => {
        callback({ [key]: mockStorage.get(key) ?? null });
      },
      set: (items: Record<string, unknown>, callback?: () => void) => {
        for (const [key, value] of Object.entries(items)) {
          mockStorage.set(key, value);
        }
        callback?.();
      },
    },
  },
};

describe('allowlist service', () => {
  beforeEach(async () => {
    mockStorage.clear();
    useAllowlistStore.setState({ approvedSites: {} });
    await clearAllowlist();
  });

  describe('isAllowed', () => {
    it('returns false for non-existent entry', async () => {
      const result = await isAllowed('testnet', 'CAAAA...', 'https://example.com');
      expect(result).toBe(false);
    });

    it('returns true for existing entry', async () => {
      await addToAllowlist('testnet', 'CAAAA...', 'https://example.com');
      const result = await isAllowed('testnet', 'CAAAA...', 'https://example.com');
      expect(result).toBe(true);
    });

    it('returns false for different network', async () => {
      await addToAllowlist('testnet', 'CAAAA...', 'https://example.com');
      const result = await isAllowed('mainnet', 'CAAAA...', 'https://example.com');
      expect(result).toBe(false);
    });

    it('returns false for different smart account', async () => {
      await addToAllowlist('testnet', 'CAAAA...', 'https://example.com');
      const result = await isAllowed('testnet', 'CBBBB...', 'https://example.com');
      expect(result).toBe(false);
    });

    it('returns false for different origin', async () => {
      await addToAllowlist('testnet', 'CAAAA...', 'https://example.com');
      const result = await isAllowed('testnet', 'CAAAA...', 'https://other.com');
      expect(result).toBe(false);
    });
  });

  describe('addToAllowlist', () => {
    it('adds a new entry', async () => {
      await addToAllowlist('testnet', 'CAAAA...', 'https://example.com');
      const result = await isAllowed('testnet', 'CAAAA...', 'https://example.com');
      expect(result).toBe(true);
    });

    it('allows multiple entries for different origins', async () => {
      await addToAllowlist('testnet', 'CAAAA...', 'https://example.com');
      await addToAllowlist('testnet', 'CAAAA...', 'https://other.com');

      const result1 = await isAllowed('testnet', 'CAAAA...', 'https://example.com');
      const result2 = await isAllowed('testnet', 'CAAAA...', 'https://other.com');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('removeFromAllowlist', () => {
    it('removes an existing entry', async () => {
      await addToAllowlist('testnet', 'CAAAA...', 'https://example.com');
      await removeFromAllowlist('testnet', 'CAAAA...', 'https://example.com');

      const result = await isAllowed('testnet', 'CAAAA...', 'https://example.com');
      expect(result).toBe(false);
    });

    it('handles removing non-existent entry', async () => {
      await expect(
        removeFromAllowlist('testnet', 'CAAAA...', 'https://example.com')
      ).resolves.not.toThrow();
    });
  });

  describe('getAllowedOrigins', () => {
    it('returns empty array for no entries', async () => {
      const result = await getAllowedOrigins('testnet', 'CAAAA...');
      expect(result).toEqual([]);
    });

    it('returns allowed origins for network and account', async () => {
      await addToAllowlist('testnet', 'CAAAA...', 'https://example.com');
      await addToAllowlist('testnet', 'CAAAA...', 'https://other.com');
      await addToAllowlist('mainnet', 'CAAAA...', 'https://example.com');

      const result = await getAllowedOrigins('testnet', 'CAAAA...');
      expect(result).toEqual(['https://example.com', 'https://other.com']);
    });

    it('filters by smart account', async () => {
      await addToAllowlist('testnet', 'CAAAA...', 'https://example.com');
      await addToAllowlist('testnet', 'CBBBB...', 'https://other.com');

      const result = await getAllowedOrigins('testnet', 'CAAAA...');
      expect(result).toEqual(['https://example.com']);
    });
  });

  describe('clearAllowlist', () => {
    it('clears all entries', async () => {
      await addToAllowlist('testnet', 'CAAAA...', 'https://example.com');
      await clearAllowlist();

      const result = await isAllowed('testnet', 'CAAAA...', 'https://example.com');
      expect(result).toBe(false);
    });
  });
});
