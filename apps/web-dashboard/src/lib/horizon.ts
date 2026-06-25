/**
 * Horizon client for fetching Stellar account information.
 *
 * This module provides a thin wrapper around Horizon REST API
 * for account balance queries, keeping network interactions simple
 * and independent of indexer work.
 */

const HORIZON_URL = import.meta.env.VITE_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

export interface HorizonAccountData {
  id: string;
  account_id: string;
  balances: Array<{
    balance: string;
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
  sequence: string;
  subentry_count: number;
  home_domain?: string;
  last_modified_ledger: number;
  last_modified_time: string;
}

/**
 * Fetch the native balance (XLM) for a Stellar account.
 *
 * @param publicKey The Stellar account public key
 * @returns The native balance as a number
 * @throws Error if the account is not found or network request fails
 */
export async function fetchAccountBalance(publicKey: string): Promise<number> {
  const url = `${HORIZON_URL}/accounts/${publicKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Account not found: ${publicKey}`);
    }
    throw new Error(`Horizon error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as HorizonAccountData;
  const nativeBalance = data.balances.find((b) => b.asset_type === 'native');

  if (!nativeBalance) {
    throw new Error('No native balance found for account');
  }

  return Number(nativeBalance.balance);
}

/**
 * Fetch full account data from Horizon.
 *
 * @param publicKey The Stellar account public key
 * @returns The full account data from Horizon
 * @throws Error if the account is not found or network request fails
 */
export async function fetchAccountData(publicKey: string): Promise<HorizonAccountData> {
  const url = `${HORIZON_URL}/accounts/${publicKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Account not found: ${publicKey}`);
    }
    throw new Error(`Horizon error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as HorizonAccountData;
}

/**
 * Get the currently configured Horizon URL.
 *
 * @returns The Horizon URL being used
 */
export function getHorizonUrl(): string {
  return HORIZON_URL;
}
