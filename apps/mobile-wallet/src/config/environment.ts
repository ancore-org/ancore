import type { Network, NetworkConfig } from '@ancore/types';

import { resolveServiceUrls, validateServiceUrls } from './urls';

const DEFAULT_TESTNET_RPC_URL = 'https://soroban-testnet.stellar.org';
const DEFAULT_TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const DEFAULT_MAINNET_RPC_URL = 'https://soroban-rpc.mainnet.stellar.gateway.fm';
const DEFAULT_MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
const DEFAULT_FUTURENET_RPC_URL = 'https://rpc-futurenet.stellar.org';
const DEFAULT_FUTURENET_PASSPHRASE = 'Test SDF Future Network ; October 2022';

export interface MobileWalletEnvironment extends NetworkConfig {
  accountContractId: string;
  appName: string;
  indexerUrl: string;
  relayerUrl: string;
  aiAgentUrl?: string;
  readOnlyAccountId?: string;
  readOnlyAccountAddress?: string;
  walletConnectProjectId?: string;
}

export type MobileWalletEnvSource = Record<string, string | undefined>;

export class MobileWalletEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MobileWalletEnvironmentError';
  }
}

const isNetwork = (network: string): network is Network => {
  return (
    network === 'testnet' || network === 'mainnet' || network === 'futurenet' || network === 'local'
  );
};

const defaultRpcUrlFor = (network: Network): string | undefined => {
  if (network === 'testnet') {
    return DEFAULT_TESTNET_RPC_URL;
  }

  if (network === 'mainnet') {
    return DEFAULT_MAINNET_RPC_URL;
  }

  if (network === 'futurenet') {
    return DEFAULT_FUTURENET_RPC_URL;
  }

  return undefined;
};

const defaultPassphraseFor = (network: Network): string | undefined => {
  if (network === 'testnet') {
    return DEFAULT_TESTNET_PASSPHRASE;
  }

  if (network === 'mainnet') {
    return DEFAULT_MAINNET_PASSPHRASE;
  }

  if (network === 'futurenet') {
    return DEFAULT_FUTURENET_PASSPHRASE;
  }

  return undefined;
};

export const loadMobileWalletEnvironment = (
  source: MobileWalletEnvSource
): MobileWalletEnvironment => {
  const rawNetwork = source.ANCORE_MOBILE_NETWORK ?? 'testnet';

  if (!isNetwork(rawNetwork)) {
    throw new MobileWalletEnvironmentError(
      `Unsupported ANCORE_MOBILE_NETWORK "${rawNetwork}". Expected testnet, mainnet, futurenet, or local.`
    );
  }

  const accountContractId = source.ANCORE_ACCOUNT_CONTRACT_ID?.trim();

  if (!accountContractId) {
    throw new MobileWalletEnvironmentError(
      'ANCORE_ACCOUNT_CONTRACT_ID is required to initialize the mobile wallet SDK client.'
    );
  }

  const nodeEnv = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
  const serviceUrls = resolveServiceUrls(source, rawNetwork, nodeEnv);

  const explicitIndexer =
    source.EXPO_PUBLIC_INDEXER_URL?.trim() || source.ANCORE_INDEXER_URL?.trim();
  if (!explicitIndexer && nodeEnv === 'development') {
    throw new MobileWalletEnvironmentError(
      'EXPO_PUBLIC_INDEXER_URL is required to initialize the mobile wallet SDK client.'
    );
  }

  const urlErrors = validateServiceUrls(serviceUrls);
  if (urlErrors.length > 0) {
    throw new MobileWalletEnvironmentError(urlErrors.join('; '));
  }

  return {
    accountContractId,
    appName: source.ANCORE_MOBILE_APP_NAME?.trim() || 'Ancore Mobile Wallet',
    network: rawNetwork,
    rpcUrl: source.ANCORE_MOBILE_RPC_URL?.trim() || defaultRpcUrlFor(rawNetwork),
    networkPassphrase:
      source.ANCORE_MOBILE_NETWORK_PASSPHRASE?.trim() || defaultPassphraseFor(rawNetwork),
    indexerUrl: serviceUrls.indexerUrl,
    relayerUrl: serviceUrls.relayerUrl,
    aiAgentUrl: serviceUrls.aiAgentUrl,
    readOnlyAccountId: source.ANCORE_MOBILE_READONLY_ACCOUNT_ID?.trim() || undefined,
    readOnlyAccountAddress: source.ANCORE_MOBILE_READONLY_ACCOUNT_ADDRESS?.trim() || undefined,
    walletConnectProjectId: source.WALLETCONNECT_PROJECT_ID?.trim() || undefined,
  };
};

/** Load environment from process.env (Expo / React Native host apps). */
export const loadMobileWalletEnvironmentFromEnv = (): MobileWalletEnvironment => {
  const source: MobileWalletEnvSource = {
    ANCORE_ACCOUNT_CONTRACT_ID: process.env.ANCORE_ACCOUNT_CONTRACT_ID,
    ANCORE_MOBILE_NETWORK: process.env.ANCORE_MOBILE_NETWORK,
    ANCORE_MOBILE_RPC_URL: process.env.ANCORE_MOBILE_RPC_URL,
    ANCORE_MOBILE_NETWORK_PASSPHRASE: process.env.ANCORE_MOBILE_NETWORK_PASSPHRASE,
    ANCORE_MOBILE_APP_NAME: process.env.ANCORE_MOBILE_APP_NAME,
    EXPO_PUBLIC_INDEXER_URL: process.env.EXPO_PUBLIC_INDEXER_URL,
    EXPO_PUBLIC_RELAYER_URL: process.env.EXPO_PUBLIC_RELAYER_URL,
    EXPO_PUBLIC_AI_AGENT_URL: process.env.EXPO_PUBLIC_AI_AGENT_URL,
    WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID,
  };

  return loadMobileWalletEnvironment(source);
};
