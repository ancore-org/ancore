/**
 * Supported Ancore network types.
 */
export type AncoreNetwork = 'testnet' | 'mainnet' | 'futurenet';

/**
 * Network profile with Stellar integration details.
 */
export interface NetworkProfile {
  /** Stellar network passphrase for transactions */
  networkPassphrase: string;

  /** Horizon API endpoint for transaction submission */
  horizonUrl: string;

  /** Soroban RPC endpoint for contract interactions */
  sorobanRpcUrl: string;

  /** Network description for UI display */
  description: string;
}

/**
 * Network profiles mapping network IDs to Stellar configuration.
 */
export const NETWORK_PROFILES: Record<AncoreNetwork, NetworkProfile> = {
  testnet: {
    networkPassphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    description: 'Testnet - for development and testing',
  },
  mainnet: {
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://soroban-mainnet.stellar.org',
    description: 'Mainnet - production network',
  },
  futurenet: {
    networkPassphrase: 'Test SDF Future Network ; October 2022',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    sorobanRpcUrl: 'https://soroban-futurenet.stellar.org',
    description: 'Futurenet - for testing new Stellar features',
  },
};

/**
 * Type guard to check if a string is a valid AncoreNetwork.
 */
export function isAncoreNetwork(value: unknown): value is AncoreNetwork {
  if (typeof value !== 'string') return false;
  return value === 'testnet' || value === 'mainnet' || value === 'futurenet';
}

/**
 * Get network profile by network ID.
 * @throws Error if network ID is invalid
 */
export function getNetworkProfile(network: AncoreNetwork): NetworkProfile {
  const profile = NETWORK_PROFILES[network];
  if (!profile) {
    throw new Error(`Invalid network: ${network}`);
  }
  return profile;
}

/**
 * Validate network string and return typed network ID.
 */
export function validateNetwork(value: string): AncoreNetwork {
  if (!isAncoreNetwork(value)) {
    throw new Error(
      `Invalid network "${value}". Must be one of: ${Object.keys(NETWORK_PROFILES).join(', ')}`
    );
  }
  return value;
}
