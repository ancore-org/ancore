/**
 * Per-origin allowlist helpers for the Ancore wallet.
 *
 * Modeled on Freighter's allowlist pattern, adapted for smart accounts:
 * Freighter keys by (network, ownerPublicKey, origin);
 * Ancore keys by (network, smartAccountId, origin) because the user-visible
 * address is the contract C-address, not the G-key signer.
 *
 * Storage key: use allowlistStorageKey(network, smartAccountId) from networks.ts
 * to obtain the chrome.storage.local / AsyncStorage key, then serialize/parse
 * the list with serializeAllowlist / parseAllowlist.
 */

import type { StellarNetwork } from './networks';

/** A single origin grant record stored in the allowlist. */
export interface AllowlistEntry {
  /** dApp origin, e.g. "https://app.example.com". Must be normalized (no trailing slash). */
  origin: string;
  /** Unix timestamp (ms) when the user granted access. */
  grantedAt: number;
  /** Stellar network this grant applies to. */
  network: StellarNetwork;
  /** Soroban smart account contract ID (C-address) that granted access. */
  smartAccountId: string;
}

/**
 * Parse a serialized allowlist JSON string into typed entries.
 * Returns an empty array when the raw value is absent, empty, or malformed —
 * this matches the "first visit" case where storage returns null/undefined.
 */
export function parseAllowlist(raw: string | null | undefined): AllowlistEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

/**
 * Serialize allowlist entries to a JSON string for storage.
 */
export function serializeAllowlist(entries: AllowlistEntry[]): string {
  return JSON.stringify(entries);
}

/**
 * Check whether a given origin has an active grant for the specified network.
 * Returns true only when an exact-match entry exists.
 */
export function isOriginAllowed(
  entries: AllowlistEntry[],
  origin: string,
  network: StellarNetwork
): boolean {
  return entries.some((e) => e.origin === origin && e.network === network);
}

/**
 * Add a new entry to the allowlist. If an entry for the same
 * (origin, network, smartAccountId) triple already exists, it is replaced
 * so that grantedAt reflects the most recent grant.
 */
export function addOriginToAllowlist(
  entries: AllowlistEntry[],
  entry: AllowlistEntry
): AllowlistEntry[] {
  const filtered = entries.filter(
    (e) =>
      !(
        e.origin === entry.origin &&
        e.network === entry.network &&
        e.smartAccountId === entry.smartAccountId
      )
  );
  return [...filtered, entry];
}

/**
 * Remove all entries matching the given origin (across all networks and
 * smartAccountIds). Use the narrower addOriginToAllowlist replace-pattern
 * if you need per-network or per-account removal.
 */
export function removeOriginFromAllowlist(
  entries: AllowlistEntry[],
  origin: string
): AllowlistEntry[] {
  return entries.filter((e) => e.origin !== origin);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isValidEntry(value: unknown): value is AllowlistEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<AllowlistEntry>;
  return (
    typeof e.origin === 'string' &&
    typeof e.grantedAt === 'number' &&
    typeof e.network === 'string' &&
    typeof e.smartAccountId === 'string'
  );
}
