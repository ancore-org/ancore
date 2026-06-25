/**
 * Allowlist Service
 *
 * Manages per-origin allowlist for dApp access.
 * Keyed by (network, smartAccountId, origin) tuple.
 */

import type { AllowlistEntry } from '@ancore/types';

const ALLOWLIST_STORAGE_KEY = 'ancore_allowlist';

/**
 * Storage interface for allowlist persistence.
 * Abstracted to support both chrome.storage and localStorage.
 */
interface Storage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

/**
 * Chrome storage implementation.
 */
class ChromeStorage implements Storage {
  async get(key: string): Promise<unknown> {
    return new Promise((resolve) => {
      const chromeRef = (globalThis as { chrome?: any }).chrome;
      if (chromeRef?.storage?.local) {
        chromeRef.storage.local.get(key, (result: Record<string, unknown>) => {
          resolve(result[key] ?? null);
        });
      } else {
        resolve(localStorage.getItem(key));
      }
    });
  }

  async set(key: string, value: unknown): Promise<void> {
    return new Promise((resolve) => {
      const chromeRef = (globalThis as { chrome?: any }).chrome;
      if (chromeRef?.storage?.local) {
        chromeRef.storage.local.set({ [key]: value }, resolve);
      } else {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        resolve();
      }
    });
  }
}

const storage = new ChromeStorage();

/**
 * Generate a unique key for an allowlist entry.
 */
function generateKey(network: string, smartAccountId: string, origin: string): string {
  return `${network}:${smartAccountId}:${origin}`;
}

/**
 * Load all allowlist entries from storage.
 */
async function loadAllowlist(): Promise<Map<string, AllowlistEntry>> {
  try {
    const raw = await storage.get(ALLOWLIST_STORAGE_KEY);
    if (!raw || typeof raw !== 'string') {
      return new Map();
    }
    const entries = JSON.parse(raw) as AllowlistEntry[];
    const map = new Map<string, AllowlistEntry>();
    for (const entry of entries) {
      const _key = generateKey(entry.network, entry.smartAccountId, entry.origin);
      map.set(_key, entry);
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Save all allowlist entries to storage.
 */
async function saveAllowlist(map: Map<string, AllowlistEntry>): Promise<void> {
  const entries = Array.from(map.values());
  await storage.set(ALLOWLIST_STORAGE_KEY, JSON.stringify(entries));
}

/**
 * Check if an origin is allowed for a given network and smart account.
 */
export async function isAllowed(
  network: string,
  smartAccountId: string,
  origin: string
): Promise<boolean> {
  const allowlist = await loadAllowlist();
  const key = generateKey(network, smartAccountId, origin);
  return allowlist.has(key);
}

/**
 * Add an origin to the allowlist.
 */
export async function addToAllowlist(
  network: string,
  smartAccountId: string,
  origin: string
): Promise<void> {
  const allowlist = await loadAllowlist();
  const key = generateKey(network, smartAccountId, origin);
  const entry: AllowlistEntry = {
    network,
    smartAccountId,
    origin,
    approvedAt: Date.now(),
  };
  allowlist.set(key, entry);
  await saveAllowlist(allowlist);
}

/**
 * Remove an origin from the allowlist.
 */
export async function removeFromAllowlist(
  network: string,
  smartAccountId: string,
  origin: string
): Promise<void> {
  const allowlist = await loadAllowlist();
  const key = generateKey(network, smartAccountId, origin);
  allowlist.delete(key);
  await saveAllowlist(allowlist);
}

/**
 * Get all allowed origins for a given network and smart account.
 */
export async function getAllowedOrigins(
  network: string,
  smartAccountId: string
): Promise<string[]> {
  const allowlist = await loadAllowlist();
  const origins: string[] = [];
  for (const [_key, entry] of allowlist.entries()) {
    if (entry.network === network && entry.smartAccountId === smartAccountId) {
      origins.push(entry.origin);
    }
  }
  return origins;
}

/**
 * Clear all allowlist entries (for testing or reset).
 */
export async function clearAllowlist(): Promise<void> {
  await storage.set(ALLOWLIST_STORAGE_KEY, null);
}
