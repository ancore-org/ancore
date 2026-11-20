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
  mainnet: 'https://soroban-mainnet.stellar.org',
  testnet: 'https://soroban-testnet.stellar.org',
  futurenet: 'https://rpc-futurenet.stellar.org',
  local: 'http://localhost:8000/soroban/rpc',
};

export interface NetworkConfig {
  name: StellarNetwork;
  passphrase: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
}

export const NETWORK_CONFIGS: Record<StellarNetwork, NetworkConfig> = {
  mainnet: {
    name: 'mainnet',
    passphrase: NETWORK_PASSPHRASES.mainnet,
    horizonUrl: DEFAULT_HORIZON_URLS.mainnet,
    sorobanRpcUrl: DEFAULT_SOROBAN_RPC_URLS.mainnet,
  },
  testnet: {
    name: 'testnet',
    passphrase: NETWORK_PASSPHRASES.testnet,
    horizonUrl: DEFAULT_HORIZON_URLS.testnet,
    sorobanRpcUrl: DEFAULT_SOROBAN_RPC_URLS.testnet,
  },
  futurenet: {
    name: 'futurenet',
    passphrase: NETWORK_PASSPHRASES.futurenet,
    horizonUrl: DEFAULT_HORIZON_URLS.futurenet,
    sorobanRpcUrl: DEFAULT_SOROBAN_RPC_URLS.futurenet,
  },
  local: {
    name: 'local',
    passphrase: NETWORK_PASSPHRASES.local,
    horizonUrl: DEFAULT_HORIZON_URLS.local,
    sorobanRpcUrl: DEFAULT_SOROBAN_RPC_URLS.local,
  },
};

/**
 * Returns the canonical NetworkConfig object for a given network identifier.
 * Throws an Error if the network is unknown.
 */
export function getNetworkConfig(network: StellarNetwork): NetworkConfig {
  const config = NETWORK_CONFIGS[network];
  if (!config) {
    throw new Error(`Unknown network: ${network}`);
  }
  return config;
}

/**
 * Resolves a network service endpoint URL (Horizon or Soroban RPC),
 * returning the override URL if provided, otherwise the canonical default.
 */
export function resolveNetworkEndpoint(
  network: StellarNetwork,
  service: 'horizon' | 'rpc',
  overrideUrl?: string
): string {
  if (overrideUrl && overrideUrl.trim()) {
    return overrideUrl.trim();
  }
  const config = getNetworkConfig(network);
  return service === 'horizon' ? config.horizonUrl : config.sorobanRpcUrl;
}

/** chrome.storage.local key prefix for per-origin allowlist entries. */
export function allowlistStorageKey(network: StellarNetwork, smartAccountId: string): string {
  return `ancore_allowlist_${network}_${smartAccountId}`;
}
