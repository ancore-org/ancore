/**
 * Allowlist Service
 *
 * Manages per-origin allowlist for dApp access.
 * Delegated to the Zustand allowlist store.
 */

import { useAllowlistStore } from '../../../stores/allowlist';

async function ensureRehydrated() {
  if (!useAllowlistStore.persist.hasHydrated()) {
    await useAllowlistStore.persist.rehydrate();
  }
}

/**
 * Check if an origin is allowed for a given network and smart account.
 */
export async function isAllowed(
  network: string,
  smartAccountId: string,
  origin: string
): Promise<boolean> {
  await ensureRehydrated();
  return useAllowlistStore.getState().isApproved(origin, smartAccountId, network);
}

/**
 * Add an origin to the allowlist.
 */
export async function addToAllowlist(
  network: string,
  smartAccountId: string,
  origin: string
): Promise<void> {
  await ensureRehydrated();
  useAllowlistStore.getState().approve(origin, smartAccountId, network);
}

/**
 * Remove an origin from the allowlist.
 */
export async function removeFromAllowlist(
  network: string,
  smartAccountId: string,
  origin: string
): Promise<void> {
  await ensureRehydrated();
  useAllowlistStore.getState().revoke(origin, smartAccountId, network);
}

/**
 * Get all allowed origins for a given network and smart account.
 */
export async function getAllowedOrigins(
  network: string,
  smartAccountId: string
): Promise<string[]> {
  await ensureRehydrated();
  return useAllowlistStore.getState().getApprovedList(smartAccountId, network);
}

/**
 * Clear all allowlist entries (for testing or reset).
 */
export async function clearAllowlist(): Promise<void> {
  useAllowlistStore.setState({ approvedSites: {} });
}
