/** Stellar network ids — aligned with @ancore/types Network. */
export type StellarNetwork = 'testnet' | 'mainnet' | 'futurenet' | 'local';

/** Stellar network passphrases — keep in sync with @ancore/types / extension settings. */
export const NETWORK_PASSPHRASES: Record<StellarNetwork, string> = {
  mainnet: 'Public Global Stellar Network ; September 2015',
  testnet: 'Test SDF Network ; September 2015',
  futurenet: 'Test SDF Future Network ; October 2022',
  local: 'Standalone Network ; February 2017',
};

export const DEFAULT_HORIZON_URLS: Record<StellarNetwork, string> = {
  mainnet: 'https://horizon.stellar.org',
  testnet: 'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
  local: 'http://localhost:8000',
};

export const DEFAULT_SOROBAN_RPC_URLS: Record<StellarNetwork, string> = {
  mainnet: 'https://soroban-rpc.mainnet.stellar.gateway.dev',
  testnet: 'https://soroban-testnet.stellar.org',
  futurenet: 'https://rpc-futurenet.stellar.org',
  local: 'http://localhost:8000/soroban/rpc',
};

/** chrome.storage.local key prefix for per-origin allowlist entries. */
export function allowlistStorageKey(network: StellarNetwork, smartAccountId: string): string {
  return `ancore_allowlist_${network}_${smartAccountId}`;
}
